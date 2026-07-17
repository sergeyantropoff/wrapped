(() => {
  const KEY = "wrapped.lang";
  const dict = {
    en: {
      "footer.tagline": "Zero-knowledge · one-time · encrypted",
      "footer.lede": "Wrap text, images or files into a one-time token. Encryption happens in your browser — the server never sees plaintext.",
      "footer.cap.text": "Text",
      "footer.cap.text.hint": "Secrets, configs, notes",
      "footer.cap.media": "Images & files",
      "footer.cap.media.hint": "Screenshots, archives, docs",
      "footer.cap.browser": "Encrypted in-browser",
      "footer.cap.browser.hint": "Only ciphertext reaches the server",
      "footer.pillar.zk": "Zero-knowledge",
      "footer.pillar.once": "One-time",
      "footer.pillar.encrypted": "Encrypted",
      "footer.pillar.zk.hint": "Server never sees content",
      "footer.pillar.once.hint": "Gone after unwrap",
      "footer.pillar.encrypted.hint": "Key lives only in your link",
      "footer.copy.author": "Sergey Antropov",
      "brand.tagline": "Wrap. Send. Vanish.",
      "create.eyebrow": "Secure drop",
      "create.title": "Wrap. Send. Vanish.",
      "create.lede": "Wrap text, images or files into a one-time token. Encryption happens in your browser — the server never sees plaintext.",
      "create.language": "Highlight language",
      "create.text": "Text",
      "create.textPlaceholder": "Paste secrets, configs, notes…",
      "create.drop": "Drop files here, click to browse, or paste a screenshot (⌘V / Ctrl+V)",
      "create.ttl": "Time to live",
      "create.password": "Password (optional)",
      "create.passwordPlaceholder": "Extra unlock secret",
      "create.passwordGenerate": "Generate password",
      "create.passwordGenerateTip": "Generate a strong password",
      "create.submit": "Create wrapped token",
      "create.openToken": "Open a token",
      "create.successTitle": "Token issued",
      "create.successWarn": "One-time unwrap. After someone opens it, ciphertext is destroyed on the server.",
      "create.shareLink": "Share link",
      "create.token": "Wrapped token",
      "create.another": "Create another",
      "create.needPayload": "Add text or at least one file.",
      "create.tooLarge": "Package exceeds max size.",
      "create.mimeDenied": "One or more MIME types are not allowed.",
      "create.expires": "Expires {datetime} · {relative}",
      "create.ttl.1h": "1 hour",
      "create.ttl.6h": "6 hours",
      "create.ttl.24h": "24 hours",
      "create.ttl.3d": "3 days",
      "create.ttl.7d": "7 days",
      "create.ttl.default": "Default ({seconds} s)",
      "lang.plaintext": "Plain text",
      "lang.markdown": "Markdown",
      "lang.json": "JSON",
      "lang.yaml": "YAML",
      "lang.python": "Python",
      "lang.javascript": "JavaScript",
      "lang.typescript": "TypeScript",
      "lang.go": "Go",
      "lang.rust": "Rust",
      "lang.sql": "SQL",
      "lang.bash": "Bash",
      "lang.html": "HTML",
      "lang.css": "CSS",
      "relative.inMinutes": "in {n} min",
      "relative.inHours": "in {n} h",
      "relative.inDays": "in {n} d",
      "relative.soon": "soon",
      "unwrap.eyebrow": "Unwrap",
      "unwrap.title": "Reveal once",
      "unwrap.lede": "Paste a wrapped token or open a share link. Ciphertext is fetched once and deleted from the server.",
      "unwrap.token": "Wrapped token or ID",
      "unwrap.tokenPlaceholder": "wrapped_v1.… or wrap id",
      "unwrap.password": "Password (if set)",
      "unwrap.submit": "Unwrap",
      "unwrap.destroyed": "Server copy destroyed. Preview lives only in this browser session.",
      "unwrap.needKey": "Missing encryption key. Open the full share link (with #key) or paste the full wrapped token.",
      "unwrap.badPassword": "Wrong password.",
      "unwrap.unavailable": "Unavailable (already used, expired, or invalid).",
      "common.copy": "Copy",
      "common.copied": "Copied",
      "common.download": "Download",
      "common.error": "Something went wrong.",
      "admin.nav.settings": "Settings",
      "admin.nav.audit": "Audit",
      "admin.nav.danger": "Danger",
      "admin.nav.site": "Site",
      "admin.nav.logout": "Logout",
      "admin.brand.tagline": "Admin console",
      "admin.settings.title": "Settings",
      "admin.audit.title": "Audit",
      "admin.tab.limits": "Limits",
      "admin.tab.rate": "Rate limits",
      "admin.tab.mime": "MIME",
      "admin.tab.password": "Password",
      "admin.tab.captcha": "CAPTCHA",
      "admin.login.sub": "Admin",
      "admin.login.username": "Username",
      "admin.login.password": "Password",
      "admin.login.submit": "Sign in",
      "admin.login.error.rate": "Too many attempts. Try later.",
      "admin.login.error.bad": "Invalid credentials",
      "admin.flash.saved": "Settings saved.",
      "admin.flash.purgedPrefix": "Purged",
      "admin.flash.purgedWraps": "wrap(s) and",
      "admin.flash.purgedObjects": "object(s).",
      "admin.flash.purgeConfirm": "Type PURGE to confirm forced cleanup.",
      "admin.flash.purgeError": "Purge failed. Check logs / MinIO connectivity.",
      "admin.limits.title": "Limits",
      "admin.limits.maxUpload": "Max upload (MB)",
      "admin.limits.defaultTtl": "Default TTL (hours)",
      "admin.limits.maxTtl": "Max TTL (hours)",
      "admin.limits.auditRetention": "Audit retention (days)",
      "admin.rate.title": "Rate limits (per IP / minute)",
      "admin.rate.create": "Create",
      "admin.rate.unwrap": "Unwrap",
      "admin.rate.adminLogin": "Admin login",
      "admin.mime.title": "MIME allowlist",
      "admin.mime.hint": "One pattern per line. Supports exact types and wildcards like image/*.",
      "admin.mime.examples": "Examples / suggested defaults",
      "admin.passwordMode.title": "Password mode",
      "admin.passwordMode.client_only": "Password is verified only in the browser after ciphertext download. Maximum zero-knowledge: the server never checks the password. Best when you trust link secrecy and want strongest ZK.",
      "admin.passwordMode.server_gate": "Server stores an Argon2id hash and releases ciphertext only after a correct password. Slightly weaker ZK metadata but stops offline bruteforce if someone steals the share link without the password.",
      "admin.captcha.title": "CAPTCHA",
      "admin.captcha.provider": "Provider",
      "admin.captcha.turnstileSite": "Turnstile site key",
      "admin.captcha.hcaptchaSite": "hCaptcha site key",
      "admin.captcha.secrets": "Secrets:",
      "admin.captcha.set": "set",
      "admin.captcha.missing": "missing",
      "admin.captcha.viaEnv": "(via env TURNSTILE_SECRET_KEY / HCAPTCHA_SECRET_KEY)",
      "admin.captcha.helperTitle": "How to get CAPTCHA tokens",
      "admin.captcha.turnstile.1": "Open Cloudflare Turnstile dashboard",
      "admin.captcha.turnstile.2": "Create a site widget for your domain (use localhost for dev)",
      "admin.captcha.turnstile.3": "Copy Site Key into the field above",
      "admin.captcha.turnstile.4": "Copy Secret Key into env TURNSTILE_SECRET_KEY and restart",
      "admin.captcha.turnstile.5": "Set provider to turnstile",
      "admin.captcha.hcaptcha.1": "Open hCaptcha dashboard",
      "admin.captcha.hcaptcha.2": "New site → copy Sitekey here",
      "admin.captcha.hcaptcha.3": "Secret into env HCAPTCHA_SECRET_KEY, restart",
      "admin.captcha.hcaptcha.4": "Set provider to hcaptcha",
      "admin.settings.save": "Save settings",
      "admin.danger.title": "Danger zone",
      "admin.danger.hint": "Force-delete all wraps from the database and all ciphertext objects in MinIO (wraps/). Audit log is kept. This cannot be undone.",
      "admin.danger.confirmLabel": "Type PURGE to confirm",
      "admin.danger.submit": "Clear all wraps & files",
      "admin.danger.confirmDialog": "Delete ALL wraps and files? This cannot be undone.",
      "admin.danger.confirmTitle": "Confirm purge",
      "admin.danger.confirmOk": "Delete everything",
      "modal.confirm.title": "Confirm",
      "modal.confirm.ok": "Confirm",
      "modal.confirm.cancel": "Cancel",
      "admin.audit.eventType": "Event type",
      "admin.audit.wrapId": "Wrap ID",
      "admin.audit.filter": "Filter",
      "admin.audit.allEvents": "All events",
      "admin.audit.shown": "events shown",
      "admin.audit.of": "of",
      "admin.audit.events": "events",
      "admin.audit.page": "Page",
      "admin.audit.prev": "Prev",
      "admin.audit.next": "Next",
      "admin.audit.col.time": "Time",
      "admin.audit.col.event": "Event",
      "admin.audit.col.ok": "OK",
      "admin.audit.col.wrap": "Wrap",
      "admin.audit.col.details": "Details",
      "admin.audit.yes": "yes",
      "admin.audit.no": "no",
      "admin.audit.empty": "No events",
    },
    ru: {
      "footer.tagline": "Zero-knowledge · одноразово · зашифровано",
      "footer.lede": "Упакуй текст, картинки или файлы в одноразовый токен. Шифрование в браузере — сервер не видит plaintext.",
      "footer.cap.text": "Текст",
      "footer.cap.text.hint": "Секреты, конфиги, заметки",
      "footer.cap.media": "Картинки и файлы",
      "footer.cap.media.hint": "Скриншоты, архивы, документы",
      "footer.cap.browser": "Шифрование в браузере",
      "footer.cap.browser.hint": "На сервер уходит только ciphertext",
      "footer.pillar.zk": "Zero-knowledge",
      "footer.pillar.once": "Одноразово",
      "footer.pillar.encrypted": "Зашифровано",
      "footer.pillar.zk.hint": "Сервер не видит содержимое",
      "footer.pillar.once.hint": "После открытия — удаление",
      "footer.pillar.encrypted.hint": "Ключ только в вашей ссылке",
      "footer.copy.author": "Сергей Антропов",
      "brand.tagline": "Упакуй. Отправь. Исчезни.",
      "create.eyebrow": "Безопасная передача",
      "create.title": "Упакуй. Отправь. Исчезни.",
      "create.lede": "Упакуй текст, картинки или файлы в одноразовый токен. Шифрование в браузере — сервер не видит plaintext.",
      "create.language": "Язык подсветки",
      "create.text": "Текст",
      "create.textPlaceholder": "Вставь секреты, конфиги, заметки…",
      "create.drop": "Перетащи файлы, выбери или вставь скриншот из буфера (⌘V / Ctrl+V)",
      "create.ttl": "Время жизни",
      "create.password": "Пароль (необязательно)",
      "create.passwordPlaceholder": "Дополнительный секрет",
      "create.passwordGenerate": "Сгенерировать пароль",
      "create.passwordGenerateTip": "Сгенерировать надёжный пароль",
      "create.submit": "Создать wrapped-токен",
      "create.openToken": "Открыть токен",
      "create.successTitle": "Токен выдан",
      "create.successWarn": "Unwrap один раз. После открытия ciphertext удаляется на сервере.",
      "create.shareLink": "Ссылка",
      "create.token": "Wrapped-токен",
      "create.another": "Создать ещё",
      "create.needPayload": "Добавь текст или хотя бы один файл.",
      "create.tooLarge": "Пакет превышает лимит размера.",
      "create.mimeDenied": "Один или несколько MIME-типов запрещены.",
      "create.expires": "Истекает {datetime} · {relative}",
      "create.ttl.1h": "1 час",
      "create.ttl.6h": "6 часов",
      "create.ttl.24h": "24 часа",
      "create.ttl.3d": "3 дня",
      "create.ttl.7d": "7 дней",
      "create.ttl.default": "По умолчанию ({seconds} с)",
      "lang.plaintext": "Обычный текст",
      "lang.markdown": "Markdown",
      "lang.json": "JSON",
      "lang.yaml": "YAML",
      "lang.python": "Python",
      "lang.javascript": "JavaScript",
      "lang.typescript": "TypeScript",
      "lang.go": "Go",
      "lang.rust": "Rust",
      "lang.sql": "SQL",
      "lang.bash": "Bash",
      "lang.html": "HTML",
      "lang.css": "CSS",
      "relative.inMinutes": "через {n} мин",
      "relative.inHours": "через {n} ч",
      "relative.inDays": "через {n} дн",
      "relative.soon": "скоро",
      "unwrap.eyebrow": "Unwrap",
      "unwrap.title": "Открыть один раз",
      "unwrap.lede": "Вставь wrapped-токен или открой ссылку. Ciphertext скачивается один раз и удаляется на сервере.",
      "unwrap.token": "Wrapped-токен или ID",
      "unwrap.tokenPlaceholder": "wrapped_v1.… или ID",
      "unwrap.password": "Пароль (если задан)",
      "unwrap.submit": "Расшифровать",
      "unwrap.destroyed": "Копия на сервере уничтожена. Превью только в этой сессии браузера.",
      "unwrap.needKey": "Нет ключа шифрования. Открой полную ссылку (с #key) или вставь полный wrapped-токен.",
      "unwrap.badPassword": "Неверный пароль.",
      "unwrap.unavailable": "Недоступно (уже использовано, истекло или неверно).",
      "common.copy": "Копировать",
      "common.copied": "Скопировано",
      "common.download": "Скачать",
      "common.error": "Что-то пошло не так.",
      "admin.nav.settings": "Настройки",
      "admin.nav.audit": "Аудит",
      "admin.nav.danger": "Опасная зона",
      "admin.nav.site": "Сайт",
      "admin.nav.logout": "Выйти",
      "admin.brand.tagline": "Консоль администратора",
      "admin.settings.title": "Настройки",
      "admin.audit.title": "Аудит",
      "admin.tab.limits": "Лимиты",
      "admin.tab.rate": "Rate limits",
      "admin.tab.mime": "MIME",
      "admin.tab.password": "Пароль",
      "admin.tab.captcha": "CAPTCHA",
      "admin.login.sub": "Админ",
      "admin.login.username": "Логин",
      "admin.login.password": "Пароль",
      "admin.login.submit": "Войти",
      "admin.login.error.rate": "Слишком много попыток. Попробуйте позже.",
      "admin.login.error.bad": "Неверный логин или пароль",
      "admin.flash.saved": "Настройки сохранены.",
      "admin.flash.purgedPrefix": "Удалено",
      "admin.flash.purgedWraps": "wrap(ов) и",
      "admin.flash.purgedObjects": "объект(ов).",
      "admin.flash.purgeConfirm": "Введите PURGE для подтверждения очистки.",
      "admin.flash.purgeError": "Очистка не удалась. Проверьте логи / MinIO.",
      "admin.limits.title": "Лимиты",
      "admin.limits.maxUpload": "Макс. размер (МБ)",
      "admin.limits.defaultTtl": "TTL по умолчанию (часы)",
      "admin.limits.maxTtl": "Макс. TTL (часы)",
      "admin.limits.auditRetention": "Хранение аудита (дни)",
      "admin.rate.title": "Rate limits (на IP / минуту)",
      "admin.rate.create": "Создание",
      "admin.rate.unwrap": "Unwrap",
      "admin.rate.adminLogin": "Вход в админку",
      "admin.mime.title": "MIME allowlist",
      "admin.mime.hint": "Один шаблон на строку. Точные типы и wildcards вроде image/*.",
      "admin.mime.examples": "Примеры / рекомендуемые значения",
      "admin.passwordMode.title": "Режим пароля",
      "admin.passwordMode.client_only": "Пароль проверяется только в браузере после скачивания ciphertext. Максимальный zero-knowledge: сервер пароль не проверяет. Лучше, если доверяете секретности ссылки.",
      "admin.passwordMode.server_gate": "Сервер хранит Argon2id-хеш и отдаёт ciphertext только после верного пароля. Чуть слабее ZK по метаданным, но защищает от офлайн-брута при утечке ссылки без пароля.",
      "admin.captcha.title": "CAPTCHA",
      "admin.captcha.provider": "Провайдер",
      "admin.captcha.turnstileSite": "Turnstile site key",
      "admin.captcha.hcaptchaSite": "hCaptcha site key",
      "admin.captcha.secrets": "Секреты:",
      "admin.captcha.set": "задан",
      "admin.captcha.missing": "нет",
      "admin.captcha.viaEnv": "(через env TURNSTILE_SECRET_KEY / HCAPTCHA_SECRET_KEY)",
      "admin.captcha.helperTitle": "Как получить токены CAPTCHA",
      "admin.captcha.turnstile.1": "Откройте Cloudflare Turnstile dashboard",
      "admin.captcha.turnstile.2": "Создайте виджет для домена (для dev — localhost)",
      "admin.captcha.turnstile.3": "Скопируйте Site Key в поле выше",
      "admin.captcha.turnstile.4": "Secret Key в env TURNSTILE_SECRET_KEY и перезапустите",
      "admin.captcha.turnstile.5": "Выберите provider = turnstile",
      "admin.captcha.hcaptcha.1": "Откройте hCaptcha dashboard",
      "admin.captcha.hcaptcha.2": "Новый сайт → Sitekey сюда",
      "admin.captcha.hcaptcha.3": "Secret в env HCAPTCHA_SECRET_KEY, перезапуск",
      "admin.captcha.hcaptcha.4": "Выберите provider = hcaptcha",
      "admin.settings.save": "Сохранить",
      "admin.danger.title": "Опасная зона",
      "admin.danger.hint": "Принудительно удаляет все wraps из БД и все ciphertext-объекты в MinIO (wraps/). Аудит сохраняется. Отменить нельзя.",
      "admin.danger.confirmLabel": "Введите PURGE для подтверждения",
      "admin.danger.submit": "Очистить все wraps и файлы",
      "admin.danger.confirmDialog": "Удалить ВСЕ wraps и файлы? Это нельзя отменить.",
      "admin.danger.confirmTitle": "Подтверждение очистки",
      "admin.danger.confirmOk": "Удалить всё",
      "modal.confirm.title": "Подтверждение",
      "modal.confirm.ok": "Подтвердить",
      "modal.confirm.cancel": "Отмена",
      "admin.audit.eventType": "Тип события",
      "admin.audit.wrapId": "Wrap ID",
      "admin.audit.filter": "Фильтр",
      "admin.audit.allEvents": "Все события",
      "admin.audit.shown": "событий показано",
      "admin.audit.of": "из",
      "admin.audit.events": "событий",
      "admin.audit.page": "Страница",
      "admin.audit.prev": "Назад",
      "admin.audit.next": "Далее",
      "admin.audit.col.time": "Время",
      "admin.audit.col.event": "Событие",
      "admin.audit.col.ok": "OK",
      "admin.audit.col.wrap": "Wrap",
      "admin.audit.col.details": "Детали",
      "admin.audit.yes": "да",
      "admin.audit.no": "нет",
      "admin.audit.empty": "Нет событий",
    },
  };

  const listeners = [];

  function current() {
    const stored = localStorage.getItem(KEY);
    if (stored === "en" || stored === "ru") return stored;
    return "ru";
  }

  function t(key, vars) {
    const lang = current();
    let text = (dict[lang] && dict[lang][key]) || dict.en[key] || key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        text = text.replaceAll(`{${k}}`, String(v));
      });
    }
    return text;
  }

  function locale() {
    return current() === "ru" ? "ru-RU" : "en-GB";
  }

  function formatExpires(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const datetime = new Intl.DateTimeFormat(locale(), {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
    const diffMs = d.getTime() - Date.now();
    let relative = t("relative.soon");
    if (diffMs > 0) {
      const mins = Math.round(diffMs / 60000);
      if (mins < 60) relative = t("relative.inMinutes", { n: Math.max(1, mins) });
      else if (mins < 60 * 48) relative = t("relative.inHours", { n: Math.round(mins / 60) });
      else relative = t("relative.inDays", { n: Math.round(mins / (60 * 24)) });
    }
    return t("create.expires", { datetime, relative });
  }

  function apply() {
    const lang = current();
    document.documentElement.lang = lang;
    const label = document.getElementById("lang-label");
    if (label) label.textContent = lang.toUpperCase();
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
    });
    document.querySelectorAll("[data-i18n-tooltip]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n-tooltip"));
    });
    listeners.forEach((fn) => {
      try {
        fn(lang);
      } catch {
        /* ignore */
      }
    });
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  function toggle() {
    const next = current() === "en" ? "ru" : "en";
    localStorage.setItem(KEY, next);
    apply();
  }

  document.addEventListener("DOMContentLoaded", () => {
    apply();
    const btn = document.getElementById("lang-toggle");
    if (btn) btn.addEventListener("click", toggle);
  });

  window.WrappedI18n = { t, apply, current, locale, formatExpires, onChange };
})();
