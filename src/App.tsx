import { useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Sidebar } from "./Sidebar";
import { Canvas } from "./Canvas";
import { Inspector } from "./Inspector";

const KEY = "atlas:inspector-w";

export default function App() {
  useEffect(() => {
    try {
      const w = Number(localStorage.getItem(KEY));
      if (w) document.documentElement.style.setProperty("--inspector-w", `${w}px`);
    } catch {}
  }, []);

  const drag = (e: React.PointerEvent) => {
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      if (ev.buttons === 0) return up(); // button released outside the window
      const w = Math.min(Math.max(window.innerWidth - ev.clientX, 280), Math.round(window.innerWidth * 0.6));
      document.documentElement.style.setProperty("--inspector-w", `${w}px`);
      try {
        localStorage.setItem(KEY, String(w));
      } catch {}
    };
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <ReactFlowProvider>
      <div className="app">
        <Sidebar />
        <Canvas />
        <div className="resizer" onPointerDown={drag} title="Drag to resize panel" />
        <Inspector />
      </div>
    </ReactFlowProvider>
  );
}
