/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { Browser } from "@capacitor/browser";
import { App } from "@capacitor/app";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_NATIVE_CLIENT_ID || "";
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_NATIVE_CLIENT_SECRET || "";
const REDIRECT_URI = "honeybudget://google-auth";

function generateVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function generateChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export async function nativeGoogleSignIn() {
  if (!CLIENT_ID) throw new Error("VITE_GOOGLE_NATIVE_CLIENT_ID is not set.");

  const verifier = generateVerifier();
  const challenge = await generateChallenge(verifier);

  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "openid email profile",
      code_challenge: challenge,
      code_challenge_method: "S256",
      access_type: "online",
    });

  return new Promise(async (resolve, reject) => {
    let urlListener = null;
    let finishedListener = null;
    let settled = false;

    function settle(fn, value) {
      if (settled) return;
      settled = true;
      urlListener?.remove();
      finishedListener?.remove();
      fn(value);
    }

    urlListener = await App.addListener("appUrlOpen", async (event) => {
      if (!event.url.startsWith(REDIRECT_URI)) return;

      await Browser.close().catch(() => {});

      const parsed = new URL(event.url);
      const code = parsed.searchParams.get("code");
      const error = parsed.searchParams.get("error");

      if (error || !code) {
        settle(reject, new Error(error || "Google sign-in was cancelled"));
        return;
      }

      try {
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: "authorization_code",
            code_verifier: verifier,
          }),
        });
        const tokens = await res.json();
        if (tokens.error) throw new Error(tokens.error_description || tokens.error);
        settle(resolve, tokens.access_token);
      } catch (err) {
        settle(reject, err);
      }
    });

    // browserFinished fires when user manually closes the sheet AND when iOS
    // auto-closes it after a custom-scheme redirect. Delay so appUrlOpen (the
    // redirect case) wins the race.
    finishedListener = await Browser.addListener("browserFinished", () => {
      setTimeout(() => settle(reject, new Error("Google sign-in was cancelled")), 600);
    });

    try {
      await Browser.open({ url: authUrl });
    } catch (err) {
      settle(reject, err);
    }
  });
}
