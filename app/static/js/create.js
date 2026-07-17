(() => {
  const t = (k) => window.WrappedI18n.t(k);
  const files = [];
  let settings = null;
  let captchaWidgetId = null;

  const els = {
    text: document.getElementById("payload-text"),
    lang: document.getElementById("text-language"),
    ttl: document.getElementById("ttl-seconds"),
    password: document.getElementById("password"),
    generatePassword: document.getElementById("generate-password"),
    dropzone: document.getElementById("dropzone"),
    fileInput: document.getElementById("file-input"),
    fileList: document.getElementById("file-list"),
    wrapBtn: document.getElementById("wrap-btn"),
    error: document.getElementById("form-error"),
    success: document.getElementById("success-panel"),
    composer: document.querySelector(".composer"),
    shareLink: document.getElementById("share-link"),
    shareToken: document.getElementById("share-token"),
    expiresMeta: document.getElementById("expires-meta"),
    captchaSlot: document.getElementById("captcha-slot"),
  };

  function showError(msg) {
    els.error.textContent = msg;
    els.error.classList.remove("hidden");
  }

  function clearError() {
    els.error.classList.add("hidden");
    els.error.textContent = "";
  }

  function mimeAllowed(ct) {
    const allow = settings.mime_allowlist || [];
    const base = (ct || "").split(";")[0].trim().toLowerCase();
    return allow.some((p) => {
      const pat = p.toLowerCase();
      if (pat.endsWith("/*")) return base.startsWith(pat.slice(0, -1));
      return base === pat;
    });
  }

  function renderFiles() {
    els.fileList.innerHTML = "";
    files.forEach((f, idx) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${f.name} <small>(${f.type || "file"} · ${f.size} B)</small></span>`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "×";
      btn.addEventListener("click", () => {
        files.splice(idx, 1);
        renderFiles();
      });
      li.appendChild(btn);
      els.fileList.appendChild(li);
    });
  }

  function addFiles(list) {
    for (const f of list) {
      if (!mimeAllowed(f.type || "application/octet-stream")) {
        showError(t("create.mimeDenied") + `: ${f.type || f.name}`);
        continue;
      }
      files.push(f);
    }
    renderFiles();
  }

  let lastExpiresAt = null;

  function fillTtl() {
    if (!settings || !els.ttl) return;
    const max = settings.max_ttl_seconds;
    const def = settings.default_ttl_seconds;
    const selected = els.ttl.value ? Number(els.ttl.value) : def;
    const options = [
      { key: "create.ttl.1h", value: 3600 },
      { key: "create.ttl.6h", value: 6 * 3600 },
      { key: "create.ttl.24h", value: 24 * 3600 },
      { key: "create.ttl.3d", value: 3 * 24 * 3600 },
      { key: "create.ttl.7d", value: 7 * 24 * 3600 },
    ].filter((o) => o.value <= max);
    if (!options.find((o) => o.value === def) && def <= max) {
      options.unshift({ key: "create.ttl.default", value: def, seconds: def });
    }
    const pick = options.some((o) => o.value === selected) ? selected : def;
    els.ttl.innerHTML = options
      .map((o) => {
        const label =
          o.key === "create.ttl.default"
            ? t("create.ttl.default", { seconds: o.seconds })
            : t(o.key);
        return `<option value="${o.value}" ${o.value === pick ? "selected" : ""}>${label}</option>`;
      })
      .join("");
  }

  function refreshExpiresMeta() {
    if (lastExpiresAt && els.expiresMeta) {
      els.expiresMeta.textContent = window.WrappedI18n.formatExpires(lastExpiresAt);
    }
  }

  function loadCaptcha() {
    els.captchaSlot.innerHTML = "";
    captchaWidgetId = null;
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
      return window.hcaptcha.getResponse?.(captchaWidgetId) || window.hcaptcha.getResponse?.() || "";
    }
    return "";
  }

  async function init() {
    const resp = await fetch("/api/v1/settings");
    settings = await resp.json();
    fillTtl();
    loadCaptcha();
  }

  els.dropzone.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", () => addFiles(els.fileInput.files));
  ["dragenter", "dragover"].forEach((ev) => {
    els.dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      els.dropzone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach((ev) => {
    els.dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      els.dropzone.classList.remove("dragover");
    });
  });
  els.dropzone.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));

  document.addEventListener("paste", (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pasted = [];
    for (const item of items) {
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) pasted.push(f);
      }
    }
    if (pasted.length) {
      e.preventDefault();
      addFiles(pasted);
    }
  });

  async function copyFrom(input, btn) {
    await navigator.clipboard.writeText(input.value);
    const old = btn.textContent;
    btn.textContent = t("common.copied");
    setTimeout(() => (btn.textContent = old), 1200);
  }

  document.getElementById("copy-link").addEventListener("click", () => {
    copyFrom(els.shareLink, document.getElementById("copy-link"));
  });
  document.getElementById("copy-token").addEventListener("click", () => {
    copyFrom(els.shareToken, document.getElementById("copy-token"));
  });
  document.getElementById("create-another").addEventListener("click", () => {
    location.reload();
  });

  els.wrapBtn.addEventListener("click", async () => {
    clearError();
    const text = els.text.value;
    if (!text.trim() && files.length === 0) {
      showError(t("create.needPayload"));
      return;
    }

    const items = [];
    const contentTypes = [];
    if (text.trim()) {
      items.push({
        type: "text",
        language: els.lang.value,
        content: text,
      });
      contentTypes.push("text/plain");
    }
    for (const f of files) {
      const item = await window.WrappedCrypto.fileToItem(f);
      items.push(item);
      contentTypes.push(item.mime);
    }

    for (const ct of contentTypes) {
      if (!mimeAllowed(ct)) {
        showError(t("create.mimeDenied"));
        return;
      }
    }

    const password = els.password.value || "";
    const pack = { version: 1, items };
    const { ciphertext, keyB64url } = await window.WrappedCrypto.encryptPackage(
      pack,
      password || null
    );

    if (ciphertext.byteLength > settings.max_upload_bytes) {
      showError(t("create.tooLarge"));
      return;
    }

    els.wrapBtn.disabled = true;
    try {
      const body = {
        ciphertext_b64: window.WrappedCrypto.bytesToBase64(ciphertext),
        ttl_seconds: Number(els.ttl.value),
        content_types: contentTypes,
        item_count: items.length,
        has_password: Boolean(password),
        password: settings.password_mode === "server_gate" && password ? password : null,
        captcha_token: captchaToken() || null,
      };
      const resp = await fetch("/api/v1/wraps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        showError(err.detail || t("common.error"));
        return;
      }
      const data = await resp.json();
      const token = window.WrappedCrypto.buildToken(data.wrap_id, keyB64url);
      const link = `${location.origin}${data.share_path}#${keyB64url}`;
      els.shareLink.value = link;
      els.shareToken.value = token;
      lastExpiresAt = data.expires_at;
      refreshExpiresMeta();
      els.composer.classList.add("hidden");
      els.success.classList.remove("hidden");
    } catch {
      showError(t("common.error"));
    } finally {
      els.wrapBtn.disabled = false;
    }
  });

  function generatePassword(length = 20) {
    const alphabet =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_";
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  }

  els.generatePassword?.addEventListener("click", () => {
    const pwd = generatePassword();
    els.password.type = "text";
    els.password.value = pwd;
    els.password.focus();
    els.password.select();
  });

  if (window.WrappedI18n.onChange) {
    window.WrappedI18n.onChange(() => {
      fillTtl();
      refreshExpiresMeta();
    });
  }

  init().catch(() => showError(t("common.error")));
})();
