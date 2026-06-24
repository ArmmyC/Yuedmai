import "./styles.css";

import { registerServiceWorker } from "./notifications.js";
import { parseRoute } from "./router.js";
import { renderControllerRoute } from "./routes/controller.js";
import { renderDisplayRoute } from "./routes/display.js";
import { renderHomeRoute } from "./routes/home.js";
import { renderJoinRoute } from "./routes/join.js";

const app = document.getElementById("app");

function renderNotFound() {
  app.innerHTML = `
    <main class="page-shell phone-shell">
      <section class="panel narrow-panel">
        <p class="eyebrow">Not Found</p>
        <h1 class="phone-title">This page is unavailable</h1>
        <p class="status-copy">Try opening the display screen to create a new room.</p>
        <a class="button-link primary-button wide-button" href="/display">Open display</a>
      </section>
    </main>
  `;
}

async function main() {
  try {
    await registerServiceWorker();
  } catch (error) {
    console.error("Service worker registration failed", error);
  }

  const route = parseRoute(window.location.pathname);

  if (route.name === "home") {
    renderHomeRoute(app);
    return;
  }

  if (route.name === "display-create") {
    await renderDisplayRoute(app, null);
    return;
  }

  if (route.name === "display-room") {
    await renderDisplayRoute(app, route.roomCode);
    return;
  }

  if (route.name === "join") {
    await renderJoinRoute(app, route.roomCode);
    return;
  }

  if (route.name === "controller") {
    await renderControllerRoute(app, route.roomCode);
    return;
  }

  renderNotFound();
}

main().catch((error) => {
  console.error(error);
  app.innerHTML = `
    <main class="page-shell phone-shell">
      <section class="panel narrow-panel">
        <p class="eyebrow">App Error</p>
        <h1 class="phone-title">Something went wrong</h1>
        <p class="status-copy">${error.message || "Refresh the page and try again."}</p>
        <a class="button-link primary-button wide-button" href="/display">Open display</a>
      </section>
    </main>
  `;
});
