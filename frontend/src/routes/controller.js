import { getRoom, listRoomRoutines, openRoomSocket, selectRoomRoutine, sendRoomCommand } from "../api.js";
import { hasControllerAccess } from "../router.js";

const COMMAND_LABELS = {
  START_CALIBRATION: "Start Calibration",
  START_SESSION: "Start Quest",
  PAUSE_SESSION: "Pause",
  RESUME_SESSION: "Resume",
  NEXT_STRETCH: "Next Stretch",
  SKIP_STRETCH: "Skip Stretch",
  END_SESSION: "End Session",
  START_ANOTHER_QUEST: "Start Another Quest",
};

function roomErrorMessage(error) {
  if (error?.status === 404) {
    return "This room does not exist or has expired.";
  }
  if (error?.status === 410) {
    return "This room has expired. Refresh the display for a new code.";
  }
  if (error?.status === 409) {
    return error.message || "This action is not available right now.";
  }
  return error?.message || "The controller cannot reach the room right now.";
}

function commandEnabled(room, commandType) {
  if (!room) {
    return false;
  }

  const hasRoutine = Boolean(room.selected_routine);
  const hasSession = Boolean(room.session);
  const { status } = room;

  switch (commandType) {
    case "START_CALIBRATION":
      return hasRoutine && (status === "routine_selected" || status === "connected");
    case "START_SESSION":
      return hasRoutine && (status === "routine_selected" || status === "calibrating");
    case "PAUSE_SESSION":
      return status === "active";
    case "RESUME_SESSION":
      return status === "paused";
    case "NEXT_STRETCH":
    case "SKIP_STRETCH":
      return hasSession && ["active", "paused", "rest"].includes(status);
    case "END_SESSION":
      return ["connected", "routine_selected", "calibrating", "active", "paused", "rest", "complete"].includes(status);
    case "START_ANOTHER_QUEST":
      return ["complete", "ended"].includes(status);
    default:
      return false;
  }
}

