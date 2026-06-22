(function () {
  const KEY = "maogai-theme";

  function applyTheme(theme) {
    if (theme === "dark") document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
  }

  const saved = localStorage.getItem(KEY);
  if (saved) applyTheme(saved);

  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "" : "dark";
      applyTheme(next);
      localStorage.setItem(KEY, next);
    });
  });

  const page = document.body.dataset.page;
  document.querySelectorAll(".site-nav a").forEach((a) => {
    if (a.dataset.page === page) a.classList.add("active");
  });

  window.MaogaiShared = {
    escapeHtml(s) {
      return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    loadWrong(key) {
      try {
        return JSON.parse(localStorage.getItem(key) || "[]");
      } catch {
        return [];
      }
    },
    saveWrong(key, ids) {
      localStorage.setItem(key, JSON.stringify([...new Set(ids)]));
    },
  };
})();
