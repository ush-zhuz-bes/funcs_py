// Function Lab — дерекқор қабатын таңдау.
// DATABASE_URL орнатылған болса (Vercel + Neon production), Postgres
// қолданылады. Орнатылмаса (жергілікті тез тексеру), жергілікті JSON
// файлға сақтайтын жеңіл нұсқа іске қосылады.
"use strict";

module.exports = process.env.DATABASE_URL ? require("./store.pg") : require("./store.json");
