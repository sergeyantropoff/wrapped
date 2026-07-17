(() => {
  const KEY = "wrapped.theme";

  function preferred() {
    return localStorage.getItem(KEY) || "dark";
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
    const next = preferred() === "dark" ? "light" : "dark";
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
