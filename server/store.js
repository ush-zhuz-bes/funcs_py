// Function Lab — дерекқор қабатын таңдау.
// Neon-ды Vercel арқылы қосқанда интеграция DATABASE_URL-дан басқа
// POSTGRES_URL / POSTGRES_URL_NON_POOLING атаулармен де орнатуы мүмкін —
// қайсысы бар болса, соны қолданамыз. Ешқайсысы жоқ болса (жергілікті тез
// тексеру), жергілікті JSON файлға сақтайтын жеңіл нұсқа іске қосылады.
"use strict";

const CONNECTION_STRING =
  process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;

module.exports = CONNECTION_STRING ? require("./store.pg") : require("./store.json");
