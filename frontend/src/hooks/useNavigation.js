import { useEffect, useState } from "react";

const APP_ROUTES = new Set([
  "home", "expenses", "savings", "more", "planner", "budget-planner",
  "setup", "coach", "notifications", "calendar", "insights", "history",
  "debt", "settings", "paywall", "privacy-policy", "terms-of-service", "reset-password",
]);

function parseHash() {
  if (typeof window === "undefined") return { route: "home", query: "" };
  const raw = window.location.hash.replace(/^#\/?/, "").trim();
  const [rawRoute, query = ""] = raw.split("?");
  const route = rawRoute.trim().toLowerCase();
  return { route: APP_ROUTES.has(route) ? route : "home", query };
}

function setHash(route) {
  if (typeof window === "undefined") return;
  const next = `#/${route}`;
  if (window.location.hash !== next) window.location.hash = next;
}

export function useNavigation() {
  const [hashLocation, setHashLocation] = useState(parseHash);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.location.hash) setHash("home");
    const sync = () => setHashLocation(parseHash());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  function navigate(routeKey) {
    setHashLocation({ route: routeKey, query: "" });
    setHash(routeKey);
  }

  return {
    route: hashLocation.route,
    query: hashLocation.query,
    navigate,
    APP_ROUTES,
  };
}
