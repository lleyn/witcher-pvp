export const ROOM_CODE_LENGTH = 16;
export const HOST_KEY_LENGTH = 64;

export type RoomHashRoute =
  | { kind: "host"; hostKey: string }
  | { kind: "guest"; code: string };

export function normalizeRoomCode(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, ROOM_CODE_LENGTH);
}

export function createRoomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function normalizeHostKey(value: string) {
  return value.toLowerCase().replace(/[^a-f0-9]/g, "").slice(0, HOST_KEY_LENGTH);
}

export function createHostKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(HOST_KEY_LENGTH / 2));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function roomCodeFromHostKey(hostKey: string) {
  const normalized = normalizeHostKey(hostKey);
  if (normalized.length !== HOST_KEY_LENGTH) return "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest).slice(0, ROOM_CODE_LENGTH / 2), (value) => value.toString(16).padStart(2, "0")).join("");
}

export function roomIdFromCode(code: string) {
  return `duel_${normalizeRoomCode(code)}`;
}

export function peerIdFromCode(code: string) {
  return `witcher-pvp-${normalizeRoomCode(code)}`;
}

export function roomCodeFromHash(hash: string) {
  const route = roomRouteFromHash(hash);
  return route?.kind === "guest" ? route.code : "";
}

export function roomRouteFromHash(hash: string): RoomHashRoute | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const keys = [...params.keys()];
  if (keys.length !== 1) return null;
  if (keys[0] === "host") {
    const rawHostKey = params.get("host") ?? "";
    if (!new RegExp(`^[a-f0-9]{${HOST_KEY_LENGTH}}$`, "i").test(rawHostKey)) return null;
    const hostKey = normalizeHostKey(rawHostKey);
    return { kind: "host", hostKey };
  }
  if (keys[0] !== "join") return null;
  const rawGuestCode = params.get("join") ?? "";
  if (!new RegExp(`^[a-z0-9]{${ROOM_CODE_LENGTH}}$`, "i").test(rawGuestCode)) return null;
  return { kind: "guest", code: normalizeRoomCode(rawGuestCode) };
}

type RoomPageLocation = Pick<Location, "origin" | "pathname"> & Partial<Pick<Location, "search">>;

export function inviteUrl(code: string, location: RoomPageLocation) {
  return `${location.origin}${location.pathname}${location.search ?? ""}#join=${normalizeRoomCode(code)}`;
}

export function hostUrl(hostKey: string, location: RoomPageLocation) {
  return `${location.origin}${location.pathname}${location.search ?? ""}#host=${normalizeHostKey(hostKey)}`;
}

export function connectionErrorMessage(type?: string, role?: "host" | "guest") {
  if (type === "peer-unavailable") return "Комната не найдена. Проверьте код или попросите владельца создать новую ссылку.";
  if (type === "unavailable-id") return role === "host"
    ? "Эта комната уже открыта в другой вкладке владельца. Закройте её там и подключитесь снова."
    : "Идентификатор подключения уже занят. Подключитесь ещё раз.";
  if (type === "browser-incompatible") return "Этот браузер не поддерживает прямое соединение. Откройте сайт в свежей версии Chrome, Edge, Firefox или Safari.";
  if (type === "network" || type === "server-error" || type === "socket-error") return "Сервис соединения временно недоступен. Попробуйте подключиться ещё раз.";
  return "Не удалось установить прямое соединение. Иногда этому мешает корпоративная сеть или строгий роутер.";
}
