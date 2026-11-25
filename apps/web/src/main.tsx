import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// PWA: service worker (push, cache estratégico e tela offline). Só em produção,
// para não interferir no hot reload do Vite.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch((error) => {
      console.warn("Service worker não registrado:", error);
    });
  });
}
