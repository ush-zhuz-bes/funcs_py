// Нұсқалар арасындағы тұрақты жұптасу: 1-2, 3-4, 5-6, 7-8.
"use strict";

const PAIR_MAP = { 1: 2, 2: 1, 3: 4, 4: 3, 5: 6, 6: 5, 7: 8, 8: 7 };

function partnerOf(variantId) {
  return PAIR_MAP[Number(variantId)] || null;
}

module.exports = { PAIR_MAP, partnerOf };
