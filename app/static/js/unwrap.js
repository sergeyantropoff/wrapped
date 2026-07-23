(() => {
  const t = (k, vars) => window.WrappedI18n.t(k, vars);
  let settings = null;

  const els = {
    token: document.getElementById("token-input"),
    password: document.getElementById("unwrap-password"),
    btn: document.getElementById("unwrap-btn"),
    error: document.getElementById("form-error"),
    errorTitle: document.getElementById("form-error-title"),
    errorHint: document.getElementById("form-error-hint"),
    errorAttempts: document.getElementById("form-error-attempts"),
    form: document.getElementById("unwrap-form"),
    result: document.getElementById("result-panel"),
    items: document.getElementById("items"),
    captchaSlot: document.getElementById("captcha-slot"),
  };

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
    // Fallback if structured nodes missing
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

  function attemptsLabel(detail) {
    const n = Number(detail?.attempts_remaining);
    const max = Number(detail?.attempts_max);
    if (!Number.isFinite(n) || !Number.isFinite(max)) return "";
    return t("unwrap.attemptsLeft", { n, max });
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
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function makeDownloadBtn(onClick) {
    const btn = document.createElement("button");
    btn.className = "btn download-btn";
    btn.type = "button";
    btn.innerHTML = `<i class="fa-solid fa-download" aria-hidden="true"></i><span>${t("common.download")}</span>`;
    btn.addEventListener("click", onClick);
    return btn;
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
        await navigator.clipboard.writeText(getText() || "");
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

  function renderPackage(pack) {
    els.items.innerHTML = "";
    for (const item of pack.items || []) {
      const card = document.createElement("div");
      card.className = "item-card";
      if (item.type === "text") {
        const lang = item.language || "plaintext";
        const text = item.content || "";
        const head = document.createElement("div");
        head.className = "item-card-head";
        head.innerHTML = `<div><strong>text</strong> · <span class="mono">${lang}</span></div>`;
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
        const blob = new Blob([bytes], { type: item.mime || "application/octet-stream" });
        const head = document.createElement("div");
        head.className = "item-card-head";
        head.innerHTML = `<div><strong>${item.name}</strong> · <span class="mono">${item.mime}</span> · ${window.WrappedUI.formatBytes(bytes.length)}</div>`;
        head.appendChild(makeDownloadBtn(() => downloadBlob(item.name || "file", blob)));
        card.appendChild(head);
        if ((item.mime || "").startsWith("image/")) {
          const img = document.createElement("img");
          img.alt = item.name;
          img.src = URL.createObjectURL(blob);
          card.appendChild(img);
        }
      }
      els.items.appendChild(card);
    }
  }

  els.btn.addEventListener("click", async () => {
    clearError();
    const parsed = window.WrappedCrypto.parseToken(els.token.value);
    if (!parsed) {
      showError(t("unwrap.unavailable"));
      return;
    }
    const key = resolveKey(parsed);
    if (!key) {
      showError(t("unwrap.needKey"));
      return;
    }

    els.btn.disabled = true;
    window.WrappedUI.showBusy(t("unwrap.working"));
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
            showError(
              t("unwrap.passwordLocked"),
              t("unwrap.passwordLockedHint")
            );
            return;
          }
          if (detail.code === "password_required") {
            showError(
              t("unwrap.passwordRequired"),
              t("unwrap.passwordRequiredHint"),
              attemptsLabel(detail)
            );
            els.password?.focus();
            return;
          }
          if (detail.code === "bad_password") {
            showError(
              t("unwrap.badPassword"),
              t("unwrap.badPasswordHint"),
              attemptsLabel(detail)
            );
            els.password?.focus();
            els.password?.select?.();
            return;
          }
        }
        showError(t("unwrap.badPassword"), t("unwrap.badPasswordHint"));
        return;
      }
      if (!resp.ok) {
        showError(t("unwrap.unavailable"));
        return;
      }
      const data = await resp.json();
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
          return;
        }
        if (err.message === "bad_password") {
          showError(t("unwrap.badPassword"), t("unwrap.badPasswordHint"));
          return;
        }
        showError(t("common.error"));
        return;
      }
      renderPackage(pack);
      els.form.classList.add("hidden");
      els.result.classList.remove("hidden");
      history.replaceState(null, "", location.pathname);
    } catch {
      showError(t("common.error"));
    } finally {
      window.WrappedUI.hideBusy();
      els.btn.disabled = false;
    }
  });

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

