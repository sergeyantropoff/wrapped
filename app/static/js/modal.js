(() => {
  let root = null;
  let resolveFn = null;

  function ensure() {
    if (root) return root;
    root = document.createElement("div");
    root.id = "confirm-modal";
    root.className = "modal-root hidden";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.innerHTML = `
      <div class="modal-backdrop" data-modal-cancel></div>
      <div class="modal-panel" role="document">
        <h2 class="modal-title" id="confirm-modal-title"></h2>
        <p class="modal-message" id="confirm-modal-message"></p>
        <div class="modal-actions">
          <button type="button" class="btn" data-modal-cancel id="confirm-modal-cancel"></button>
          <button type="button" class="btn danger" data-modal-ok id="confirm-modal-ok"></button>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    root.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest("[data-modal-cancel]")) finish(false);
      if (t.closest("[data-modal-ok]")) finish(true);
    });

    document.addEventListener("keydown", (e) => {
      if (!root || root.classList.contains("hidden")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      }
    });

    return root;
  }

  function finish(ok) {
    if (!root || root.classList.contains("hidden")) return;
    root.classList.add("hidden");
    document.body.classList.remove("modal-open");
    const fn = resolveFn;
    resolveFn = null;
    if (fn) fn(ok);
  }

  function t(key, fallback) {
    return window.WrappedI18n?.t(key) || fallback;
  }

  /**
   * @param {{ title?: string, message: string, confirmLabel?: string, cancelLabel?: string, danger?: boolean }} opts
   * @returns {Promise<boolean>}
   */
  function confirm(opts) {
    const el = ensure();
    const title = opts.title || t("modal.confirm.title", "Confirm");
    const message = opts.message || "";
    const confirmLabel = opts.confirmLabel || t("modal.confirm.ok", "Confirm");
    const cancelLabel = opts.cancelLabel || t("modal.confirm.cancel", "Cancel");
    const danger = opts.danger !== false;

    el.querySelector("#confirm-modal-title").textContent = title;
    el.querySelector("#confirm-modal-message").textContent = message;
    const okBtn = el.querySelector("#confirm-modal-ok");
    const cancelBtn = el.querySelector("#confirm-modal-cancel");
    okBtn.textContent = confirmLabel;
    cancelBtn.textContent = cancelLabel;
    okBtn.className = danger ? "btn danger" : "btn primary";

    el.classList.remove("hidden");
    document.body.classList.add("modal-open");
    okBtn.focus();

    return new Promise((resolve) => {
      resolveFn = resolve;
    });
  }

  window.WrappedModal = { confirm };
})();
