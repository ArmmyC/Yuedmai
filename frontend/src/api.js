const API_BASE = import.meta.env.VITE_API_BASE || defaultApiBase();
const WS_BASE = API_BASE.replace(/^http/, "ws");

function defaultApiBase() {
  if (typeof window === "undefined" || import.meta.env.DEV) {
    return "http://localhost:8000";
  }

  return window.location.origin;
}

export class ApiError extends Error {
  constructor(message, status, payload = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const raw = await response.text();
  const payload = raw ? safeJsonParse(raw) : null;

  if (!response.ok) {
    const message = payload?.detail || payload?.message || `Request failed: ${response.status}`;
    throw new ApiError(message, response.status, payload);
  }

  return payload;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return { raw: value };
  }
}

function jsonBody(body) {
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function createSession() {
  return jsonRequest("/api/sessions", {
    method: "POST",
    ...jsonBody({}),
  });
}

export function scoreSession(sessionId, signal) {
  return jsonRequest(`/api/sessions/${sessionId}/score`, {
    method: "POST",
    ...jsonBody(signal),
  });
}

export function advanceSession(sessionId) {
  return jsonRequest(`/api/sessions/${sessionId}/advance`, {
    method: "POST",
  });
}

export function loadDailyQuests() {
  return jsonRequest("/api/quests/daily");
}

export function createRoom() {
  return jsonRequest("/api/rooms", {
    method: "POST",
  });
}

export function getRoom(roomCode) {
  return jsonRequest(`/api/rooms/${roomCode}`);
}

export function joinRoom(roomCode, mode = "guest") {
  return jsonRequest(`/api/rooms/${roomCode}/join`, {
    method: "POST",
    ...jsonBody({ mode }),
  });
}

export function listRoomRoutines() {
  return jsonRequest("/api/rooms/routines");
}

export function selectRoomRoutine(roomCode, routineId) {
  return jsonRequest(`/api/rooms/${roomCode}/routine`, {
    method: "POST",
    ...jsonBody({ routine_id: routineId }),
  });
}

export function sendRoomCommand(roomCode, type) {
  return jsonRequest(`/api/rooms/${roomCode}/commands`, {
    method: "POST",
    ...jsonBody({ type }),
  });
}

export function openPoseSocket(onResult) {
  const socket = new WebSocket(`${WS_BASE}/ws/pose-stream`);
  socket.addEventListener("message", (event) => onResult(JSON.parse(event.data)));
  return socket;
}

export function openRoomSocket(roomCode, role, handlers = {}) {
  const socket = new WebSocket(`${WS_BASE}/ws/rooms/${roomCode}/${role}`);
  socket.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);
    handlers.onEvent?.(payload);
    if ((payload.type === "ROOM_STATE" || payload.type === "ROOM_UPDATED") && payload.room) {
      handlers.onRoom?.(payload.room);
    }
    if (payload.type === "ROOM_ERROR") {
      handlers.onError?.(payload.message || "Connection error");
    }
  });
  socket.addEventListener("close", () => handlers.onClose?.());
  return socket;
}
