const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const IS_PROD = import.meta.env.PROD;

if (IS_PROD && !BASE_URL) {
  console.error("VITE_API_BASE_URL is required in production.");
}

function getToken() {
  return localStorage.getItem("budget_token") || "";
}

export async function apiFetch(path, { auth = true, ...options } = {}) {
  if (!path.startsWith("http") && !BASE_URL) {
    if (IS_PROD) throw new Error("VITE_API_BASE_URL is required in production.");
    console.warn("VITE_API_BASE_URL not set — falling back to same-origin requests.");
  }

  const token = auth ? getToken() : null;
  const { headers: extraHeaders, ...restOptions } = options;
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;

  const response = await fetch(url, {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(data?.error?.message || "Request failed.");
    err.status = response.status;
    throw err;
  }

  return data.data;
}

export const API_BASE_URL = BASE_URL;
