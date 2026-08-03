import { readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { songs } from "../src/data/songs.js";

function readConvexUrl() {
  if (process.env.CONVEX_URL) return process.env.CONVEX_URL;
  const envPath = new URL("../.env.local", import.meta.url);
  const text = readFileSync(envPath, "utf8");
  const line = text.match(/^CONVEX_URL=(.*)$/m);
  return line?.[1]?.trim();
}

const convexUrl = readConvexUrl();
if (!convexUrl) throw new Error("CONVEX_URL is not configured");

const client = new ConvexHttpClient(convexUrl);

for (const song of songs) {
  await client.mutation(api.tracks.upsert, {
    title: song.title,
    artist: song.artist,
    filePath: song.file,
    source: "Supabase · Outside Lands bucket",
    bpm: song.bpm,
    genres: [],
    moods: [],
  });
}

console.log(
  JSON.stringify(
    {
      convexUrl,
      playableTrackCount: songs.length,
      syncedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
