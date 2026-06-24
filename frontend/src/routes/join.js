import { getRoom, joinRoom } from "../api.js";
import { hasControllerAccess, rememberControllerAccess } from "../router.js";

function roomErrorMessage(error) {
  if (error?.status === 404) {
    return "This room does not exist or has expired.";
  }
  if (error?.status === 410) {
    return "This room has expired. Refresh the display for a new code.";
  }
  if (error?.status === 409) {
    return "A controller is already connected to this room.";
  }
  return error?.message || "The room is unavailable right now. Refresh the display and try again.";
}

export async function renderJoinRoute(container, roomCode) {
  if (window.location.pathname !== `/join/${roomCode}`) {
    window.history.replaceState({}, "", `/join/${roomCode}`);
  }

  const state = {
    room: null,
    error: "",
    loading: true,
    joining: false,
    loginMessage: "",
  };

  function render() {
    const roomReady = Boolean(state.room);
    const alreadyConnected = roomReady && state.room.controller_mode === "guest" && !hasControllerAccess(roomCode);
    const localAccess = roomReady && state.room.controller_mode === "guest" && hasControllerAccess(roomCode);

    container.innerHTML = `
      <main class="page-shell phone-shell">
        <section class="panel narrow-panel" aria-busy="${state.loading || state.joining}">
          <p class="eyebrow">Join Room</p>
          <h1 class="phone-title">YUEDMAI</h1>
          <p class="status-copy" aria-live="polite">
            ${state.loading ? "Fetching room..." : roomReady ? `Room code ${roomCode}` : "Room unavailable"}
          </p>
          <div class="status-pill ${state.error ? "status-error" : "status-neutral"}" aria-live="polite">
            ${state.error || (state.joining ? "Joining room..." : roomReady ? "Ready to pair" : "Loading")}
          </div>

          ${
            state.error
              ? `
                <div class="notice notice-error">
                  <p>${state.error}</p>
                  <a class="button-link secondary-button wide-button" href="/display">Refresh the display</a>
                </div>
              `
              : `
                <div class="auth-copy">
                  <div class="surface">
                    <h2>Continue without login</h2>
                    <p>Play now. Your result is temporary.</p>
                  </div>
                  <div class="surface">
                    <h2>Log in</h2>
                    <p>Save XP, streaks, and badges later.</p>
                  </div>
                </div>
                ${
                  localAccess
                    ? `
                      <div class="notice">
                        <p>This phone already joined this room.</p>
                        <a class="button-link primary-button wide-button" href="/controller/${roomCode}">Open controller</a>
                      </div>
                    `
                    : `
                      <button
                        id="continue-guest"
                        class="primary-button wide-button"
                        ${state.joining || alreadyConnected || !roomReady ? "disabled" : ""}
                      >
                        ${state.joining ? "Joining room..." : "Continue without login"}
                      </button>
                    `
                }
                <button id="login-soon" class="secondary-button wide-button" type="button">
                  Log in
                </button>
                ${
                  alreadyConnected
                    ? `
                      <div class="notice notice-error">
                        <p>A controller is already connected to this room. Use the original phone or refresh the display for a new code.</p>
                      </div>
                    `
                    : ""
                }
                ${
                  state.loginMessage
                    ? `
                      <div class="notice">
                        <p>${state.loginMessage}</p>
                      </div>
                    `
                    : ""
                }
              `
          }
        </section>
      </main>
    `;

    const continueButton = container.querySelector("#continue-guest");
    continueButton?.addEventListener("click", handleContinueAsGuest);

    const loginButton = container.querySelector("#login-soon");
    loginButton?.addEventListener("click", () => {
      state.loginMessage = "Login is coming soon. Continue as guest for this version.";
      render();
    });
  }

  async function loadRoom() {
    state.loading = true;
    state.error = "";
    render();

    try {
      state.room = await getRoom(roomCode);
    } catch (error) {
      console.error(error);
      state.room = null;
      state.error = roomErrorMessage(error);
    } finally {
      state.loading = false;
      render();
    }
  }

  async function handleContinueAsGuest() {
    if (state.joining) {
      return;
    }

    state.joining = true;
    state.error = "";
    render();

    try {
      const room = await joinRoom(roomCode, "guest");
      rememberControllerAccess(room.code);
      window.location.assign(`/controller/${room.code}`);
    } catch (error) {
      console.error(error);
      state.error = roomErrorMessage(error);
      state.joining = false;
      render();
    }
  }

  render();
  await loadRoom();
}
