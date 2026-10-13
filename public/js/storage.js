// Function Lab — localStorage арқылы сақтау қабаты.
// Барлық жазу/оқу осы файл арқылы өтеді, сондықтан localStorage қолжетімсіз
// болса да (жекелік режимі, т.б.) сайт құламай, жалған "Сақталды" де көрсетпейді.

const STORAGE_KEY = "functionlab_state_v1";

function storageAvailable() {
  try {
    const testKey = "__functionlab_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

export const SAVE_AVAILABLE = storageAvailable();

function makeStudentId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return "sid-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function defaultState() {
  return {
    studentId: makeStudentId(),
    studentName: "",
    groupName: "",
    selectedVariant: null,
    visitedSections: {},
    submittedSections: {}, // { "start": "2026-10-14T...", ... } — серверге жіберілген уақыт
    theory: { code: "" },
    predictMain: { predictionOutput: "", predictionResult: "", explained: false },
    predictFix: { code: "", runCount: 0, revealed: false },
    variantCodes: {}, // { "1": "код...", ... }
    discussionAnswer: "",
    testResults: {}, // { "1": { normal: {...}, qty0: {...}, disc0: {...}, lastTestedCode: "" } }
    pairSentAt: null, // серіктеске соңғы рет код жіберілген уақыт
    receivedFeedback: [], // серіктестен келген пікірлер (серверден алынып, осында кэштеледі)
    defenseAnswers: { params: "", result: "", test: "" },
    reflection: { q1: "", q2: "", stem1: "", stem2: "" },
  };
}

function loadState() {
  if (!SAVE_AVAILABLE) return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch (e) {
    return defaultState();
  }
}

export const state = loadState();

let saveTimer = null;
const saveListeners = new Set();

export function onSaveStatus(fn) {
  saveListeners.add(fn);
  return () => saveListeners.delete(fn);
}

function notifySave(ok) {
  saveListeners.forEach((fn) => fn(ok));
}

export function saveState() {
  if (!SAVE_AVAILABLE) {
    notifySave(false);
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      notifySave(true);
    } catch (e) {
      notifySave(false);
    }
  }, 300);
}

export function markVisited(sectionId) {
  state.visitedSections[sectionId] = true;
  saveState();
}
