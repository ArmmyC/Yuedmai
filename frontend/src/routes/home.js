export function renderHomeRoute(container) {
  container.innerHTML = `
    <main class="page-shell landing-shell">
      <section class="hero-panel">
        <p class="eyebrow">Two-Screen Quest</p>
        <h1>Stretch better. Play daily.</h1>
        <p class="lede">
          Launch a shared display, show a QR code, and use your phone as the private YUEDMAI controller.
        </p>
        <div class="button-row">
          <a class="button-link primary-button" href="/display">Open Display Screen</a>
        </div>
        <p class="fine-print">
          Scan the room QR with your phone, continue as a guest, choose Quick Reset, and control the quest from there.
        </p>
      </section>
    </main>
  `;
}
