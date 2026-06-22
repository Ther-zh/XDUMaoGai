(function () {
  const data = window.QUIZ_DATA;
  const { escapeHtml, shuffle, loadWrong, saveWrong } = window.MaogaiShared;
  const WRONG_KEY = "maogai-quiz-wrong";

  if (!data) {
    document.body.innerHTML = "<p style='padding:2rem'>未找到 quiz-data.js，请先运行 build.py</p>";
    return;
  }

  const subtitle = document.getElementById("quizSubtitle");
  const sourceFilter = document.getElementById("sourceFilter");
  const chapterFilter = document.getElementById("chapterFilter");
  const poolHint = document.getElementById("poolHint");
  const startBtn = document.getElementById("startBtn");
  const quizEmpty = document.getElementById("quizEmpty");
  const quizSession = document.getElementById("quizSession");
  const quizResult = document.getElementById("quizResult");
  const quizCard = document.getElementById("quizCard");
  const quizActions = document.getElementById("quizActions");
  const progressText = document.getElementById("progressText");
  const progressFill = document.getElementById("progressFill");
  const scoreText = document.getElementById("scoreText");
  const resultScore = document.getElementById("resultScore");
  const resultDetail = document.getElementById("resultDetail");
  const retryBtn = document.getElementById("retryBtn");
  const retryWrongBtn = document.getElementById("retryWrongBtn");
  const countSelect = document.getElementById("countSelect");

  const s = data.stats;
  subtitle.textContent = `${s.objective} 题 · 单${s.single} / 多${s.multi} / 判${s.judge}`;

  let filterType = "all";
  let filterMode = "random";
  let session = null;
  let selected = new Set();

  const sources = [...new Set(data.objective.map((q) => q.source))].sort();
  sources.forEach((src) => {
    const opt = document.createElement("option");
    opt.value = src;
    opt.textContent = src;
    sourceFilter.appendChild(opt);
  });

  const chapters = [...new Set(data.objective.map((q) => q.chapter).filter(Boolean))].sort();
  chapters.forEach((ch) => {
    const opt = document.createElement("option");
    opt.value = ch;
    opt.textContent = ch;
    chapterFilter.appendChild(opt);
  });
  if (!chapters.length) chapterFilter.closest("label")?.previousElementSibling?.classList?.add("hidden");

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

  [sourceFilter, chapterFilter, countSelect].forEach((el) => el.addEventListener("change", updatePoolHint));

  function getPool(wrongOnly = false) {
    const wrongIds = loadWrong(WRONG_KEY);
    let pool = data.objective.filter((q) => {
      if (filterType !== "all" && q.type !== filterType) return false;
      if (sourceFilter.value !== "all" && q.source !== sourceFilter.value) return false;
      if (chapterFilter.value !== "all" && q.chapter !== chapterFilter.value) return false;
      if (wrongOnly && !wrongIds.includes(q.id)) return false;
      if (filterMode === "wrong" && !wrongOnly && !wrongIds.includes(q.id)) return false;
      return true;
    });
    if (filterMode === "random" || filterMode === "wrong") pool = shuffle(pool);
    return pool;
  }

  function updatePoolHint() {
    const pool = getPool(filterMode === "wrong");
    const wrongN = loadWrong(WRONG_KEY).length;
    poolHint.textContent = `当前题库 ${pool.length} 题${wrongN ? ` · 错题本 ${wrongN} 题` : ""}`;
  }
  updatePoolHint();

  function typeLabel(t) {
    return { single: "单选", multi: "多选", judge: "判断" }[t] || t;
  }

  function startSession(wrongOnly = false) {
    let pool = getPool(wrongOnly);
    const countVal = countSelect.value;
    if (countVal !== "all") pool = pool.slice(0, parseInt(countVal, 10));
    if (!pool.length) {
      alert(wrongOnly || filterMode === "wrong" ? "错题本为空，先做几道题吧" : "没有符合条件的题目");
      return;
    }
    session = {
      items: pool,
      index: 0,
      correct: 0,
      wrongIds: [],
      answered: false,
    };
    selected = new Set();
    quizEmpty.classList.add("hidden");
    quizResult.classList.add("hidden");
    quizSession.classList.remove("hidden");
    renderQuestion();
  }

  function renderQuestion() {
    const q = session.items[session.index];
    const total = session.items.length;
    progressText.textContent = `${session.index + 1} / ${total}`;
    progressFill.style.width = `${((session.index + 1) / total) * 100}%`;
    scoreText.textContent = session.correct;

    const meta = [typeLabel(q.type), q.source, q.chapter].filter(Boolean).join(" · ");
    quizCard.innerHTML = `
      <div class="quiz-meta">${escapeHtml(meta)}</div>
      <h3 class="quiz-stem">${escapeHtml(q.question)}</h3>
      <div class="option-list" id="optionList"></div>
      <div class="quiz-feedback hidden" id="feedback"></div>`;

    const list = quizCard.querySelector("#optionList");
    session.answered = false;
    selected = new Set();

    if (q.type === "judge") {
      ["对", "错"].forEach((label) => {
        list.appendChild(makeOption(label, label, false));
      });
    } else if (q.type === "multi") {
      q.options.forEach((o) => list.appendChild(makeOption(o.key, `${o.key}. ${o.text}`, true)));
      quizActions.innerHTML = `<button type="button" class="btn-primary" id="submitBtn">确认答案</button>`;
      document.getElementById("submitBtn").addEventListener("click", submitMulti);
    } else {
      q.options.forEach((o) => list.appendChild(makeOption(o.key, `${o.key}. ${o.text}`, false)));
      quizActions.innerHTML = "";
    }
  }

  function makeOption(key, text, multi) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option-btn";
    btn.dataset.key = key;
    btn.innerHTML = escapeHtml(text);
    btn.addEventListener("click", () => {
      if (session.answered) return;
      if (multi) {
        btn.classList.toggle("selected");
        if (selected.has(key)) selected.delete(key);
        else selected.add(key);
      } else {
        submitSingle(key);
      }
    });
    return btn;
  }

  function normalizeAnswer(ans) {
    return String(ans).replace(/\s+/g, "").toUpperCase();
  }

  function submitSingle(key) {
    session.answered = true;
    const q = session.items[session.index];
    const ok = normalizeAnswer(key) === normalizeAnswer(q.answer);
    if (ok) session.correct++;
    else session.wrongIds.push(q.id);
    showFeedback(q, ok, key);
    markOptions(q, ok, new Set([key]));
    quizActions.innerHTML = `<button type="button" class="btn-primary" id="nextBtn">${session.index + 1 >= session.items.length ? "查看结果" : "下一题"}</button>`;
    document.getElementById("nextBtn").addEventListener("click", nextQuestion);
  }

  function submitMulti() {
    if (!selected.size) return;
    session.answered = true;
    const q = session.items[session.index];
    const userAns = [...selected].sort().join("");
    const ok = normalizeAnswer(userAns) === normalizeAnswer(q.answer);
    if (ok) session.correct++;
    else session.wrongIds.push(q.id);
    showFeedback(q, ok, userAns);
    markOptions(q, ok, selected);
    quizActions.innerHTML = `<button type="button" class="btn-primary" id="nextBtn">${session.index + 1 >= session.items.length ? "查看结果" : "下一题"}</button>`;
    document.getElementById("nextBtn").addEventListener("click", nextQuestion);
  }

  function markOptions(q, ok, userKeys) {
    quizCard.querySelectorAll(".option-btn").forEach((btn) => {
      const k = btn.dataset.key;
      const correctKeys = new Set(normalizeAnswer(q.answer).split(""));
      btn.disabled = true;
      if (correctKeys.has(normalizeAnswer(k))) btn.classList.add("correct");
      else if (userKeys.has(k)) btn.classList.add("wrong");
    });
  }

  function showFeedback(q, ok, userAns) {
    const fb = quizCard.querySelector("#feedback");
    fb.classList.remove("hidden");
    fb.className = "quiz-feedback " + (ok ? "ok" : "bad");
    const ansShow = q.type === "judge" ? q.answer : q.answer + (q.answerText ? `（${q.answerText}）` : "");
    fb.innerHTML = ok
      ? "✓ 回答正确"
      : `✗ 正确答案：${escapeHtml(ansShow)}${userAns ? ` · 你的选择：${escapeHtml(userAns)}` : ""}`;
    scoreText.textContent = session.correct;

    const wrong = loadWrong(WRONG_KEY);
    if (!ok && !wrong.includes(q.id)) {
      wrong.push(q.id);
      saveWrong(WRONG_KEY, wrong);
      updatePoolHint();
    } else if (ok && wrong.includes(q.id)) {
      saveWrong(WRONG_KEY, wrong.filter((id) => id !== q.id));
      updatePoolHint();
    }
  }

  function nextQuestion() {
    session.index++;
    if (session.index >= session.items.length) showResult();
    else renderQuestion();
  }

  function showResult() {
    quizSession.classList.add("hidden");
    quizResult.classList.remove("hidden");
    const total = session.items.length;
    const pct = Math.round((session.correct / total) * 100);
    resultScore.textContent = `${session.correct} / ${total}（${pct}%）`;
    resultDetail.textContent =
      session.wrongIds.length > 0
        ? `错题 ${session.wrongIds.length} 道，已加入错题本`
        : "全部正确，继续保持！";
  }

  startBtn.addEventListener("click", () => startSession(false));
  retryBtn.addEventListener("click", () => startSession(false));
  retryWrongBtn.addEventListener("click", () => startSession(true));
})();
