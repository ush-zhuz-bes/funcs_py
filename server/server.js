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
// Vercel-де әр "суық старт" жаңа процесс болғандықтан, кездейсоқ құпия
// сессияны буза бермеуі үшін ADMIN_SECRET берілмесе, тұрақты (бірақ
// ADMIN_PASSWORD-қа тәуелді) мәннен шығарамыз — кездейсоқ байт емес.
const SESSION_SECRET = process.env.ADMIN_SECRET
  || crypto.createHash("sha256").update("functionlab-session::" + ADMIN_PASSWORD).digest("hex");

if (!process.env.ADMIN_PASSWORD) {
  console.warn(
    '[Function Lab] ЕСКЕРТУ: ADMIN_PASSWORD орнатылмаған, әдепкі пароль "ustaz2026" қолданылады. ' +
    "Нақты серверге (интернетке) шығармас бұрын ADMIN_PASSWORD орнатыңыз."
  );
}

// Vercel-дің Node.js функциялары кейде JSON денені өзі алдын ала оқып,
// req.body-ға жазып қояды (сонда ағын таусылып, express.json() бос
// объект қайтарады). Бұл жағдайды таниды да, қайта талдамайды; егер
// Vercel денені жолдан (string) ретінде берсе, өзіміз JSON.parse жасаймыз.
app.use((req, res, next) => {
  if (req.body !== undefined) {
    if (typeof req.body === "string" && req.body.length) {
      try { req.body = JSON.parse(req.body); } catch (e) { /* бос немесе JSON емес дене */ }
    }
    return next();
  }
  express.json({ limit: "1mb" })(req, res, next);
});
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

function isHttps(req) {
  return req.secure || req.headers["x-forwarded-proto"] === "https";
}

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body || {};
  // Құпия мәндерді ЕШҚАШАН логқа жазбаймыз — тек диагностика үшін
  // ұзындығы мен түрін ғана жазамыз.
  console.log(
    "[admin/login] body type=%s, password received: %s (len=%s), expected len=%s, match=%s",
    typeof req.body, password === undefined ? "жоқ" : "бар",
    typeof password === "string" ? password.length : "н/б",
    ADMIN_PASSWORD.length,
    password === ADMIN_PASSWORD
  );
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "wrong_password" });
  }
  const secureFlag = isHttps(req) ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `admin_session=${encodeURIComponent(sessionToken())}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 12}${secureFlag}`
  );
  res.json({ ok: true });
});

app.post("/api/admin/logout", (req, res) => {
  res.setHeader("Set-Cookie", "admin_session=; HttpOnly; Path=/; Max-Age=0");
  res.json({ ok: true });
});

app.get("/api/admin/data", requireAdmin, async (req, res) => {
  try {
    const [students, pairData] = await Promise.all([store.listStudents(), store.allPairData()]);
    res.json({ lessonPlan: lessonPlan, students, ...pairData });
  } catch (e) {
    res.status(500).json({ error: "server_error", message: e.message });
  }
});

// ---------- Студент API ----------

app.post("/api/submit", async (req, res) => {
  try {
    const saved = await store.upsertStudent(req.body || {});
    res.json({ ok: true, updatedAt: saved.updatedAt });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.post("/api/pair/send", async (req, res) => {
  try {
    const { studentId, studentName, variantId, code } = req.body || {};
    if (!studentId || !variantId) return res.status(400).json({ error: "variantId/studentId жоқ" });
    const share = await store.addPairShare({ studentId, studentName, variantId, code });
    res.json({ ok: true, share });
  } catch (e) {
    res.status(500).json({ error: "server_error", message: e.message });
  }
});

app.get("/api/pair/inbox", async (req, res) => {
  try {
    const variantId = Number(req.query.variantId);
    if (!variantId) return res.status(400).json({ error: "variantId жоқ" });
    const partner = partnerOf(variantId);
    if (!partner) return res.status(400).json({ error: "жұп табылмады" });
    const share = await store.latestShareForVariant(partner);
    res.json({ share });
  } catch (e) {
    res.status(500).json({ error: "server_error", message: e.message });
  }
});

app.post("/api/pair/review", async (req, res) => {
  try {
    const { shareId, studentId, studentName, variantId, condition, observed, conclusion } = req.body || {};
    if (!shareId || !variantId) return res.status(400).json({ error: "shareId/variantId жоқ" });
    const review = await store.addPairReview({ shareId, studentId, studentName, variantId, condition, observed, conclusion });
    res.json({ ok: true, review });
  } catch (e) {
    res.status(500).json({ error: "server_error", message: e.message });
  }
});

app.get("/api/pair/feedback", async (req, res) => {
  try {
    const variantId = Number(req.query.variantId);
    if (!variantId) return res.status(400).json({ error: "variantId жоқ" });
    res.json({ reviews: await store.feedbackForVariant(variantId) });
  } catch (e) {
    res.status(500).json({ error: "server_error", message: e.message });
  }
});

// Vercel серверлесс функциясы ретінде импортталғанда (api/[...path].js),
// Express app-ты өзін (req,res) өңдегіш ретінде экспорттаймыз. Жергілікті
// `node server/server.js` арқылы іске қосқанда ғана порт тыңдаймыз.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Function Lab сервері іске қосылды: http://localhost:${PORT}`);
    console.log(`Әкімші панелі: http://localhost:${PORT}/admin/`);
  });
}

module.exports = app;
