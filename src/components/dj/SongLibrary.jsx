import React, { useMemo, useRef, useState } from "react";
import {
  ScrollArea,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from "../ui/scroll-area";
import { Icon } from "./Icons";

export function SongLibrary({
  songs,
  festivalArtists = [],
  onLoad,
  onUpload,
  uploadStatus = "",
}) {
  const [query, setQuery] = useState("");
  const [artistQuery, setArtistQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState(songs[0]?.file || "");
  const rowRefs = useRef([]);
  const visibleSongs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return songs;
    return songs.filter((song) =>
      `${song.artist} ${song.title}`.toLowerCase().includes(normalized),
    );
  }, [query, songs]);
  const visibleArtists = useMemo(() => {
    const normalized = artistQuery.trim().toLowerCase();
    if (!normalized) return festivalArtists;
    return festivalArtists.filter((item) =>
      `${item.artist} ${item.day}`.toLowerCase().includes(normalized),
    );
  }, [artistQuery, festivalArtists]);

  function focusRow(index) {
    const nextIndex = Math.max(0, Math.min(visibleSongs.length - 1, index));
    const next = visibleSongs[nextIndex];
    if (!next) return;
    setSelectedFile(next.file);
    rowRefs.current[next.file]?.focus();
  }

  function handleRowKeyDown(event, index, song) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusRow(index + 1);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusRow(index - 1);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      onLoad(0, song);
    }
  }

  return (
    <section className="library-card" aria-labelledby="library-title">
      <div className="library-head">
        <div>
          <span className="eyebrow">PLAYLIST</span>
          <h2 id="library-title">Audio &amp; lineup</h2>
        </div>
        <div className="library-head-actions">
          <span className="track-count">
            {songs.length} tracks · {festivalArtists.length} artists
          </span>
          <label className="load-button upload-button">
            <Icon name="upload" size={12} />
            <span>Upload track</span>
            <input
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onUpload?.(file);
                event.target.value = "";
              }}
              aria-label="Upload your own audio track"
            />
          </label>
          {uploadStatus && <span className="upload-status">{uploadStatus}</span>}
        </div>
      </div>
      <div className="library-columns">
        <div className="library-pane">
          <div className="library-pane-head">
            <span className="eyebrow">PLAYABLE AUDIO</span>
            <span>{songs.length}</span>
          </div>
          <label className="library-search">
            <Icon name="search" size={13} />
            <span className="sr-only">Search library</span>
            <input
              type="search"
              value={query}
              placeholder="Search tracks"
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search playable tracks"
            />
          </label>
          <ScrollArea className="library-scroll">
            <ScrollAreaViewport className="library-viewport">
              <div className="song-table" role="table" aria-label="Available songs">
                <div className="song-table-head" role="row">
                  <span role="columnheader">TRACK</span>
                  <span role="columnheader">BPM</span>
                  <span role="columnheader">LOAD + PLAY</span>
                </div>
                {visibleSongs.map((song, index) => (
                  <div
                    className={`song-row ${selectedFile === song.file ? "is-selected" : ""}`}
                    role="row"
                    aria-selected={selectedFile === song.file}
                    tabIndex={0}
                    key={song.file}
                    ref={(node) => {
                      rowRefs.current[song.file] = node;
                    }}
                    onFocus={() => setSelectedFile(song.file)}
                    onKeyDown={(event) => handleRowKeyDown(event, index, song)}
                  >
                    <div className="song-details" role="cell">
                      <span className="song-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="song-text">
                        <strong>{song.title}</strong>
                        <small>{song.artist}</small>
                      </span>
                    </div>
                    <span className="song-bpm" role="cell">
                      {song.bpm || "—"}
                    </span>
                    <div className="song-load-buttons" role="cell">
                      <button
                        className="load-button deck-a-button"
                        type="button"
                        onClick={() => onLoad(0, song)}
                        aria-label={`Load and play ${song.title} on Deck A`}
                      >
                        <Icon name="play" size={12} /> A
                      </button>
                      <button
                        className="load-button deck-b-button"
                        type="button"
                        onClick={() => onLoad(1, song)}
                        aria-label={`Load and play ${song.title} on Deck B`}
                      >
                        <Icon name="play" size={12} /> B
                      </button>
                    </div>
                  </div>
                ))}
                {!visibleSongs.length && (
                  <div className="library-empty" role="row">
                    No tracks match “{query}”.
                  </div>
                )}
              </div>
            </ScrollAreaViewport>
            <ScrollAreaScrollbar
              className="library-scrollbar"
              orientation="vertical"
            >
              <ScrollAreaThumb className="library-thumb" />
            </ScrollAreaScrollbar>
          </ScrollArea>
        </div>

        <div className="library-pane lineup-pane">
          <div className="library-pane-head">
            <span className="eyebrow">OUTSIDE LANDS 2026</span>
            <span>{visibleArtists.length}</span>
          </div>
          <label className="library-search">
            <Icon name="search" size={13} />
            <span className="sr-only">Search lineup</span>
            <input
              type="search"
              value={artistQuery}
              placeholder="Search artists or day"
              onChange={(event) => setArtistQuery(event.target.value)}
              aria-label="Search festival artists"
            />
          </label>
          <ScrollArea className="library-scroll artist-library-scroll">
            <ScrollAreaViewport className="library-viewport">
              <div className="artist-list" role="list" aria-label="Festival artist lineup">
                {visibleArtists.map((item, index) => (
                  <div className="artist-row" role="listitem" key={item.id || `${item.day}:${item.artist}`}>
                    <span className="artist-number">{String(index + 1).padStart(2, "0")}</span>
                    <span className="artist-name">{item.artist}</span>
                    <span className="artist-day">{item.day.split(" · ")[0]}</span>
                  </div>
                ))}
                {!visibleArtists.length && (
                  <div className="library-empty">No artists match “{artistQuery}”.</div>
                )}
              </div>
            </ScrollAreaViewport>
            <ScrollAreaScrollbar
              className="library-scrollbar"
              orientation="vertical"
            >
              <ScrollAreaThumb className="library-thumb" />
            </ScrollAreaScrollbar>
          </ScrollArea>
        </div>
      </div>
    </section>
  );
}
