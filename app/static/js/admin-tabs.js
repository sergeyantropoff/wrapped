(() => {
  const root = document.getElementById("admin-tabs");
  if (!root) return;

  const tabs = [...root.querySelectorAll(".admin-tab")];
  const panels = [...root.querySelectorAll(".admin-tabpanel")];

  function activate(name) {
    const id = name || "limits";
    tabs.forEach((tab) => {
      const on = tab.dataset.tab === id;
      tab.classList.toggle("active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });
    panels.forEach((panel) => {
      const on = panel.dataset.panel === id;
      panel.classList.toggle("active", on);
      panel.hidden = !on;
    });
    const url = new URL(location.href);
    url.hash = id;
    history.replaceState(null, "", url);
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => activate(tab.dataset.tab));
  });

  const fromHash = (location.hash || "").replace(/^#/, "");
  const initial = tabs.some((t) => t.dataset.tab === fromHash) ? fromHash : "limits";
  activate(initial);
})();
