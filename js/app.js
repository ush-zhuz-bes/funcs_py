import {
  LESSON_INFO, VARIANTS, getVariant, trueResult, makeTestCases, variantSkeleton,
  GUIDING_QUESTIONS, THEORY_EXAMPLE_CODE, PREDICT_EXAMPLE_CODE, GRADING,
} from "./data.js";
import { state, saveState, markVisited, onSaveStatus, SAVE_AVAILABLE } from "./storage.js";
import { pyRunner } from "./pyrunner.js";
import { CodeEditor, formatKazakhHint } from "./editor.js";

// ---------- Жалпы көмекші функциялар ----------

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function numbersClose(a, b) {
  if (typeof a !== "number" || typeof b !== "number" || Number.isNaN(a) || Number.isNaN(b)) return false;
  const tol = 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= tol;
}

function bindField(el, get, set) {
  if (!el) return;
  el.value = get() ?? "";
  el.addEventListener("input", () => { set(el.value); saveState(); });
}

// ---------- Жоғарғы панель: Python күйі / сақтау күйі ----------

const pyStatusBanner = document.getElementById("pyStatusBanner");
const STATUS_TEXT = {
  loading: "Python ортасы жүктелуде…",
  ready: "Орындауға дайын",
  running: "Код орындалуда…",
  error: "Python ортасын жүктеу мүмкін болмады — интернет байланысын тексеріңіз. Кодты .py ретінде жүктеп, компьютердегі Python ортасында орындауға болады.",
};
pyRunner.onStatus((status) => {
  pyStatusBanner.textContent = STATUS_TEXT[status] || "";
  pyStatusBanner.classList.toggle("status-error", status === "error");
});

const saveStatusBanner = document.getElementById("saveStatusBanner");
if (!SAVE_AVAILABLE) {
  saveStatusBanner.textContent = "Браузерде сақтау қолжетімсіз — жұмысты міндетті түрде файл ретінде жүктеп алыңыз.";
  saveStatusBanner.classList.add("status-error");
} else {
  onSaveStatus((ok) => {
    saveStatusBanner.textContent = ok ? "Сақталды" : "Сақтау мүмкін болмады";
    saveStatusBanner.classList.toggle("status-error", !ok);
    clearTimeout(saveStatusBanner._t);
    if (ok) saveStatusBanner._t = setTimeout(() => { saveStatusBanner.textContent = ""; }, 2000);
  });
}

bindField(document.getElementById("studentName"), () => state.studentName, (v) => { state.studentName = v; });
bindField(document.getElementById("groupName"), () => state.groupName, (v) => { state.groupName = v; });

// ---------- Навигация ----------

const navButtons = Array.from(document.querySelectorAll(".nav-btn"));
const sections = Array.from(document.querySelectorAll(".lesson-section"));

