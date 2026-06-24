import QRCode from "qrcode";

import { createRoom, getRoom, openPoseSocket, openRoomSocket } from "../api.js";
import { frameHint, startCamera } from "../camera.js";

const CAMERA_ROOM_STATES = new Set(["calibrating", "active", "paused", "rest"]);

function displayErrorMessage(error) {
  if (error?.status === 404) {
    return "This room does not exist or has expired.";
  }
  if (error?.status === 410) {
    return "This room has expired. Refresh the display for a new code.";
  }
  return error?.message || "The backend is unavailable. Refresh the display to create a new code.";
}

function formatCountdown(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const remainder = String(safe % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function roomStatusLabel(room, disconnected) {
  if (!room) {
    return "Creating room...";
  }
  if (disconnected) {
    return "Display disconnected. Refresh the display to create a new code.";
  }

  switch (room.status) {
    case "waiting":
      return "Waiting for your phone...";
    case "connected":
      return "Phone connected";
    case "routine_selected":
      return "Routine selected";
    case "calibrating":
      return "Camera Check";
    case "active":
      return "Quest active";
    case "paused":
      return "Paused from phone.";
    case "rest":
      return "Rest";
    case "complete":
      return "Quest Complete";
    case "expired":
      return "Room expired";
    case "ended":
      return "Session ended";
    default:
      return "Display ready";
  }
}

function statusText(active) {
  return active ? "chip active" : "chip";
}

export async function renderDisplayRoute(container, roomCode) {
  if (roomCode && window.location.pathname !== `/display/${roomCode}`) {
    window.history.replaceState({}, "", `/display/${roomCode}`);
  }

  const state = {
    room: null,
    loading: true,
    error: "",
    disconnected: false,
    qrPending: false,
    qrDataUrl: "",
    qrError: "",
    joinUrl: "",
    roomSocket: null,
    poseSocket: null,
    poseIntervalId: 0,
    timerIntervalId: 0,
    cameraStream: null,
    cameraStarting: false,
    cameraStartedAt: 0,
    cameraError: "",
    poseMessage: "Stand where the camera can see you.",
    poseSignal: {
      visible: false,
      centered: false,
      confidence: 0,
      steady: false,
      hold_seconds: 0,
    },
  };

  function render() {
    const room = state.room;
    const session = room?.session;
    const routine = room?.selected_routine;
    const roomStatus = roomStatusLabel(room, state.disconnected);

    if (state.loading) {
      container.innerHTML = `
        <main class="page-shell display-shell">
          <section class="hero-panel display-hero">
            <p class="eyebrow">Display Screen</p>
            <h1>YUEDMAI</h1>
            <p class="lede">Creating room...</p>
            <div class="status-pill status-neutral" aria-live="polite">Creating room...</div>
          </section>
        </main>
      `;
      return;
    }

    if (state.error && !room) {
      container.innerHTML = `
        <main class="page-shell display-shell">
          <section class="panel error-panel">
            <p class="eyebrow">Display Error</p>
            <h1>Refresh the display</h1>
            <p>${state.error}</p>
            <a class="button-link primary-button" href="/display">Create a new room</a>
          </section>
        </main>
      `;
      return;
    }

    const qrBlock = `
      <div class="qr-stack">
        <div class="qr-frame" aria-label="QR code to join this room">
          ${
            state.qrPending
              ? `<div class="qr-placeholder">Generating QR...</div>`
              : state.qrDataUrl
                ? `<img class="qr-image" src="${state.qrDataUrl}" alt="Join room QR code for ${state.joinUrl}" />`
                : `<div class="qr-placeholder">QR fallback</div>`
          }
        </div>
        <p class="fine-print">Scan to start your quest</p>
        <p class="room-code-label">Code: ${room.code}</p>
        <p class="fine-print">This code refreshes after 10 minutes.</p>
        <p class="fine-print"><a class="text-link" href="${state.joinUrl}">${state.joinUrl}</a></p>
        ${state.qrError ? `<p class="fine-print">${state.qrError}</p>` : ""}
      </div>
    `;

    if (["waiting", "connected", "routine_selected"].includes(room.status)) {
      container.innerHTML = `
        <main class="page-shell display-shell">
          <section class="hero-panel display-hero">
            <div class="status-row">
              <div class="status-pill ${state.error ? "status-error" : "status-success"}" aria-live="polite">${roomStatus}</div>
              <div class="status-pill status-neutral">Room ${room.code}</div>
            </div>
            <p class="eyebrow">YUEDMAI</p>
            <h1>Stretch better. Play daily.</h1>
            <p class="lede">Your phone chooses the quest. This screen stays public, readable, and camera-first.</p>
          </section>

          <section class="display-grid">
            <article class="panel">
              ${qrBlock}
            </article>
            <article class="panel info-panel">
              <h2>${room.status === "waiting" ? "Waiting for your phone..." : "Phone connected"}</h2>
              <p>${room.controller_mode ? "Guest controller ready" : "Scan the QR code to connect a controller."}</p>
              <p>${routine ? `${routine.name} selected. Start calibration or the quest from your phone.` : "Choose your quest on your phone."}</p>
              ${
                routine
                  ? `
                    <div class="surface">
                      <h3>${routine.name}</h3>
                      <p>${routine.description}</p>
                      <p class="fine-print">Stretches: ${routine.stretches.join(", ")}</p>
                    </div>
                  `
                  : ""
              }
            </article>
          </section>
        </main>
      `;
      return;
    }

    if (room.status === "calibrating") {
      container.innerHTML = `
        <main class="page-shell display-shell">
          <section class="hero-panel display-hero">
            <div class="status-row">
              <div class="status-pill status-success" aria-live="polite">${roomStatus}</div>
              <div class="status-pill status-neutral">${routine?.name || "Quest ready"}</div>
            </div>
            <p class="eyebrow">Camera Check</p>
            <h1>Stand where the camera can see you.</h1>
            <p class="lede">Center your shoulders in the frame and make sure the area is well lit.</p>
          </section>

          <section class="session-grid">
            <article class="panel camera-panel">
              <div class="video-label">Camera preview</div>
              <div class="camera-frame">
                <video id="display-camera-preview" autoplay playsinline muted></video>
                <div class="pose-overlay">${state.cameraError || state.poseMessage}</div>
              </div>
            </article>

            <article class="panel session-side-panel">
              <div class="chip-row" aria-live="polite">
                <span class="${statusText(state.poseSignal.visible)}">Person visible</span>
                <span class="${statusText(state.poseSignal.centered)}">Centered</span>
                <span class="${statusText(state.poseSignal.confidence >= 0.65)}">Lighting okay</span>
              </div>
              <ul class="guidance-list">
                <li>Stand where the camera can see you.</li>
                <li>Center your shoulders in the frame.</li>
                <li>Make sure the area is well lit.</li>
              </ul>
              ${
                state.cameraError
                  ? `<div class="notice notice-error"><p>${state.cameraError}</p></div>`
                  : ""
              }
              <p class="fine-print">Use your phone to start the quest when the room looks ready.</p>
            </article>
          </section>
        </main>
      `;
      attachCameraStream();
      void ensureCamera();
      return;
    }

    if (["active", "paused", "rest"].includes(room.status)) {
      const stretchNumber = session ? session.current_index + 1 : 0;
      const activeTimer = session ? formatCountdown(session.elapsed_seconds) : "00:00";
      const feedbackText =
        room.status === "paused"
          ? "Paused from phone."
          : room.status === "rest"
            ? "Tap Next on your phone when ready."
            : session?.feedback_message || "Control from your phone.";

      container.innerHTML = `
        <main class="page-shell display-shell">
          <section class="session-grid active-grid">
            <article class="panel camera-panel">
              <div class="session-topline">
                <h1>${room.status === "rest" ? "Rest" : `Stretch ${stretchNumber} of ${session?.total_stretches || 0}`}</h1>
                <div class="session-topline-stats">
                  <span>XP ${session?.xp_earned || 0}</span>
                  <span>Score ${session?.total_score || 0}</span>
                  <span>${"★".repeat(session?.current_stars || 0) || "☆☆☆"}</span>
                </div>
              </div>
              <div class="video-label">Camera preview</div>
              <div class="camera-frame">
                <video id="display-camera-preview" autoplay playsinline muted></video>
                <div class="pose-overlay">${state.cameraError || state.poseMessage}</div>
              </div>
            </article>

            <article class="panel session-side-panel">
              <div class="status-row">
                <div class="status-pill ${room.status === "paused" ? "status-warning" : "status-success"}" aria-live="polite">${roomStatus}</div>
                <div class="status-pill status-neutral">Control from your phone</div>
              </div>
              <h2>${room.status === "rest" ? `Next up: ${session?.current_name || routine?.name || "Quick Reset"}` : session?.current_name || routine?.name || "Quick Reset"}</h2>
              <div class="metric-row">
                <div class="metric-box">
                  <span>Timer</span>
                  <strong>${activeTimer}</strong>
                </div>
                <div class="metric-box">
                  <span>Stars</span>
                  <strong>${session?.total_stars || 0}</strong>
                </div>
                <div class="metric-box">
                  <span>XP</span>
                  <strong>${session?.xp_earned || 0}</strong>
                </div>
              </div>
              <p class="feedback-copy">Feedback: ${feedbackText}</p>
              ${
                state.cameraError
                  ? `<div class="notice notice-error"><p>${state.cameraError}</p></div>`
                  : ""
              }
            </article>
          </section>
        </main>
      `;
      attachCameraStream();
      void ensureCamera();
      return;
    }

    if (room.status === "complete" || room.status === "ended" || room.status === "expired") {
      container.innerHTML = `
        <main class="page-shell display-shell">
          <section class="hero-panel display-hero">
            <div class="status-pill ${room.status === "expired" ? "status-error" : "status-success"}" aria-live="polite">${roomStatus}</div>
            <p class="eyebrow">${room.status === "expired" ? "Room Expired" : "Quest Complete"}</p>
            <h1>${room.status === "expired" ? "Refresh for a new room" : "Quest Complete"}</h1>
            <p class="lede">
              ${
                room.status === "expired"
                  ? "This room has expired. Refresh the display to create a new code."
                  : "Create an account later to keep XP and streaks."
              }
            </p>
          </section>

          <section class="display-grid">
            <article class="panel">
              <div class="metric-row">
                <div class="metric-box">
                  <span>Total XP</span>
                  <strong>${session?.xp_earned || 0}</strong>
                </div>
                <div class="metric-box">
                  <span>Total Stars</span>
                  <strong>${session?.total_stars || 0}</strong>
                </div>
                <div class="metric-box">
                  <span>Routine</span>
                  <strong>${routine?.name || "Quick Reset"}</strong>
                </div>
              </div>
              <p class="feedback-copy">Start another quest from your phone.</p>
            </article>
            <article class="panel info-panel">
              <h2>${room.status === "expired" ? "Room expired" : "Guest quest complete"}</h2>
              <p>${state.error || "This display will stay ready for another phone-controlled quest."}</p>
              <a class="button-link primary-button" href="/display">Create a new display room</a>
            </article>
          </section>
        </main>
      `;
      return;
    }
  }

  function attachCameraStream() {
    const video = container.querySelector("#display-camera-preview");
    if (!video || !state.cameraStream || video.srcObject === state.cameraStream) {
      return;
    }
    video.srcObject = state.cameraStream;
    video.play().catch(() => {});
  }

  async function generateQr() {
    if (!state.room) {
      return;
    }
    state.joinUrl = new URL(state.room.join_path, window.location.origin).toString();
    state.qrPending = true;
    state.qrError = "";
    render();
    try {
      state.qrDataUrl = await QRCode.toDataURL(state.joinUrl, {
        width: 320,
        margin: 1,
        color: {
          dark: "#ecfff6",
          light: "#0b141b",
        },
      });
    } catch (error) {
      console.error(error);
      state.qrDataUrl = "";
      state.qrError = "QR preview unavailable. Use the room code or join URL below.";
    } finally {
      state.qrPending = false;
      render();
    }
  }

  function connectRoomSocket() {
    if (!state.room || state.roomSocket) {
      return;
    }

    state.roomSocket = openRoomSocket(state.room.code, "display", {
      onRoom(room) {
        state.room = room;
        state.error = "";
        state.disconnected = false;
        render();
        if (CAMERA_ROOM_STATES.has(room.status)) {
          void ensureCamera();
        }
      },
      onError(message) {
        state.error = message;
        render();
      },
      onClose() {
        state.disconnected = true;
        render();
      },
    });
  }

  async function ensureCamera() {
    if (!state.room || !CAMERA_ROOM_STATES.has(state.room.status)) {
      return;
    }
    if (state.cameraStream || state.cameraStarting) {
      attachCameraStream();
      return;
    }

    const video = container.querySelector("#display-camera-preview");
    if (!video) {
      return;
    }

    state.cameraStarting = true;
    try {
      state.cameraStream = await startCamera(video);
      state.cameraStartedAt = Date.now();
      state.cameraError = "";
      attachCameraStream();
      startPoseMonitoring();
    } catch (error) {
      console.error(error);
      state.cameraError =
        error?.name === "NotAllowedError"
          ? "Camera permission was denied. You can still control the quest, or refresh after enabling camera access."
          : error.message || "Camera is unavailable on this display.";
      render();
    } finally {
      state.cameraStarting = false;
    }
  }

  function startPoseMonitoring() {
    if (state.poseSocket) {
      return;
    }
    state.poseSocket = openPoseSocket((result) => {
      state.poseSignal = result.signal;
      state.poseMessage = result.message || "Hold steady.";
      render();
    });

    state.poseIntervalId = window.setInterval(() => {
      const video = container.querySelector("#display-camera-preview");
      if (!video || !state.poseSocket || state.poseSocket.readyState !== WebSocket.OPEN) {
        return;
      }
      const holdSeconds = Math.max(0, (Date.now() - state.cameraStartedAt) / 1000);
      state.poseSocket.send(JSON.stringify(frameHint(video, holdSeconds)));
    }, 1000);
  }

  async function loadDisplayRoom() {
    state.loading = true;
    state.error = "";
    render();

    try {
      if (roomCode) {
        state.room = await getRoom(roomCode);
      } else {
        state.room = await createRoom();
        window.history.replaceState({}, "", state.room.display_path);
      }
      state.loading = false;
      state.disconnected = false;
      render();
      await generateQr();
      connectRoomSocket();
      if (CAMERA_ROOM_STATES.has(state.room.status)) {
        await ensureCamera();
      }
    } catch (error) {
      console.error(error);
      state.loading = false;
      state.error = displayErrorMessage(error);
      if (error?.status === 410 && roomCode) {
        state.room = {
          code: roomCode,
          status: "expired",
          selected_routine: null,
          session: null,
        };
      }
      render();
    }
  }

  state.timerIntervalId = window.setInterval(() => {
    if (state.room?.status === "active") {
      render();
    }
  }, 1000);

  render();
  await loadDisplayRoom();
}
