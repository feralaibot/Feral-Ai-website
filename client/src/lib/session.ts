const SESSION_KEY = "feral_wallet_session";

type SessionPayload = {
  token: string;
  expiresAt: number;
};

let cachedSession: SessionPayload | null = null;

export function setSession(payload: SessionPayload) {
  cachedSession = payload;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage errors; in-memory cache remains.
  }
}

export function clearSession() {
  cachedSession = null;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore storage errors.
  }
}

export function getSession(): SessionPayload | null {
  if (cachedSession && cachedSession.expiresAt > Date.now()) {
    return cachedSession;
  }

  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionPayload;
    if (!parsed?.token || !parsed?.expiresAt) return null;
    if (parsed.expiresAt < Date.now()) return null;
    cachedSession = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export function getAuthHeaders(): HeadersInit {
  const session = getSession();
  if (!session) return {};
  return { Authorization: `Bearer ${session.token}` };
}
