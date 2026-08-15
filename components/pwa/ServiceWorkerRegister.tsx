"use client";

import { useEffect } from "react";

/**
 * Registra public/sw.js al mount. Componente client "invisibile" (non
 * renderizza nulla), pensato per essere incluso una sola volta nel
 * RootLayout. Il service worker fa solo caching statico di base: vedi
 * public/sw.js per i dettagli.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Evita di registrare il SW in dev per non interferire con l'HMR di
    // Next.js: registriamo solo in produzione.
    if (process.env.NODE_ENV !== "production") return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((error) => {
          console.error("Registrazione service worker fallita:", error);
        });
    };

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