function showSection(id, { focus = true } = {}) {
  sections.forEach((s) => { s.hidden = s.dataset.section !== id; });
  navButtons.forEach((b) => {
    const active = b.dataset.section === id;
    b.classList.toggle("active", active);
    if (active) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
  markVisited(id);
  applyVisitedMarks();
  const section = sections.find((s) => s.dataset.section === id);
  if (section) {
    const headerEl = document.querySelector(".site-header");
    const headerHeight = headerEl ? headerEl.offsetHeight : 0;
    const top = section.getBoundingClientRect().top + window.scrollY - headerHeight - 10;
    window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
    if (focus) {
      const heading = section.querySelector("h2");
      if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus({ preventScroll: true }); }
    }
  }
  if (id === "check") renderTestTable();
}

function applyVisitedMarks() {
  navButtons.forEach((b) => {
    b.classList.toggle("visited", !!state.visitedSections[b.dataset.section]);
  });
}

navButtons.forEach((b) => b.addEventListener("click", () => showSection(b.dataset.section)));
document.querySelectorAll("[data-next]").forEach((b) => {
  b.addEventListener("click", () => showSection(b.dataset.next));
});

applyVisitedMarks();
showSection("start", { focus: false });

// ---------- 1. Бастау ----------

bindField(document.getElementById("discussionAnswer"), () => state.discussionAnswer, (v) => { state.discussionAnswer = v; });

const btnRevealDiscussion = document.getElementById("btnRevealDiscussion");
const discussionExplanation = document.getElementById("discussionExplanation");
btnRevealDiscussion.addEventListener("click", () => {
  discussionExplanation.hidden = !discussionExplanation.hidden;
  btnRevealDiscussion.textContent = discussionExplanation.hidden ? "Түсіндірмені ашу" : "Түсіндірмені жасыру";
});

// ---------- 2. Түсіну ----------

const theoryEditor = new CodeEditor(document.querySelector('[data-slot="theory-main"]'), {
  slot: "theory-main",
  template: THEORY_EXAMPLE_CODE,
  filename: "mysal.py",
  getSaved: () => state.theory.code,
  setSaved: (v) => { state.theory.code = v; },
  onRunResult: (result) => {
    const out = (result.stdout || "").trim();
    const fb = document.getElementById("theoryGuessFeedback");
    const guess = document.getElementById("theoryGuess").value.trim();
    if (!result.ok) { fb.textContent = ""; return; }
    if (!out) { fb.textContent = ""; return; }
    if (guess) {
      fb.textContent = (guess === out)
        ? `Болжамыңыз нақты нәтижемен сәйкес келді: ${out}.`
        : `Нақты нәтиже: ${out}. Сіздің болжамыңыз: ${guess}. Айырмашылықтың себебін ойланыңыз.`;
    } else {
      fb.textContent = `Нақты нәтиже: ${out}.`;
    }
  },
});

// ---------- 3. Болжау ----------

const predictQ1 = document.getElementById("predictQ1");
const predictQ2 = document.getElementById("predictQ2");
const btnRevealPredictExplain = document.getElementById("btnRevealPredictExplain");
const predictExplainBox = document.getElementById("predictExplainBox");

function predictionsFilled() {
  return predictQ1.value.trim() !== "" && predictQ2.value.trim() !== "";
}

function refreshPredictGate() {
  const ok = predictionsFilled();
  btnRevealPredictExplain.disabled = !ok;
  predictMainEditor.refreshGate();
}

bindField(predictQ1, () => state.predictMain.predictionOutput, (v) => { state.predictMain.predictionOutput = v; refreshPredictGate(); });
bindField(predictQ2, () => state.predictMain.predictionResult, (v) => { state.predictMain.predictionResult = v; refreshPredictGate(); });

const predictMainEditor = new CodeEditor(document.querySelector('[data-slot="predict-main"]'), {
  slot: "predict-main",
  template: PREDICT_EXAMPLE_CODE,
  filename: "boljau.py",
  getSaved: () => "",
  setSaved: () => {},
  canRun: predictionsFilled,
});
// Бұл редактордың коды редакцияланбайды — тек оқу мысалы ретінде орындалады.
predictMainEditor.textarea.value = PREDICT_EXAMPLE_CODE;
predictMainEditor.textarea.readOnly = true;

btnRevealPredictExplain.addEventListener("click", () => {
  predictExplainBox.hidden = !predictExplainBox.hidden;
  state.predictMain.explained = !predictExplainBox.hidden;
  saveState();
  btnRevealPredictExplain.textContent = predictExplainBox.hidden ? "Түсіндірмені ашу" : "Түсіндірмені жасыру";
});
if (state.predictMain.explained) predictExplainBox.hidden = false;
refreshPredictGate();

const btnRevealFixed = document.getElementById("btnRevealFixed");
const fixedExplainBox = document.getElementById("fixedExplainBox");

const predictFixEditor = new CodeEditor(document.querySelector('[data-slot="predict-fix"]'), {
  slot: "predict-fix",
  template: PREDICT_EXAMPLE_CODE,
  filename: "boljau_tuzetu.py",
  getSaved: () => state.predictFix.code,
  setSaved: (v) => { state.predictFix.code = v; },
  onRunResult: () => {
    state.predictFix.runCount = (state.predictFix.runCount || 0) + 1;
    saveState();
    btnRevealFixed.disabled = false;
  },
});
if (state.predictFix.runCount > 0) btnRevealFixed.disabled = false;
if (state.predictFix.revealed) fixedExplainBox.hidden = false;

btnRevealFixed.addEventListener("click", () => {
  fixedExplainBox.hidden = !fixedExplainBox.hidden;
  state.predictFix.revealed = !fixedExplainBox.hidden;
  saveState();
  btnRevealFixed.textContent = fixedExplainBox.hidden ? "Дайын түзетуді ашу" : "Дайын түзетуді жасыру";
});

// ---------- 4. Менің нұсқам ----------

const variantSelect = document.getElementById("variantSelect");
const variantDetailCard = document.getElementById("variantDetailCard");
const variantEditorHost = document.getElementById("variantEditorHost");
const pairVariantSelect = document.getElementById("pairVariantSelect");
const guidingQuestionsList = document.getElementById("guidingQuestionsList");

GUIDING_QUESTIONS.forEach((q) => {
  const li = document.createElement("li");
  li.textContent = q;
  guidingQuestionsList.appendChild(li);
});

const btnToggleGuiding = document.getElementById("btnToggleGuiding");
const guidingQuestionsBox = document.getElementById("guidingQuestionsBox");
btnToggleGuiding.addEventListener("click", () => {
  guidingQuestionsBox.hidden = !guidingQuestionsBox.hidden;
  btnToggleGuiding.textContent = guidingQuestionsBox.hidden ? "Бағыттаушы сұрақ" : "Бағыттаушы сұрақты жасыру";
});

VARIANTS.forEach((v) => {
  const opt1 = document.createElement("option");
  opt1.value = v.id;
  opt1.textContent = `Нұсқа ${v.id} — ${v.title}`;
  variantSelect.appendChild(opt1);
  const opt2 = opt1.cloneNode(true);
  pairVariantSelect.appendChild(opt2);
});

let currentVariantEditor = null;

function renderVariantDetail(variant) {
  variantDetailCard.innerHTML = `
    <table class="kv-table">
      <tr><th>Мазмұны</th><td>${escapeHtml(variant.title)}</td></tr>
      <tr><th>Функция атауы</th><td><code>${escapeHtml(variant.funcName)}</code></td></tr>
      <tr><th>price</th><td>${variant.price}</td></tr>
      <tr><th>quantity (${escapeHtml(variant.unitLabel)})</th><td>${variant.quantity}</td></tr>
      <tr><th>discount</th><td>${variant.discount}%</td></tr>
      <tr><th>fee (қызмет ақысы)</th><td>${variant.fee}</td></tr>
    </table>`;
}

function mountVariantEditor(variant) {
  if (currentVariantEditor) currentVariantEditor._unsubscribe();
  const template = variantSkeleton(variant);
  variantEditorHost.innerHTML = `
    <div class="editor" data-slot="variant-${variant.id}" data-filename="variant_${variant.id}.py">
      <div class="editor-toolbar">
        <button type="button" class="btn btn-primary" data-action="run">Орындау</button>
        <button type="button" class="btn" data-action="stop">Тоқтату</button>
        <button type="button" class="btn btn-ghost" data-action="reset">Бастапқы үлгі</button>
        <button type="button" class="btn btn-ghost" data-action="copy">Көшіру</button>
        <button type="button" class="btn btn-ghost" data-action="download">.py жүктеу</button>
      </div>
      <textarea class="editor-textarea" spellcheck="false" autocapitalize="off" autocomplete="off" rows="10"></textarea>
      <div class="editor-status" data-role="status">Python ортасы жүктелуде…</div>
      <pre class="editor-output" data-role="output" aria-live="polite"></pre>
    </div>`;
  const root = variantEditorHost.querySelector(".editor");
  currentVariantEditor = new CodeEditor(root, {
    slot: `variant-${variant.id}`,
    template,
    filename: `variant_${variant.id}.py`,
    getSaved: () => state.variantCodes[variant.id],
    setSaved: (v) => { state.variantCodes[variant.id] = v; },
    onCodeChanged: () => { invalidateTestResults(variant.id); if (!document.getElementById("section-check").hidden) renderTestTable(); },
  });
}

function selectVariant(id) {
  const variant = getVariant(id);
  if (!variant) return;
  state.selectedVariant = variant.id;
  saveState();
  variantSelect.value = String(variant.id);
  pairVariantSelect.value = String(variant.id);
  updatePairFuncName();
  renderVariantDetail(variant);
  mountVariantEditor(variant);
  renderTestTable();
}

variantSelect.addEventListener("change", () => selectVariant(variantSelect.value));

// ---------- 5. Тексеру ----------

const testTableHost = document.getElementById("testTableHost");
const checkActiveVariantLine = document.getElementById("checkActiveVariantLine");

function invalidateTestResults(variantId) {
  const rec = state.testResults[variantId];
  if (rec) rec.stale = true;
  saveState();
}

function getTestRecord(variantId) {
  if (!state.testResults[variantId]) {
    state.testResults[variantId] = { normal: null, qty0: null, disc0: null, stale: false };
  }
  return state.testResults[variantId];
}

function renderTestTable() {
  const variant = getVariant(state.selectedVariant);
  if (!variant) return;
  checkActiveVariantLine.textContent = `Белсенді нұсқа: ${variant.id} — ${variant.title} (функция: ${variant.funcName})`;
  const cases = makeTestCases(variant);
  const rec = getTestRecord(variant.id);

  const rows = cases.map((tc) => {
    const saved = rec[tc.key];
    const studentExpected = saved && saved.studentExpected !== undefined ? saved.studentExpected : "";
    const actualText = saved && !rec.stale ? saved.actualText : "";
    const passBadge = saved && !rec.stale
      ? (saved.pass ? '<span class="badge badge-ok">Иә</span>' : '<span class="badge badge-fail">Жоқ</span>')
      : (rec.stale && saved ? '<span class="badge badge-warn">Код өзгерді, қайта тексеріңіз</span>' : '<span class="badge">—</span>');
    const guessNote = saved && studentExpected !== ""
      ? (numbersClose(parseFloat(studentExpected), tc.expected)
          ? '<span class="guess-note guess-ok">✓ болжам дұрыс</span>'
          : '<span class="guess-note guess-fail">✗ болжам басқа</span>')
      : "";
    return `
      <tr data-test-key="${tc.key}">
        <td data-label="Тест">${tc.label}</td>
        <td data-label="Берілген аргументтер">price=${tc.args[0]}, quantity=${tc.args[1]}, discount=${tc.args[2]}</td>
        <td data-label="Мен күткен нәтиже">
          <input type="text" inputmode="decimal" data-expected-input value="${escapeHtml(studentExpected)}" placeholder="мәнді жазыңыз">
          ${guessNote}
        </td>
        <td data-label="Нақты қайтарылған нәтиже" data-actual-cell>${escapeHtml(actualText)}</td>
        <td data-label="Сәйкес пе?" data-pass-cell>${passBadge}</td>
        <td data-label=""><button type="button" class="btn btn-small" data-test-check-btn ${studentExpected === "" ? "disabled" : ""}>Тексеру</button></td>
      </tr>`;
  }).join("");

  testTableHost.innerHTML = `
    <table class="test-table">
      <thead><tr><th>Тест</th><th>Берілген аргументтер</th><th>Мен күткен нәтиже</th><th>Нақты қайтарылған нәтиже</th><th>Сәйкес пе?</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="hint">Бұл кестеде функцияның <strong>return</strong> арқылы қайтарған сомасы тексеріледі. <code>fee</code> қызмет ақысы бұл сомаға кірмейді.</p>
    <div id="finalPaymentBox" class="final-payment"></div>
  `;

  renderFinalPayment(variant, rec);

  testTableHost.querySelectorAll("[data-expected-input]").forEach((input) => {
    input.addEventListener("input", () => {
      const row = input.closest("tr");
      const key = row.dataset.testKey;
      const r = getTestRecord(variant.id);
      r[key] = r[key] || {};
      r[key].studentExpected = input.value;
      saveState();
      const btn = row.querySelector("[data-test-check-btn]");
      btn.disabled = input.value.trim() === "";
      renderGuessNoteOnly(row, variant, key);
    });
  });

  testTableHost.querySelectorAll("[data-test-check-btn]").forEach((btn) => {
    btn.addEventListener("click", () => runSingleTest(variant, btn.closest("tr").dataset.testKey));
  });
}

function renderGuessNoteOnly(row, variant, key) {
  const tc = makeTestCases(variant).find((t) => t.key === key);
  const rec = getTestRecord(variant.id);
  const studentExpected = rec[key] && rec[key].studentExpected;
  const cell = row.querySelector("td:nth-child(3)");
  const existingNote = cell.querySelector(".guess-note");
  if (existingNote) existingNote.remove();
  if (studentExpected !== undefined && studentExpected !== "") {
    const span = document.createElement("span");
    const ok = numbersClose(parseFloat(studentExpected), tc.expected);
    span.className = "guess-note " + (ok ? "guess-ok" : "guess-fail");
    span.textContent = ok ? "✓ болжам дұрыс" : "✗ болжам басқа";
    cell.appendChild(span);
  }
}

function renderFinalPayment(variant, rec) {
  const box = document.getElementById("finalPaymentBox");
  if (!box) return;
  const normal = rec.normal;
  if (normal && !rec.stale && typeof normal.actualValue === "number") {
    box.innerHTML = `<strong>Қызмет ақысымен соңғы төлем (қалыпты деректер):</strong> ${normal.actualValue} + ${variant.fee} (fee) = ${normal.actualValue + variant.fee}`;
  } else {
    box.innerHTML = `<span class="hint">Соңғы төлемді көру үшін алдымен "Қалыпты деректер" тестін тексеріңіз.</span>`;
  }
}

async function runSingleTest(variant, key) {
  const row = testTableHost.querySelector(`tr[data-test-key="${key}"]`);
  const actualCell = row.querySelector("[data-actual-cell]");
  const passCell = row.querySelector("[data-pass-cell]");
  actualCell.textContent = "Орындалуда…";
  const tc = makeTestCases(variant).find((t) => t.key === key);
  const code = state.variantCodes[variant.id] || "";

  try {
    await runSingleTestInner(variant, key, tc, code, row, actualCell, passCell);
  } catch (err) {
    actualCell.textContent = "Күтпеген қате: " + (err && err.message ? err.message : err);
    passCell.innerHTML = '<span class="badge badge-fail">Жоқ</span>';
  }
}

async function runSingleTestInner(variant, key, tc, code, row, actualCell, passCell) {
  const runResult = await pyRunner.run(`variant-${variant.id}`, code);
  if (!runResult.ok) {
    const hint = formatKazakhHint(runResult.error.name);
    actualCell.textContent = `${runResult.error.name}: ${runResult.error.message}`;
    passCell.innerHTML = '<span class="badge badge-fail">Жоқ</span>';
    if (hint) actualCell.textContent += `\n${hint}`;
    saveTestRow(variant.id, key, row.querySelector("[data-expected-input]").value, null, false, code);
    return;
  }

  const callResult = await pyRunner.call(`variant-${variant.id}`, variant.funcName, tc.args);
  if (!callResult.ok) {
    actualCell.textContent = `${callResult.error.name}: ${callResult.error.message}`;
    const hint = formatKazakhHint(callResult.error.name);
    if (hint) actualCell.textContent += `\n${hint}`;
    passCell.innerHTML = '<span class="badge badge-fail">Жоқ</span>';
    saveTestRow(variant.id, key, row.querySelector("[data-expected-input]").value, null, false, code);
    return;
  }

  if (callResult.isNone) {
    actualCell.textContent = "None\nЕсептелген санды қай жол қайтарады? Тек экранға шығарып тұрған жоқсыз ба?";
    passCell.innerHTML = '<span class="badge badge-fail">Жоқ</span>';
    saveTestRow(variant.id, key, row.querySelector("[data-expected-input]").value, null, false, code);
    return;
  }

  const actualValue = Number(callResult.value);
  const pass = numbersClose(actualValue, tc.expected);
  actualCell.textContent = String(callResult.value);
  passCell.innerHTML = pass ? '<span class="badge badge-ok">Иә</span>' : '<span class="badge badge-fail">Жоқ</span>';
  saveTestRow(variant.id, key, row.querySelector("[data-expected-input]").value, actualValue, pass, code);
  renderFinalPayment(variant, getTestRecord(variant.id));
}

function saveTestRow(variantId, key, studentExpected, actualValue, pass, code) {
  const rec = getTestRecord(variantId);
  rec[key] = { studentExpected, actualValue, actualText: actualValue === null ? "" : String(actualValue), pass };
  rec.stale = false;
  rec.lastTestedCode = code;
  saveState();
}

// ---------- Жұптық тексеру ----------

function updatePairFuncName() {
  const v = getVariant(pairVariantSelect.value);
  const input = document.querySelector('#pairReviewForm input[name="funcName"]');
  if (v && input) input.value = v.funcName;
}
pairVariantSelect.addEventListener("change", updatePairFuncName);
updatePairFuncName();

const pairReviewForm = document.getElementById("pairReviewForm");
const pairReviewList = document.getElementById("pairReviewList");

function renderPairReviews() {
  if (state.pairReviews.length === 0) {
    pairReviewList.innerHTML = '<p class="hint">Әзірге жазба жоқ.</p>';
    return;
  }
  pairReviewList.innerHTML = state.pairReviews.map((r, idx) => `
    <div class="pair-entry">
      <div class="pair-entry-head">
        <strong>${escapeHtml(r.author)}</strong> — нұсқа ${escapeHtml(r.variant)} (${escapeHtml(r.funcName)}) ·
        тексерген: ${escapeHtml(r.reviewer)} · жағдай: ${escapeHtml(r.condition)}
        <button type="button" class="btn btn-small btn-ghost" data-remove-review="${idx}">Өшіру</button>
      </div>
      <p><strong>Байқалған нәтиже:</strong> ${escapeHtml(r.observed)}</p>
      <p><strong>Қорытынды:</strong> ${escapeHtml(r.conclusion)}</p>
    </div>
  `).join("");
  pairReviewList.querySelectorAll("[data-remove-review]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.pairReviews.splice(Number(btn.dataset.removeReview), 1);
      saveState();
      renderPairReviews();
    });
  });
}

pairReviewForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(pairReviewForm);
  state.pairReviews.push({
    author: fd.get("author"), variant: fd.get("variant"), funcName: fd.get("funcName"),
    reviewer: fd.get("reviewer"), condition: fd.get("condition"),
    observed: fd.get("observed"), conclusion: fd.get("conclusion"), ts: Date.now(),
  });
  saveState();
  renderPairReviews();
  pairReviewForm.reset();
  updatePairFuncName();
});

renderPairReviews();

bindField(document.getElementById("defenseQ1"), () => state.defenseAnswers.params, (v) => { state.defenseAnswers.params = v; });
bindField(document.getElementById("defenseQ2"), () => state.defenseAnswers.result, (v) => { state.defenseAnswers.result = v; });
bindField(document.getElementById("defenseQ3"), () => state.defenseAnswers.test, (v) => { state.defenseAnswers.test = v; });

// ---------- 6. Қорытынды ----------

bindField(document.getElementById("finalQ1"), () => state.reflection.q1, (v) => { state.reflection.q1 = v; });
bindField(document.getElementById("finalQ2"), () => state.reflection.q2, (v) => { state.reflection.q2 = v; });
bindField(document.getElementById("reflectionStem1"), () => state.reflection.stem1, (v) => { state.reflection.stem1 = v; });
bindField(document.getElementById("reflectionStem2"), () => state.reflection.stem2, (v) => { state.reflection.stem2 = v; });

