import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createDioramaRenderer } from "./three/DioramaRenderer";
import { ThreeGameApp } from "./three/ThreeGameApp";
import "./three/three-game.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing #root 3D application container");
}

createRoot(root).render(
  <StrictMode>
    <ThreeGameApp createRenderer={createDioramaRenderer} />
  </StrictMode>,
);
