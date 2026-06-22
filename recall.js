(function () {
  const data = window.QUIZ_DATA;
  const { escapeHtml, shuffle } = window.MaogaiShared;

  if (!data) {
    document.body.innerHTML = "<p style='padding:2rem'>未找到 quiz-data.js，请先运行 build.py</p>";
    return;
  }

  const subtitle = document.getElementById("recallSubtitle");
  const sourceFilter = document.getElementById("sourceFilter");
  const chapterFilter = document.getElementById("chapterFilter");
  const poolHint = document.getElementById("poolHint");
  const startBtn = document.getElementById("startBtn");
  const recallEmpty = document.getElementById("recallEmpty");
  const recallSession = document.getElementById("recallSession");
  const recallCard = document.getElementById("recallCard");
  const progressText = document.getElementById("progressText");
  const progressFill = document.getElementById("progressFill");
  const qMeta = document.getElementById("qMeta");
  const showMemoBtn = document.getElementById("showMemoBtn");
  const showAnswerBtn = document.getElementById("showAnswerBtn");
  const recallNav = document.getElementById("recallNav");
  const prevBtn = document.getElementById("prevBtn");
  const easyBtn = document.getElementById("easyBtn");
  const hardBtn = document.getElementById("hardBtn");

  const s = data.stats;
  subtitle.textContent = `${s.subjective} 题 · 简${s.short} / 论${s.essay}`;

  let filterType = "all";
  let filterMode = "random";
  let session = null;
  let revealed = false;

  [...new Set(data.subjective.map((q) => q.source))].sort().forEach((src) => {
    const opt = document.createElement("option");
    opt.value = src;
    opt.textContent = src;
    sourceFilter.appendChild(opt);
  });

  [...new Set(data.subjective.map((q) => q.chapter).filter(Boolean))].sort().forEach((ch) => {
    const opt = document.createElement("option");
    opt.value = ch;
    opt.textContent = ch;
    chapterFilter.appendChild(opt);
  });

  document.getElementById("typeChips").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-type]");
    if (!btn) return;
    document.querySelectorAll("#typeChips .chip").forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    filterType = btn.dataset.type;
    updatePoolHint();
  });

  document.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-mode]").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      filterMode = btn.dataset.mode;
      updatePoolHint();
    });
  });

  [sourceFilter, chapterFilter].forEach((el) => el.addEventListener("change", updatePoolHint));

  function getPool() {
    let pool = data.subjective.filter((q) => {
      if (filterType !== "all" && q.type !== filterType) return false;
      if (sourceFilter.value !== "all" && q.source !== sourceFilter.value) return false;
      if (chapterFilter.value !== "all" && q.chapter !== chapterFilter.value) return false;
      return true;
    });
    if (filterMode === "random") pool = shuffle(pool);
    return pool;
  }

  function updatePoolHint() {
    poolHint.textContent = `当前 ${getPool().length} 题`;
  }
  updatePoolHint();

  function typeLabel(t) {
    return t === "essay" ? "论述" : "简答";
  }

  function formatAnswer(text) {
    return escapeHtml(text).replace(/\n/g, "<br>");
  }

  function renderQuestion() {
    const q = session.items[session.index];
    const total = session.items.length;
    progressText.textContent = `${session.index + 1} / ${total}`;
    progressFill.style.width = `${((session.index + 1) / total) * 100}%`;
    qMeta.textContent = [typeLabel(q.type), q.source, q.chapter].filter(Boolean).join(" · ");
    revealed = false;

    recallCard.innerHTML = `
      <div class="recall-q">${escapeHtml(q.question)}</div>
      <div class="recall-memo hidden" id="memoBlock"></div>
      <div class="recall-answer hidden" id="answerBlock"></div>`;

    if (q.memo) {
      showMemoBtn.classList.remove("hidden");
      showMemoBtn.onclick = () => {
        const el = document.getElementById("memoBlock");
        el.classList.remove("hidden");
        el.innerHTML = `<div class="card-label">记</div><div>${formatAnswer(q.memo)}</div>`;
        showMemoBtn.classList.add("hidden");
      };
    } else {
      showMemoBtn.classList.add("hidden");
    }

    showAnswerBtn.classList.remove("hidden");
    showAnswerBtn.onclick = () => {
      const el = document.getElementById("answerBlock");
      el.classList.remove("hidden");
      el.innerHTML = `<div class="card-label">答</div><div>${formatAnswer(q.answer)}</div>`;
      showAnswerBtn.classList.add("hidden");
      recallNav.classList.remove("hidden");
      revealed = true;
    };

    recallNav.classList.add("hidden");
    prevBtn.disabled = session.index === 0;
  }

  function startSession() {
    const pool = getPool();
    if (!pool.length) {
      alert("没有符合条件的题目");
      return;
    }
    session = { items: pool, index: 0 };
    recallEmpty.classList.add("hidden");
    recallSession.classList.remove("hidden");
    renderQuestion();
  }

  function go(delta) {
    session.index += delta;
    if (session.index >= session.items.length) {
      alert(`过题完成！共 ${session.items.length} 题`);
      session.index = session.items.length - 1;
      return;
    }
    if (session.index < 0) session.index = 0;
    renderQuestion();
  }

  startBtn.addEventListener("click", startSession);
  prevBtn.addEventListener("click", () => go(-1));
  easyBtn.addEventListener("click", () => go(1));
  hardBtn.addEventListener("click", () => go(1));
})();