const btnToggleGrading = document.getElementById("btnToggleGrading");
const gradingBox = document.getElementById("gradingBox");
const gradingTableHost = document.getElementById("gradingTableHost");
gradingTableHost.innerHTML = GRADING.criteria.map((c) => `
  <div class="grading-block">
    <h4>${c.code}. ${escapeHtml(c.title)} <span class="hint">(барлығы 20 балл)</span></h4>
    <ul>${c.items.map((i) => `<li>${escapeHtml(i.label)} — ${i.points} балл</li>`).join("")}</ul>
  </div>
`).join("") + `
  <div class="grading-block">
    <h4>Дескриптор (әр 10 балдық өлшем)</h4>
    <ul>${GRADING.descriptor.map((d) => `<li>${d.range} — ${escapeHtml(d.desc)}</li>`).join("")}</ul>
  </div>
`;
btnToggleGrading.addEventListener("click", () => { gradingBox.hidden = !gradingBox.hidden; });

const btnToggleHomework = document.getElementById("btnToggleHomework");
const btnShowHomework = document.getElementById("btnShowHomework");
const homeworkBox = document.getElementById("homeworkBox");
function openHomework() {
  homeworkBox.hidden = false;
  homeworkBox.scrollIntoView({ block: "center", behavior: "smooth" });
}
btnToggleHomework.addEventListener("click", () => { homeworkBox.hidden = !homeworkBox.hidden; });
btnShowHomework.addEventListener("click", openHomework);

