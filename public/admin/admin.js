// Function Lab — әкімші панелінің логикасы.
(() => {
  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("kk-KZ");
    } catch (e) {
      return iso;
    }
  }

  const loginView = document.getElementById("loginView");
  const dashboardView = document.getElementById("dashboardView");
  const adminBar = document.getElementById("adminBar");
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");

  async function fetchData() {
    const res = await fetch("/api/admin/data", { credentials: "same-origin" });
    if (res.status === 401) {
      showLogin();
      return null;
    }
    if (!res.ok) throw new Error("Деректерді алу мүмкін болмады (" + res.status + ")");
    return res.json();
  }

  function showLogin() {
    loginView.hidden = false;
    dashboardView.hidden = true;
    adminBar.hidden = true;
  }

  function showDashboard() {
    loginView.hidden = true;
    dashboardView.hidden = false;
    adminBar.hidden = false;
  }

  function renderStages(stages) {
    const host = document.getElementById("stagesHost");
    host.innerHTML = stages.map((s) => `
      <div class="stage-card">
        <h4><span class="stage-range">${escapeHtml(s.range)}</span> ${escapeHtml(s.title)}</h4>
        <ul>${s.say.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
        <div class="watch"><strong>Бақылау:</strong> ${escapeHtml(s.watch)}</div>
      </div>
    `).join("");
  }

  function renderAnswerKey(rows) {
    const host = document.getElementById("answerKeyHost");
    host.innerHTML = `
      <table class="admin-table">
        <thead><tr><th>Нұсқа</th><th>Мазмұны</th><th>Функция</th><th>Қалыпты нәтиже</th><th>quantity=0</th><th>discount=0</th><th>Соңғы төлем</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td>${r.variant}</td><td>${escapeHtml(r.title)}</td><td><code>${escapeHtml(r.func)}</code></td><td>${r.normal}</td><td>${r.qty0}</td><td>${r.disc0}</td><td>${r.finalPayment}</td></tr>`).join("")}</tbody>
      </table>`;
  }

  function renderGrading(grading) {
    const host = document.getElementById("gradingHost");
    host.innerHTML = grading.criteria.map((c) => `
      <div class="grading-block">
        <h4>${c.code}. ${escapeHtml(c.title)} <span class="hint">(${c.points} балл)</span></h4>
        <ul>${c.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>
      </div>
    `).join("") + `
      <div class="grading-block">
        <h4>Дескриптор</h4>
        <ul>${grading.descriptor.map((d) => `<li>${d.points} балл — ${escapeHtml(d.desc)}</li>`).join("")}</ul>
      </div>
      <p class="hint">${escapeHtml(grading.note)}</p>
    `;
  }

  function renderStudents(students) {
    const host = document.getElementById("studentsHost");
    if (!students.length) {
      host.innerHTML = '<p class="empty-note">Әзірге ешкім жауап жібермеген.</p>';
      return;
    }
    host.innerHTML = students.map((s) => {
      const tr = s.testResults || {};
      const testRows = ["normal", "qty0", "disc0"].map((k) => {
        const t = tr[k];
        if (!t) return "";
        const label = k === "normal" ? "Қалыпты" : k === "qty0" ? "quantity=0" : "discount=0";
        return `<tr><td>${label}</td><td>${escapeHtml(t.studentExpected ?? "")}</td><td>${escapeHtml(t.actualText ?? "")}</td><td>${t.pass ? "Иә" : "Жоқ"}</td></tr>`;
      }).join("");
      return `
      <div class="student-card">
        <div class="student-card-head">
          <div>
            <strong>${escapeHtml(s.studentName) || "(аты жазылмаған)"}</strong>
            <span class="meta-row">· топ: ${escapeHtml(s.groupName) || "—"} · нұсқа: ${s.variantId ?? "—"} (${escapeHtml(s.funcName) || "—"})</span>
          </div>
          <span class="meta-row">соңғы жаңарту: ${fmtDate(s.updatedAt)} · соңғы бөлім: ${escapeHtml(s.lastSection) || "—"}</span>
        </div>
        <details>
          <summary>Код пен тест нәтижелерін көру</summary>
          <pre>${escapeHtml(s.code) || "(код жоқ)"}</pre>
          ${testRows ? `<table class="admin-table"><thead><tr><th>Тест</th><th>Студент күткен</th><th>Нақты нәтиже</th><th>Сәйкес пе?</th></tr></thead><tbody>${testRows}</tbody></table>` : '<p class="empty-note">Тест әлі өткізілмеген.</p>'}
          ${s.finalPayment != null ? `<p class="hint">Соңғы төлем: ${escapeHtml(String(s.finalPayment))}</p>` : ""}
        </details>
        <details>
          <summary>Шағын қорғау және рефлексия</summary>
          ${s.defenseAnswers ? `<p><strong>Параметрлер:</strong> ${escapeHtml(s.defenseAnswers.params)}</p><p><strong>Нәтиже:</strong> ${escapeHtml(s.defenseAnswers.result)}</p><p><strong>Тест:</strong> ${escapeHtml(s.defenseAnswers.test)}</p>` : '<p class="empty-note">Жауап жоқ</p>'}
          ${s.reflection ? `<p><strong>Қ1:</strong> ${escapeHtml(s.reflection.q1)}</p><p><strong>Қ2:</strong> ${escapeHtml(s.reflection.q2)}</p>` : ""}
        </details>
      </div>`;
    }).join("");
  }

  function renderPairs(pairShares, pairReviews) {
    const host = document.getElementById("pairsHost");
    if (!pairShares.length) {
      host.innerHTML = '<p class="empty-note">Әзірге ешкім кодын серіктесіне жібермеген.</p>';
      return;
    }
    host.innerHTML = pairShares.slice().reverse().map((share) => {
      const reviews = pairReviews.filter((r) => r.shareId === share.id);
      return `
      <div class="pair-group">
        <h4>Нұсқа ${share.variantId} — ${escapeHtml(share.studentName) || "аты жоқ"} жіберген код <span class="meta-row">(${fmtDate(share.sentAt)})</span></h4>
        <pre>${escapeHtml(share.code) || "(код бос)"}</pre>
        ${reviews.length === 0
          ? '<p class="empty-note">Пікір әлі жазылмаған.</p>'
          : reviews.map((r) => `
            <div class="reveal-box">
              <p class="meta-row">Тексерген: ${escapeHtml(r.studentName) || "аты жоқ"} (нұсқа ${r.variantId}) · жағдай: ${escapeHtml(r.condition)} · ${fmtDate(r.reviewedAt)}</p>
              <p><strong>Байқалған нәтиже:</strong> ${escapeHtml(r.observed)}</p>
              <p><strong>Қорытынды:</strong> ${escapeHtml(r.conclusion)}</p>
            </div>`).join("")}
      </div>`;
    }).join("");
  }

  async function loadAll() {
    const data = await fetchData();
    if (!data) return;
    showDashboard();
    renderStages(data.lessonPlan.STAGES);
    renderAnswerKey(data.lessonPlan.ANSWER_KEY);
    renderGrading(data.lessonPlan.GRADING);
    renderStudents(data.students);
    renderPairs(data.pairShares, data.pairReviews);
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    const password = document.getElementById("passwordInput").value;
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        loginError.textContent = "Пароль қате. Қайталап көріңіз.";
        loginError.hidden = false;
        return;
      }
      await loadAll();
    } catch (err) {
      loginError.textContent = "Серверге қосылу мүмкін болмады.";
      loginError.hidden = false;
    }
  });

  document.getElementById("btnRefresh").addEventListener("click", () => {
    loadAll().catch((e) => alert("Жаңарту сәтсіз: " + e.message));
  });

  document.getElementById("btnLogout").addEventListener("click", async () => {
    await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
    showLogin();
  });

  loadAll().catch(() => showLogin());
})();
