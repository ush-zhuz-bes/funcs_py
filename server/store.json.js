// Function Lab — қарапайым JSON-файлға негізделген дерекқор.
// Сыныптағы 8-10 студентке арналған көлем үшін толық мәнді СУБД қажет емес —
// бәрі жадыда сақталып, әр жазудан кейін дискіге көшіріледі.
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "submissions.json");

function emptyState() {
  return { students: {}, pairShares: [], pairReviews: [] };
}

function load() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return { ...emptyState(), ...parsed };
  } catch (e) {
    return emptyState();
  }
}

let state = load();
let saveTimer = null;

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf8");
    } catch (e) {
      console.error("Дерекқорды сақтау мүмкін болмады:", e.message);
    }
  }, 150);
}

function newId() {
  return crypto.randomBytes(8).toString("hex");
}

function upsertStudent(payload) {
  const {
    studentId, studentName, groupName, section, variantId, funcName,
    code, testResults, finalPayment, defenseAnswers, reflection,
    discussionAnswer, predictAnswers,
  } = payload;

  if (!studentId) throw new Error("studentId жоқ");

  const existing = state.students[studentId] || {
    studentId, createdAt: new Date().toISOString(), submissions: [],
  };

  const updated = {
    ...existing,
    studentName: studentName ?? existing.studentName ?? "",
    groupName: groupName ?? existing.groupName ?? "",
    variantId: variantId ?? existing.variantId ?? null,
    funcName: funcName ?? existing.funcName ?? "",
    code: code ?? existing.code ?? "",
    testResults: testResults ?? existing.testResults ?? null,
    finalPayment: finalPayment ?? existing.finalPayment ?? null,
    defenseAnswers: defenseAnswers ?? existing.defenseAnswers ?? null,
    reflection: reflection ?? existing.reflection ?? null,
    discussionAnswer: discussionAnswer ?? existing.discussionAnswer ?? "",
    predictAnswers: predictAnswers ?? existing.predictAnswers ?? null,
    lastSection: section || existing.lastSection || "",
    updatedAt: new Date().toISOString(),
  };
  updated.submissions = [...(existing.submissions || []), { section, at: updated.updatedAt }].slice(-50);

  state.students[studentId] = updated;
  persist();
  return updated;
}

function listStudents() {
  return Object.values(state.students).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

function addPairShare({ studentId, studentName, variantId, code }) {
  const share = {
    id: newId(), studentId, studentName: studentName || "", variantId: Number(variantId),
    code: code || "", sentAt: new Date().toISOString(),
  };
  state.pairShares.push(share);
  state.pairShares = state.pairShares.slice(-500);
  persist();
  return share;
}

function latestShareForVariant(variantId) {
  const shares = state.pairShares.filter((s) => s.variantId === Number(variantId));
  return shares.length ? shares[shares.length - 1] : null;
}

function addPairReview({ shareId, studentId, studentName, variantId, condition, observed, conclusion }) {
  const review = {
    id: newId(), shareId, studentId, studentName: studentName || "", variantId: Number(variantId),
    condition: condition || "", observed: observed || "", conclusion: conclusion || "",
    reviewedAt: new Date().toISOString(),
  };
  state.pairReviews.push(review);
  state.pairReviews = state.pairReviews.slice(-500);
  persist();
  return review;
}

function feedbackForVariant(variantId) {
  const myShareIds = new Set(
    state.pairShares.filter((s) => s.variantId === Number(variantId)).map((s) => s.id)
  );
  return state.pairReviews.filter((r) => myShareIds.has(r.shareId));
}

function allPairData() {
  return { pairShares: state.pairShares, pairReviews: state.pairReviews };
}

module.exports = {
  upsertStudent, listStudents, addPairShare, latestShareForVariant,
  addPairReview, feedbackForVariant, allPairData,
};
