const CONTROLLER_ACCESS_KEY = "yuedmai-controller-room";

function trimSlashes(pathname) {
  return pathname.replace(/^\/+|\/+$/g, "");
}

export function normalizeRoomCode(roomCode = "") {
  return roomCode.trim().toUpperCase();
}

export function parseRoute(pathname) {
  const cleanPath = trimSlashes(pathname || "/");
  const segments = cleanPath ? cleanPath.split("/") : [];

  if (segments.length === 0) {
    return { name: "home" };
  }

  if (segments[0] === "display") {
    if (segments.length === 1) {
      return { name: "display-create" };
    }
    if (segments.length === 2) {
      return { name: "display-room", roomCode: normalizeRoomCode(segments[1]) };
    }
  }

  if (segments[0] === "join" && segments.length === 2) {
    return { name: "join", roomCode: normalizeRoomCode(segments[1]) };
  }

  if (segments[0] === "controller" && segments.length === 2) {
    return { name: "controller", roomCode: normalizeRoomCode(segments[1]) };
  }

  return { name: "not-found" };
}

export function rememberControllerAccess(roomCode) {
  sessionStorage.setItem(CONTROLLER_ACCESS_KEY, normalizeRoomCode(roomCode));
}

export function hasControllerAccess(roomCode) {
  return sessionStorage.getItem(CONTROLLER_ACCESS_KEY) === normalizeRoomCode(roomCode);
}

export function clearControllerAccess(roomCode) {
  const stored = sessionStorage.getItem(CONTROLLER_ACCESS_KEY);
  if (!stored) {
    return;
  }
  if (!roomCode || stored === normalizeRoomCode(roomCode)) {
    sessionStorage.removeItem(CONTROLLER_ACCESS_KEY);
  }
}
