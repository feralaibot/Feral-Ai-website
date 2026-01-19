const FALLBACK_API_BASE_URL = "https://feral-ai-website.onrender.com";

const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

const resolvedBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  (isLocalhost ? window.location.origin : FALLBACK_API_BASE_URL);

export const API_BASE_URL = resolvedBaseUrl.replace(/\/$/, "");

export function buildApiUrl(path: string): string {
  if (!API_BASE_URL) return path;
  if (path.startsWith("http")) return path;
  return `${API_BASE_URL}${path}`;
}