function formatElapsed(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const remainder = String(safe % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function sessionSummary(room) {
  if (!room?.session) {
    return "No active session yet.";
  }
  const index = room.session.current_index + 1;
  return `Stretch ${index} of ${room.session.total_stretches}: ${room.session.current_name}`;
}

export async function renderControllerRoute(container, roomCode) {
  if (window.location.pathname !== `/controller/${roomCode}`) {
    window.history.replaceState({}, "", `/controller/${roomCode}`);
  }

  const state = {
    room: null,
    routines: [],
    loading: true,
    pending: "",
    error: "",
    disconnected: false,
    socket: null,
  };

  function render() {
    const room = state.room;
    const session = room?.session;
    const selectedRoutineId = room?.selected_routine?.id;
    const showResult = room?.status === "complete";
    const showEnded = room?.status === "ended";

    container.innerHTML = `
      <main class="page-shell phone-shell">
        <section class="panel narrow-panel" aria-busy="${state.loading || Boolean(state.pending)}">
          <p class="eyebrow">Phone Controller</p>
          <h1 class="phone-title">Connected to YUEDMAI screen</h1>
          <div class="status-row">
            <div class="status-pill ${state.disconnected ? "status-error" : "status-success"}" aria-live="polite">
              ${
                state.loading
                  ? "Loading room..."
                  : state.disconnected
                    ? "Controller disconnected. Refresh to reconnect."
                    : `Room ${roomCode} live`
              }
            </div>
            <div class="status-pill status-neutral">Guest mode</div>
          </div>

          ${
            state.error
              ? `
                <div class="notice notice-error">
                  <p>${state.error}</p>
                  <a class="button-link secondary-button wide-button" href="/join/${roomCode}">Back to join</a>
                </div>
              `
              : ""
          }

          <div class="surface">
            <h2>${room?.selected_routine?.name || "Choose your quest"}</h2>
            <p>${sessionSummary(room)}</p>
            ${
              session
                ? `
                  <div class="metric-row">
                    <div class="metric-box">
                      <span>Timer</span>
                      <strong>${formatElapsed(session.elapsed_seconds)}</strong>
                    </div>
                    <div class="metric-box">
                      <span>Score</span>
                      <strong>${session.total_score}</strong>
                    </div>
                    <div class="metric-box">
                      <span>Stars</span>
                      <strong>${session.total_stars}</strong>
                    </div>
                  </div>
                `
                : `<p class="fine-print">No active session. Start Calibration or Start Quest when you are ready.</p>`
            }
          </div>

          <section class="routine-list">
            ${state.routines
              .map((routine) => {
                const selected = selectedRoutineId === routine.id;
                return `
                  <article class="routine-card ${selected ? "routine-selected" : ""}">
                    <div class="routine-card-head">
                      <div>
                        <h2>${routine.name}</h2>
                        <p>${routine.description}</p>
                      </div>
                      <span class="status-pill status-neutral">${Math.round(routine.duration_seconds / 60)} minutes</span>
                    </div>
                    <p class="fine-print">Stretches: ${routine.stretches.join(", ")}</p>
                    <button
                      class="${selected ? "secondary-button" : "primary-button"} wide-button"
                      data-routine-id="${routine.id}"
                      ${
                        state.pending || !["connected", "routine_selected"].includes(room?.status || "")
                          ? "disabled"
                          : ""
                      }
                    >
                      ${selected ? "Selected" : "Select Routine"}
                    </button>
                  </article>
                `;
              })
              .join("")}
          </section>

          ${
            showResult
              ? `
                <div class="notice">
                  <p>Quest complete. Create an account later to keep XP and streaks.</p>
                </div>
              `
              : ""
          }

          ${
            showEnded
              ? `
                <div class="notice">
                  <p>This session was ended. Start another quest or return to the display for a new code.</p>
                </div>
              `
              : ""
          }

          <section class="controller-actions">
            ${renderCommandButton("START_CALIBRATION", state.pending, room)}
            ${renderCommandButton("START_SESSION", state.pending, room)}
            ${renderCommandButton("PAUSE_SESSION", state.pending, room)}
            ${renderCommandButton("RESUME_SESSION", state.pending, room)}
            ${renderCommandButton("NEXT_STRETCH", state.pending, room)}
            ${renderCommandButton("SKIP_STRETCH", state.pending, room)}
            ${renderCommandButton("START_ANOTHER_QUEST", state.pending, room)}
            ${renderCommandButton("END_SESSION", state.pending, room, { tone: "danger" })}
          </section>
        </section>
      </main>
    `;

    for (const button of container.querySelectorAll("[data-routine-id]")) {
      button.addEventListener("click", async () => {
        await handleSelectRoutine(button.dataset.routineId);
      });
    }

    for (const button of container.querySelectorAll("[data-command]")) {
      button.addEventListener("click", async () => {
        await handleCommand(button.dataset.command);
      });
    }
  }

  function renderCommandButton(commandType, pending, room, options = {}) {
    const disabled = pending || !commandEnabled(room, commandType);
    const toneClass =
      options.tone === "danger"
        ? "danger-button"
        : commandType === "START_SESSION" || commandType === "START_CALIBRATION" || commandType === "START_ANOTHER_QUEST"
          ? "primary-button"
          : "secondary-button";
    return `
      <button
        class="${toneClass} wide-button"
        type="button"
        data-command="${commandType}"
        ${disabled ? "disabled" : ""}
      >
        ${pending === commandType ? "Sending command..." : COMMAND_LABELS[commandType]}
      </button>
    `;
  }

  async function loadController() {
    state.loading = true;
    state.error = "";
    render();

    try {
      const [room, routinePayload] = await Promise.all([getRoom(roomCode), listRoomRoutines()]);
      if (!room.controller_mode || !hasControllerAccess(roomCode)) {
        window.location.replace(`/join/${roomCode}`);
        return;
      }

      state.room = room;
      state.routines = routinePayload.routines;
      state.loading = false;
      render();
      connectSocket();
    } catch (error) {
      console.error(error);
      state.loading = false;
      state.error = roomErrorMessage(error);
      render();
    }
  }

  function connectSocket() {
    if (state.socket) {
      return;
    }

    state.socket = openRoomSocket(roomCode, "controller", {
      onRoom(room) {
        state.room = room;
        state.pending = "";
        state.disconnected = false;
        render();
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

  async function handleSelectRoutine(routineId) {
    if (state.pending) {
      return;
    }

    state.pending = `ROUTINE:${routineId}`;
    state.error = "";
    render();

    try {
      state.room = await selectRoomRoutine(roomCode, routineId);
      state.pending = "";
      render();
    } catch (error) {
      console.error(error);
      state.pending = "";
      state.error = roomErrorMessage(error);
      render();
    }
  }

  async function handleCommand(commandType) {
    if (state.pending || !commandEnabled(state.room, commandType)) {
      return;
    }

    state.pending = commandType;
    state.error = "";
    render();

    try {
      state.room = await sendRoomCommand(roomCode, commandType);
      state.pending = "";
      render();
    } catch (error) {
      console.error(error);
      state.pending = "";
      state.error = roomErrorMessage(error);
      render();
    }
  }

  render();
  await loadController();
}
