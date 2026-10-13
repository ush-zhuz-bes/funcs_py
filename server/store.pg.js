// Function Lab — Neon (Postgres) дерекқор қабаты.
// Vercel serverless ортасында файл жүйесі тұрақты болмайтындықтан (әр
// функция шақыруы жаңа контейнерде жүгіруі мүмкін), жауаптар осы жерде
// нақты Postgres дерекқорында сақталады. @neondatabase/serverless HTTP
// арқылы сұрайды — serverless функцияларға арналған ресми тиімді драйвер.
"use strict";

const crypto = require("crypto");
const { neon } = require("@neondatabase/serverless");

const CONNECTION_STRING =
  process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;

const sql = neon(CONNECTION_STRING);

let schemaReady = null;
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS students (
          student_id TEXT PRIMARY KEY,
          student_name TEXT,
          group_name TEXT,
          variant_id INTEGER,
          func_name TEXT,
          code TEXT,
          test_results JSONB,
          final_payment NUMERIC,
          defense_answers JSONB,
          reflection JSONB,
          discussion_answer TEXT,
          predict_answers JSONB,
          last_section TEXT,
          submissions JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS pair_shares (
          id TEXT PRIMARY KEY,
          student_id TEXT,
          student_name TEXT,
          variant_id INTEGER NOT NULL,
          code TEXT,
          sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS pair_reviews (
          id TEXT PRIMARY KEY,
          share_id TEXT REFERENCES pair_shares(id),
          student_id TEXT,
          student_name TEXT,
          variant_id INTEGER NOT NULL,
          condition TEXT,
          observed TEXT,
          conclusion TEXT,
          reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS pair_shares_variant_idx ON pair_shares (variant_id, sent_at)`;
      await sql`CREATE INDEX IF NOT EXISTS pair_reviews_share_idx ON pair_reviews (share_id)`;
    })();
  }
  return schemaReady;
}

function newId() {
  return crypto.randomBytes(8).toString("hex");
}

function rowToStudent(row) {
  if (!row) return null;
  return {
    studentId: row.student_id,
    studentName: row.student_name || "",
    groupName: row.group_name || "",
    variantId: row.variant_id,
    funcName: row.func_name || "",
    code: row.code || "",
    testResults: row.test_results ?? null,
    finalPayment: row.final_payment !== null && row.final_payment !== undefined ? Number(row.final_payment) : null,
    defenseAnswers: row.defense_answers ?? null,
    reflection: row.reflection ?? null,
    discussionAnswer: row.discussion_answer || "",
    predictAnswers: row.predict_answers ?? null,
    lastSection: row.last_section || "",
    submissions: row.submissions || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToShare(row) {
  if (!row) return null;
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name || "",
    variantId: row.variant_id,
    code: row.code || "",
    sentAt: row.sent_at,
  };
}

function rowToReview(row) {
  if (!row) return null;
  return {
    id: row.id,
    shareId: row.share_id,
    studentId: row.student_id,
    studentName: row.student_name || "",
    variantId: row.variant_id,
    condition: row.condition || "",
    observed: row.observed || "",
    conclusion: row.conclusion || "",
    reviewedAt: row.reviewed_at,
  };
}

async function upsertStudent(payload) {
  await ensureSchema();
  const {
    studentId, studentName, groupName, section, variantId, funcName,
    code, testResults, finalPayment, defenseAnswers, reflection,
    discussionAnswer, predictAnswers,
  } = payload;

  if (!studentId) throw new Error("studentId жоқ");

  const submissionEntry = JSON.stringify([{ section: section || "", at: new Date().toISOString() }]);

  const rows = await sql`
    INSERT INTO students (
      student_id, student_name, group_name, variant_id, func_name, code,
      test_results, final_payment, defense_answers, reflection,
      discussion_answer, predict_answers, last_section, submissions, updated_at
    ) VALUES (
      ${studentId},
      ${studentName ?? null},
      ${groupName ?? null},
      ${variantId ?? null},
      ${funcName ?? null},
      ${code ?? null},
      ${testResults ? JSON.stringify(testResults) : null}::jsonb,
      ${finalPayment ?? null},
      ${defenseAnswers ? JSON.stringify(defenseAnswers) : null}::jsonb,
      ${reflection ? JSON.stringify(reflection) : null}::jsonb,
      ${discussionAnswer ?? null},
      ${predictAnswers ? JSON.stringify(predictAnswers) : null}::jsonb,
      ${section || ""},
      ${submissionEntry}::jsonb,
      now()
    )
    ON CONFLICT (student_id) DO UPDATE SET
      student_name = COALESCE(EXCLUDED.student_name, students.student_name),
      group_name = COALESCE(EXCLUDED.group_name, students.group_name),
      variant_id = COALESCE(EXCLUDED.variant_id, students.variant_id),
      func_name = COALESCE(EXCLUDED.func_name, students.func_name),
      code = COALESCE(EXCLUDED.code, students.code),
      test_results = COALESCE(EXCLUDED.test_results, students.test_results),
      final_payment = COALESCE(EXCLUDED.final_payment, students.final_payment),
      defense_answers = COALESCE(EXCLUDED.defense_answers, students.defense_answers),
      reflection = COALESCE(EXCLUDED.reflection, students.reflection),
      discussion_answer = COALESCE(EXCLUDED.discussion_answer, students.discussion_answer),
      predict_answers = COALESCE(EXCLUDED.predict_answers, students.predict_answers),
      last_section = EXCLUDED.last_section,
      submissions = (
        (COALESCE(students.submissions, '[]'::jsonb) || EXCLUDED.submissions)
      ),
      updated_at = now()
    RETURNING *
  `;
  const student = rowToStudent(rows[0]);
  // 50 жазбадан аспас үшін — соңғы 50-ін ғана қалдырамыз.
  if (student.submissions.length > 50) {
    const trimmed = student.submissions.slice(-50);
    await sql`UPDATE students SET submissions = ${JSON.stringify(trimmed)}::jsonb WHERE student_id = ${studentId}`;
    student.submissions = trimmed;
  }
  return student;
}

async function listStudents() {
  await ensureSchema();
  const rows = await sql`SELECT * FROM students ORDER BY updated_at DESC`;
  return rows.map(rowToStudent);
}

async function addPairShare({ studentId, studentName, variantId, code }) {
  await ensureSchema();
  const id = newId();
  const rows = await sql`
    INSERT INTO pair_shares (id, student_id, student_name, variant_id, code)
    VALUES (${id}, ${studentId}, ${studentName || ""}, ${Number(variantId)}, ${code || ""})
    RETURNING *
  `;
  return rowToShare(rows[0]);
}

async function latestShareForVariant(variantId) {
  await ensureSchema();
  const rows = await sql`
    SELECT * FROM pair_shares WHERE variant_id = ${Number(variantId)}
    ORDER BY sent_at DESC LIMIT 1
  `;
  return rows.length ? rowToShare(rows[0]) : null;
}

async function addPairReview({ shareId, studentId, studentName, variantId, condition, observed, conclusion }) {
  await ensureSchema();
  const id = newId();
  const rows = await sql`
    INSERT INTO pair_reviews (id, share_id, student_id, student_name, variant_id, condition, observed, conclusion)
    VALUES (${id}, ${shareId}, ${studentId}, ${studentName || ""}, ${Number(variantId)}, ${condition || ""}, ${observed || ""}, ${conclusion || ""})
    RETURNING *
  `;
  return rowToReview(rows[0]);
}

async function feedbackForVariant(variantId) {
  await ensureSchema();
  const rows = await sql`
    SELECT pr.* FROM pair_reviews pr
    JOIN pair_shares ps ON ps.id = pr.share_id
    WHERE ps.variant_id = ${Number(variantId)}
    ORDER BY pr.reviewed_at ASC
  `;
  return rows.map(rowToReview);
}

async function allPairData() {
  await ensureSchema();
  const shares = await sql`SELECT * FROM (SELECT * FROM pair_shares ORDER BY sent_at DESC LIMIT 500) sub ORDER BY sent_at ASC`;
  const reviews = await sql`SELECT * FROM (SELECT * FROM pair_reviews ORDER BY reviewed_at DESC LIMIT 500) sub ORDER BY reviewed_at ASC`;
  return { pairShares: shares.map(rowToShare), pairReviews: reviews.map(rowToReview) };
}

module.exports = {
  upsertStudent, listStudents, addPairShare, latestShareForVariant,
  addPairReview, feedbackForVariant, allPairData,
};
