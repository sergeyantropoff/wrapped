(() => {
  const modal = document.getElementById("about-modal");
  const toggle = document.getElementById("about-toggle");
  if (!modal || !toggle) return;

  function syncToggleLabels() {
    const label = window.WrappedI18n?.t("about.open") || "About Wrapped";
    toggle.setAttribute("title", label);
    toggle.setAttribute("aria-label", label);
  }

  function openModal() {
    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");
    modal.querySelector("[data-about-close].btn")?.focus?.();
  }

  function closeModal() {
    modal.classList.add("hidden");
    document.body.classList.remove("modal-open");
    toggle.focus?.();
  }

  toggle.addEventListener("click", openModal);
  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-about-close]")) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
  });

  if (window.WrappedI18n?.onChange) {
    window.WrappedI18n.onChange(syncToggleLabels);
  }
  syncToggleLabels();
})();
