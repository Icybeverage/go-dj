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
import { emitDjEvent, subscribeDjEvents } from "../features/dj/bus";
import { deckGroup } from "../features/dj/math";
import { api } from "../convexApi";
import { createCommandQueue } from "../services/convex/commands";

const TUTORIAL_STORAGE_KEY = "go-dj-tutorial-complete";

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
  const remoteTracks = useQuery(api.tracks.search, { limit: 100 });
  const remoteFestivalArtists = useQuery(api.festivals.listArtists, {
    festival: OUTSIDE_LANDS_FESTIVAL,
    limit: 200,
  });
  const librarySongs = useMemo(() => {
    if (!remoteTracks?.length) return songs;
    const normalized = remoteTracks
      .filter((track) => track.filePath)
      .map((track) => {
        const filePath = track.filePath;
        const file = filePath.startsWith("http")
          ? decodeURIComponent(filePath.split("/").pop() || filePath)
          : filePath;
        return {
          ...track,
          file,
          url: filePath.startsWith("http")
            ? filePath
            : `${SUPABASE_BUCKET}/${encodeURIComponent(filePath)}`,
        };
      });
    return normalized.length ? normalized : songs;
  }, [remoteTracks]);
  const libraryArtists = remoteFestivalArtists?.length
    ? remoteFestivalArtists
    : outsideLandsArtists;
  const enqueueMutation = useMutation(api.mixxx.enqueue);
  const enqueue = useMemo(
    () => createCommandQueue(enqueueMutation),
    [enqueueMutation],
  );

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

  const handleSyncChange = useCallback((deck, enabled) => {
    setSyncStates((current) => {
      if (!enabled)
        return current.map((value, index) =>
          index === deck - 1 ? false : value,
        );
      return current.map((_, index) => index === deck - 1);
    });
  }, []);

  useEffect(() => {
    function nextSongFor(sourceDeck) {
      const currentFile = decks[sourceDeck - 1]?.file;
      const currentIndex = librarySongs.findIndex(
        (song) => song.file === currentFile,
      );
      return (
        librarySongs[
          (currentIndex + 1 + librarySongs.length) % librarySongs.length
        ] || librarySongs[0]
      );
    }

    function syncNext(sourceDeck) {
      const targetDeck = sourceDeck === 1 ? 2 : 1;
      const next = nextSongFor(sourceDeck);
      if (next && decks[targetDeck - 1]?.file !== next.file)
        loadSong(targetDeck - 1, next);
      emitDjEvent({
        type: "sync",
        deck: targetDeck,
        value: 1,
        targetBpm: next?.bpm,
      });
    }

    function handoffNext(sourceDeck) {
      const targetDeck = sourceDeck === 1 ? 2 : 1;
      const next = nextSongFor(sourceDeck);
      if (!next) return;
      loadSong(targetDeck - 1, next);
      setAutoPlaySignals((current) =>
        current.map((value, index) =>
          index === targetDeck - 1 ? value + 1 : value,
        ),
      );
      window.setTimeout(
        () =>
          emitDjEvent({
            type: "sync",
            deck: targetDeck,
            value: 1,
            targetBpm: next.bpm,
          }),
        220,
      );
    }

    return subscribeDjEvents((event) => {
      if (event?.type === "syncNext") syncNext(event.deck);
      if (event?.type === "handoffNext") handoffNext(event.deck);
    });
  }, [decks, librarySongs, loadSong]);

  if (showLanding) return <LandingPage onEnter={enterDashboard} />;

  return (
    <main className="app-shell">
      <div className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark">GD</span>
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
            <span className="player-meta">A / B · KEYLOCK</span>
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
          />
        </section>
      </div>
    </main>
  );
}
