"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    let cancelled = false;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        if (!cancelled) {
          registration.update().catch(() => {
            // A failed background update must not interrupt the current session.
          });
        }
      })
      .catch((error: unknown) => {
        // PWA support is progressive enhancement; app navigation still works.
        console.warn("KhataLink service worker registration failed:", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
