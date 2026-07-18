(() => {
  let busyEl = null;

  function ensureBusy() {
    if (busyEl) return busyEl;
    busyEl = document.createElement("div");
    busyEl.id = "busy-overlay";
    busyEl.className = "busy-overlay hidden";
    busyEl.setAttribute("aria-live", "polite");
    busyEl.setAttribute("aria-busy", "true");
    busyEl.innerHTML = `
      <div class="busy-card">
        <span class="busy-logo" aria-hidden="true">
          <img src="/static/favicon.svg" alt="" width="48" height="48" />
        </span>
        <p class="busy-text" data-busy-label></p>
      </div>
    `;
    document.body.appendChild(busyEl);
    return busyEl;
  }

  function showBusy(message) {
    const el = ensureBusy();
    const label = el.querySelector("[data-busy-label]");
    if (label) {
      label.textContent =
        message || window.WrappedI18n?.t("common.working") || "Working…";
    }
    el.classList.remove("hidden");
    document.body.classList.add("busy-open");
  }

  function hideBusy() {
    if (!busyEl) return;
    busyEl.classList.add("hidden");
    document.body.classList.remove("busy-open");
  }

  function formatBytes(n) {
    const bytes = Number(n) || 0;
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb < 10 ? mb.toFixed(2) : mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
  }

  window.WrappedUI = { showBusy, hideBusy, formatBytes };
})();
