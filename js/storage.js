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

function defaultState() {
  return {
    studentName: "",
    groupName: "",
    selectedVariant: null,
    visitedSections: {},
    theory: { code: "" },
    predictMain: { predictionOutput: "", predictionResult: "", explained: false },
    predictFix: { code: "", runCount: 0, revealed: false },
    variantCodes: {}, // { "1": "код...", ... }
    discussionAnswer: "",
    testResults: {}, // { "1": { normal: {...}, qty0: {...}, disc0: {...}, lastTestedCode: "" } }
    pairReviews: [], // [{author, variant, funcName, reviewer, condition, observed, conclusion, ts}]
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
