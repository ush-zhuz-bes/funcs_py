// Function Lab — сервер.
// Студенттік статикалық сайтты (public/) беріп, сонымен қатар жауаптарды
// орталықтандырып жинайтын және оқытушының әкімші панеліне арналған API-ды
// қамтамасыз етеді.
"use strict";

const path = require("path");
const crypto = require("crypto");
const express = require("express");

const store = require("./store");
const { partnerOf } = require("./pairs");
const lessonPlan = require("./lesson-plan");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ustaz2026";
const SESSION_SECRET = process.env.ADMIN_SECRET || crypto.randomBytes(32).toString("hex");

if (!process.env.ADMIN_PASSWORD) {
  console.warn(
    '[Function Lab] ЕСКЕРТУ: ADMIN_PASSWORD орнатылмаған, әдепкі пароль "ustaz2026" қолданылады. ' +
    "Нақты серверге (интернетке) шығармас бұрын ADMIN_PASSWORD орнатыңыз."
  );
}

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

// ---------- Қарапайым cookie-негізді әкімші сессиясы ----------

function sessionToken() {
  return crypto.createHmac("sha256", SESSION_SECRET).update(ADMIN_PASSWORD).digest("hex");
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(val);
  });
  return out;
}

function requireAdmin(req, res, next) {
  const cookies = parseCookies(req);
  if (cookies.admin_session === sessionToken()) return next();
  res.status(401).json({ error: "unauthorized" });
}

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "wrong_password" });
  }
  res.setHeader(
    "Set-Cookie",
    `admin_session=${encodeURIComponent(sessionToken())}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 12}`
  );
  res.json({ ok: true });
});

app.post("/api/admin/logout", (req, res) => {
  res.setHeader("Set-Cookie", "admin_session=; HttpOnly; Path=/; Max-Age=0");
  res.json({ ok: true });
});

app.get("/api/admin/data", requireAdmin, (req, res) => {
  res.json({
    lessonPlan: lessonPlan,
    students: store.listStudents(),
    ...store.allPairData(),
  });
});

// ---------- Студент API ----------

app.post("/api/submit", (req, res) => {
  try {
    const saved = store.upsertStudent(req.body || {});
    res.json({ ok: true, updatedAt: saved.updatedAt });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.post("/api/pair/send", (req, res) => {
  const { studentId, studentName, variantId, code } = req.body || {};
  if (!studentId || !variantId) return res.status(400).json({ error: "variantId/studentId жоқ" });
  const share = store.addPairShare({ studentId, studentName, variantId, code });
  res.json({ ok: true, share });
});

app.get("/api/pair/inbox", (req, res) => {
  const variantId = Number(req.query.variantId);
  if (!variantId) return res.status(400).json({ error: "variantId жоқ" });
  const partner = partnerOf(variantId);
  if (!partner) return res.status(400).json({ error: "жұп табылмады" });
  const share = store.latestShareForVariant(partner);
  res.json({ share });
});

app.post("/api/pair/review", (req, res) => {
  const { shareId, studentId, studentName, variantId, condition, observed, conclusion } = req.body || {};
  if (!shareId || !variantId) return res.status(400).json({ error: "shareId/variantId жоқ" });
  const review = store.addPairReview({ shareId, studentId, studentName, variantId, condition, observed, conclusion });
  res.json({ ok: true, review });
});

app.get("/api/pair/feedback", (req, res) => {
  const variantId = Number(req.query.variantId);
  if (!variantId) return res.status(400).json({ error: "variantId жоқ" });
  res.json({ reviews: store.feedbackForVariant(variantId) });
});

app.listen(PORT, () => {
  console.log(`Function Lab сервері іске қосылды: http://localhost:${PORT}`);
  console.log(`Әкімші панелі: http://localhost:${PORT}/admin/`);
});
