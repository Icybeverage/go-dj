import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Deck } from "../components/dj/Deck";
import { Mixer } from "../components/dj/Mixer";
import { CameraCard } from "../components/dj/CameraCard";
import { LandingPage } from "../components/dj/LandingPage";
import { SongLibrary } from "../components/dj/SongLibrary";
import { preloadedSongs, songs, SUPABASE_BUCKET } from "../data/songs";
import {
  OUTSIDE_LANDS_FESTIVAL,
  outsideLandsArtists,
} from "../data/outsidelandsArtists";
import { deckGroup } from "../features/dj/math";
import { api } from "../convexApi";
import { createCommandQueue } from "../services/convex/commands";

const TUTORIAL_STORAGE_KEY = "go-dj-tutorial-complete";
const SESSION_STORAGE_KEY = "go-dj-session-key";

function getSessionKey() {
  try {
    const current = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (current) return current;
    const next =
      globalThis.crypto?.randomUUID?.() ||
      `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(SESSION_STORAGE_KEY, next);
    return next;
  } catch {
    return `session-${Date.now()}`;
  }
}

export function App() {
  const [showLanding, setShowLanding] = useState(() => {
    try {
      return window.localStorage.getItem(TUTORIAL_STORAGE_KEY) !== "true";
    } catch {
      return true;
    }
  });
  const [decks, setDecks] = useState(preloadedSongs);
  const [autoPlaySignals, setAutoPlaySignals] = useState([0, 0]);
  const [syncStates, setSyncStates] = useState([false, false]);
  const [sessionKey] = useState(getSessionKey);
  const remoteTracks = useQuery(api.tracks.search, { limit: 100, sessionKey });
  const sessionState = useQuery(api.sessions.state, { sessionKey });
  const remoteFestivalArtists = useQuery(api.festivals.listArtists, {
    festival: OUTSIDE_LANDS_FESTIVAL,
    limit: 200,
  });
  const librarySongs = useMemo(() => {
    const normalized = (remoteTracks || [])
      .map((track) => {
        const filePath = track.storageUrl || track.filePath;
        if (!filePath) return null;
        const file = filePath.startsWith("http")
          ? track.fileName || decodeURIComponent(filePath.split("/").pop() || filePath)
          : track.fileName || filePath;
        return {
          ...track,
          file: track.storageId ? `convex:${track._id}` : file,
          url: filePath.startsWith("http")
            ? filePath
            : `${SUPABASE_BUCKET}/${encodeURIComponent(filePath)}`,
        };
      })
      .filter(Boolean);
    const byTrack = new Map(
      normalized.map((track) => [
        `${track.artist}`.toLowerCase() + "::" + `${track.title}`.toLowerCase(),
        track,
      ]),
    );
    songs.forEach((song) => {
      const key = `${song.artist}`.toLowerCase() + "::" + `${song.title}`.toLowerCase();
      if (!byTrack.has(key)) byTrack.set(key, song);
    });
    return [...byTrack.values()];
  }, [remoteTracks]);
  const libraryArtists = remoteFestivalArtists?.length
    ? remoteFestivalArtists
    : outsideLandsArtists;
  const ensureSession = useMutation(api.sessions.ensure);
  const enqueueMutation = useMutation(api.sessions.dispatch);
  const generateUploadUrl = useMutation(api.tracks.generateUploadUrl);
  const registerUpload = useMutation(api.tracks.registerUpload);
  const [uploadStatus, setUploadStatus] = useState("");
  const enqueue = useMemo(
    () =>
      createCommandQueue(enqueueMutation, {
        sessionKey,
        source: "web-dashboard",
      }),
    [enqueueMutation, sessionKey],
  );

  useEffect(() => {
    void ensureSession({ sessionKey, displayName: "Go DJ! web controller" });
  }, [ensureSession, sessionKey]);

  const enterDashboard = useCallback(() => {
    try {
      window.localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
    } catch {
      // The dashboard can still open when storage is unavailable.
    }
    setShowLanding(false);
  }, []);

  const loadSong = useCallback(
    (index, song) => {
      setDecks((current) =>
        current.map((item, deckIndex) =>
          deckIndex === index
            ? { ...song, name: `${song.artist} — ${song.title}` }
            : item,
        ),
      );
      void enqueue("loadTrack", {
        deck: index + 1,
        trackId: song._id,
        source: song.source || "preloaded",
        path: song.file,
        artist: song.artist,
        title: song.title,
        bpm: song.bpm,
        mixxx: {
          group: deckGroup(index + 1),
          action: "loadTrackByPath",
          path: song.file,
          requiresLibrarySelection: true,
        },
      });
    },
    [enqueue],
  );

  const playSong = useCallback(
    (index, song) => {
      loadSong(index, song);
      setAutoPlaySignals((current) =>
        current.map((value, deckIndex) =>
          deckIndex === index ? value + 1 : value,
        ),
      );
    },
    [loadSong],
  );

  const uploadTrack = useCallback(
    async (file) => {
      if (!file.type.startsWith("audio/")) {
        setUploadStatus("Choose an audio file.");
        return;
      }
      setUploadStatus("Uploading…");
      try {
        const uploadUrl = await generateUploadUrl({});
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        });
        if (!response.ok) throw new Error(`Upload failed (${response.status})`);
        const { storageId } = await response.json();
        const title = file.name.replace(/\.[^/.]+$/, "") || "Uploaded track";
        await registerUpload({
          sessionKey,
          storageId,
          title,
          artist: "Your upload",
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        });
        setUploadStatus("Uploaded — choose Deck A or B");
      } catch (error) {
        setUploadStatus(error instanceof Error ? error.message : "Upload failed");
      }
    },
    [generateUploadUrl, registerUpload, sessionKey],
  );

  const handleSyncChange = useCallback((deck, enabled) => {
    setSyncStates((current) => {
      if (!enabled)
        return current.map((value, index) =>
          index === deck - 1 ? false : value,
        );
      return current.map((_, index) => index === deck - 1);
    });
  }, []);

  if (showLanding) return <LandingPage onEnter={enterDashboard} />;

  return (
    <main className="app-shell">
      <div className="app-header">
        <div className="brand-lockup">
          <h1>Go DJ!</h1>
        </div>
      </div>
      <div className="app-grid">
        <aside className="camera-column">
          <CameraCard />
        </aside>
        <section className="player-card" aria-labelledby="player-title">
          <div className="player-head">
            <div>
              <span className="eyebrow">CONTROL SURFACE</span>
              <h2 id="player-title">Two-deck player</h2>
            </div>
            <span className="player-meta">
              A / B · KEYLOCK · {sessionState ? "SESSION READY" : "CONNECTING"}
            </span>
          </div>
          <div className="deck-grid">
            <Deck
              number={1}
              track={decks[0]}
              enqueue={enqueue}
              autoPlaySignal={autoPlaySignals[0]}
              syncEnabled={syncStates[0]}
              syncTargetBpm={syncStates[0] ? decks[1]?.bpm : null}
              onSyncChange={(enabled) => handleSyncChange(1, enabled)}
            />
            <Mixer enqueue={enqueue} />
            <Deck
              number={2}
              track={decks[1]}
              enqueue={enqueue}
              autoPlaySignal={autoPlaySignals[1]}
              syncEnabled={syncStates[1]}
              syncTargetBpm={syncStates[1] ? decks[0]?.bpm : null}
              onSyncChange={(enabled) => handleSyncChange(2, enabled)}
            />
          </div>
          <SongLibrary
            songs={librarySongs}
            festivalArtists={libraryArtists}
            onLoad={playSong}
            onUpload={uploadTrack}
            uploadStatus={uploadStatus}
          />
        </section>
      </div>
    </main>
  );
}