function buildReportHtml() {
  const variant = getVariant(state.selectedVariant);
  const rec = variant ? getTestRecord(variant.id) : {};
  const cases = variant ? makeTestCases(variant) : [];
  const testRowsHtml = cases.map((tc) => {
    const r = rec[tc.key] || {};
    return `<tr><td>${tc.label}</td><td>${tc.args.join(", ")}</td><td>${escapeHtml(r.studentExpected ?? "")}</td><td>${escapeHtml(r.actualText ?? "")}</td><td>${r.pass ? "Иә" : "Жоқ"}</td></tr>`;
  }).join("");

  const html = `<!doctype html><html lang="kk"><head><meta charset="utf-8"><title>Жұмыс есебі — ${escapeHtml(state.studentName)}</title>
  <style>body{font-family:Arial,sans-serif;max-width:800px;margin:24px auto;line-height:1.6;color:#1a1a1a}
  h1{font-size:22px}h2{font-size:18px;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:28px}
  pre{background:#f4f6f8;padding:12px;border-radius:6px;white-space:pre-wrap}
  table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px 8px;text-align:left;font-size:14px}
  .muted{color:#555}</style></head><body>
  <h1>Function Lab — жұмыс есебі</h1>
  <p class="muted">${escapeHtml(LESSON_INFO.university)} · ${escapeHtml(LESSON_INFO.subject)} · ${escapeHtml(LESSON_INFO.topic)}</p>
  <p><strong>Студент:</strong> ${escapeHtml(state.studentName) || "(көрсетілмеген)"} &nbsp; <strong>Топ:</strong> ${escapeHtml(state.groupName) || "(көрсетілмеген)"}</p>
  <p><strong>Нұсқа:</strong> ${variant ? `${variant.id} — ${escapeHtml(variant.title)} (функция: ${variant.funcName})` : "таңдалмаған"}</p>

  <h2>Код</h2>
  <pre>${escapeHtml(variant ? (state.variantCodes[variant.id] || "") : "")}</pre>

  <h2>Үш тест нәтижесі</h2>
  <table><thead><tr><th>Тест</th><th>Аргументтер</th><th>Мен күткенім</th><th>Нақты нәтиже</th><th>Сәйкес пе?</th></tr></thead>
  <tbody>${testRowsHtml}</tbody></table>

  <h2>Шағын қорғау</h2>
  <p><strong>Параметрлер:</strong> ${escapeHtml(state.defenseAnswers.params)}</p>
  <p><strong>Нәтиже:</strong> ${escapeHtml(state.defenseAnswers.result)}</p>
  <p><strong>Тест:</strong> ${escapeHtml(state.defenseAnswers.test)}</p>

  <h2>Жұптық кері байланыс</h2>
  ${state.pairReviews.length === 0 ? "<p>Жазба жоқ.</p>" : state.pairReviews.map((r) => `<p><strong>${escapeHtml(r.author)}</strong> (нұсқа ${escapeHtml(r.variant)}) — тексерген: ${escapeHtml(r.reviewer)}, жағдай: ${escapeHtml(r.condition)}<br>Байқалған нәтиже: ${escapeHtml(r.observed)}<br>Қорытынды: ${escapeHtml(r.conclusion)}</p>`).join("")}

  <h2>Қорытынды сұрақтар</h2>
  <p>1) ${escapeHtml(state.reflection.q1)}</p>
  <p>2) ${escapeHtml(state.reflection.q2)}</p>

  <h2>Рефлексия</h2>
  <p>Бүгін мен ${escapeHtml(state.reflection.stem1)} орындай алдым.</p>
  <p>Келесі жолы ${escapeHtml(state.reflection.stem2)} жақсартамын.</p>

  <p class="muted">Қорытынды бағаны оқытушы қояды.</p>
  </body></html>`;
  return html;
}

document.getElementById("btnDownloadReport").addEventListener("click", () => {
  const html = buildReportHtml();
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = (state.studentName || "student").replace(/[^a-zA-Zа-яА-ЯәіңғүұқөһӘІҢҒҮҰҚӨҺ0-9_-]+/g, "_");
  a.href = url;
  a.download = `jumys_esebi_${safeName}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
});

document.getElementById("btnPrintSheet").addEventListener("click", () => {
  const html = buildReportHtml();
  const win = window.open("", "_blank");
  if (!win) {
    alert("Жаңа терезе ашылмады. Браузердің қалқымалы терезелерді бұғаттауын тексеріңіз.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
});

// ---------- Бастапқы нұсқаны белсендіру ----------
// Барлық бөлімдердің DOM/функциялары дайын болғаннан кейін ғана шақырылады.
if (!state.selectedVariant) state.selectedVariant = 1;
selectVariant(state.selectedVariant);
