// Function Lab — сервер.
// Студенттік статикалық сайтты (public/) беріп, сонымен қатар жауаптарды
// орталықтандырып жинайтын және оқытушының әкімші панеліне арналған API-ды
// қамтамасыз етеді.
//
// Әкімші панелі парольмен емес, болжауға келмейтін жол (slug) арқылы
// қорғалған: /panel-fc1a5bd32b98/ (бет) және /api/panel-fc1a5bd32b98/data
// (деректер API-сы). Осы атауды білмеген адам деректерге жете алмайды.
// Бұл сілтемені студенттерге таратпаңыз.
"use strict";

const path = require("path");
const express = require("express");

const store = require("./store");
const { partnerOf } = require("./pairs");
const lessonPlan = require("./lesson-plan");

const ADMIN_SLUG = "panel-fc1a5bd32b98";

const app = express();
const PORT = process.env.PORT || 3000;

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

app.get(`/api/${ADMIN_SLUG}/data`, async (req, res) => {
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
    console.log(`Әкімші панелі: http://localhost:${PORT}/${ADMIN_SLUG}/`);
  });
}

module.exports = app;
