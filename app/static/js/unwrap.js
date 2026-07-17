(() => {
  const t = (k) => window.WrappedI18n.t(k);
  let settings = null;

  const els = {
    token: document.getElementById("token-input"),
    password: document.getElementById("unwrap-password"),
    btn: document.getElementById("unwrap-btn"),
    error: document.getElementById("form-error"),
    form: document.getElementById("unwrap-form"),
    result: document.getElementById("result-panel"),
    items: document.getElementById("items"),
    captchaSlot: document.getElementById("captcha-slot"),
  };

  function showError(msg) {
    els.error.textContent = msg;
    els.error.classList.remove("hidden");
  }

  function clearError() {
    els.error.classList.add("hidden");
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

  function renderPackage(pack) {
    els.items.innerHTML = "";
    for (const item of pack.items || []) {
      const card = document.createElement("div");
      card.className = "item-card";
      if (item.type === "text") {
        card.innerHTML = `<div><strong>text</strong> · <span class="mono">${item.language || "plaintext"}</span></div>`;
        const pre = document.createElement("pre");
        pre.textContent = item.content || "";
        card.appendChild(pre);
        const btn = document.createElement("button");
        btn.className = "btn";
        btn.type = "button";
        btn.textContent = t("common.download");
        btn.addEventListener("click", () => {
          downloadBlob(
            `wrapped-${item.language || "text"}.txt`,
            new Blob([item.content || ""], { type: "text/plain" })
          );
        });
        card.appendChild(btn);
      } else if (item.type === "file") {
        const bytes = window.WrappedCrypto.base64ToBytes(item.data_b64);
        const blob = new Blob([bytes], { type: item.mime || "application/octet-stream" });
        card.innerHTML = `<div><strong>${item.name}</strong> · <span class="mono">${item.mime}</span> · ${bytes.length} B</div>`;
        if ((item.mime || "").startsWith("image/")) {
          const img = document.createElement("img");
          img.alt = item.name;
          img.src = URL.createObjectURL(blob);
          card.appendChild(img);
        }
        const btn = document.createElement("button");
        btn.className = "btn";
        btn.type = "button";
        btn.textContent = t("common.download");
        btn.style.marginTop = "0.6rem";
        btn.addEventListener("click", () => downloadBlob(item.name || "file", blob));
        card.appendChild(btn);
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
        showError(t("unwrap.badPassword"));
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
        if (err.message === "bad_password" || err.message === "password_required") {
          showError(t("unwrap.badPassword"));
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
      els.btn.disabled = false;
    }
  });

  async function init() {
    const resp = await fetch("/api/v1/settings");
    settings = await resp.json();
    loadCaptcha();

    // Prefill from path + hash
    const pathMatch = location.pathname.match(/\/w\/([A-Za-z0-9]+)/);
    if (pathMatch && !els.token.value) {
      els.token.value = pathMatch[1];
    }
  }

  init().catch(() => showError(t("common.error")));
})();
