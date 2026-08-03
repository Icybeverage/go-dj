export const SUPABASE_BUCKET =
  "https://zcahokqhmmsjpcfrxfly.supabase.co/storage/v1/object/public/outsidelands";

export const songs = [
  [
    "Baby Keem",
    "family ties",
    140,
    "Baby Keem, Kendrick Lamar - family ties (Official Video).mp3",
  ],
  ["Charli xcx", "Camera", 122, "Charli xcx - Camera (Official Video).mp3"],
  [
    "Djo",
    "End Of Beginning",
    78,
    "Djo - End Of Beginning (Official Audio).mp3",
  ],
  [
    "Empire Of The Sun",
    "Walking On A Dream",
    127,
    "Empire Of The Sun - Walking On A Dream (Official Music Video).mp3",
  ],
  [
    "GRiZ & Subtronics",
    "Griztronics",
    140,
    "GRiZ & Subtronics - Griztronics.mp3",
  ],
  [
    "The Strokes",
    "Last Nite",
    104,
    "The Strokes - Last Nite (Official HD Video).mp3",
  ],
].map(([artist, title, bpm, file]) => ({
  artist,
  title,
  bpm,
  file,
  url: `${SUPABASE_BUCKET}/${encodeURIComponent(file)}`,
}));

export const preloadedSongs = [...songs]
  .sort(() => Math.random() - 0.5)
  .slice(0, 2);
