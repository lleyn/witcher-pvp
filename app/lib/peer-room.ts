export const ROOM_CODE_LENGTH = 16;

export function normalizeRoomCode(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, ROOM_CODE_LENGTH);
}

export function createRoomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function roomIdFromCode(code: string) {
  return `duel_${normalizeRoomCode(code)}`;
}

export function peerIdFromCode(code: string) {
  return `witcher-pvp-${normalizeRoomCode(code)}`;
}

export function roomCodeFromHash(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const code = normalizeRoomCode(params.get("join") ?? "");
  return code.length === ROOM_CODE_LENGTH ? code : "";
}

export function inviteUrl(code: string, location: Pick<Location, "origin" | "pathname">) {
  return `${location.origin}${location.pathname}#join=${normalizeRoomCode(code)}`;
}

export function connectionErrorMessage(type?: string) {
  if (type === "peer-unavailable") return "Комната не найдена. Проверьте код или попросите владельца создать новую ссылку.";
  if (type === "unavailable-id") return "Такой код комнаты уже занят. Создайте комнату ещё раз.";
  if (type === "browser-incompatible") return "Этот браузер не поддерживает прямое соединение. Откройте сайт в свежей версии Chrome, Edge, Firefox или Safari.";
  if (type === "network" || type === "server-error" || type === "socket-error") return "Сервис соединения временно недоступен. Попробуйте подключиться ещё раз.";
  return "Не удалось установить прямое соединение. Иногда этому мешает корпоративная сеть или строгий роутер.";
}
