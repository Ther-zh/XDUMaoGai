(function () {

  const data = window.STUDY_DATA;

  if (!data) {

    document.body.innerHTML = "<p style='padding:2rem;font-family:sans-serif'>未找到 data.js，请先运行 build.py</p>";

    return;

  }



  const navList = document.getElementById("navList");

  const navStats = document.getElementById("navStats");

  const sectionsEl = document.getElementById("sections");

  const hero = document.getElementById("hero");

  const footnotesEl = document.getElementById("footnotes");

  const searchInput = document.getElementById("search");

  const memoOnly = document.getElementById("memoOnly");

  const fab = document.getElementById("fab");

  const progressBar = document.getElementById("progressBar");

  const menuBtn = document.getElementById("menuBtn");

  const sidebar = document.getElementById("sidebar");

  const sidebarOverlay = document.getElementById("sidebarOverlay");



  const totalQuestions = data.sections.reduce((n, s) => n + s.questions.length, 0);

  const chapterCount = data.sections.length;



  navStats.textContent = `${chapterCount} 章 · ${totalQuestions} 题`;



  hero.innerHTML = `

    <h2>${data.title}</h2>

    <p class="hero-desc">按章背诵【记】，对照【答】练完整话术</p>

    <div class="hero-stats">

      <span class="stat-chip"><strong>${chapterCount}</strong> 章节</span>

      <span class="stat-chip"><strong>${totalQuestions}</strong> 主观题</span>

      <span class="stat-chip">绪论–8 章精讲</span>

    </div>

    <ul class="meta-list">${(data.metaHtml || data.meta.map((m) => m.replace(/^>\s*/, ""))).map((m) => `<li>${m}</li>`).join("")}</ul>

  `;



  const fnEntries = Object.entries(data.footnotes || {});

  if (fnEntries.length) {

    footnotesEl.innerHTML =

      "<h3>脚注</h3>" +

      fnEntries

        .map(([id, text]) => `<p id="fn-${id}"><dt>[${id}]</dt> <dd>${text}</dd></p>`)

        .join("");

  }



  let qGlobalIndex = 0;



  data.sections.forEach((sec, secIndex) => {

    const navLi = document.createElement("li");

    navLi.innerHTML = `<a href="#${sec.id}" data-id="${sec.id}">

      <span class="nav-index">${String(secIndex + 1).padStart(2, "0")}</span>

      <span>${sec.title}</span>

    </a>`;

    navList.appendChild(navLi);



    const article = document.createElement("article");

    article.className = "chapter";

    article.id = sec.id;

    article.dataset.search = sec.title + " " + sec.questions.map((q) => q.title).join(" ");



    const qHtml = sec.questions

      .map((q) => {

        qGlobalIndex += 1;

        const qSearch = q.title + " " + q.memo.join(" ") + " " + q.answer.join(" ");

        return `

        <div class="question" data-search="${escapeAttr(qSearch)}">

          <h4 class="question-title">

            <span class="q-badge">Q${qGlobalIndex}</span>

            ${q.titleHtml || q.title}

          </h4>

          <div class="card card-memo">

            <div class="card-label">记</div>

            <div class="card-body">${q.memoHtml}</div>

          </div>

          <div class="card card-answer answer-block">

            <div class="card-label">答</div>

            <div class="card-body">${q.answerHtml}</div>

          </div>

        </div>`;

      })

      .join("");



    const numLabel = secIndex === 0 ? "模板" : String(secIndex).padStart(2, "0");



    article.innerHTML = `

      <div class="chapter-head">

        <span class="chapter-num">${numLabel}</span>

        <h2>${sec.title}</h2>

      </div>

      <div class="block knowledge">

        <div class="block-title">知识点</div>

        ${sec.intro || ""}

        ${sec.knowledgeHtml}

      </div>

      ${sec.questions.length ? `<div class="block">

        <div class="block-title">题目 · ${sec.questions.length}</div>

        ${qHtml}

      </div>` : ""}`;



    sectionsEl.appendChild(article);

  });



  const navLinks = [...navList.querySelectorAll("a")];

  const chapters = [...document.querySelectorAll(".chapter")];



  const observer = new IntersectionObserver(

    (entries) => {

      entries.forEach((e) => {

        if (e.isIntersecting) {

          navLinks.forEach((a) => a.classList.toggle("active", a.dataset.id === e.target.id));

        }

      });

    },

    { rootMargin: "-25% 0px -65% 0px", threshold: 0 }

  );

  chapters.forEach((c) => observer.observe(c));



  function applyMemoOnly() {

    document.querySelectorAll(".answer-block").forEach((el) => {

      el.classList.toggle("hidden-answer", memoOnly.checked);

    });

  }

  memoOnly.addEventListener("change", applyMemoOnly);



  searchInput.addEventListener("input", () => {

    const q = searchInput.value.trim().toLowerCase();

    chapters.forEach((ch) => {

      const chText = (ch.dataset.search || ch.textContent).toLowerCase();

      const chMatch = !q || chText.includes(q);

      let anyQ = false;

      ch.querySelectorAll(".question").forEach((ques) => {

        const qt = (ques.dataset.search || "").toLowerCase();

        const match = !q || qt.includes(q) || chMatch;

        ques.classList.toggle("hidden", !match);

        if (match) anyQ = true;

      });

      ch.classList.toggle("hidden", !q ? false : !(chMatch || anyQ));

    });

    navLinks.forEach((a) => {

      const sec = document.getElementById(a.dataset.id);

      a.parentElement.classList.toggle("hidden", sec?.classList.contains("hidden"));

    });

  });



  document.addEventListener("keydown", (e) => {

    if (e.key === "/" && document.activeElement !== searchInput) {

      e.preventDefault();

      searchInput.focus();

    }

    if (e.key === "Escape") {

      if (document.activeElement === searchInput) {

        searchInput.blur();

        searchInput.value = "";

        searchInput.dispatchEvent(new Event("input"));

      }

      closeSidebar();

    }

  });



  function openSidebar() {

    sidebar.classList.add("open");

    sidebarOverlay.classList.add("visible");

    menuBtn.setAttribute("aria-expanded", "true");

  }



  function closeSidebar() {

    sidebar.classList.remove("open");

    sidebarOverlay.classList.remove("visible");

    menuBtn.setAttribute("aria-expanded", "false");

  }



  menuBtn.addEventListener("click", () => {

    sidebar.classList.contains("open") ? closeSidebar() : openSidebar();

  });



  sidebarOverlay.addEventListener("click", closeSidebar);



  navLinks.forEach((a) => {

    a.addEventListener("click", () => {

      if (window.matchMedia("(max-width: 768px)").matches) closeSidebar();

    });

  });



  function updateProgress() {

    const scrollTop = window.scrollY;

    const docHeight = document.documentElement.scrollHeight - window.innerHeight;

    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;

    progressBar.style.width = pct + "%";

    fab.classList.toggle("visible", scrollTop > 400);

  }



  window.addEventListener("scroll", updateProgress, { passive: true });

  updateProgress();



  fab.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));



  function escapeAttr(s) {

    return s.replace(/"/g, "&quot;").replace(/</g, "&lt;");

  }

})();

