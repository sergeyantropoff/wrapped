(() => {
  const form = document.getElementById("audit-filter-form");
  const typeSelect = document.getElementById("audit-event-type");
  const perPage = document.getElementById("audit-per-page");
  const clearForm = document.getElementById("audit-clear-form");

  function resetToFirstPageAndSubmit() {
    if (!form) return;
    const pageInput = form.querySelector('input[name="page"]');
    if (pageInput) pageInput.value = "1";
    form.requestSubmit();
  }

  typeSelect?.addEventListener("change", resetToFirstPageAndSubmit);
  perPage?.addEventListener("change", resetToFirstPageAndSubmit);

  clearForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const t = (k, fallback) => window.WrappedI18n?.t(k) || fallback;
    const ok = await window.WrappedModal.confirm({
      title: t("admin.audit.clearConfirmTitle", "Clear audit"),
      message: t(
        "admin.audit.clearConfirm",
        "Delete all audit events? This cannot be undone."
      ),
      confirmLabel: t("admin.audit.clearConfirmOk", "Clear all"),
      cancelLabel: t("modal.confirm.cancel", "Cancel"),
      danger: true,
    });
    if (ok) clearForm.submit();
  });

  document.querySelectorAll(".audit-time[data-ts]").forEach((el) => {
    const raw = el.getAttribute("data-ts");
    if (!raw) return;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return;
    const locale = window.WrappedI18n?.locale?.() || undefined;
    el.textContent = new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(d);
    el.title = raw;
  });
})();
