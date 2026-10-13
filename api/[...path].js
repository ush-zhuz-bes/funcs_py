// Vercel серверлесс функциясы: /api/* бойынша келген барлық сұранысты
// (файл жүйесіне негізделген бағыттау арқылы, "[...path]" — catch-all)
// біздің Express қосымшамызға береді. Статикалық файлдар (public/) Vercel
// арқылы тікелей, осы функцияны шақырмай беріледі.
"use strict";

const app = require("../server/server");

module.exports = (req, res) => app(req, res);
