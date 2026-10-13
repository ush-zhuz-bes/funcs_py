// Function Lab — код редакторы компоненті.
// HTML-де дайын пішінді textarea мен батырмаларды "жандандырады".

import { pyRunner } from "./pyrunner.js";
import { saveState } from "./storage.js";

function autoIndentOnEnter(textarea, event) {
  if (event.key !== "Enter") return;
  const { selectionStart, value } = textarea;
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const currentLine = value.slice(lineStart, selectionStart);
  const indentMatch = currentLine.match(/^[ \t]*/);
  let indent = indentMatch ? indentMatch[0] : "";
  if (/:\s*$/.test(currentLine.trim() ? currentLine : "")) {
    if (currentLine.trim().endsWith(":")) indent += "    ";
  }
  if (!indent) return;
  event.preventDefault();
  const before = value.slice(0, selectionStart);
  const after = value.slice(textarea.selectionEnd);
  textarea.value = before + "\n" + indent + after;
  const pos = selectionStart + 1 + indent.length;
  textarea.selectionStart = textarea.selectionEnd = pos;
  textarea.dispatchEvent(new Event("input"));
}

function handleTab(textarea, event) {
  if (event.key !== "Tab") return;
  event.preventDefault();
  const { selectionStart, selectionEnd, value } = textarea;
  if (event.shiftKey) {
    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    if (value.slice(lineStart, lineStart + 4) === "    ") {
      textarea.value = value.slice(0, lineStart) + value.slice(lineStart + 4);
      textarea.selectionStart = Math.max(lineStart, selectionStart - 4);
      textarea.selectionEnd = Math.max(lineStart, selectionEnd - 4);
    }
  } else {
    textarea.value = value.slice(0, selectionStart) + "    " + value.slice(selectionEnd);
    textarea.selectionStart = textarea.selectionEnd = selectionStart + 4;
  }
  textarea.dispatchEvent(new Event("input"));
}

