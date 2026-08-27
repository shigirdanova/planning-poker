import { nanoid } from "nanoid";

const NAME_KEY = "pp-name";
const RESUME_KEY = "pp-resume";
const LEGACY_PLAYER_KEY = "pp-player-id";

export function getStoredName(): string {
  const local = (localStorage.getItem(NAME_KEY) ?? "").trim();
  if (local) return local;
  const session = (sessionStorage.getItem(NAME_KEY) ?? "").trim();
  if (session) {
    localStorage.setItem(NAME_KEY, session);
    return session;
  }
  return "";
}

export function setStoredName(name: string): void {
  localStorage.setItem(NAME_KEY, name.trim());
}

export function getResumeToken(): string {
  const stored =
    localStorage.getItem(RESUME_KEY)?.trim() ||
    localStorage.getItem(LEGACY_PLAYER_KEY)?.trim() ||
    "";
  if (stored && /^[A-Za-z0-9_-]{8,32}$/.test(stored)) {
    localStorage.setItem(RESUME_KEY, stored);
    return stored;
  }
  const token = nanoid(21);
  localStorage.setItem(RESUME_KEY, token);
  return token;
}
