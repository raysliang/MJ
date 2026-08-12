(() => {
  // src/mahjong.js
  var SUIT_NAMES = ["Characters", "Bamboo", "Dots"];
  var RANK_NAMES = ["\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D", "\u4E03", "\u516B", "\u4E5D"];
  var HONOR_NAMES = ["\u6771", "\u5357", "\u897F", "\u5317", "\u4E2D", "\u767C", "\u767D"];
  var HONOR_ENGLISH_NAMES = ["East Wind", "South Wind", "West Wind", "North Wind", "Red Dragon", "Green Dragon", "White Dragon"];
  var GLYPHS = [
    "\u{1F007}",
    "\u{1F008}",
    "\u{1F009}",
    "\u{1F00A}",
    "\u{1F00B}",
    "\u{1F00C}",
    "\u{1F00D}",
    "\u{1F00E}",
    "\u{1F00F}",
    "\u{1F010}",
    "\u{1F011}",
    "\u{1F012}",
    "\u{1F013}",
    "\u{1F014}",
    "\u{1F015}",
    "\u{1F016}",
    "\u{1F017}",
    "\u{1F018}",
    "\u{1F019}",
    "\u{1F01A}",
    "\u{1F01B}",
    "\u{1F01C}",
    "\u{1F01D}",
    "\u{1F01E}",
    "\u{1F01F}",
    "\u{1F020}",
    "\u{1F021}",
    "\u{1F000}",
    "\u{1F001}",
    "\u{1F002}",
    "\u{1F003}",
    "\u{1F004}",
    "\u{1F005}",
    "\u{1F006}"
  ];
  var HONOR_CODES = ["east", "south", "west", "north", "red", "green", "white"];
  var SEAT_NAMES = ["East", "South", "West", "North"];
  var TILE_COUNT = 34;
  var COPIES_PER_TILE = 4;
  var MAX_SHANTEN_CACHE_ENTRIES = 1e5;
  var shantenCache = /* @__PURE__ */ new Map();
  var TILE_TYPES = Object.freeze([
    ...Array.from({ length: 27 }, (_, type) => Object.freeze({
      type,
      code: `${type % 9 + 1}${"msp"[Math.floor(type / 9)]}`,
      name: `${RANK_NAMES[type % 9]}${SUIT_NAMES[Math.floor(type / 9) === 0 ? 0 : Math.floor(type / 9) === 1 ? 1 : 2] === "Characters" ? "\u842C" : Math.floor(type / 9) === 1 ? "\u7D22" : "\u7B52"}`,
      englishName: `${type % 9 + 1} ${SUIT_NAMES[Math.floor(type / 9)]}`,
      glyph: GLYPHS[type],
      suited: true,
      rank: type % 9 + 1,
      suit: Math.floor(type / 9)
    })),
    ...Array.from({ length: 7 }, (_, offset) => Object.freeze({
      type: 27 + offset,
      code: HONOR_CODES[offset],
      name: HONOR_NAMES[offset],
      englishName: HONOR_ENGLISH_NAMES[offset],
      glyph: GLYPHS[27 + offset],
      suited: false,
      rank: null,
      suit: null
    }))
  ]);
  function typeOf(tile) {
    return typeof tile === "number" ? tile : tile.type;
  }
  function assertType(type) {
    if (!Number.isInteger(type) || type < 0 || type >= TILE_COUNT) {
      throw new RangeError(`Unknown tile type: ${type}`);
    }
    return type;
  }
  function tileInfo(tile) {
    return TILE_TYPES[assertType(typeOf(tile))];
  }
  function tileGlyph(tile) {
    return tileInfo(tile).glyph;
  }
  function tileName(tile) {
    return tileInfo(tile).name;
  }
  function tileEnglishName(tile) {
    return tileInfo(tile).englishName;
  }
  function tileCode(tile) {
    return tileInfo(tile).code;
  }
  function createDeck() {
    return Array.from({ length: TILE_COUNT * COPIES_PER_TILE }, (_, id) => ({
      id,
      type: Math.floor(id / COPIES_PER_TILE)
    }));
  }
  function shuffle(tiles, random = Math.random) {
    const shuffled = [...tiles];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  }
  function seededRandom(seed) {
    let value = Number(seed) >>> 0 || 2654435769;
    return () => {
      value += 1831565813;
      let result = value;
      result = Math.imul(result ^ result >>> 15, result | 1);
      result ^= result + Math.imul(result ^ result >>> 7, result | 61);
      return ((result ^ result >>> 14) >>> 0) / 4294967296;
    };
  }
  function sortTiles(tiles) {
    return [...tiles].sort((left, right) => typeOf(left) - typeOf(right) || (left.id ?? 0) - (right.id ?? 0));
  }
  function tileCounts(tiles) {
    const counts = Array(TILE_COUNT).fill(0);
    for (const tile of tiles) {
      counts[assertType(typeOf(tile))] += 1;
    }
    return counts;
  }
  function addMeldCounts(counts, melds) {
    for (const meld of melds) {
      for (const tile of meld.tiles) {
        counts[assertType(typeOf(tile))] += 1;
      }
    }
    return counts;
  }
  function calculateShantenFromCounts(counts, openMeldCount = 0) {
    const cacheKey = `${openMeldCount}:${counts.join("")}`;
    const cached = shantenCache.get(cacheKey);
    if (cached !== void 0) {
      return cached;
    }
    const targetMelds = Math.max(0, 4 - openMeldCount);
    let best = 8 - openMeldCount * 2;
    function search(start, melds, taatsu, pair) {
      if (melds > targetMelds) {
        return;
      }
      while (start < TILE_COUNT && counts[start] === 0) {
        start += 1;
      }
      if (start >= TILE_COUNT) {
        const usableTaatsu = Math.min(taatsu, targetMelds - melds);
        best = Math.min(best, 8 - 2 * (openMeldCount + melds) - usableTaatsu - pair);
        return;
      }
      const current = start;
      counts[current] -= 1;
      search(current, melds, taatsu, pair);
      counts[current] += 1;
      if (counts[current] >= 3) {
        counts[current] -= 3;
        search(current, melds + 1, taatsu, pair);
        counts[current] += 3;
      }
      const info = TILE_TYPES[current];
      if (info.suited && info.rank <= 7 && counts[current + 1] > 0 && counts[current + 2] > 0) {
        counts[current] -= 1;
        counts[current + 1] -= 1;
        counts[current + 2] -= 1;
        search(current, melds + 1, taatsu, pair);
        counts[current] += 1;
        counts[current + 1] += 1;
        counts[current + 2] += 1;
      }
      if (counts[current] >= 2) {
        if (pair === 0) {
          counts[current] -= 2;
          search(current, melds, taatsu, 1);
          counts[current] += 2;
        }
        if (taatsu < targetMelds - melds) {
          counts[current] -= 2;
          search(current, melds, taatsu + 1, pair);
          counts[current] += 2;
        }
      }
      if (info.suited && info.rank <= 8 && counts[current + 1] > 0 && taatsu < targetMelds - melds) {
        counts[current] -= 1;
        counts[current + 1] -= 1;
        search(current, melds, taatsu + 1, pair);
        counts[current] += 1;
        counts[current + 1] += 1;
      }
      if (info.suited && info.rank <= 7 && counts[current + 2] > 0 && taatsu < targetMelds - melds) {
        counts[current] -= 1;
        counts[current + 2] -= 1;
        search(current, melds, taatsu + 1, pair);
        counts[current] += 1;
        counts[current + 2] += 1;
      }
    }
    search(0, 0, 0, 0);
    if (shantenCache.size >= MAX_SHANTEN_CACHE_ENTRIES) {
      shantenCache.clear();
    }
    shantenCache.set(cacheKey, best);
    return best;
  }
  function calculateShanten(tilesOrCounts, openMeldCount = 0) {
    const counts = Array.isArray(tilesOrCounts) && tilesOrCounts.length === TILE_COUNT && tilesOrCounts.every(Number.isInteger) ? [...tilesOrCounts] : tileCounts(tilesOrCounts);
    return calculateShantenFromCounts(counts, openMeldCount);
  }
  function normalizeVisibleCounts(visibleCounts, concealedTiles, melds) {
    if (visibleCounts) {
      return visibleCounts.slice(0, TILE_COUNT).concat(Array(Math.max(0, TILE_COUNT - visibleCounts.length)).fill(0));
    }
    return addMeldCounts(tileCounts(concealedTiles), melds);
  }
  function totalLiveCopies(improvementTiles) {
    return improvementTiles.reduce((total, item) => total + item.remaining, 0);
  }
  function sequenceShapeCount(counts) {
    let total = 0;
    for (let suitStart = 0; suitStart < 27; suitStart += 9) {
      for (let rank = 0; rank < 7; rank += 1) {
        total += Math.min(counts[suitStart + rank], counts[suitStart + rank + 1], counts[suitStart + rank + 2]);
      }
    }
    return total;
  }
  function analyzeHand(concealedTiles, melds = [], visibleCounts) {
    const concealed = [...concealedTiles];
    const counts = tileCounts(concealed);
    const shanten = calculateShantenFromCounts(counts, melds.length);
    const visible = normalizeVisibleCounts(visibleCounts, concealed, melds);
    const improvementTiles = [];
    const winningTiles = [];
    if (shanten >= 0) {
      for (let type = 0; type < TILE_COUNT; type += 1) {
        const remaining = Math.max(0, COPIES_PER_TILE - Math.min(COPIES_PER_TILE, visible[type] ?? 0));
        if (remaining === 0) {
          continue;
        }
        const sequenceCountBefore = sequenceShapeCount(counts);
        counts[type] += 1;
        const nextShanten = calculateShantenFromCounts(counts, melds.length);
        const createsSequence = sequenceShapeCount(counts) > sequenceCountBefore;
        counts[type] -= 1;
        if (nextShanten < shanten) {
          const item = { type, remaining, glyph: tileGlyph(type), name: tileName(type), winning: nextShanten === -1, createsSequence };
          improvementTiles.push(item);
          if (item.winning) {
            winningTiles.push(item);
          }
        }
      }
    }
    return {
      shanten,
      tilesAway: Math.max(0, shanten + 1),
      complete: shanten === -1,
      improvementTiles,
      improvementCopies: totalLiveCopies(improvementTiles),
      winningTiles,
      winningCopies: totalLiveCopies(winningTiles),
      visibleCounts: visible
    };
  }
  function isWinningHand(concealedTiles, melds = []) {
    return calculateShanten(tileCounts(concealedTiles), melds.length) === -1;
  }
  function weaknessScore(type, counts) {
    const info = TILE_TYPES[type];
    const count = counts[type];
    if (!info.suited) {
      return count === 1 ? 14 : count === 2 ? 2 : -6;
    }
    const rank = info.rank;
    const left = rank > 1 ? counts[type - 1] : 0;
    const right = rank < 9 ? counts[type + 1] : 0;
    const gapLeft = rank > 2 ? counts[type - 2] : 0;
    const gapRight = rank < 8 ? counts[type + 2] : 0;
    let score = count === 1 ? 4 : count === 2 ? 1 : -5;
    if (left === 0 && right === 0 && gapLeft === 0 && gapRight === 0) {
      score += 4;
    } else if (left === 0 && right === 0) {
      score += 1;
    }
    if (rank === 1 || rank === 9) {
      score += 1;
    }
    return score;
  }
  function structureLabel(type, counts) {
    const info = TILE_TYPES[type];
    const count = counts[type];
    if (!info.suited) {
      if (count === 1) {
        return "isolated honor; it cannot form a sequence";
      }
      if (count === 2) {
        return "honor pair; it can become a pair or pong";
      }
      return "honor triplet potential";
    }
    const rank = info.rank;
    const left = rank > 1 ? counts[type - 1] : 0;
    const right = rank < 9 ? counts[type + 1] : 0;
    const gapLeft = rank > 2 ? counts[type - 2] : 0;
    const gapRight = rank < 8 ? counts[type + 2] : 0;
    if (count >= 2) {
      return "pair or triplet potential";
    }
    if (left > 0 && right > 0) {
      return "inside a connected sequence shape";
    }
    if (left > 0 || right > 0) {
      return "connected to an adjacent suited tile";
    }
    if (gapLeft > 0 || gapRight > 0) {
      return "gapped sequence potential";
    }
    if (rank === 1 || rank === 9) {
      return "isolated edge tile; only a narrow sequence range can help";
    }
    return "isolated suited tile; several sequence tiles can help";
  }
  function compareRolloutQuality(left, right) {
    if (!left.rollout || !right.rollout) {
      return 0;
    }
    if (Math.abs(left.rollout.expectedTilesAway - right.rollout.expectedTilesAway) > 1e-9) {
      return left.rollout.expectedTilesAway < right.rollout.expectedTilesAway ? -1 : 1;
    }
    if (Math.abs(left.rollout.expectedImprovementCopies - right.rollout.expectedImprovementCopies) > 1e-9) {
      return left.rollout.expectedImprovementCopies > right.rollout.expectedImprovementCopies ? -1 : 1;
    }
    if (Math.abs(left.rollout.expectedImprovementTypes - right.rollout.expectedImprovementTypes) > 1e-9) {
      return left.rollout.expectedImprovementTypes > right.rollout.expectedImprovementTypes ? -1 : 1;
    }
    return 0;
  }
  function compareDiscardCandidates(left, right, strategy = "original") {
    if (!right) {
      return -1;
    }
    if (left.analysis.tilesAway !== right.analysis.tilesAway) {
      return left.analysis.tilesAway < right.analysis.tilesAway ? -1 : 1;
    }
    if (strategy === "structure") {
      if (left.structureScore !== right.structureScore) {
        return left.structureScore > right.structureScore ? -1 : 1;
      }
    } else if (strategy !== "efficiency") {
      const rolloutQuality = compareRolloutQuality(left, right);
      if (rolloutQuality !== 0) {
        return rolloutQuality;
      }
    }
    if (strategy !== "structure" && left.structureScore !== right.structureScore) {
      return left.structureScore > right.structureScore ? -1 : 1;
    }
    if (left.analysis.improvementCopies !== right.analysis.improvementCopies) {
      return left.analysis.improvementCopies > right.analysis.improvementCopies ? -1 : 1;
    }
    if (left.analysis.improvementTiles.length !== right.analysis.improvementTiles.length) {
      return left.analysis.improvementTiles.length > right.analysis.improvementTiles.length ? -1 : 1;
    }
    if (left.weakness !== right.weakness) {
      return left.weakness > right.weakness ? -1 : 1;
    }
    return typeOf(left.tile) - typeOf(right.tile);
  }
  function samePrimaryDiscardQuality(left, right, strategy = "original") {
    return left.analysis.tilesAway === right.analysis.tilesAway && (strategy === "efficiency" || compareRolloutQuality(left, right) === 0) && left.weakness === right.weakness && (strategy !== "structure" || left.structureScore === right.structureScore) && left.analysis.improvementCopies === right.analysis.improvementCopies && left.analysis.improvementTiles.length === right.analysis.improvementTiles.length;
  }
  function summarizeDiscardCandidate(candidate, equivalent) {
    return {
      id: candidate.tile.id,
      type: typeOf(candidate.tile),
      tilesAway: candidate.analysis.tilesAway,
      improvementCopies: candidate.analysis.improvementCopies,
      improvementTypes: candidate.analysis.improvementTiles.length,
      weakness: candidate.weakness,
      structureScore: candidate.structureScore,
      structure: candidate.structure,
      rollout: candidate.rollout,
      equivalent
    };
  }
  function evaluateDiscardRollout(candidate, melds, visibleCounts, strategy = "original") {
    let totalCopies = 0;
    let weightedTilesAway = 0;
    let weightedImprovementCopies = 0;
    let weightedImprovementTypes = 0;
    const immediateImprovements = new Map(candidate.analysis.improvementTiles.map((item) => [item.type, item]));
    for (let type = 0; type < TILE_COUNT; type += 1) {
      const remaining = Math.max(0, COPIES_PER_TILE - Math.min(COPIES_PER_TILE, visibleCounts[type] ?? 0));
      if (remaining === 0) {
        continue;
      }
      totalCopies += remaining;
      if (!immediateImprovements.has(type)) {
        weightedTilesAway += candidate.analysis.tilesAway * remaining;
        weightedImprovementCopies += candidate.analysis.improvementCopies * remaining;
        weightedImprovementTypes += candidate.analysis.improvementTiles.length * remaining;
        continue;
      }
      const visibleAfterDraw = [...visibleCounts];
      visibleAfterDraw[type] = (visibleAfterDraw[type] ?? 0) + 1;
      const drawnHand = [...candidate.remaining, { id: -1, type }];
      const nextAnalysis = analyzeHand(drawnHand, melds, visibleAfterDraw);
      const nextDiscard = nextAnalysis.complete ? null : chooseBestDiscard(drawnHand, melds, visibleAfterDraw, { lookahead: false, strategy });
      const resultingAnalysis = nextDiscard?.analysis ?? nextAnalysis;
      weightedTilesAway += resultingAnalysis.tilesAway * remaining;
      weightedImprovementCopies += resultingAnalysis.improvementCopies * remaining;
      weightedImprovementTypes += resultingAnalysis.improvementTiles.length * remaining;
    }
    if (totalCopies === 0) {
      return {
        expectedTilesAway: Infinity,
        expectedImprovementCopies: 0,
        expectedImprovementTypes: 0,
        totalCopies: 0
      };
    }
    return {
      expectedTilesAway: weightedTilesAway / totalCopies,
      expectedImprovementCopies: weightedImprovementCopies / totalCopies,
      expectedImprovementTypes: weightedImprovementTypes / totalCopies,
      totalCopies
    };
  }
  function chooseBestDiscard(concealedTiles, melds = [], visibleCounts, { lookahead = true, strategy = "original" } = {}) {
    const original = [...concealedTiles];
    const originalCounts = tileCounts(original);
    let best = null;
    const candidates = [];
    const seenTypes = /* @__PURE__ */ new Set();
    for (const tile of sortTiles(original)) {
      const type = typeOf(tile);
      if (seenTypes.has(type)) {
        continue;
      }
      seenTypes.add(type);
      const remaining = original.filter((candidate2) => candidate2.id !== tile.id);
      const candidate = {
        tile,
        remaining,
        analysis: analyzeHand(remaining, melds, visibleCounts),
        weakness: weaknessScore(type, originalCounts),
        structureScore: handStructureScore(tileCounts(remaining), melds.length),
        honorCount: TILE_TYPES[type].suited ? 0 : originalCounts[type],
        structure: structureLabel(type, originalCounts)
      };
      candidates.push(candidate);
      if (compareDiscardCandidates(candidate, best, strategy) < 0) {
        best = candidate;
      }
    }
    if (!best) {
      return null;
    }
    const minimumTilesAway = Math.min(...candidates.map((candidate) => candidate.analysis.tilesAway));
    if (lookahead) {
      for (const candidate of candidates) {
        if (candidate.analysis.tilesAway === minimumTilesAway && strategy !== "efficiency") {
          candidate.rollout = evaluateDiscardRollout(candidate, melds, visibleCounts, strategy);
        }
      }
      best = candidates.reduce((current, candidate) => compareDiscardCandidates(candidate, current, strategy) < 0 ? candidate : current, null);
    }
    const optimalDiscards = candidates.filter((candidate) => samePrimaryDiscardQuality(candidate, best, strategy));
    const optimalTypes = new Set(optimalDiscards.map((candidate) => typeOf(candidate.tile)));
    return {
      ...best,
      optimalDiscards,
      discardOptions: candidates.map((candidate) => summarizeDiscardCandidate(candidate, optimalTypes.has(typeOf(candidate.tile))))
    };
  }
  function compareBranchQuality(left, right) {
    if (!right) {
      return -1;
    }
    if (left.expectedTilesAway !== right.expectedTilesAway) {
      return left.expectedTilesAway < right.expectedTilesAway ? -1 : 1;
    }
    if (left.expectedImprovementCopies !== right.expectedImprovementCopies) {
      return left.expectedImprovementCopies > right.expectedImprovementCopies ? -1 : 1;
    }
    if (left.bestTilesAway !== right.bestTilesAway) {
      return left.bestTilesAway < right.bestTilesAway ? -1 : 1;
    }
    return 0;
  }
  function expectedReplacementQuality(concealedTiles, melds, visibleCounts) {
    let totalCopies = 0;
    let weightedTilesAway = 0;
    let bestTilesAway = Infinity;
    let weightedImprovementCopies = 0;
    let bestType = null;
    for (let type = 0; type < TILE_COUNT; type += 1) {
      const remaining = Math.max(0, COPIES_PER_TILE - Math.min(COPIES_PER_TILE, visibleCounts[type] ?? 0));
      if (remaining === 0) {
        continue;
      }
      const drawnTiles = [...concealedTiles, { id: -1, type }];
      const visibleAfterDraw = [...visibleCounts];
      visibleAfterDraw[type] = (visibleAfterDraw[type] ?? 0) + 1;
      const analysis = isWinningHand(drawnTiles, melds) ? analyzeHand(drawnTiles, melds, visibleAfterDraw) : chooseBestDiscard(drawnTiles, melds, visibleAfterDraw, { lookahead: false })?.analysis;
      if (!analysis) {
        continue;
      }
      totalCopies += remaining;
      weightedTilesAway += analysis.tilesAway * remaining;
      weightedImprovementCopies += analysis.improvementCopies * remaining;
      if (analysis.tilesAway < bestTilesAway) {
        bestTilesAway = analysis.tilesAway;
        bestType = type;
      }
    }
    if (totalCopies === 0) {
      return {
        bestTilesAway: Infinity,
        expectedTilesAway: Infinity,
        expectedImprovementCopies: 0,
        bestType: null,
        totalCopies: 0
      };
    }
    return {
      bestTilesAway,
      expectedTilesAway: weightedTilesAway / totalCopies,
      expectedImprovementCopies: weightedImprovementCopies / totalCopies,
      bestType,
      totalCopies
    };
  }
  function shouldTakeKong(branch, bestDiscard) {
    if (!branch || branch.totalCopies === 0 || !bestDiscard) {
      return false;
    }
    if (branch.expectedTilesAway < bestDiscard.analysis.tilesAway) {
      return true;
    }
    if (branch.expectedTilesAway > bestDiscard.analysis.tilesAway) {
      return false;
    }
    return branch.expectedImprovementCopies > bestDiscard.analysis.improvementCopies;
  }
  function removeTilesOfType(tiles, type, amount) {
    const removed = [];
    const kept = [];
    for (const tile of tiles) {
      if (typeOf(tile) === type && removed.length < amount) {
        removed.push(tile);
      } else {
        kept.push(tile);
      }
    }
    return { removed, kept };
  }
  function getKongCandidates(seat) {
    const counts = tileCounts(seat.concealed);
    const candidates = [];
    for (let type = 0; type < TILE_COUNT; type += 1) {
      if (counts[type] >= 4) {
        candidates.push({ kind: "concealedKong", type });
      }
    }
    for (const meld of seat.melds) {
      if (meld.kind === "pong") {
        const type = typeOf(meld.tiles[0]);
        if (counts[type] >= 1) {
          candidates.push({ kind: "addedKong", type });
        }
      }
    }
    return candidates;
  }
  function buildUserTurnDecision(state2, seatIndex, pendingCall = null, turn = state2.turn + 1) {
    const seat = state2.players[seatIndex];
    const visibleCounts = getPublicCounts(state2, seatIndex);
    const bestDiscard = chooseBestDiscard(seat.concealed, seat.melds, visibleCounts, {
      lookahead: false,
      strategy: state2.decisionStrategy ?? "original"
    });
    const options = [];
    const seenTypes = /* @__PURE__ */ new Set();
    for (const tile of sortTiles(seat.concealed)) {
      if (seenTypes.has(typeOf(tile))) {
        continue;
      }
      seenTypes.add(typeOf(tile));
      const remaining = seat.concealed.filter((candidate) => candidate.id !== tile.id);
      const analysis = analyzeHand(remaining, seat.melds, visibleCounts);
      options.push({
        kind: "discard",
        type: typeOf(tile),
        id: tile.id,
        label: `${tileGlyph(tile)} ${tileName(tile)}`,
        tilesAway: analysis.tilesAway,
        improvementCopies: analysis.improvementCopies
      });
    }
    for (const candidate of getKongCandidates(seat)) {
      const branch = evaluateKongCandidate(seat, candidate, visibleCounts);
      options.push({
        kind: candidate.kind,
        type: candidate.type,
        label: `${candidate.kind === "concealedKong" ? "Concealed kong" : "Added kong"}: ${tileGlyph(candidate.type)} ${tileName(candidate.type)}`,
        expectedTilesAway: branch.expectedTilesAway,
        expectedImprovementCopies: branch.expectedImprovementCopies
      });
    }
    return {
      phase: "turn",
      seatIndex,
      turn,
      pendingCall,
      options,
      discardOptions: bestDiscard?.discardOptions ?? [],
      recommendedType: bestDiscard?.tile ? typeOf(bestDiscard.tile) : null,
      recommendedId: bestDiscard?.tile?.id ?? null
    };
  }
  function buildUserCallDecision(state2, seatIndex, discardedTile, discardingSeat) {
    const seat = state2.players[seatIndex];
    const type = typeOf(discardedTile);
    const counts = tileCounts(seat.concealed);
    const options = [{ kind: "pass", label: "Pass" }];
    if (counts[type] >= 2) {
      options.push({ kind: "pong", type, label: `Pong ${tileGlyph(type)} ${tileName(type)}` });
    }
    if (counts[type] >= 3) {
      options.push({ kind: "exposedKong", type, label: `Kong ${tileGlyph(type)} ${tileName(type)}` });
    }
    return options.length > 1 ? { phase: "call", seatIndex, discardingSeat, discardedTile, options } : null;
  }
  function evaluateKongCandidate(seat, candidate, visibleCounts) {
    let concealedAfter = seat.concealed;
    let meldsAfter = seat.melds;
    if (candidate.kind === "concealedKong") {
      concealedAfter = removeTilesOfType(seat.concealed, candidate.type, 4).kept;
      meldsAfter = [...seat.melds, {
        kind: "kong",
        type: candidate.type,
        open: false,
        source: "self",
        tiles: []
      }];
    } else {
      concealedAfter = removeTilesOfType(seat.concealed, candidate.type, 1).kept;
      meldsAfter = seat.melds.map((meld) => meld.kind === "pong" && typeOf(meld.tiles[0]) === candidate.type ? { ...meld, kind: "kong", source: "added", tiles: [...meld.tiles] } : meld);
    }
    const quality = expectedReplacementQuality(concealedAfter, meldsAfter, visibleCounts);
    return { ...candidate, ...quality, concealedAfter, meldsAfter };
  }
  function buildDiscardExplanation(seat, candidate, beforeAnalysis) {
    const tile = tileGlyph(candidate.tile);
    const liveImprovements = `${candidate.analysis.improvementCopies} live copies across ${candidate.analysis.improvementTiles.length} tile type${candidate.analysis.improvementTiles.length === 1 ? "" : "s"}`;
    const futureProjection = candidate.rollout ? ` A one-draw rollout projects ${candidate.rollout.expectedTilesAway.toFixed(2)} tiles away after the next draw and best discard, with ${candidate.rollout.expectedImprovementCopies.toFixed(1)} expected follow-up copies.` : "";
    const distanceChange = beforeAnalysis.tilesAway === candidate.analysis.tilesAway ? `keeps the hand at ${candidate.analysis.tilesAway} tile${candidate.analysis.tilesAway === 1 ? "" : "s"} away` : `leaves the hand ${candidate.analysis.tilesAway} tile${candidate.analysis.tilesAway === 1 ? "" : "s"} away`;
    const structuralReason = candidate.honorCount === 1 ? "it is an unpaired honor with no sequence potential" : "the other tiles have stronger pair or sequence connections";
    const optimalDiscards = candidate.optimalDiscards ?? [candidate];
    const optimalList = optimalDiscards.map((option) => `${tileGlyph(option.tile)} ${tileName(option.tile)}`).join(", ");
    const alternatives = optimalDiscards.length > 1 ? ` The same completion path is preserved by these equally strong discards: ${optimalList}. The simulation chooses ${tile} deterministically.` : "";
    return `${seat.name} discards ${tile} ${tileName(candidate.tile)} because ${structuralReason}; it ${distanceChange} with ${liveImprovements}.${futureProjection} Hover any hand tile to compare every discard path.${alternatives}`;
  }
  function chooseTurnAction(state2, seatIndex = state2.activeSeat) {
    const seat = state2.players[seatIndex];
    const visibleCounts = getPublicCounts(state2, seatIndex);
    const beforeAnalysis = analyzeHand(seat.concealed, seat.melds, visibleCounts);
    const strategy = state2.decisionStrategy ?? "original";
    const bestDiscard = chooseBestDiscard(seat.concealed, seat.melds, visibleCounts, {
      lookahead: strategy !== "efficiency",
      strategy
    });
    let bestKong = null;
    for (const candidate of getKongCandidates(seat)) {
      const branch = evaluateKongCandidate(seat, candidate, visibleCounts);
      if (compareBranchQuality(branch, bestKong) < 0) {
        bestKong = branch;
      }
    }
    const userAction = state2.userActionOverrides?.[seatIndex];
    if (userAction) {
      delete state2.userActionOverrides[seatIndex];
      if (userAction.kind === "discard") {
        const tile = seat.concealed.find((candidate) => typeOf(candidate) === userAction.type);
        if (tile) {
          const remaining = seat.concealed.filter((candidate) => candidate.id !== tile.id);
          return {
            kind: "discard",
            type: userAction.type,
            tile,
            candidate: {
              ...bestDiscard,
              tile,
              remaining,
              analysis: analyzeHand(remaining, seat.melds, visibleCounts)
            },
            discardOptions: bestDiscard?.discardOptions ?? [],
            explanation: `${seat.name} follows the user's discard choice.`,
            beforeAnalysis,
            visibleCounts
          };
        }
      }
      const selectedKong = getKongCandidates(seat).filter((candidate) => candidate.kind === userAction.kind && candidate.type === userAction.type).map((candidate) => evaluateKongCandidate(seat, candidate, visibleCounts))[0];
      if (selectedKong) {
        const glyph = tileGlyph(selectedKong.type);
        const kind = selectedKong.kind === "concealedKong" ? "concealed kong" : "added kong";
        return {
          kind: selectedKong.kind,
          type: selectedKong.type,
          candidate: selectedKong,
          explanation: `${seat.name} chooses a ${kind} of ${glyph} ${tileName(selectedKong.type)} by user choice.`,
          beforeAnalysis,
          visibleCounts
        };
      }
    }
    if (bestKong && shouldTakeKong(bestKong, bestDiscard)) {
      const glyph = tileGlyph(bestKong.type);
      const kind = bestKong.kind === "concealedKong" ? "concealed kong" : "added kong";
      return {
        kind: bestKong.kind,
        type: bestKong.type,
        candidate: bestKong,
        explanation: `${seat.name} chooses a ${kind} of ${glyph} ${tileName(bestKong.type)} because the publicly possible replacement draws average ${bestKong.expectedTilesAway.toFixed(2)} tiles away after the required discard, versus ${bestDiscard.analysis.tilesAway} for the direct discard path.`,
        beforeAnalysis,
        visibleCounts
      };
    }
    const overrideType = state2.discardOverrides?.[seatIndex];
    if (overrideType !== void 0 && bestDiscard) {
      delete state2.discardOverrides[seatIndex];
      const overrideTile = seat.concealed.find((tile) => typeOf(tile) === overrideType);
      if (overrideTile) {
        const remaining = seat.concealed.filter((tile) => tile.id !== overrideTile.id);
        const analysis = analyzeHand(remaining, seat.melds, visibleCounts);
        return {
          kind: "discard",
          type: overrideType,
          tile: overrideTile,
          candidate: {
            ...bestDiscard,
            tile: overrideTile,
            remaining,
            analysis
          },
          discardOptions: bestDiscard.discardOptions,
          explanation: `${seat.name} follows the external model discard recommendation for this benchmark position.`,
          beforeAnalysis,
          visibleCounts
        };
      }
    }
    if (!bestDiscard) {
      return {
        kind: "pass",
        explanation: `${seat.name} has no discardable tile.`,
        beforeAnalysis,
        visibleCounts
      };
    }
    const kongPassReason = bestKong ? ` It passes on the ${bestKong.kind === "concealedKong" ? "concealed" : "added"} kong of ${tileGlyph(bestKong.type)} ${tileName(bestKong.type)} because its best publicly available replacement branch reaches ${Number.isFinite(bestKong.bestTilesAway) ? `${bestKong.bestTilesAway} tile${bestKong.bestTilesAway === 1 ? "" : "s"}` : "no better completion distance"}, while the selected discard is stronger immediately.` : "";
    return {
      kind: "discard",
      type: typeOf(bestDiscard.tile),
      tile: bestDiscard.tile,
      candidate: bestDiscard,
      discardOptions: bestDiscard.discardOptions,
      explanation: `${buildDiscardExplanation(seat, bestDiscard, beforeAnalysis)}${kongPassReason}`,
      beforeAnalysis,
      visibleCounts
    };
  }
  function evaluatePongBranch(seat, type, visibleCounts, { lookahead = true, strategy = "original" } = {}) {
    const removed = removeTilesOfType(seat.concealed, type, 2);
    const meldsAfter = [...seat.melds, { kind: "pong", type, open: true, source: "discard", tiles: [] }];
    const bestDiscard = chooseBestDiscard(removed.kept, meldsAfter, visibleCounts, { lookahead, strategy });
    if (!bestDiscard) {
      return null;
    }
    return {
      kind: "pong",
      type,
      bestDiscard,
      tilesAway: bestDiscard.analysis.tilesAway,
      improvementCopies: bestDiscard.analysis.improvementCopies,
      structureScore: bestDiscard.structureScore,
      bestTilesAway: bestDiscard.analysis.tilesAway,
      expectedTilesAway: bestDiscard.analysis.tilesAway,
      expectedImprovementCopies: bestDiscard.analysis.improvementCopies,
      concealedAfter: removed.kept,
      meldsAfter
    };
  }
  function evaluateCallKongBranch(seat, type, visibleCounts) {
    const removed = removeTilesOfType(seat.concealed, type, 3);
    const meldsAfter = [...seat.melds, { kind: "kong", type, open: true, source: "discard", tiles: [] }];
    return {
      kind: "exposedKong",
      type,
      ...expectedReplacementQuality(removed.kept, meldsAfter, visibleCounts),
      concealedAfter: removed.kept,
      meldsAfter
    };
  }
  function callImprovesHand(call, currentAnalysis, currentDiscard) {
    if (!call) {
      return false;
    }
    const callStructure = call.structureScore ?? -Infinity;
    const currentStructure = currentDiscard?.structureScore ?? -Infinity;
    return call.expectedTilesAway < currentAnalysis.tilesAway || call.expectedTilesAway === currentAnalysis.tilesAway && (callStructure > currentStructure || callStructure === currentStructure && call.expectedImprovementCopies > currentAnalysis.improvementCopies);
  }
  function evaluateDiscardCall(state2, seatIndex, discardedTile) {
    const seat = state2.players[seatIndex];
    const type = typeOf(discardedTile);
    const visibleCounts = getPublicCounts(state2, seatIndex);
    const strategy = state2.decisionStrategy ?? "original";
    const lookahead = strategy !== "efficiency";
    const currentAnalysis = analyzeHand(seat.concealed, seat.melds, visibleCounts);
    const currentDiscard = chooseBestDiscard(seat.concealed, seat.melds, visibleCounts, { lookahead, strategy });
    const counts = tileCounts(seat.concealed);
    const options = [];
    if (counts[type] >= 2) {
      const pong = evaluatePongBranch(seat, type, visibleCounts, { lookahead, strategy });
      if (pong) {
        options.push(pong);
      }
    }
    if (counts[type] >= 3) {
      options.push(evaluateCallKongBranch(seat, type, visibleCounts));
    }
    let bestCall = null;
    for (const option of options) {
      if (!callImprovesHand(option, currentAnalysis, currentDiscard)) {
        continue;
      }
      if (compareBranchQuality(option, bestCall) < 0) {
        bestCall = option;
      }
    }
    if (bestCall) {
      const glyph = tileGlyph(type);
      if (bestCall.kind === "exposedKong") {
        return {
          kind: bestCall.kind,
          type,
          candidate: bestCall,
          explanation: `${seat.name} calls an exposed kong of ${glyph} ${tileName(type)} because publicly possible replacement draws average ${bestCall.expectedTilesAway.toFixed(2)} tiles away after the required discard, improving on the current ${currentAnalysis.tilesAway}-tile path.`
        };
      }
      return {
        kind: bestCall.kind,
        type,
        candidate: bestCall,
        explanation: `${seat.name} calls pong on ${glyph} ${tileName(type)} because this discard is available now; after claiming it and making the required discard, the hand reaches ${bestCall.tilesAway} tile${bestCall.tilesAway === 1 ? "" : "s"} away with ${bestCall.improvementCopies} live follow-up copies, better than passing.`
      };
    }
    const possibleCall = options.length > 0;
    return {
      kind: "pass",
      type,
      explanation: possibleCall ? `${seat.name} passes on ${tileGlyph(type)} ${tileName(type)} because committing those tiles to pong/kong would not beat the more flexible concealed path at ${currentAnalysis.tilesAway} tile${currentAnalysis.tilesAway === 1 ? "" : "s"} away.` : `${seat.name} cannot make a legal pong or kong from ${tileGlyph(type)} ${tileName(type)}.`
    };
  }
  function nextSeat(seatIndex) {
    return (seatIndex + 1) % SEAT_NAMES.length;
  }
  function removeTileById(tiles, id) {
    const index = tiles.findIndex((tile) => tile.id === id);
    if (index < 0) {
      return null;
    }
    return tiles.splice(index, 1)[0];
  }
  function drawLiveTile(state2, seat) {
    const tile = state2.liveWall.shift();
    if (tile) {
      seat.concealed.push(tile);
      seat.concealed = sortTiles(seat.concealed);
      state2.lastDraw = { tileId: tile.id, seatIndex: state2.players.indexOf(seat), source: "live", turn: state2.turn + 1 };
    }
    return tile;
  }
  function drawReplacementTile(state2, seat) {
    const tile = state2.replacementWall.pop();
    if (tile) {
      seat.concealed.push(tile);
      seat.concealed = sortTiles(seat.concealed);
      state2.lastDraw = { tileId: tile.id, seatIndex: state2.players.indexOf(seat), source: "replacement", turn: state2.turn + 1 };
    }
    return tile;
  }
  function applyUserCallChoice(state2, pending, choice) {
    const seat = state2.players[pending.seatIndex];
    const discardedTile = pending.discardedTile;
    if (choice.kind === "pass") {
      state2.pendingUserDecision = null;
      state2.activeSeat = nextSeat(pending.discardingSeat);
      state2.needsDraw = true;
      state2.canDeclareSelfDraw = false;
      return false;
    }
    markClaimedDiscard(state2, discardedTile, pending.seatIndex);
    const beforeCall = {
      concealed: sortTiles(seat.concealed),
      melds: seat.melds.map((meld) => ({ ...meld, tiles: [...meld.tiles] }))
    };
    if (choice.kind === "pong") {
      applyPong(seat, choice.type, discardedTile);
    } else if (choice.kind === "exposedKong") {
      applyExposedKong(seat, choice.type, discardedTile);
    } else {
      return false;
    }
    const callInfo = {
      seatIndex: pending.seatIndex,
      kind: choice.kind === "exposedKong" ? "exposedKong" : "pong",
      explanation: `East chooses to call ${choice.kind === "exposedKong" ? "kong" : "pong"} by user choice.`,
      takenTile: discardedTile,
      takenTileId: discardedTile.id,
      beforeCall,
      drawnTiles: [],
      drawnTileIds: []
    };
    state2.activeSeat = pending.seatIndex;
    state2.needsDraw = false;
    state2.canDeclareSelfDraw = false;
    state2.pendingCall = callInfo;
    state2.pendingUserDecision = null;
    if (state2.lastAction) {
      state2.lastAction.call = callInfo;
    }
    if (choice.kind === "exposedKong") {
      const replacement = drawReplacementTile(state2, seat);
      if (!replacement) {
        state2.terminal = { type: "wallExhausted", winner: null, message: "The replacement wall is empty after the exposed kong." };
        return true;
      }
      callInfo.drawnTiles = [replacement];
      callInfo.drawnTileIds = [replacement.id];
      if (isWinningHand(seat.concealed, seat.melds)) {
        state2.terminal = { type: "selfDraw", winner: pending.seatIndex, message: `${seat.name} wins by drawing the replacement tile after a kong.` };
        return true;
      }
    }
    state2.pendingUserDecision = buildUserTurnDecision(state2, pending.seatIndex, callInfo, state2.turn + 1);
    return true;
  }
  function markClaimedDiscard(state2, tile, bySeat) {
    state2.claimedDiscardIds.push(tile.id);
    state2.lastDiscard = { ...state2.lastDiscard, claimedBy: bySeat };
  }
  function findAddedKongMeld(seat, type) {
    return seat.melds.find((meld) => meld.kind === "pong" && typeOf(meld.tiles[0]) === type);
  }
  function applyConcealedKong(seat, type) {
    const removed = removeTilesOfType(seat.concealed, type, 4);
    seat.concealed = sortTiles(removed.kept);
    seat.melds.push({ kind: "kong", type, open: false, source: "self", tiles: removed.removed });
  }
  function applyAddedKong(seat, type) {
    const tile = removeTilesOfType(seat.concealed, type, 1).removed[0];
    const meld = findAddedKongMeld(seat, type);
    if (!tile || !meld) {
      return false;
    }
    seat.concealed = sortTiles(seat.concealed.filter((candidate) => candidate.id !== tile.id));
    meld.kind = "kong";
    meld.source = "added";
    meld.tiles.push(tile);
    return true;
  }
  function applyPong(seat, type, discardedTile) {
    const removed = removeTilesOfType(seat.concealed, type, 2);
    seat.concealed = sortTiles(removed.kept);
    seat.melds.push({ kind: "pong", type, open: true, source: "discard", tiles: [...removed.removed, discardedTile] });
  }
  function applyExposedKong(seat, type, discardedTile) {
    const removed = removeTilesOfType(seat.concealed, type, 3);
    seat.concealed = sortTiles(removed.kept);
    seat.melds.push({ kind: "kong", type, open: true, source: "discard", tiles: [...removed.removed, discardedTile] });
  }
  function findRobbedKongWinner(state2, actorSeat, type) {
    for (let distance = 1; distance < SEAT_NAMES.length; distance += 1) {
      const seatIndex = (actorSeat + distance) % SEAT_NAMES.length;
      const seat = state2.players[seatIndex];
      const candidateCounts = tileCounts(seat.concealed);
      candidateCounts[type] += 1;
      if (calculateShanten(candidateCounts, seat.melds.length) === -1) {
        return seatIndex;
      }
    }
    return null;
  }
  function discardFromDecision(seat, decision) {
    const tile = removeTileById(seat.concealed, decision.tile.id);
    if (!tile) {
      return null;
    }
    seat.discards.push(tile);
    return tile;
  }
  function resolveDiscardCalls(state2, discardingSeat, discardedTile) {
    const considered = [];
    for (let distance = 1; distance < SEAT_NAMES.length; distance += 1) {
      const seatIndex = (discardingSeat + distance) % SEAT_NAMES.length;
      if (seatIndex === 0 && state2.userControl) {
        const userCall = buildUserCallDecision(state2, seatIndex, discardedTile, discardingSeat);
        if (userCall) {
          state2.pendingUserDecision = userCall;
          state2.activeSeat = seatIndex;
          state2.needsDraw = false;
          state2.canDeclareSelfDraw = false;
          return { call: null, considered, pending: true };
        }
      }
      const decision = evaluateDiscardCall(state2, seatIndex, discardedTile);
      considered.push({ seatIndex, ...decision });
      if (decision.kind === "pass") {
        continue;
      }
      markClaimedDiscard(state2, discardedTile, seatIndex);
      const seat = state2.players[seatIndex];
      const beforeCall = {
        concealed: sortTiles(seat.concealed),
        melds: seat.melds.map((meld) => ({ ...meld, tiles: [...meld.tiles] }))
      };
      if (decision.kind === "pong") {
        applyPong(seat, decision.type, discardedTile);
        state2.activeSeat = seatIndex;
        state2.needsDraw = false;
        state2.canDeclareSelfDraw = false;
        return { call: { ...decision, beforeCall }, considered };
      }
      applyExposedKong(seat, decision.type, discardedTile);
      const replacement = drawReplacementTile(state2, seat);
      state2.activeSeat = seatIndex;
      state2.needsDraw = false;
      state2.canDeclareSelfDraw = false;
      if (!replacement) {
        state2.terminal = { type: "wallExhausted", winner: null, message: "The replacement wall is empty after the exposed kong." };
      } else if (isWinningHand(seat.concealed, seat.melds)) {
        state2.terminal = { type: "selfDraw", winner: seatIndex, message: `${seat.name} wins by drawing the replacement tile after a kong.` };
      }
      return { call: { ...decision, beforeCall }, considered, replacement };
    }
    state2.activeSeat = nextSeat(discardingSeat);
    state2.needsDraw = true;
    state2.canDeclareSelfDraw = false;
    return { call: null, considered };
  }
  function summarizeNeeded(analysis) {
    return analysis.improvementTiles.map((item) => `${item.glyph} ${item.name} (${item.remaining} left)`).join(", ") || "none visible as a live improvement";
  }
  function getPublicCounts(state2, perspectiveSeat) {
    const counts = Array(TILE_COUNT).fill(0);
    const ownSeat = state2.players[perspectiveSeat];
    if (ownSeat) {
      for (const tile of ownSeat.concealed) {
        counts[typeOf(tile)] += 1;
      }
    }
    for (const seat of state2.players) {
      for (const meld of seat.melds) {
        for (const tile of meld.tiles) {
          counts[typeOf(tile)] += 1;
        }
      }
      for (const tile of seat.discards) {
        if (!state2.claimedDiscardIds.includes(tile.id)) {
          counts[typeOf(tile)] += 1;
        }
      }
    }
    return counts;
  }
  function handStructureScore(counts, meldCount = 0) {
    let score = meldCount * 6;
    for (let type = 0; type < TILE_COUNT; type += 1) {
      const count = counts[type];
      if (count >= 2) {
        score += 4;
      }
      if (count >= 3) {
        score += 3;
      }
    }
    for (let suitStart = 0; suitStart < 27; suitStart += 9) {
      for (let rank = 0; rank < 8; rank += 1) {
        score += Math.min(counts[suitStart + rank], counts[suitStart + rank + 1]) * 2;
      }
      for (let rank = 0; rank < 7; rank += 1) {
        score += Math.min(counts[suitStart + rank], counts[suitStart + rank + 2]);
        score += Math.min(counts[suitStart + rank], counts[suitStart + rank + 1], counts[suitStart + rank + 2]) * 3;
      }
    }
    return score;
  }
  function analyzeKeepableDraws(state2, perspectiveSeat = 0) {
    const seat = state2.players[perspectiveSeat];
    const visibleCounts = getPublicCounts(state2, perspectiveSeat);
    const currentStructure = handStructureScore(tileCounts(seat.concealed), seat.melds.length);
    const keepableTiles = [];
    for (let type = 0; type < TILE_COUNT; type += 1) {
      const remaining = Math.max(0, COPIES_PER_TILE - Math.min(COPIES_PER_TILE, visibleCounts[type] ?? 0));
      if (remaining === 0) {
        continue;
      }
      const drawnTile = { id: -1, type };
      const bestDiscard = chooseBestDiscard([...seat.concealed, drawnTile], seat.melds, visibleCounts, { lookahead: false });
      const keptStructure = bestDiscard ? handStructureScore(tileCounts(bestDiscard.remaining), seat.melds.length) : currentStructure;
      if (bestDiscard && bestDiscard.tile.type !== type && keptStructure > currentStructure) {
        keepableTiles.push({ type, remaining, glyph: tileGlyph(type), name: tileName(type) });
      }
    }
    return {
      tiles: keepableTiles,
      copies: totalLiveCopies(keepableTiles)
    };
  }
  function analyzePlayer(state2, seatIndex) {
    const seat = state2.players[seatIndex];
    const visibleCounts = getPublicCounts(state2, seatIndex);
    const current = analyzeHand(seat.concealed, seat.melds, visibleCounts);
    const isActiveDiscardPhase = state2.activeSeat === seatIndex && !state2.needsDraw && !state2.terminal;
    if (current.complete || !isActiveDiscardPhase) {
      return current;
    }
    const bestDiscard = chooseBestDiscard(seat.concealed, seat.melds, visibleCounts, { strategy: state2.decisionStrategy ?? "original" });
    return bestDiscard ? bestDiscard.analysis : current;
  }
  function createGame({ seed = Date.now() } = {}) {
    const random = seededRandom(seed);
    const deck = shuffle(createDeck(), random);
    const players = SEAT_NAMES.map((name, seatIndex) => ({
      seatIndex,
      name,
      concealed: [],
      melds: [],
      discards: []
    }));
    let cursor = 0;
    for (let round = 0; round < 13; round += 1) {
      for (const player of players) {
        player.concealed.push(deck[cursor]);
        cursor += 1;
      }
    }
    players[0].concealed.push(deck[cursor]);
    cursor += 1;
    for (const player of players) {
      player.concealed = sortTiles(player.concealed);
    }
    const remaining = deck.slice(cursor);
    return {
      seed,
      players,
      liveWall: remaining.slice(0, -14),
      replacementWall: remaining.slice(-14),
      activeSeat: 0,
      needsDraw: false,
      canDeclareSelfDraw: true,
      turn: 0,
      terminal: null,
      lastDiscard: null,
      lastDraw: null,
      pendingCall: null,
      lastAction: null,
      claimedDiscardIds: [],
      discardOverrides: {},
      userControl: false,
      userActionOverrides: {},
      pendingUserDecision: null,
      userDecisionSelection: null,
      history: []
    };
  }
  function nextTurn(state2) {
    if (state2.terminal) {
      return state2;
    }
    if (state2.pendingUserDecision?.phase === "call") {
      if (!state2.userDecisionSelection) {
        return state2;
      }
      const pendingCall2 = state2.pendingUserDecision;
      const selection = state2.userDecisionSelection;
      state2.userDecisionSelection = null;
      const applied = applyUserCallChoice(state2, pendingCall2, selection);
      return applied && selection.kind === "pass" ? nextTurn(state2) : state2;
    }
    const pendingUserTurn = state2.pendingUserDecision?.phase === "turn" ? state2.pendingUserDecision : null;
    if (pendingUserTurn && !state2.userDecisionSelection) {
      return state2;
    }
    const seatIndex = state2.activeSeat;
    const seat = state2.players[seatIndex];
    const userSelection = pendingUserTurn ? state2.userDecisionSelection : null;
    const turnNumber = pendingUserTurn?.turn ?? state2.turn + 1;
    const events = [];
    let discardCallMade = false;
    let drawnTiles = [];
    let handBeforeDiscard = null;
    let discardedTile = null;
    let callInfo = null;
    let equivalentDiscards = [];
    let discardOptions = [];
    const pendingCall = pendingUserTurn?.pendingCall ?? state2.pendingCall;
    state2.pendingUserDecision = null;
    state2.userDecisionSelection = null;
    const wasDrawRequired = state2.needsDraw;
    state2.pendingCall = null;
    state2.lastDraw = null;
    if (!pendingUserTurn && state2.needsDraw) {
      const drawn = drawLiveTile(state2, seat);
      if (!drawn) {
        state2.terminal = { type: "wallExhausted", winner: null, message: "The live wall is empty. No player completed a hand." };
        state2.lastAction = {
          turn: turnNumber,
          seatIndex,
          kind: "wallExhausted",
          explanation: state2.terminal.message,
          events
        };
        state2.turn = turnNumber;
        state2.history.push(state2.lastAction);
        return state2;
      }
      events.push(`${seat.name} draws ${tileGlyph(drawn)}.`);
      drawnTiles.push(drawn);
      state2.canDeclareSelfDraw = true;
    }
    state2.needsDraw = false;
    handBeforeDiscard = sortTiles(seat.concealed);
    const openingDraw = seatIndex === 0 && state2.turn <= 1 && !wasDrawRequired && seat.concealed.length === 14 ? handBeforeDiscard[handBeforeDiscard.length - 1] : null;
    if (openingDraw) {
      drawnTiles.push(openingDraw);
    }
    if (state2.canDeclareSelfDraw !== false && isWinningHand(seat.concealed, seat.melds)) {
      state2.terminal = { type: "selfDraw", winner: seatIndex, message: `${seat.name} wins by self-draw.` };
      const explanation2 = `${seat.name} completes four melds and a pair with the drawn hand. Self-draw is legal; ordinary discard wins are not used.`;
      state2.lastAction = {
        turn: turnNumber,
        seatIndex,
        displaySeatIndex: seatIndex,
        kind: "selfDraw",
        explanation: explanation2,
        events,
        handBeforeDiscard,
        drawnTiles,
        drawnTileIds: drawnTiles.map((tile) => tile.id),
        discardedTile: null,
        discardedTileId: null,
        equivalentDiscards: [],
        discardOptions: [],
        call: null,
        callFromPrevious: pendingCall
      };
      state2.turn = turnNumber;
      state2.history.push(state2.lastAction);
      return state2;
    }
    if (!pendingUserTurn && state2.userControl && seatIndex === 0) {
      state2.turn = turnNumber;
      state2.pendingUserDecision = buildUserTurnDecision(state2, seatIndex, pendingCall, turnNumber);
      return state2;
    }
    if (userSelection && userSelection.kind !== "selfDraw") {
      state2.userActionOverrides[seatIndex] = userSelection;
    }
    const decision = chooseTurnAction(state2, seatIndex);
    let explanation = pendingCall?.explanation ? `${pendingCall.explanation} ${decision.explanation}` : decision.explanation;
    let actionKind = pendingCall ? `${pendingCall.kind}+${decision.kind}` : decision.kind;
    if (decision.kind === "addedKong") {
      const robber = findRobbedKongWinner(state2, seatIndex, decision.type);
      if (robber !== null) {
        const robberSeat = state2.players[robber];
        state2.terminal = { type: "robbedKong", winner: robber, message: `${robberSeat.name} wins by robbing ${seat.name}'s added kong.` };
        explanation += ` ${robberSeat.name} may rob this added kong because the kong tile completes a legal hand; this is the explicit exception to self-draw-only wins.`;
        actionKind = "robbedKong";
        state2.lastAction = { turn: turnNumber, seatIndex, kind: actionKind, winner: robber, explanation, events };
        state2.turn = turnNumber;
        state2.history.push(state2.lastAction);
        return state2;
      }
      if (applyAddedKong(seat, decision.type)) {
        events.push(`${seat.name} upgrades a pong to a kong of ${tileGlyph(decision.type)}.`);
        const replacement = drawReplacementTile(state2, seat);
        if (!replacement) {
          state2.terminal = { type: "wallExhausted", winner: null, message: "The replacement wall is empty after the added kong." };
        } else {
          drawnTiles.push(replacement);
          events.push(`${seat.name} draws replacement ${tileGlyph(replacement)}.`);
          if (isWinningHand(seat.concealed, seat.melds)) {
            state2.terminal = { type: "selfDraw", winner: seatIndex, message: `${seat.name} wins by drawing the replacement tile after an added kong.` };
          }
        }
      }
    } else if (decision.kind === "concealedKong") {
      applyConcealedKong(seat, decision.type);
      events.push(`${seat.name} declares a concealed kong of ${tileGlyph(decision.type)}.`);
      const replacement = drawReplacementTile(state2, seat);
      if (!replacement) {
        state2.terminal = { type: "wallExhausted", winner: null, message: "The replacement wall is empty after the concealed kong." };
      } else {
        drawnTiles.push(replacement);
        events.push(`${seat.name} draws replacement ${tileGlyph(replacement)}.`);
        if (isWinningHand(seat.concealed, seat.melds)) {
          state2.terminal = { type: "selfDraw", winner: seatIndex, message: `${seat.name} wins by drawing the replacement tile after a concealed kong.` };
        }
      }
    }
    if (!state2.terminal) {
      handBeforeDiscard = sortTiles(seat.concealed);
      const discardDecision = decision.kind === "discard" ? decision : chooseTurnAction(state2, seatIndex);
      if (discardDecision.kind === "discard" && discardDecision.tile) {
        discardOptions = discardDecision.discardOptions ?? [];
        equivalentDiscards = (discardDecision.candidate?.optimalDiscards ?? []).map((candidate) => ({
          id: candidate.tile.id,
          type: candidate.tile.type
        }));
        const discarded = discardFromDecision(seat, discardDecision);
        if (discarded) {
          discardedTile = discarded;
          state2.lastDiscard = { tile: discarded, fromSeat: seatIndex };
          events.push(`${seat.name} discards ${tileGlyph(discarded)}.`);
          const callResult = resolveDiscardCalls(state2, seatIndex, discarded);
          if (callResult.call) {
            discardCallMade = true;
            callInfo = {
              seatIndex: state2.activeSeat,
              kind: callResult.call.kind,
              explanation: callResult.call.explanation,
              takenTile: discarded,
              takenTileId: discarded.id,
              beforeCall: callResult.call.beforeCall,
              drawnTiles: callResult.replacement ? [callResult.replacement] : [],
              drawnTileIds: callResult.replacement ? [callResult.replacement.id] : []
            };
            state2.pendingCall = callInfo;
            if (callResult.replacement) {
              events.push(`${state2.players[state2.activeSeat].name} draws a replacement tile.`);
            }
          }
        }
      }
    }
    if (!state2.terminal && !discardCallMade && state2.activeSeat === seatIndex) {
      state2.activeSeat = nextSeat(seatIndex);
      state2.needsDraw = true;
      state2.canDeclareSelfDraw = false;
    }
    state2.turn = turnNumber;
    state2.lastAction = {
      turn: turnNumber,
      seatIndex,
      kind: actionKind,
      explanation,
      events,
      analysis: decision.beforeAnalysis,
      needed: summarizeNeeded(decision.beforeAnalysis),
      displaySeatIndex: seatIndex,
      handBeforeDiscard,
      drawnTiles: [...pendingCall?.drawnTiles ?? [], ...drawnTiles],
      drawnTileIds: [...pendingCall?.drawnTileIds ?? [], ...drawnTiles.map((tile) => tile.id)],
      discardedTile,
      discardedTileId: discardedTile?.id ?? null,
      equivalentDiscards,
      discardOptions,
      call: callInfo,
      callFromPrevious: pendingCall
    };
    state2.history.push(state2.lastAction);
    return state2;
  }

  // src/main.js
  var BUILD_VERSION = "2026-08-12 05:21 UTC";
  var decisionStrategy = "efficiency";
  function createInitialState(seed) {
    const initialState = createGame(seed === void 0 ? {} : { seed });
    initialState.decisionStrategy = decisionStrategy;
    initialState.userControl = true;
    return nextTurn(initialState);
  }
  var state = createInitialState();
  var timeline = [structuredClone(state)];
  var elements = {
    next: document.querySelector("#next-turn"),
    previous: document.querySelector("#previous-turn"),
    newDeal: document.querySelector("#new-deal"),
    turn: document.querySelector("#turn-number"),
    liveWall: document.querySelector("#live-wall-count"),
    liveWallMeter: document.querySelector("#live-wall-meter"),
    boardTitle: document.querySelector("#board-title"),
    riverGrid: document.querySelector("#river-grid"),
    newTile: document.querySelector("#new-tile-0"),
    heldTileSummary: document.querySelector("#held-tile-summary"),
    heldTile: document.querySelector("#held-tile-0"),
    heldCount: document.querySelector("#held-count"),
    analysisImprovementCount: document.querySelector("#analysis-improvement-count"),
    sequenceCount: document.querySelector("#sequence-count"),
    otherCount: document.querySelector("#other-count"),
    sequenceTiles: document.querySelector("#sequence-tiles"),
    otherTiles: document.querySelector("#other-tiles"),
    userDecisionPanel: document.querySelector("#user-decision-panel"),
    userDecisionActions: document.querySelector("#user-decision-actions"),
    copyPosition: document.querySelector("#copy-position"),
    copyPositionLabel: document.querySelector("#copy-position-label")
  };
  document.querySelector("#build-version").textContent = `Build ${BUILD_VERSION}`;
  var TILE_ART_URLS = {
    0: "https://commons.wikimedia.org/wiki/Special:FilePath/0101%E4%B8%80%E8%90%AC.svg",
    1: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/0102%E4%BA%8C%E8%90%AC.svg/120px-0102%E4%BA%8C%E8%90%AC.svg.png",
    2: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/0103%E4%B8%89%E8%90%AC.svg/120px-0103%E4%B8%89%E8%90%AC.svg.png",
    3: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/0104%E5%9B%9B%E8%90%AC.svg/120px-0104%E5%9B%9B%E8%90%AC.svg.png",
    4: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/0105%E4%BA%94%E8%90%AC.svg/120px-0105%E4%BA%94%E8%90%AC.svg.png",
    5: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/0106%E5%85%AD%E8%90%AC.svg/120px-0106%E5%85%AD%E8%90%AC.svg.png",
    6: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/0107%E4%B8%83%E8%90%AC.svg/120px-0107%E4%B8%83%E8%90%AC.svg.png",
    7: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/0108%E5%85%AB%E8%90%AC.svg/120px-0108%E5%85%AB%E8%90%AC.svg.png",
    8: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/0109%E4%B9%9D%E8%90%AC.svg/120px-0109%E4%B9%9D%E8%90%AC.svg.png",
    9: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/0301%E4%B8%80%E6%A2%9D.svg/120px-0301%E4%B8%80%E6%A2%9D.svg.png",
    10: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/0302%E4%BA%8C%E6%A2%9D.svg/120px-0302%E4%BA%8C%E6%A2%9D.svg.png",
    11: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/0303%E4%B8%89%E6%A2%9D.svg/120px-0303%E4%B8%89%E6%A2%9D.svg.png",
    12: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/0304%E5%9B%9B%E6%A2%9D.svg/120px-0304%E5%9B%9B%E6%A2%9D.svg.png",
    13: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/0305%E4%BA%94%E6%A2%9D.svg/120px-0305%E4%BA%94%E6%A2%9D.svg.png",
    14: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/0306%E5%85%AD%E6%A2%9D.svg/120px-0306%E5%85%AD%E6%A2%9D.svg.png",
    15: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/0307%E4%B8%83%E6%A2%9D.svg/120px-0307%E4%B8%83%E6%A2%9D.svg.png",
    16: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/0308%E5%85%AB%E6%A2%9D.svg/120px-0308%E5%85%AB%E6%A2%9D.svg.png",
    17: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/0309%E4%B9%9D%E6%A2%9D.svg/120px-0309%E4%B9%9D%E6%A2%9D.svg.png",
    18: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/0201%E4%B8%80%E9%A4%85.svg/120px-0201%E4%B8%80%E9%A4%85.svg.png",
    19: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/0202%E4%BA%8C%E9%A4%85.svg/120px-0202%E4%BA%8C%E9%A4%85.svg.png",
    20: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/0203%E4%B8%89%E9%A4%85.svg/120px-0203%E4%B8%89%E9%A4%85.svg.png",
    21: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/0204%E5%9B%9B%E9%A4%85.svg/120px-0204%E5%9B%9B%E9%A4%85.svg.png",
    22: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/0205%E4%BA%94%E9%A4%85.svg/120px-0205%E4%BA%94%E9%A4%85.svg.png",
    23: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/0206%E5%85%AD%E9%A4%85.svg/120px-0206%E5%85%AD%E9%A4%85.svg.png",
    24: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/0207%E4%B8%83%E9%A4%85.svg/120px-0207%E4%B8%83%E9%A4%85.svg.png",
    25: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/0208%E5%85%AB%E9%A4%85.svg/120px-0208%E5%85%AB%E9%A4%85.svg.png",
    26: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/0209%E4%B9%9D%E9%A4%85.svg/120px-0209%E4%B9%9D%E9%A4%85.svg.png",
    27: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/0401%E6%9D%B1%E9%A2%A8.svg/120px-0401%E6%9D%B1%E9%A2%A8.svg.png",
    28: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/0403%E5%8D%97%E9%A2%A8.svg/120px-0403%E5%8D%97%E9%A2%A8.svg.png",
    29: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/0402%E8%A5%BF%E9%A2%A8.svg/120px-0402%E8%A5%BF%E9%A2%A8.svg.png",
    30: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/0404%E5%8C%97%E9%A2%A8.svg/120px-0404%E5%8C%97%E9%A2%A8.svg.png",
    31: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/0405%E4%B8%AD.svg/120px-0405%E4%B8%AD.svg.png",
    32: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/0406%E7%99%BC.svg/120px-0406%E7%99%BC.svg.png",
    33: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/0407%E7%99%BD.svg/120px-0407%E7%99%BD.svg.png"
  };
  function localTileArtPath(type) {
    const localNames = [
      "0101\u4E00\u842C.svg.webp",
      "0102\u4E8C\u842C.svg.webp",
      "0103\u4E09\u842C.svg.webp",
      "0104\u56DB\u842C.svg.webp",
      "0105\u4E94\u842C.svg.webp",
      "0106\u516D\u842C.svg.webp",
      "0107\u4E03\u842C.svg.webp",
      "0108\u516B\u842C.svg.webp",
      "0109\u4E5D\u842C.svg.webp",
      "0301\u4E00\u689D.svg.webp",
      "0302\u4E8C\u689D.svg.webp",
      "0303\u4E09\u689D.svg.webp",
      "0304\u56DB\u689D.svg.webp",
      "0305\u4E94\u689D.svg.webp",
      "0306\u516D\u689D.svg.webp",
      "0307\u4E03\u689D.svg.webp",
      "0308\u516B\u689D.svg.webp",
      "0309\u4E5D\u689D.svg.webp",
      "0201\u4E00\u9905.svg.webp",
      "0202\u4E8C\u9905.svg.webp",
      "0203\u4E09\u9905.svg.webp",
      "0204\u56DB\u9905.svg.webp",
      "0205\u4E94\u9905.svg.webp",
      "0206\u516D\u9905.svg.webp",
      "0207\u4E03\u9905.svg.webp",
      "0208\u516B\u9905.svg.webp",
      "0209\u4E5D\u9905.svg.webp",
      "0401\u6771\u98A8.svg.webp",
      "0403\u5357\u98A8.svg.webp",
      "0402\u897F\u98A8.svg.webp",
      "0404\u5317\u98A8.svg.webp",
      "0405\u4E2D.svg.webp",
      "0406\u767C.svg.webp",
      "0407\u767D.svg.webp"
    ];
    return localNames[type] ? `./assets/tiles/${localNames[type]}` : "./assets/tiles/missing.webp";
  }
  function tileFaceMarkup(type, glyph, hidden) {
    if (hidden) {
      return `<span class="tile-face tile-back">${glyph}</span>`;
    }
    if (TILE_ART_URLS[type]) {
      return `<img class="tile-art" src="${localTileArtPath(type)}" data-fallback="${TILE_ART_URLS[type]}" alt="" draggable="false" onerror="if(this.src.endsWith('/missing.webp')){this.onerror=null;this.src=this.dataset.fallback}else{this.onerror=null;this.src=this.dataset.fallback}">`;
    }
    return `<span class="tile-face tile-art-missing" aria-hidden="true"></span>`;
  }
  function tileMarkup(tile, { compact = false, claimed = false, drawn = false, discarded = false, taken = false, alternative = false, decision = null, inline = false, hidden = false } = {}) {
    const type = tile.type ?? tile;
    const glyph = hidden ? "\u{1F02B}" : tileGlyph(type);
    const label = hidden ? "Concealed tile" : `${tileEnglishName(type)} ${tileName(type)}`;
    const family = type < 9 ? "tile-characters" : type < 18 ? "tile-bamboo" : type < 27 ? "tile-dots" : "tile-honor";
    const classes = ["tile", family, `tile-type-${type}`, compact ? "tile-compact" : "", claimed ? "tile-claimed" : "", drawn ? "tile-drawn" : "", discarded ? "tile-discard-target" : "", taken ? "tile-taken" : "", alternative ? "tile-alternative" : "", decision ? "tile-has-decision" : "", inline ? "tile-inline" : ""].filter(Boolean).join(" ");
    const discardMarker = discarded ? '<span class="discard-marker" aria-hidden="true"></span>' : "";
    return `<span class="${classes}" title="${label}"${decision ? ' tabindex="0"' : ""} aria-label="${label}">${tileFaceMarkup(type, glyph, hidden)}${discardMarker}</span>`;
  }
  function distanceMarkup(analysis) {
    if (analysis.complete) {
      return "Complete";
    }
    return `${analysis.tilesAway} ${analysis.tilesAway === 1 ? "tile" : "tiles"}`;
  }
  function renderMelds(seat, takenTileId = null) {
    if (seat.melds.length === 0) {
      return "";
    }
    return seat.melds.map((meld) => {
      const label = meld.kind === "kong" ? "Kong" : "Pong";
      return `<span class="meld-group" title="${label}${meld.open ? " \xB7 open" : " \xB7 concealed"}"><span class="meld-label">${label}</span>${meld.tiles.map((tile) => tileMarkup(tile, { compact: true, taken: tile.id === takenTileId })).join("")}</span>`;
    }).join("");
  }
  function renderEastSeat() {
    const seat = state.players[0];
    const card = document.querySelector("#seat-0");
    const analysis = analyzePlayer(state, 0);
    const lastAction = state.lastAction;
    const focusSeatIndex = lastAction?.displaySeatIndex ?? state.activeSeat;
    const active = !state.terminal && focusSeatIndex === 0;
    const next = !state.terminal && Boolean(lastAction) && state.activeSeat === 0 && !active;
    const showingPreDiscardHand = lastAction?.seatIndex === 0 && Array.isArray(lastAction.handBeforeDiscard);
    const handTiles = showingPreDiscardHand ? lastAction.handBeforeDiscard : seat.concealed;
    const drawnTileIds = showingPreDiscardHand ? lastAction.drawnTileIds ?? [] : [];
    const openingAction = lastAction?.seatIndex === 0 && lastAction.turn === 1 && !lastAction.drawnTiles?.length;
    const openingTile = handTiles.length === 14 && (!lastAction && state.turn === 0 || openingAction) ? handTiles[handTiles.length - 1] : null;
    const newTileIds = drawnTileIds.length ? drawnTileIds : openingTile ? [openingTile.id] : [];
    const displayHandTiles = handTiles.filter((tile) => !newTileIds.includes(tile.id));
    const displayDrawnTiles = handTiles.filter((tile) => newTileIds.includes(tile.id));
    const discardedTileId = showingPreDiscardHand ? lastAction.discardedTileId : null;
    const discardOptions = showingPreDiscardHand ? lastAction?.discardOptions ?? [] : [];
    const pendingRecommendationId = state.pendingUserDecision?.phase === "turn" ? state.pendingUserDecision.recommendedId : null;
    const discardOptionByType = new Map(discardOptions.map((option) => [option.type, option]));
    const selectedDiscardType = lastAction?.discardedTile?.type ?? null;
    const equivalentDiscardTypes = new Set((lastAction?.equivalentDiscards ?? []).map((tile) => tile.type));
    const winner = state.terminal?.winner === 0;
    const stateLabel = state.terminal ? winner ? "Winner" : "Finished" : active ? showingPreDiscardHand ? "Throw marked" : state.needsDraw ? "Draw next" : "Choose discard" : next ? state.needsDraw ? "Next draw" : "Next discard" : "Waiting";
    card.classList.toggle("is-active", active);
    card.classList.toggle("is-next", next);
    card.classList.toggle("is-winner", winner);
    card.classList.toggle("is-finished", Boolean(state.terminal) && !winner);
    card.setAttribute("aria-current", active ? "step" : "false");
    document.querySelector("#seat-state-0").textContent = stateLabel;
    document.querySelector("#seat-distance-0").textContent = `${distanceMarkup(analysis)} to win`;
    const compactHandLayout = card.querySelector(".compact-hand-layout");
    compactHandLayout.classList.toggle("has-melds", seat.melds.length > 0);
    document.querySelector("#hand-0").innerHTML = displayHandTiles.map((tile) => tileMarkup(tile, {
      drawn: drawnTileIds.includes(tile.id),
      discarded: discardedTileId === tile.id || pendingRecommendationId === tile.id,
      alternative: equivalentDiscardTypes.has(tile.type) && tile.type !== selectedDiscardType,
      decision: discardOptionByType.get(tile.type) ? buildTileDecision(discardOptionByType.get(tile.type), discardOptions, discardedTileId) : null
    })).join("");
    renderUserDecision();
    document.querySelector("#melds-0").innerHTML = renderMelds(seat);
    elements.newTile.innerHTML = displayDrawnTiles.map((tile) => tileMarkup(tile, {
      drawn: true,
      discarded: discardedTileId === tile.id
    })).join("");
    const improvementTypes = new Set(analysis.improvementTiles.map((item) => item.type));
    const keepableDraws = analyzeKeepableDraws(state, 0).tiles.filter((item) => !improvementTypes.has(item.type));
    const keepableCopies = keepableDraws.reduce((total, item) => total + item.remaining, 0);
    elements.heldTileSummary.hidden = keepableDraws.length === 0;
    elements.heldCount.textContent = `${keepableCopies} live ${keepableCopies === 1 ? "tile" : "tiles"}`;
    elements.heldTile.innerHTML = needTilesMarkup(keepableDraws, "");
    renderEastAnalysis(analysis);
  }
  function chooseUserDecision(choice) {
    if (!state.pendingUserDecision) {
      return;
    }
    state.userDecisionSelection = choice;
    state = nextTurn(state);
    let automaticSteps = 0;
    while (!state.terminal && !state.pendingUserDecision && automaticSteps < 4) {
      state = nextTurn(state);
      automaticSteps += 1;
    }
    timeline.push(structuredClone(state));
    render();
  }
  function renderUserDecision() {
    const pending = state.pendingUserDecision;
    const actionOptions = pending?.options.filter((option) => option.kind !== "discard") ?? [];
    elements.userDecisionPanel.hidden = actionOptions.length === 0;
    if (actionOptions.length === 0) {
      elements.userDecisionActions.innerHTML = "";
      return;
    }
    elements.userDecisionActions.innerHTML = actionOptions.map((option) => `<button class="button button-secondary user-decision-button" type="button" data-user-kind="${option.kind}" data-user-type="${option.type ?? ""}">${option.label}</button>`).join("");
    const selectableTypes = new Set(pending.options.filter((option) => option.kind === "discard").map((option) => option.type));
    document.querySelectorAll("#hand-0 .tile").forEach((tileElement) => {
      const type = Number(tileElement.className.match(/tile-type-(\d+)/)?.[1]);
      if (!selectableTypes.has(type)) {
        return;
      }
      tileElement.classList.add("tile-user-selectable");
      tileElement.setAttribute("tabindex", "0");
      tileElement.dataset.userKind = "discard";
      tileElement.dataset.userType = String(type);
    });
  }
  function analyzedHandForDraws(analysis) {
    const seat = state.players[0];
    if (state.activeSeat === 0 && !state.needsDraw && !state.terminal) {
      return chooseBestDiscard(seat.concealed, seat.melds, analysis.visibleCounts, { strategy: state.decisionStrategy })?.remaining ?? seat.concealed;
    }
    return seat.concealed;
  }
  function discardTilesForDraw(item, hand, melds, visibleCounts) {
    const decision = chooseBestDiscard([...hand, { id: -1, type: item.type }], melds, visibleCounts, { lookahead: false, strategy: state.decisionStrategy });
    if (!decision) {
      return [];
    }
    const seen = /* @__PURE__ */ new Set();
    return decision.optimalDiscards.map((candidate) => candidate.tile).filter((tile) => {
      if (seen.has(tile.type)) {
        return false;
      }
      seen.add(tile.type);
      return true;
    });
  }
  function needTilesMarkup(items, emptyMessage) {
    if (items.length === 0) {
      return `<p class="needs-empty">${emptyMessage}</p>`;
    }
    return items.map((item) => `<div class="need-tile-card has-draw-discard" data-draw-type="${item.type}" tabindex="0" aria-label="${item.remaining} live tiles"><div>${tileMarkup({ type: item.type }, { compact: true })}</div><div class="need-tile-count"><strong>${item.remaining}</strong></div></div>`).join("");
  }
  function renderDrawDiscardTooltip(card) {
    if (card.querySelector(".draw-discard-tooltip")) {
      return;
    }
    const analysis = analyzePlayer(state, 0);
    const hand = analyzedHandForDraws(analysis);
    const discardTiles = discardTilesForDraw({ type: Number(card.dataset.drawType) }, hand, state.players[0].melds, analysis.visibleCounts);
    if (discardTiles.length === 0) {
      return;
    }
    const tooltip = document.createElement("span");
    tooltip.className = "draw-discard-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.innerHTML = discardTiles.map((tile) => tileMarkup(tile, { compact: true })).join("");
    card.append(tooltip);
  }
  function renderEastAnalysis(analysis) {
    const sequenceTiles = analysis.improvementTiles.filter((item) => item.createsSequence);
    const otherTiles = analysis.improvementTiles.filter((item) => !item.createsSequence);
    elements.analysisImprovementCount.textContent = `${analysis.improvementCopies} live`;
    const sequenceCopies = sequenceTiles.reduce((total, item) => total + item.remaining, 0);
    const otherCopies = otherTiles.reduce((total, item) => total + item.remaining, 0);
    elements.sequenceCount.textContent = `${sequenceCopies} live ${sequenceCopies === 1 ? "copy" : "copies"}`;
    elements.otherCount.textContent = `${otherCopies} live ${otherCopies === 1 ? "copy" : "copies"}`;
    elements.sequenceTiles.innerHTML = needTilesMarkup(sequenceTiles, "");
    elements.otherTiles.innerHTML = otherTiles.length ? needTilesMarkup(otherTiles, "") : "";
  }
  function buildTileDecision(option, options, selectedId) {
    const selected = option.id === selectedId;
    const best = options.find((candidate) => candidate.id === selectedId) ?? options[0];
    if (selected) {
      return {
        comparison: `Leaves ${option.tilesAway} away.`
      };
    }
    if (option.equivalent) {
      return {
        comparison: `Also leaves ${option.tilesAway} away.`
      };
    }
    let comparison;
    if (option.tilesAway > best.tilesAway) {
      comparison = `Leaves ${option.tilesAway} away instead of ${best.tilesAway}.`;
    } else if (option.improvementCopies < best.improvementCopies) {
      comparison = `Leaves ${option.improvementCopies} live improvements instead of ${best.improvementCopies}.`;
    } else if (option.improvementTypes < best.improvementTypes) {
      comparison = `Leaves ${option.improvementTypes} improvement types instead of ${best.improvementTypes}.`;
    } else {
      comparison = "Keeps stronger structure.";
    }
    return {
      comparison
    };
  }
  function renderPublicRiver() {
    const hasDiscards = state.players.some((player) => player.discards.length > 0);
    const publicMelds = state.players.slice(1).flatMap((player) => player.melds.map((meld) => ({ player, meld })));
    if (!hasDiscards && publicMelds.length === 0) {
      elements.riverGrid.innerHTML = '<div class="river-empty">No tiles have entered the river yet.</div>';
      return;
    }
    const action = state.lastAction;
    const publicMeldTileIds = new Set(publicMelds.flatMap(({ meld }) => meld.tiles.map((tile) => tile.id)));
    const historyDiscards = state.history.map((entry) => entry.discardedTile).filter(Boolean);
    const historyIds = new Set(historyDiscards.map((tile) => tile.id));
    const unrecordedDiscards = state.players.flatMap((player) => player.discards).filter((tile) => !historyIds.has(tile.id));
    const discardedTiles = [...historyDiscards, ...unrecordedDiscards].filter((tile) => !publicMeldTileIds.has(tile.id));
    const meldMarkup = publicMelds.map(({ player, meld }) => {
      const label = meld.kind === "kong" ? "Kong" : "Pong";
      return `<span class="river-public-meld" title="${label} \xB7 ${player.name}">${meld.tiles.map((tile) => tileMarkup(tile, { compact: true })).join("")}</span>`;
    }).join("");
    elements.riverGrid.innerHTML = `<div class="river-lane-tiles">${meldMarkup}${discardedTiles.map((tile) => tileMarkup(tile, { compact: true, claimed: state.claimedDiscardIds.includes(tile.id), drawn: action?.drawnTileIds?.includes(tile.id), discarded: action?.discardedTileId === tile.id })).join("") || '<span class="empty-inline">none</span>'}</div>`;
  }
  function renderBoardStatus() {
    const activePlayer = state.players[state.activeSeat];
    const displayedPlayer = state.players[state.lastAction?.displaySeatIndex ?? state.activeSeat];
    const pendingCallDisplay = Boolean(state.lastAction?.call && !state.lastAction?.callFromPrevious);
    elements.turn.textContent = state.turn;
    elements.liveWall.textContent = state.liveWall.length;
    elements.liveWallMeter.style.width = `${Math.max(0, Math.min(100, state.liveWall.length / 69 * 100))}%`;
    if (state.terminal) {
      elements.boardTitle.textContent = state.terminal.winner === null ? "Table complete" : `${state.players[state.terminal.winner].name} wins`;
      elements.next.disabled = true;
    } else {
      elements.boardTitle.textContent = pendingCallDisplay ? `${displayedPlayer.name} just acted` : `${activePlayer.name} to act`;
      elements.next.disabled = state.pendingUserDecision?.phase === "call";
    }
    elements.previous.disabled = timeline.length <= 1;
  }
  function formatTileCodes(tiles, { markClaimed = false } = {}) {
    if (!tiles?.length) {
      return "none";
    }
    return tiles.map((tile) => `${tileCode(tile)}${markClaimed && state.claimedDiscardIds.includes(tile.id) ? "*" : ""}`).join(" ");
  }
  function formatMelds(melds) {
    if (!melds?.length) {
      return "none";
    }
    return melds.map((meld) => `${meld.kind} [${formatTileCodes(meld.tiles)}]`).join("; ");
  }
  function describeTile(tile) {
    return `${tileCode(tile)} (${tileEnglishName(tile)})`;
  }
  function promptHandTiles(action, reviewSeat) {
    const hand = [...action?.handBeforeDiscard ?? reviewSeat.concealed];
    const discardedTile = action?.discardedTile;
    if (!discardedTile || hand.some((tile) => tile.id === discardedTile.id)) {
      return hand;
    }
    return sortTiles([...hand, discardedTile]);
  }
  function buildPositionPrompt() {
    const action = state.lastAction?.seatIndex === 0 ? state.lastAction : null;
    const reviewSeat = state.players[0];
    const currentPlayer = state.players[state.activeSeat];
    const promptHand = promptHandTiles(action, reviewSeat);
    const boardLines = state.players.map((player) => `  ${player.name}: ${formatTileCodes(player.discards, { markClaimed: true })}`);
    const meldLines = state.players.map((player) => `  ${player.name}: ${formatMelds(player.melds)}`);
    const rules = [
      "Rules:",
      "- 136 tiles: four copies each of 34 tile types; no flowers.",
      "- The winning shape is four melds and one pair.",
      "- Chow calls are not allowed; legal pong and kong calls are considered.",
      "- Wins are by self-draw, except for robbing an added kong; ordinary discard wins are not used.",
      "- Decisions use only the acting hand and public tiles; opponent concealed hands are hidden.",
      "- No scores are tracked.",
      "- Tile notation: m = characters, p = dots, s = bamboo; honors use east, south, west, north, red, green, white.",
      "- The reviewed discard may appear both in the pre-discard hand and East's discard row; it is the same physical tile and must be counted once."
    ];
    const moveLines = action ? [
      "Move under review:",
      `  Actor: ${reviewSeat.name}`,
      `  Draw this move: ${formatTileCodes(action.drawnTiles)}`,
      `  Discard this move: ${action.discardedTile ? describeTile(action.discardedTile) : `none (${action.kind})`}`,
      `  Description: ${action.discardedTile ? `${reviewSeat.name} throws ${describeTile(action.discardedTile)}.` : `${reviewSeat.name} makes a ${action.kind} action.`}`,
      ...action.call ? [`  Response: ${state.players[action.call.seatIndex].name} calls ${action.call.kind} on ${describeTile(action.call.takenTile)}.`] : [],
      ...action.callFromPrevious ? [`  Prior call: ${state.players[action.callFromPrevious.seatIndex].name} called ${action.callFromPrevious.kind} on ${describeTile(action.callFromPrevious.takenTile)}.`] : [],
      `  Simulation note: ${action.explanation}`
    ] : [
      "Move under review:",
      "  Actor: East",
      "  Draw this move: none recorded at this position.",
      "  Discard this move: no East move recorded at this position.",
      "  Description: East's concealed hand is the only private hand included."
    ];
    return [
      ...rules,
      "",
      `Turn: ${state.turn}`,
      `Player to act next: ${currentPlayer.name}`,
      `Live wall: ${state.liveWall.length}`,
      `Replacement tiles: ${state.replacementWall.length}`,
      "",
      action ? "Current public board (after the reviewed move):" : "Current public board (discards):",
      ...boardLines,
      "",
      "Current public melds:",
      ...meldLines,
      "",
      "East hand used for analysis:",
      `  Hand before this discard: ${formatTileCodes(promptHand)}`,
      `  Open melds: ${formatMelds(reviewSeat.melds)}`,
      "  The hand line is before the discard; the discard line identifies the tile removed from it.",
      "",
      ...moveLines,
      "",
      "* claimed discard"
    ].join("\n");
  }
  function render() {
    renderEastSeat();
    renderBoardStatus();
    renderPublicRiver();
  }
  elements.next.addEventListener("click", () => {
    if (state.pendingUserDecision?.phase === "turn" && state.pendingUserDecision.recommendedType !== null) {
      chooseUserDecision({ kind: "discard", type: state.pendingUserDecision.recommendedType });
      return;
    }
    if (state.pendingUserDecision) {
      return;
    }
    state = nextTurn(state);
    timeline.push(structuredClone(state));
    render();
  });
  elements.previous.addEventListener("click", () => {
    if (timeline.length <= 1) {
      return;
    }
    timeline.pop();
    state = structuredClone(timeline[timeline.length - 1]);
    render();
  });
  elements.newDeal.addEventListener("click", () => {
    state = createInitialState(Date.now());
    timeline = [structuredClone(state)];
    render();
  });
  elements.userDecisionActions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-user-kind]");
    if (!button) {
      return;
    }
    chooseUserDecision({
      kind: button.dataset.userKind,
      ...button.dataset.userType ? { type: Number(button.dataset.userType) } : {}
    });
  });
  document.querySelector("#hand-0").addEventListener("click", (event) => {
    const tile = event.target.closest("[data-user-kind='discard']");
    if (tile) {
      chooseUserDecision({ kind: "discard", type: Number(tile.dataset.userType) });
    }
  });
  document.querySelector("#hand-0").addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    const tile = event.target.closest("[data-user-kind='discard']");
    if (tile) {
      event.preventDefault();
      chooseUserDecision({ kind: "discard", type: Number(tile.dataset.userType) });
    }
  });
  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const isEditing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target.isContentEditable;
    if (isEditing || event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    if (event.key === "ArrowLeft") {
      elements.previous.click();
    } else if (event.key === "ArrowRight") {
      elements.next.click();
    }
  });
  document.addEventListener("pointerover", (event) => {
    const card = event.target instanceof Element ? event.target.closest(".need-tile-card.has-draw-discard") : null;
    if (card) {
      renderDrawDiscardTooltip(card);
    }
  });
  document.addEventListener("focusin", (event) => {
    const card = event.target instanceof Element ? event.target.closest(".need-tile-card.has-draw-discard") : null;
    if (card) {
      renderDrawDiscardTooltip(card);
    }
  });
  async function copyText(text) {
    if (location.protocol !== "file:") {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch {
      }
    }
    const fallback = document.createElement("textarea");
    fallback.value = text;
    fallback.setAttribute("readonly", "");
    fallback.style.position = "fixed";
    fallback.style.opacity = "0";
    document.body.append(fallback);
    fallback.focus();
    fallback.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } finally {
      fallback.remove();
    }
    return copied;
  }
  elements.copyPosition.addEventListener("click", async () => {
    if (await copyText(buildPositionPrompt())) {
      elements.copyPositionLabel.textContent = "Copied";
      window.setTimeout(() => {
        elements.copyPositionLabel.textContent = "Copy for LLM";
      }, 1400);
    }
  });
  render();
})();