function downloadText(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const STATUS_TEXT = {
  loading: "Python ортасы жүктелуде…",
  ready: "Орындауға дайын",
  running: "Код орындалуда…",
  error: "Python ортасын жүктеу кезінде қате пайда болды",
};

export class CodeEditor {
  /**
   * @param {HTMLElement} root — ".editor" элементі
   * @param {Object} cfg
   * @param {string} cfg.slot — pyodide namespace кілті
   * @param {string} cfg.template — "Бастапқы үлгі" мәтіні
   * @param {string} cfg.filename — .py жүктеу атауы
   * @param {() => string} cfg.getSaved — сақталған кодты алу
   * @param {(code:string) => void} cfg.setSaved — кодты сақтау
   * @param {(result:Object, code:string) => void} [cfg.onRunResult]
   * @param {() => boolean} [cfg.canRun] — қосымша шарт (мыс. болжам толтырылды ма)
   * @param {boolean} [cfg.confirmReset=true]
   */
  constructor(root, cfg) {
    this.root = root;
    this.cfg = cfg;
    this.textarea = root.querySelector(".editor-textarea");
    this.statusEl = root.querySelector('[data-role="status"]');
    this.outputEl = root.querySelector('[data-role="output"]');
    this.runBtn = root.querySelector('[data-action="run"]');
    this.stopBtn = root.querySelector('[data-action="stop"]');
    this.resetBtn = root.querySelector('[data-action="reset"]');
    this.copyBtn = root.querySelector('[data-action="copy"]');
    this.downloadBtn = root.querySelector('[data-action="download"]');

    const saved = cfg.getSaved();
    this.textarea.value = saved !== undefined && saved !== null && saved !== "" ? saved : cfg.template;

    this.textarea.addEventListener("keydown", (e) => {
      handleTab(this.textarea, e);
      autoIndentOnEnter(this.textarea, e);
    });
    this.textarea.addEventListener("input", () => {
      cfg.setSaved(this.textarea.value);
      saveState();
      if (cfg.onCodeChanged) cfg.onCodeChanged(this.textarea.value);
    });

    if (this.runBtn) this.runBtn.addEventListener("click", () => this.run());
    if (this.stopBtn) this.stopBtn.addEventListener("click", () => this.stop());
    if (this.copyBtn) this.copyBtn.addEventListener("click", () => this.copy());
    if (this.downloadBtn) this.downloadBtn.addEventListener("click", () => this.download());
    if (this.resetBtn) this.resetBtn.addEventListener("click", () => this.resetToTemplate());

    this._unsubscribe = pyRunner.onStatus((status) => this._applyGlobalStatus(status));
    this._updateRunEnabled();
  }

  _applyGlobalStatus(status) {
    if (this._localBusy) return;
    if (this.statusEl) this.statusEl.textContent = STATUS_TEXT[status] || "";
    this._updateRunEnabled(status);
  }

  _updateRunEnabled(globalStatus) {
    const status = globalStatus || pyRunner.status;
    const extraOk = this.cfg.canRun ? this.cfg.canRun() : true;
    if (this.runBtn) this.runBtn.disabled = !(status === "ready" && extraOk);
  }

  refreshGate() {
    this._updateRunEnabled();
  }

  getCode() {
    return this.textarea.value;
  }

  setCode(code) {
    this.textarea.value = code;
    this.cfg.setSaved(code);
    saveState();
  }

  async copy() {
    try {
      await navigator.clipboard.writeText(this.textarea.value);
      this._flash(this.copyBtn, "Көшірілді");
    } catch (e) {
      this.textarea.select();
      document.execCommand("copy");
      this._flash(this.copyBtn, "Көшірілді");
    }
  }

  download() {
    downloadText(this.cfg.filename, this.textarea.value);
  }

  resetToTemplate() {
    const ok = window.confirm("Назар аударыңыз: осы әрекет тек осы редактордағы кодты бастапқы үлгіге қайтарады. Жазылған код өшіріледі. Жалғастыру керек пе?");
    if (!ok) return;
    this.textarea.value = this.cfg.template;
    this.cfg.setSaved(this.cfg.template);
    saveState();
    if (this.outputEl) this.outputEl.textContent = "";
    if (this.cfg.onCodeChanged) this.cfg.onCodeChanged(this.textarea.value);
  }

  _flash(btn, text) {
    if (!btn) return;
    const old = btn.textContent;
    btn.textContent = text;
    setTimeout(() => { btn.textContent = old; }, 1200);
  }

  async run() {
    if (this.cfg.canRun && !this.cfg.canRun()) return;
    this._localBusy = true;
    if (this.statusEl) this.statusEl.textContent = STATUS_TEXT.running;
    if (this.runBtn) this.runBtn.disabled = true;
    if (this.outputEl) this.outputEl.textContent = "";
    const code = this.textarea.value;
    try {
      const result = await pyRunner.run(this.cfg.slot, code);
      this._renderResult(result);
      if (this.cfg.onRunResult) this.cfg.onRunResult(result, code);
    } catch (err) {
      if (this.outputEl) this.outputEl.textContent = "Күтпеген қате: " + (err && err.message ? err.message : err);
      if (this.statusEl) this.statusEl.textContent = STATUS_TEXT.error;
    } finally {
      this._localBusy = false;
      this._applyGlobalStatus(pyRunner.status);
    }
  }

  _renderResult(result) {
    const lines = [];
    if (result.stdout) lines.push(result.stdout);
    if (!result.ok && result.error) {
      lines.push(`${result.error.name}: ${result.error.message}`);
    }
    if (this.outputEl) this.outputEl.textContent = lines.join("\n") || (result.ok ? "(шығыс жоқ)" : "");
    if (this.statusEl) {
      if (result.timeout) this.statusEl.textContent = "Орындалу уақыты аяқталды — орта қайта іске қосылды";
      else this.statusEl.textContent = result.ok ? STATUS_TEXT.ready + " — орындалды" : "Қате пайда болды";
    }
  }

  async stop() {
    if (this.outputEl) this.outputEl.textContent += (this.outputEl.textContent ? "\n" : "") + "— Орындау тоқтатылды —";
    await pyRunner.stop();
  }
}

export function formatKazakhHint(errorName) {
  const hints = {
    SyntaxError: "Код жолдарын, қос нүктені (:) және жақшаларды үлгімен салыстырыңыз.",
    IndentationError: "def жолының соңын және функция денесінің шегінісін үлгімен салыстырыңыз.",
    NameError: "Функцияны қай жолда шақырдыңыз? Атау қатесі болуы мүмкін.",
    TypeError: "Функцияға берілген аргументтер санын немесе түрін тексеріңіз.",
  };
  return hints[errorName] || "";
}
