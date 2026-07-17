(() => {
  const form = document.getElementById("audit-filter-form");
  const typeSelect = document.getElementById("audit-event-type");
  if (form && typeSelect) {
    typeSelect.addEventListener("change", () => form.requestSubmit());
  }

  // Human-friendly local timestamps
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
