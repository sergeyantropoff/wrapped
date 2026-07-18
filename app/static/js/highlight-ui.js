(() => {
  const LANGUAGES = [
    "plaintext",
    "markdown",
    "json",
    "yaml",
    "python",
    "javascript",
    "typescript",
    "go",
    "rust",
    "sql",
    "bash",
    "html",
    "css",
  ];

  function hljsLang(lang) {
    const map = {
      plaintext: "plaintext",
      markdown: "markdown",
      json: "json",
      yaml: "yaml",
      python: "python",
      javascript: "javascript",
      typescript: "typescript",
      go: "go",
      rust: "rust",
      sql: "sql",
      bash: "bash",
      html: "xml",
      css: "css",
    };
    return map[lang] || "plaintext";
  }

  function highlightElement(codeEl, text, lang) {
    if (!codeEl) return;
    const value = text ?? "";
    if (window.hljs) {
      try {
        const res = window.hljs.highlight(value, {
          language: hljsLang(lang),
          ignoreIllegals: true,
        });
        codeEl.className = `hljs language-${hljsLang(lang)}`;
        codeEl.innerHTML = res.value;
        return;
      } catch {
        /* fall through */
      }
    }
    codeEl.className = "hljs";
    codeEl.textContent = value;
  }

  function syncThemeStylesheet() {
    const dark = document.getElementById("hljs-theme-dark");
    const light = document.getElementById("hljs-theme-light");
    if (!dark || !light) return;
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    dark.disabled = isLight;
    light.disabled = !isLight;
  }

  function languages() {
    return LANGUAGES.slice();
  }

  window.WrappedHighlight = {
    highlightElement,
    syncThemeStylesheet,
    languages,
    hljsLang,
  };

  document.addEventListener("DOMContentLoaded", syncThemeStylesheet);
  const obs = new MutationObserver(syncThemeStylesheet);
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
})();
