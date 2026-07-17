(() => {
  const te = new TextEncoder();
  const td = new TextDecoder();

  function b64encode(buf) {
    const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }

  function b64decode(str) {
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function b64urlEncode(buf) {
    return b64encode(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function b64urlDecode(str) {
    const pad = "=".repeat((4 - (str.length % 4)) % 4);
    return b64decode(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  }

  async function importAesKey(raw) {
    return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt",
    ]);
  }

  async function derivePasswordKey(password, salt) {
    const base = await crypto.subtle.importKey(
      "raw",
      te.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 210000, hash: "SHA-256" },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function encryptPackage(packageObj, password) {
    const dek = crypto.getRandomValues(new Uint8Array(32));
    const payload = te.encode(JSON.stringify(packageObj));
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const key = await importAesKey(dek);
    const encrypted = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, payload)
    );

    let body = encrypted;
    let bodyNonce = nonce;
    let flags = 0;
    let salt = new Uint8Array(16);
    let outerNonce = new Uint8Array(12);

    if (password) {
      flags = 1;
      salt = crypto.getRandomValues(new Uint8Array(16));
      outerNonce = crypto.getRandomValues(new Uint8Array(12));
      const pwKey = await derivePasswordKey(password, salt);
      const inner = new Uint8Array(nonce.length + encrypted.length);
      inner.set(nonce, 0);
      inner.set(encrypted, nonce.length);
      body = new Uint8Array(
        await crypto.subtle.encrypt({ name: "AES-GCM", iv: outerNonce }, pwKey, inner)
      );
      bodyNonce = outerNonce;
    }

    // header: magic(4) version(1) flags(1) salt(16) nonce(12) + ciphertext
    const header = new Uint8Array(4 + 1 + 1 + 16 + 12);
    header.set(te.encode("WRPD"), 0);
    header[4] = 1;
    header[5] = flags;
    header.set(salt, 6);
    header.set(bodyNonce, 22);
    const out = new Uint8Array(header.length + body.length);
    out.set(header, 0);
    out.set(body, header.length);

    return {
      ciphertext: out,
      keyB64url: b64urlEncode(dek),
    };
  }

  async function decryptPackage(ciphertext, keyB64url, password) {
    if (ciphertext.length < 34) throw new Error("truncated");
    const magic = td.decode(ciphertext.subarray(0, 4));
    if (magic !== "WRPD") throw new Error("bad_magic");
    const flags = ciphertext[5];
    const salt = ciphertext.subarray(6, 22);
    const nonce = ciphertext.subarray(22, 34);
    const body = ciphertext.subarray(34);
    const dek = b64urlDecode(keyB64url);

    let plainEncrypted;
    let innerNonce;

    if (flags & 1) {
      if (!password) throw new Error("password_required");
      const pwKey = await derivePasswordKey(password, salt);
      let inner;
      try {
        inner = new Uint8Array(
          await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, pwKey, body)
        );
      } catch {
        throw new Error("bad_password");
      }
      innerNonce = inner.subarray(0, 12);
      plainEncrypted = inner.subarray(12);
    } else {
      innerNonce = nonce;
      plainEncrypted = body;
    }

    const key = await importAesKey(dek);
    let payload;
    try {
      payload = new Uint8Array(
        await crypto.subtle.decrypt({ name: "AES-GCM", iv: innerNonce }, key, plainEncrypted)
      );
    } catch {
      throw new Error("decrypt_failed");
    }
    return JSON.parse(td.decode(payload));
  }

  function buildToken(wrapId, keyB64url) {
    return `wrapped_v1.${wrapId}.${keyB64url}`;
  }

  function parseToken(input) {
    const raw = (input || "").trim();
    if (!raw) return null;
    if (raw.startsWith("wrapped_v1.")) {
      const parts = raw.split(".");
      if (parts.length < 3) return null;
      return { wrapId: parts[1], key: parts.slice(2).join(".") };
    }
    // bare id — key may come from location.hash
    if (/^[A-Za-z0-9]+$/.test(raw) && raw.length >= 16) {
      return { wrapId: raw, key: null };
    }
    try {
      const url = new URL(raw);
      const m = url.pathname.match(/\/w\/([A-Za-z0-9]+)/);
      if (m) {
        return { wrapId: m[1], key: url.hash ? url.hash.slice(1) : null };
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  function bytesToBase64(bytes) {
    return b64encode(bytes);
  }

  function base64ToBytes(b64) {
    return b64decode(b64);
  }

  async function fileToItem(file) {
    const buf = new Uint8Array(await file.arrayBuffer());
    return {
      type: "file",
      name: file.name || "file",
      mime: file.type || "application/octet-stream",
      data_b64: b64encode(buf),
    };
  }

  window.WrappedCrypto = {
    encryptPackage,
    decryptPackage,
    buildToken,
    parseToken,
    bytesToBase64,
    base64ToBytes,
    fileToItem,
    b64urlEncode,
  };
})();
