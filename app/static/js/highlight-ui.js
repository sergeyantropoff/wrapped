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

  function tryParseJson(text) {
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * @returns {{ lang: string, confidence: number, suggestions: string[] }}
   */
  function detectLanguage(text) {
    const raw = (text || "").trim();
    if (!raw) {
      return { lang: "plaintext", confidence: 0, suggestions: LANGUAGES };
    }

    const scores = Object.fromEntries(LANGUAGES.map((l) => [l, 0]));

    if (
      (raw.startsWith("{") || raw.startsWith("[")) &&
      tryParseJson(raw)
    ) {
      scores.json += 10;
    } else if (/^\s*[{[]/.test(raw) && /["']?\w+["']?\s*:/.test(raw)) {
      scores.json += 4;
    }

    if (
      /^---\s*$/m.test(raw) ||
      (/^[\w.-]+\s*:\s+\S+/m.test(raw) &&
        !tryParseJson(raw) &&
        !raw.startsWith("<"))
    ) {
      scores.yaml += 5;
    }
    if (/^\s*-\s+\w+/m.test(raw) && /:\s/.test(raw)) scores.yaml += 2;

    if (
      /\b(def|class|import|from|async def)\b/.test(raw) ||
      /^\s*@\w+/m.test(raw)
    ) {
      scores.python += 5;
    }
    if (/print\(|__name__|self\./.test(raw)) scores.python += 2;

    if (
      /\b(function|const|let|var|=>|console\.)\b/.test(raw) ||
      /\brequire\s*\(/.test(raw)
    ) {
      scores.javascript += 4;
    }
    if (/\b(interface|type)\s+\w+|:\s*\w+(\[\])?\s*[=;]/.test(raw)) {
      scores.typescript += 5;
    }
    if (/\bimport\s+type\b|\bas\s+const\b/.test(raw)) scores.typescript += 2;

    if (/\b(package|func|fmt\.|:=)\b/.test(raw)) scores.go += 5;
    if (/\b(fn |let mut|impl |pub fn|cargo)\b/.test(raw)) scores.rust += 5;
    if (
      /\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|FROM|WHERE)\b/i.test(raw)
    ) {
      scores.sql += 6;
    }
    if (/^\s*#!.*\b(bash|sh|zsh)\b/m.test(raw) || /^\s*(sudo |export |echo )/m.test(raw)) {
      scores.bash += 4;
    }
    if (/<\/?[a-zA-Z][\w:-]*[\s>]/.test(raw) || raw.startsWith("<!DOCTYPE")) {
      scores.html += 6;
    }
    if (/[{;]\s*$/m.test(raw) && /[.#]?[\w-]+\s*\{/.test(raw) && !tryParseJson(raw)) {
      scores.css += 5;
    }
    if (/^#{1,6}\s+\S+/m.test(raw) || /\[[^\]]+\]\([^)]+\)/.test(raw)) {
      scores.markdown += 4;
    }

    const ranked = Object.entries(scores)
      .filter(([lang]) => lang !== "plaintext")
      .sort((a, b) => b[1] - a[1]);
    const best = ranked[0];
    const second = ranked[1];

    if (!best || best[1] < 3) {
      return {
        lang: "plaintext",
        confidence: 0.2,
        suggestions: ranked
          .filter(([, s]) => s > 0)
          .slice(0, 4)
          .map(([l]) => l)
          .concat(["plaintext"]),
      };
    }

    const confidence =
      best[1] >= 8
        ? 0.95
        : best[1] >= 5
          ? 0.75
          : second && best[1] - second[1] <= 1
            ? 0.45
            : 0.6;

    const suggestions = ranked
      .filter(([, s]) => s > 0)
      .slice(0, 5)
      .map(([l]) => l);
    if (!suggestions.includes("plaintext")) suggestions.push("plaintext");

    return { lang: best[0], confidence, suggestions };
  }

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
    detectLanguage,
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
