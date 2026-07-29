(() => {
  const KEY = "wrapped.theme";

  function systemTheme() {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function preferred() {
    const stored = localStorage.getItem(KEY);
    if (stored === "light" || stored === "dark") return stored;
    return systemTheme();
  }

  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const sun = document.getElementById("theme-icon-sun");
    const moon = document.getElementById("theme-icon-moon");
    if (sun && moon) {
      sun.classList.toggle("hidden", theme !== "light");
      moon.classList.toggle("hidden", theme !== "dark");
    }
  }

  function toggle() {
    const current = document.documentElement.getAttribute("data-theme") || preferred();
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem(KEY, next);
    apply(next);
  }

  apply(preferred());
  document.addEventListener("DOMContentLoaded", () => {
    apply(preferred());
    const btn = document.getElementById("theme-toggle");
    if (btn) btn.addEventListener("click", toggle);
  });
})();
