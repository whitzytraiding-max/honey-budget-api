import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App.jsx";
import { LanguageProvider } from "./i18n/LanguageProvider.jsx";
import { isNative, initNative } from "./lib/native.js";
import "./styles.css";

// Lock the native UI scale and prevent element dragging
if (isNative()) {
  document.documentElement.classList.add("is-native");
}

initNative();

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister()))
      )
      .then(() => {
        if ("caches" in window) {
          return caches.keys().then((keys) =>
            Promise.all(keys.map((key) => caches.delete(key))),
          );
        }

        return undefined;
      })
      .catch((error) => {
        console.error("Service worker cleanup failed:", error);
      });
  });
}
