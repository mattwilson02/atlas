import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@xyflow/react/dist/style.css";
import "./styles.css";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { startSync } from "./sync";

registerSW({ immediate: true });
// Ask the browser not to evict boards (stored in localStorage) under storage pressure.
navigator.storage?.persist?.().catch(() => {});

startSync();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
