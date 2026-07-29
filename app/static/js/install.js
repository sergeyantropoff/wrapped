(() => {
  const t = (k, vars) => window.WrappedI18n?.t(k, vars) || k;
  const btn = document.getElementById("install-app");
  if (!btn) return;

  let deferredPrompt = null;
  const isIos =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  function syncLabels() {
    btn.setAttribute("aria-label", t("install.aria"));
    const tip = btn.querySelector(".ui-tooltip");
    if (tip) tip.textContent = t(isIos ? "install.iosTip" : "install.tip");
  }

  function showBtn() {
    if (isStandalone) {
      btn.classList.add("hidden");
      return;
    }
    btn.classList.remove("hidden");
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showBtn();
    syncLabels();
  });

  if (isIos && !isStandalone) {
    showBtn();
  }

  btn.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } catch {
        /* ignore */
      }
      deferredPrompt = null;
      return;
    }
    if (isIos) {
      window.WrappedUI?.showBusy?.(t("install.iosTip"));
      setTimeout(() => window.WrappedUI?.hideBusy?.(), 2200);
    }
  });

  if (window.WrappedI18n?.onChange) {
    window.WrappedI18n.onChange(syncLabels);
  }
  syncLabels();
})();
