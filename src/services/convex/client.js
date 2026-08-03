import { ConvexReactClient } from "convex/react";

export const convex = new ConvexReactClient(
  import.meta.env.VITE_CONVEX_URL ||
    "https://watchful-herring-241.convex.cloud",
);
