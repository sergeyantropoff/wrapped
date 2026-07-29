(() => {
  const top = document.getElementById("admin-top");
  const toggle = document.getElementById("admin-nav-toggle");
  const nav = document.getElementById("admin-nav");
  if (!top || !toggle || !nav) return;

  const mq = window.matchMedia("(max-width: 860px)");

  const syncLabel = () => {
    const open = top.classList.contains("is-nav-open");
    const key = open ? "admin.nav.closeMenu" : "admin.nav.openMenu";
    const label = window.WrappedI18n?.t(key) || (open ? "Close menu" : "Menu");
    toggle.setAttribute("aria-label", label);
    toggle.setAttribute("title", label);
  };

  const setOpen = (open) => {
    top.classList.toggle("is-nav-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    const icon = toggle.querySelector("i");
    if (icon) {
      icon.className = open ? "fa-solid fa-xmark" : "fa-solid fa-bars";
    }
    syncLabel();
  };

  toggle.addEventListener("click", () => {
    setOpen(!top.classList.contains("is-nav-open"));
  });

  nav.addEventListener("click", (e) => {
    if (!mq.matches) return;
    if (e.target.closest("a.admin-nav-link")) setOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && top.classList.contains("is-nav-open")) {
      setOpen(false);
      toggle.focus();
    }
  });

  mq.addEventListener("change", () => {
    if (!mq.matches) setOpen(false);
    else syncLabel();
  });

  if (window.WrappedI18n?.onChange) {
    window.WrappedI18n.onChange(syncLabel);
  }
  syncLabel();
})();
