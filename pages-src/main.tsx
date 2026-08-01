import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PinballFinder } from "../components/pinball-finder";
import "../styles/pinball-finder.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode><PinballFinder /></StrictMode>,
);
