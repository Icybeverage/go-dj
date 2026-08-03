import React from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider } from "convex/react";
import { App } from "./app/App";
import { convex } from "./services/convex/client";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </React.StrictMode>,
);
