(() => {
  const t = (k, vars) => window.WrappedI18n.t(k, vars);
  let settings = null;
  const objectUrls = [];

  const els = {
    token: document.getElementById("token-input"),
    password: document.getElementById("unwrap-password"),
    btn: document.getElementById("unwrap-btn"),
    error: document.getElementById("form-error"),
    errorTitle: document.getElementById("form-error-title"),
    errorHint: document.getElementById("form-error-hint"),
    errorAttempts: document.getElementById("form-error-attempts"),
    form: document.getElementById("unwrap-form"),
    head: document.getElementById("unwrap-head"),
    state: document.getElementById("unwrap-state"),
    stateTitle: document.getElementById("unwrap-state-title"),
    stateHint: document.getElementById("unwrap-state-hint"),
    stateFa: document.getElementById("unwrap-state-fa"),
    result: document.getElementById("result-panel"),
    items: document.getElementById("items"),
    captchaSlot: document.getElementById("captcha-slot"),
    lightbox: document.getElementById("image-lightbox"),
    lightboxImg: document.getElementById("lightbox-img"),
    lightboxCaption: document.getElementById("lightbox-caption"),
    lightboxClose: document.getElementById("lightbox-close"),
    downloadAll: document.getElementById("download-all"),
  };

  let lastPack = null;
  let lastWrapId = null;

  function showError(title, hint, attempts) {
    if (!els.error) return;
    if (els.errorTitle) els.errorTitle.textContent = title || "";
    if (els.errorHint) {
      if (hint) {
        els.errorHint.textContent = hint;
        els.errorHint.classList.remove("hidden");
      } else {
        els.errorHint.textContent = "";
        els.errorHint.classList.add("hidden");
      }
    }
    if (els.errorAttempts) {
      if (attempts) {
        els.errorAttempts.textContent = attempts;
        els.errorAttempts.classList.remove("hidden");
      } else {
        els.errorAttempts.textContent = "";
        els.errorAttempts.classList.add("hidden");
      }
    }
    if (!els.errorTitle) els.error.textContent = [title, hint, attempts].filter(Boolean).join(" ");
    els.error.classList.remove("hidden");
  }

  function clearError() {
    if (!els.error) return;
    els.error.classList.add("hidden");
    if (els.errorTitle) els.errorTitle.textContent = "";
    if (els.errorHint) {
      els.errorHint.textContent = "";
      els.errorHint.classList.add("hidden");
    }
    if (els.errorAttempts) {
      els.errorAttempts.textContent = "";
      els.errorAttempts.classList.add("hidden");
    }
  }

  function showState({ title, hint, icon = "fa-link-slash" }) {
    clearError();
    els.form?.classList.add("hidden");
    els.head?.classList.add("hidden");
    els.result?.classList.add("hidden");
    if (els.stateFa) els.stateFa.className = `fa-solid ${icon}`;
    if (els.stateTitle) els.stateTitle.textContent = title || "";
    if (els.stateHint) els.stateHint.textContent = hint || "";
    els.state?.classList.remove("hidden");
  }

  function attemptsLabel(detail) {
    const n = Number(detail?.attempts_remaining);
    const max = Number(detail?.attempts_max);
    if (!Number.isFinite(n) || !Number.isFinite(max)) return "";
    return t("unwrap.attemptsLeft", { n, max });
  }

  function trackUrl(url) {
    objectUrls.push(url);
    return url;
  }

  function revokeAllUrls() {
    while (objectUrls.length) {
      try {
        URL.revokeObjectURL(objectUrls.pop());
      } catch {
        /* ignore */
      }
    }
  }

  function closeLightbox() {
    if (!els.lightbox) return;
    els.lightbox.classList.add("hidden");
    document.body.classList.remove("modal-open");
    if (els.lightboxImg) {
      els.lightboxImg.removeAttribute("src");
      els.lightboxImg.alt = "";
    }
    if (els.lightboxCaption) els.lightboxCaption.textContent = "";
  }

  function openLightbox(src, caption) {
    if (!els.lightbox || !els.lightboxImg) return;
    els.lightboxImg.src = src;
    els.lightboxImg.alt = caption || "";
    if (els.lightboxCaption) els.lightboxCaption.textContent = caption || "";
    els.lightbox.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }

  function loadCaptcha() {
    els.captchaSlot.innerHTML = "";
    const provider = settings.captcha_provider;
    if (provider === "turnstile" && settings.turnstile_site_key) {
      const div = document.createElement("div");
      div.className = "cf-turnstile";
      div.dataset.sitekey = settings.turnstile_site_key;
      els.captchaSlot.appendChild(div);
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      s.async = true;
      document.body.appendChild(s);
    } else if (provider === "hcaptcha" && settings.hcaptcha_site_key) {
      const div = document.createElement("div");
      div.className = "h-captcha";
      div.dataset.sitekey = settings.hcaptcha_site_key;
      els.captchaSlot.appendChild(div);
      const s = document.createElement("script");
      s.src = "https://js.hcaptcha.com/1/api.js";
      s.async = true;
      document.body.appendChild(s);
    }
  }

  function captchaToken() {
    if (settings.captcha_provider === "turnstile" && window.turnstile) {
      return window.turnstile.getResponse?.() || "";
    }
    if (settings.captcha_provider === "hcaptcha" && window.hcaptcha) {
      return window.hcaptcha.getResponse?.() || "";
    }
    return "";
  }

  function resolveKey(parsed) {
    if (parsed.key) return parsed.key;
    if (location.hash && location.hash.length > 1) return location.hash.slice(1);
    return null;
  }

  function downloadBlob(name, blob) {
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function makeDownloadBtn(onClick) {
    const btn = document.createElement("button");
    btn.className = "btn download-btn";
    btn.type = "button";
    btn.innerHTML = `<i class="fa-solid fa-download" aria-hidden="true"></i><span>${t("common.download")}</span>`;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function focusPassword({ select = false } = {}) {
    if (!els.password) return;
    els.password.focus();
    if (select) els.password.select?.();
  }

  function makeCopyBtn(getText) {
    const btn = document.createElement("button");
    btn.className = "btn copy-btn";
    btn.type = "button";
    const label = () =>
      `<i class="fa-solid fa-copy" aria-hidden="true"></i><span>${t("common.copy")}</span>`;
    btn.innerHTML = label();
    btn.addEventListener("click", async () => {
      try {
        if (window.WrappedUI?.copyText) {
          await window.WrappedUI.copyText(getText() || "");
        } else {
          await navigator.clipboard.writeText(getText() || "");
        }
        btn.innerHTML = `<i class="fa-solid fa-check" aria-hidden="true"></i><span>${t("common.copied")}</span>`;
        setTimeout(() => {
          btn.innerHTML = label();
        }, 1200);
      } catch {
        /* ignore */
      }
    });
    return btn;
  }

  function itemToBlob(item) {
    if (item.type === "text") {
      const lang = item.language || "plaintext";
      return {
        name: `wrapped-${lang}.txt`,
        blob: new Blob([item.content || ""], { type: "text/plain" }),
      };
    }
    if (item.type === "file") {
      const bytes = window.WrappedCrypto.base64ToBytes(item.data_b64);
      const mime = item.mime || "application/octet-stream";
      return {
        name: item.name || "file",
        blob: new Blob([bytes], { type: mime }),
      };
    }
    return null;
  }

  function uniqueZipName(name, used) {
    let base = name || "file";
    if (!used.has(base)) {
      used.add(base);
      return base;
    }
    const dot = base.lastIndexOf(".");
    const stem = dot > 0 ? base.slice(0, dot) : base;
    const ext = dot > 0 ? base.slice(dot) : "";
    let i = 2;
    let candidate = `${stem}-${i}${ext}`;
    while (used.has(candidate)) {
      i += 1;
      candidate = `${stem}-${i}${ext}`;
    }
    used.add(candidate);
    return candidate;
  }

  async function downloadAllZip() {
    if (!lastPack || typeof JSZip === "undefined") return;
    const items = lastPack.items || [];
    if (items.length < 2) return;
    const zip = new JSZip();
    const used = new Set();
    for (const item of items) {
      const entry = itemToBlob(item);
      if (!entry) continue;
      zip.file(uniqueZipName(entry.name, used), entry.blob);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const id = lastWrapId || "pack";
    downloadBlob(`wrapped-${id}.zip`, blob);
  }

  function syncDownloadAll() {
    if (!els.downloadAll) return;
    const count = lastPack?.items?.length || 0;
    const show = count >= 2 && typeof JSZip !== "undefined";
    els.downloadAll.classList.toggle("hidden", !show);
    els.downloadAll.setAttribute("aria-label", t("unwrap.downloadAll"));
  }

  function renderPackage(pack) {
    revokeAllUrls();
    lastPack = pack;
    els.items.innerHTML = "";
    for (const item of pack.items || []) {
      const card = document.createElement("div");
      card.className = "item-card";
      if (item.type === "text") {
        const lang = item.language || "plaintext";
        const text = item.content || "";
        const head = document.createElement("div");
        head.className = "item-card-head";
        const meta = document.createElement("div");
        const strong = document.createElement("strong");
        strong.textContent = "text";
        meta.appendChild(strong);
        meta.appendChild(document.createTextNode(" · "));
        const langEl = document.createElement("span");
        langEl.className = "mono";
        langEl.textContent = lang;
        meta.appendChild(langEl);
        head.appendChild(meta);
        const actions = document.createElement("div");
        actions.className = "item-card-actions";
        actions.appendChild(makeCopyBtn(() => text));
        actions.appendChild(
          makeDownloadBtn(() => {
            downloadBlob(`wrapped-${lang}.txt`, new Blob([text], { type: "text/plain" }));
          })
        );
        head.appendChild(actions);
        card.appendChild(head);
        const pre = document.createElement("pre");
        pre.className = "item-text-pre";
        const code = document.createElement("code");
        pre.appendChild(code);
        card.appendChild(pre);
        window.WrappedHighlight.highlightElement(code, text, lang);
      } else if (item.type === "file") {
        const bytes = window.WrappedCrypto.base64ToBytes(item.data_b64);
        const mime = item.mime || "application/octet-stream";
        const blob = new Blob([bytes], { type: mime });
        const name = item.name || "file";
        const head = document.createElement("div");
        head.className = "item-card-head";
        const meta = document.createElement("div");
        const strong = document.createElement("strong");
        strong.textContent = name;
        meta.appendChild(strong);
        meta.appendChild(document.createTextNode(" · "));
        const mimeEl = document.createElement("span");
        mimeEl.className = "mono";
        mimeEl.textContent = mime;
        meta.appendChild(mimeEl);
        meta.appendChild(document.createTextNode(` · ${window.WrappedUI.formatBytes(bytes.length)}`));
        head.appendChild(meta);
        head.appendChild(makeDownloadBtn(() => downloadBlob(name, blob)));
        card.appendChild(head);
        if (mime.startsWith("image/")) {
          const url = trackUrl(URL.createObjectURL(blob));
          const img = document.createElement("img");
          img.alt = name;
          img.src = url;
          img.className = "item-preview-img";
          img.loading = "lazy";
          img.addEventListener("click", () => openLightbox(url, name));
          card.appendChild(img);
          const tip = document.createElement("p");
          tip.className = "hint item-preview-hint";
          tip.textContent = t("unwrap.tapPreview");
          card.appendChild(tip);
        }
      }
      els.items.appendChild(card);
    }
    syncDownloadAll();
  }

  function mapHttpError(resp, detail) {
    if (resp.status === 429 || detail === "rate_limited") {
      showError(t("unwrap.rateLimited"), t("unwrap.rateLimitedHint"));
      return;
    }
    if (detail === "captcha_failed" || resp.status === 400) {
      if (detail === "captcha_failed") {
        showError(t("unwrap.captchaFailed"), t("unwrap.captchaFailedHint"));
        return;
      }
    }
    if (resp.status === 500 || detail === "storage_error") {
      showError(t("unwrap.storageError"), t("unwrap.storageErrorHint"));
      return;
    }
    if (resp.status === 410 || detail === "unavailable") {
      showState({
        title: t("unwrap.goneTitle"),
        hint: t("unwrap.goneHint"),
        icon: "fa-link-slash",
      });
      return;
    }
    showError(t("unwrap.unavailable"), t("unwrap.unavailableHint"));
  }

  els.lightboxClose?.addEventListener("click", closeLightbox);
  els.lightbox?.addEventListener("click", (e) => {
    if (e.target === els.lightbox) closeLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && els.lightbox && !els.lightbox.classList.contains("hidden")) {
      closeLightbox();
    }
  });
  window.addEventListener("pagehide", revokeAllUrls);

  els.btn.addEventListener("click", async () => {
    clearError();
    const parsed = window.WrappedCrypto.parseToken(els.token.value);
    if (!parsed) {
      showError(t("unwrap.badToken"), t("unwrap.badTokenHint"));
      return;
    }
    const key = resolveKey(parsed);
    if (!key) {
      showError(t("unwrap.needKey"));
      return;
    }

    els.btn.disabled = true;
    window.WrappedUI.showBusy(t("unwrap.workingFetch"));
    try {
      const resp = await fetch(`/api/v1/wraps/${encodeURIComponent(parsed.wrapId)}/unwrap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: els.password.value || null,
          captcha_token: captchaToken() || null,
        }),
      });
      if (resp.status === 403) {
        const err = await resp.json().catch(() => ({}));
        const detail = err.detail;
        if (detail && typeof detail === "object") {
          if (detail.code === "password_locked") {
            showState({
              title: t("unwrap.passwordLocked"),
              hint: t("unwrap.passwordLockedHint"),
              icon: "fa-shield-halved",
            });
            return;
          }
          if (detail.code === "password_required") {
            showError(
              t("unwrap.passwordRequired"),
              t("unwrap.passwordRequiredHint"),
              attemptsLabel(detail)
            );
            focusPassword({ select: true });
            return;
          }
          if (detail.code === "bad_password") {
            showError(
              t("unwrap.badPassword"),
              t("unwrap.badPasswordHint"),
              attemptsLabel(detail)
            );
            focusPassword({ select: true });
            return;
          }
        }
        showError(t("unwrap.badPassword"), t("unwrap.badPasswordHint"));
        focusPassword({ select: true });
        return;
      }
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        mapHttpError(resp, err.detail);
        return;
      }
      const data = await resp.json();
      window.WrappedUI.showBusy(t("unwrap.workingDecrypt"));
      const ciphertext = window.WrappedCrypto.base64ToBytes(data.ciphertext_b64);
      let pack;
      try {
        pack = await window.WrappedCrypto.decryptPackage(
          ciphertext,
          key,
          els.password.value || null
        );
      } catch (err) {
        if (err.message === "password_required") {
          showError(t("unwrap.passwordRequired"), t("unwrap.passwordRequiredHint"));
          focusPassword({ select: true });
          return;
        }
        if (err.message === "bad_password") {
          showError(t("unwrap.badPassword"), t("unwrap.badPasswordHint"));
          focusPassword({ select: true });
          return;
        }
        showError(t("unwrap.decryptFailed"), t("unwrap.decryptFailedHint"));
        return;
      }
      lastWrapId = parsed.wrapId;
      renderPackage(pack);
      els.form.classList.add("hidden");
      els.head?.classList.add("hidden");
      els.state?.classList.add("hidden");
      els.result.classList.remove("hidden");
      history.replaceState(null, "", location.pathname);
    } catch {
      showError(t("common.error"));
    } finally {
      window.WrappedUI.hideBusy();
      els.btn.disabled = false;
    }
  });

  els.password?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      els.btn?.click();
    }
  });

  els.downloadAll?.addEventListener("click", () => {
    downloadAllZip().catch(() => {});
  });

  if (window.WrappedI18n.onChange) {
    window.WrappedI18n.onChange(() => {
      syncDownloadAll();
    });
  }

  async function init() {
    const resp = await fetch("/api/v1/settings");
    settings = await resp.json();
    loadCaptcha();

    const pathMatch = location.pathname.match(/\/w\/([A-Za-z0-9]+)/);
    if (pathMatch && !els.token.value) {
      els.token.value = pathMatch[1];
    }
  }

  init().catch(() => showError(t("common.error")));
})();
