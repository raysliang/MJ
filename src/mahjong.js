const SUIT_NAMES = ["Characters", "Bamboo", "Dots"];
const RANK_NAMES = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const HONOR_NAMES = ["東", "南", "西", "北", "中", "發", "白"];
const HONOR_ENGLISH_NAMES = ["East Wind", "South Wind", "West Wind", "North Wind", "Red Dragon", "Green Dragon", "White Dragon"];
const GLYPHS = [
  "🀇", "🀈", "🀉", "🀊", "🀋", "🀌", "🀍", "🀎", "🀏",
  "🀐", "🀑", "🀒", "🀓", "🀔", "🀕", "🀖", "🀗", "🀘",
  "🀙", "🀚", "🀛", "🀜", "🀝", "🀞", "🀟", "🀠", "🀡",
  "🀀", "🀁", "🀂", "🀃", "🀄", "🀅", "🀆"
];
const HONOR_CODES = ["east", "south", "west", "north", "red", "green", "white"];
const SEAT_NAMES = ["East", "South", "West", "North"];
const TILE_COUNT = 34;
const COPIES_PER_TILE = 4;
const MAX_SHANTEN_CACHE_ENTRIES = 100000;
const shantenCache = new Map();

export const TILE_TYPES = Object.freeze([
  ...Array.from({ length: 27 }, (_, type) => Object.freeze({
    type,
    code: `${(type % 9) + 1}${"msp"[Math.floor(type / 9)]}`,
    name: `${RANK_NAMES[type % 9]}${SUIT_NAMES[Math.floor(type / 9) === 0 ? 0 : Math.floor(type / 9) === 1 ? 1 : 2] === "Characters" ? "萬" : Math.floor(type / 9) === 1 ? "索" : "筒"}`,
    englishName: `${(type % 9) + 1} ${SUIT_NAMES[Math.floor(type / 9)]}`,
    glyph: GLYPHS[type],
    suited: true,
    rank: (type % 9) + 1,
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

export function tileInfo(tile) {
  return TILE_TYPES[assertType(typeOf(tile))];
}

export function tileGlyph(tile) {
  return tileInfo(tile).glyph;
}

export function tileName(tile) {
  return tileInfo(tile).name;
}

export function tileEnglishName(tile) {
  return tileInfo(tile).englishName;
}

export function tileCode(tile) {
  return tileInfo(tile).code;
}

export function createDeck() {
  return Array.from({ length: TILE_COUNT * COPIES_PER_TILE }, (_, id) => ({
    id,
    type: Math.floor(id / COPIES_PER_TILE)
  }));
}

export function shuffle(tiles, random = Math.random) {
  const shuffled = [...tiles];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function seededRandom(seed) {
  let value = (Number(seed) >>> 0) || 0x9e3779b9;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export function sortTiles(tiles) {
  return [...tiles].sort((left, right) => typeOf(left) - typeOf(right) || (left.id ?? 0) - (right.id ?? 0));
}

export function tileCounts(tiles) {
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
  if (cached !== undefined) {
    return cached;
  }
  const targetMelds = Math.max(0, 4 - openMeldCount);
  let best = 8 - (openMeldCount * 2);

  function search(start, melds, taatsu, pair) {
    if (melds > targetMelds) {
      return;
    }
    while (start < TILE_COUNT && counts[start] === 0) {
      start += 1;
    }
    if (start >= TILE_COUNT) {
      const usableTaatsu = Math.min(taatsu, targetMelds - melds);
      best = Math.min(best, 8 - (2 * (openMeldCount + melds)) - usableTaatsu - pair);
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

export function calculateShanten(tilesOrCounts, openMeldCount = 0) {
  const counts = Array.isArray(tilesOrCounts) && tilesOrCounts.length === TILE_COUNT && tilesOrCounts.every(Number.isInteger)
    ? [...tilesOrCounts]
    : tileCounts(tilesOrCounts);
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

export function analyzeHand(concealedTiles, melds = [], visibleCounts) {
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

export function isWinningHand(concealedTiles, melds = []) {
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
  return left.analysis.tilesAway === right.analysis.tilesAway
    && (strategy === "efficiency" || compareRolloutQuality(left, right) === 0)
    && left.weakness === right.weakness
    && (strategy !== "structure" || left.structureScore === right.structureScore)
    && left.analysis.improvementCopies === right.analysis.improvementCopies
    && left.analysis.improvementTiles.length === right.analysis.improvementTiles.length
    ;
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
  const immediateImprovements = new Map(candidate.analysis.improvementTiles.map(item => [item.type, item]));

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
    const nextDiscard = nextAnalysis.complete
      ? null
      : chooseBestDiscard(drawnHand, melds, visibleAfterDraw, { lookahead: false, strategy });
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

export function chooseBestDiscard(concealedTiles, melds = [], visibleCounts, { lookahead = true, strategy = "original" } = {}) {
  const original = [...concealedTiles];
  const originalCounts = tileCounts(original);
  let best = null;
  const candidates = [];
  const seenTypes = new Set();

  for (const tile of sortTiles(original)) {
    const type = typeOf(tile);
    if (seenTypes.has(type)) {
      continue;
    }
    seenTypes.add(type);
    const remaining = original.filter(candidate => candidate.id !== tile.id);
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
  const minimumTilesAway = Math.min(...candidates.map(candidate => candidate.analysis.tilesAway));
  if (lookahead) {
    for (const candidate of candidates) {
      if (candidate.analysis.tilesAway === minimumTilesAway && strategy !== "efficiency") {
        candidate.rollout = evaluateDiscardRollout(candidate, melds, visibleCounts, strategy);
      }
    }
    best = candidates.reduce((current, candidate) => compareDiscardCandidates(candidate, current, strategy) < 0 ? candidate : current, null);
  }
  const optimalDiscards = candidates.filter(candidate => samePrimaryDiscardQuality(candidate, best, strategy));
  const optimalTypes = new Set(optimalDiscards.map(candidate => typeOf(candidate.tile)));
  return {
    ...best,
    optimalDiscards,
    discardOptions: candidates.map(candidate => summarizeDiscardCandidate(candidate, optimalTypes.has(typeOf(candidate.tile))))
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
    const analysis = isWinningHand(drawnTiles, melds)
      ? analyzeHand(drawnTiles, melds, visibleAfterDraw)
      : chooseBestDiscard(drawnTiles, melds, visibleAfterDraw, { lookahead: false })?.analysis;
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

function buildUserTurnDecision(state, seatIndex, pendingCall = null, turn = state.turn + 1, drawnTiles = []) {
  const seat = state.players[seatIndex];
  const visibleCounts = getPublicCounts(state, seatIndex);
  const bestDiscard = chooseBestDiscard(seat.concealed, seat.melds, visibleCounts, {
    lookahead: false,
    strategy: state.decisionStrategy ?? "original"
  });
  const options = [];
  const seenTypes = new Set();
  for (const tile of sortTiles(seat.concealed)) {
    if (seenTypes.has(typeOf(tile))) {
      continue;
    }
    seenTypes.add(typeOf(tile));
    const remaining = seat.concealed.filter(candidate => candidate.id !== tile.id);
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
    drawnTiles,
    drawnTileIds: drawnTiles.map(tile => tile.id),
    options,
    discardOptions: bestDiscard?.discardOptions ?? [],
    recommendedType: bestDiscard?.tile ? typeOf(bestDiscard.tile) : null,
    recommendedId: bestDiscard?.tile?.id ?? null
  };
}

function buildUserCallDecision(state, seatIndex, discardedTile, discardingSeat) {
  const seat = state.players[seatIndex];
  const type = typeOf(discardedTile);
  const counts = tileCounts(seat.concealed);
  const options = [{ kind: "pass", label: "Pass" }];
  if (counts[type] >= 2) {
    options.push({ kind: "pong", type, label: "Pong" });
  }
  if (counts[type] >= 3) {
    options.push({ kind: "exposedKong", type, label: "Kong" });
  }
  return options.length > 1
    ? { phase: "call", seatIndex, discardingSeat, discardedTile, options }
    : null;
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
    meldsAfter = seat.melds.map(meld => meld.kind === "pong" && typeOf(meld.tiles[0]) === candidate.type
      ? { ...meld, kind: "kong", source: "added", tiles: [...meld.tiles] }
      : meld);
  }
  const quality = expectedReplacementQuality(concealedAfter, meldsAfter, visibleCounts);
  return { ...candidate, ...quality, concealedAfter, meldsAfter };
}

function buildDiscardExplanation(seat, candidate, beforeAnalysis) {
  const tile = tileGlyph(candidate.tile);
  const liveImprovements = `${candidate.analysis.improvementCopies} live copies across ${candidate.analysis.improvementTiles.length} tile type${candidate.analysis.improvementTiles.length === 1 ? "" : "s"}`;
  const futureProjection = candidate.rollout
    ? ` A one-draw rollout projects ${candidate.rollout.expectedTilesAway.toFixed(2)} tiles away after the next draw and best discard, with ${candidate.rollout.expectedImprovementCopies.toFixed(1)} expected follow-up copies.`
    : "";
  const distanceChange = beforeAnalysis.tilesAway === candidate.analysis.tilesAway
    ? `keeps the hand at ${candidate.analysis.tilesAway} tile${candidate.analysis.tilesAway === 1 ? "" : "s"} away`
    : `leaves the hand ${candidate.analysis.tilesAway} tile${candidate.analysis.tilesAway === 1 ? "" : "s"} away`;
  const structuralReason = candidate.honorCount === 1
    ? "it is an unpaired honor with no sequence potential"
    : "the other tiles have stronger pair or sequence connections";
  const optimalDiscards = candidate.optimalDiscards ?? [candidate];
  const optimalList = optimalDiscards.map(option => `${tileGlyph(option.tile)} ${tileName(option.tile)}`).join(", ");
  const alternatives = optimalDiscards.length > 1
    ? ` The same completion path is preserved by these equally strong discards: ${optimalList}. The simulation chooses ${tile} deterministically.`
    : "";
  return `${seat.name} discards ${tile} ${tileName(candidate.tile)} because ${structuralReason}; it ${distanceChange} with ${liveImprovements}.${futureProjection} Hover any hand tile to compare every discard path.${alternatives}`;
}

export function chooseTurnAction(state, seatIndex = state.activeSeat) {
  const seat = state.players[seatIndex];
  const visibleCounts = getPublicCounts(state, seatIndex);
  const beforeAnalysis = analyzeHand(seat.concealed, seat.melds, visibleCounts);
  const strategy = state.decisionStrategy ?? "original";
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

  const userAction = state.userActionOverrides?.[seatIndex];
  if (userAction) {
    delete state.userActionOverrides[seatIndex];
    if (userAction.kind === "discard") {
      const tile = seat.concealed.find(candidate => typeOf(candidate) === userAction.type);
      if (tile) {
        const remaining = seat.concealed.filter(candidate => candidate.id !== tile.id);
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
    const selectedKong = getKongCandidates(seat)
      .filter(candidate => candidate.kind === userAction.kind && candidate.type === userAction.type)
      .map(candidate => evaluateKongCandidate(seat, candidate, visibleCounts))[0];
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

  const overrideType = state.discardOverrides?.[seatIndex];
  if (overrideType !== undefined && bestDiscard) {
    delete state.discardOverrides[seatIndex];
    const overrideTile = seat.concealed.find(tile => typeOf(tile) === overrideType);
    if (overrideTile) {
      const remaining = seat.concealed.filter(tile => tile.id !== overrideTile.id);
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

  const kongPassReason = bestKong
    ? ` It passes on the ${bestKong.kind === "concealedKong" ? "concealed" : "added"} kong of ${tileGlyph(bestKong.type)} ${tileName(bestKong.type)} because its best publicly available replacement branch reaches ${Number.isFinite(bestKong.bestTilesAway) ? `${bestKong.bestTilesAway} tile${bestKong.bestTilesAway === 1 ? "" : "s"}` : "no better completion distance"}, while the selected discard is stronger immediately.`
    : "";

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
  return call.expectedTilesAway < currentAnalysis.tilesAway
    || (call.expectedTilesAway === currentAnalysis.tilesAway
      && (callStructure > currentStructure
        || (callStructure === currentStructure
          && call.expectedImprovementCopies > currentAnalysis.improvementCopies)));
}

export function evaluateDiscardCall(state, seatIndex, discardedTile) {
  const seat = state.players[seatIndex];
  const type = typeOf(discardedTile);
  const visibleCounts = getPublicCounts(state, seatIndex);
  const strategy = state.decisionStrategy ?? "original";
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
    explanation: possibleCall
      ? `${seat.name} passes on ${tileGlyph(type)} ${tileName(type)} because committing those tiles to pong/kong would not beat the more flexible concealed path at ${currentAnalysis.tilesAway} tile${currentAnalysis.tilesAway === 1 ? "" : "s"} away.`
      : `${seat.name} cannot make a legal pong or kong from ${tileGlyph(type)} ${tileName(type)}.`
  };
}

function nextSeat(seatIndex) {
  return (seatIndex + 1) % SEAT_NAMES.length;
}

function removeTileById(tiles, id) {
  const index = tiles.findIndex(tile => tile.id === id);
  if (index < 0) {
    return null;
  }
  return tiles.splice(index, 1)[0];
}

function drawLiveTile(state, seat) {
  const tile = state.liveWall.shift();
  if (tile) {
    seat.concealed.push(tile);
    seat.concealed = sortTiles(seat.concealed);
    state.lastDraw = { tileId: tile.id, seatIndex: state.players.indexOf(seat), source: "live", turn: state.turn + 1 };
  }
  return tile;
}

function drawReplacementTile(state, seat) {
  const tile = state.replacementWall.pop();
  if (tile) {
    seat.concealed.push(tile);
    seat.concealed = sortTiles(seat.concealed);
    state.lastDraw = { tileId: tile.id, seatIndex: state.players.indexOf(seat), source: "replacement", turn: state.turn + 1 };
  }
  return tile;
}

function applyUserCallChoice(state, pending, choice) {
  const seat = state.players[pending.seatIndex];
  const discardedTile = pending.discardedTile;
  if (choice.kind === "pass") {
    state.pendingUserDecision = null;
    state.activeSeat = nextSeat(pending.discardingSeat);
    state.needsDraw = true;
    state.canDeclareSelfDraw = false;
    return false;
  }

  markClaimedDiscard(state, discardedTile, pending.seatIndex);
  const beforeCall = {
    concealed: sortTiles(seat.concealed),
    melds: seat.melds.map(meld => ({ ...meld, tiles: [...meld.tiles] }))
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
  state.activeSeat = pending.seatIndex;
  state.needsDraw = false;
  state.canDeclareSelfDraw = false;
  state.pendingCall = callInfo;
  state.pendingUserDecision = null;
  if (state.lastAction) {
    state.lastAction.call = callInfo;
  }

  if (choice.kind === "exposedKong") {
    const replacement = drawReplacementTile(state, seat);
    if (!replacement) {
      state.terminal = { type: "wallExhausted", winner: null, message: "The replacement wall is empty after the exposed kong." };
      return true;
    }
    callInfo.drawnTiles = [replacement];
    callInfo.drawnTileIds = [replacement.id];
    if (isWinningHand(seat.concealed, seat.melds)) {
      state.terminal = { type: "selfDraw", winner: pending.seatIndex, message: `${seat.name} wins by drawing the replacement tile after a kong.` };
      return true;
    }
  }

  state.pendingUserDecision = buildUserTurnDecision(state, pending.seatIndex, callInfo, state.turn + 1, callInfo.drawnTiles);
  return true;
}

function markClaimedDiscard(state, tile, bySeat) {
  state.claimedDiscardIds.push(tile.id);
  state.lastDiscard = { ...state.lastDiscard, claimedBy: bySeat };
}

function findAddedKongMeld(seat, type) {
  return seat.melds.find(meld => meld.kind === "pong" && typeOf(meld.tiles[0]) === type);
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
  seat.concealed = sortTiles(seat.concealed.filter(candidate => candidate.id !== tile.id));
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

function findRobbedKongWinner(state, actorSeat, type) {
  for (let distance = 1; distance < SEAT_NAMES.length; distance += 1) {
    const seatIndex = (actorSeat + distance) % SEAT_NAMES.length;
    const seat = state.players[seatIndex];
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

function resolveDiscardCalls(state, discardingSeat, discardedTile) {
  const considered = [];
  for (let distance = 1; distance < SEAT_NAMES.length; distance += 1) {
    const seatIndex = (discardingSeat + distance) % SEAT_NAMES.length;
    if (seatIndex === 0 && state.userControl) {
      const userCall = buildUserCallDecision(state, seatIndex, discardedTile, discardingSeat);
      if (userCall) {
        state.pendingUserDecision = userCall;
        state.activeSeat = seatIndex;
        state.needsDraw = false;
        state.canDeclareSelfDraw = false;
        return { call: null, considered, pending: true };
      }
    }
    const decision = evaluateDiscardCall(state, seatIndex, discardedTile);
    considered.push({ seatIndex, ...decision });
    if (decision.kind === "pass") {
      continue;
    }

    markClaimedDiscard(state, discardedTile, seatIndex);
    const seat = state.players[seatIndex];
    const beforeCall = {
      concealed: sortTiles(seat.concealed),
      melds: seat.melds.map(meld => ({ ...meld, tiles: [...meld.tiles] }))
    };
    if (decision.kind === "pong") {
      applyPong(seat, decision.type, discardedTile);
      state.activeSeat = seatIndex;
      state.needsDraw = false;
      state.canDeclareSelfDraw = false;
      return { call: { ...decision, beforeCall }, considered };
    }

    applyExposedKong(seat, decision.type, discardedTile);
    const replacement = drawReplacementTile(state, seat);
    state.activeSeat = seatIndex;
    state.needsDraw = false;
    state.canDeclareSelfDraw = false;
    if (!replacement) {
      state.terminal = { type: "wallExhausted", winner: null, message: "The replacement wall is empty after the exposed kong." };
    } else if (isWinningHand(seat.concealed, seat.melds)) {
      state.terminal = { type: "selfDraw", winner: seatIndex, message: `${seat.name} wins by drawing the replacement tile after a kong.` };
    }
    return { call: { ...decision, beforeCall }, considered, replacement };
  }
  state.activeSeat = nextSeat(discardingSeat);
  state.needsDraw = true;
  state.canDeclareSelfDraw = false;
  return { call: null, considered };
}

function summarizeNeeded(analysis) {
  return analysis.improvementTiles.map(item => `${item.glyph} ${item.name} (${item.remaining} left)`).join(", ") || "none visible as a live improvement";
}

export function getPublicCounts(state, perspectiveSeat) {
  const counts = Array(TILE_COUNT).fill(0);
  const ownSeat = state.players[perspectiveSeat];
  if (ownSeat) {
    for (const tile of ownSeat.concealed) {
      counts[typeOf(tile)] += 1;
    }
  }
  for (const seat of state.players) {
    for (const meld of seat.melds) {
      for (const tile of meld.tiles) {
        counts[typeOf(tile)] += 1;
      }
    }
    for (const tile of seat.discards) {
      if (!state.claimedDiscardIds.includes(tile.id)) {
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

export function analyzeKeepableDraws(state, perspectiveSeat = 0) {
  const seat = state.players[perspectiveSeat];
  const visibleCounts = getPublicCounts(state, perspectiveSeat);
  const currentStructure = handStructureScore(tileCounts(seat.concealed), seat.melds.length);
  const keepableTiles = [];

  for (let type = 0; type < TILE_COUNT; type += 1) {
    const remaining = Math.max(0, COPIES_PER_TILE - Math.min(COPIES_PER_TILE, visibleCounts[type] ?? 0));
    if (remaining === 0) {
      continue;
    }
    const drawnTile = { id: -1, type };
    const bestDiscard = chooseBestDiscard([...seat.concealed, drawnTile], seat.melds, visibleCounts, { lookahead: false });
    const keptStructure = bestDiscard
      ? handStructureScore(tileCounts(bestDiscard.remaining), seat.melds.length)
      : currentStructure;
    if (bestDiscard && bestDiscard.tile.type !== type && keptStructure > currentStructure) {
      keepableTiles.push({ type, remaining, glyph: tileGlyph(type), name: tileName(type) });
    }
  }

  return {
    tiles: keepableTiles,
    copies: totalLiveCopies(keepableTiles)
  };
}

export function analyzePlayer(state, seatIndex) {
  const seat = state.players[seatIndex];
  const visibleCounts = getPublicCounts(state, seatIndex);
  const current = analyzeHand(seat.concealed, seat.melds, visibleCounts);
  const isActiveDiscardPhase = state.activeSeat === seatIndex && !state.needsDraw && !state.terminal;
  if (current.complete || !isActiveDiscardPhase) {
    return current;
  }
  const bestDiscard = chooseBestDiscard(seat.concealed, seat.melds, visibleCounts, { strategy: state.decisionStrategy ?? "original" });
  return bestDiscard ? bestDiscard.analysis : current;
}

export function createGame({ seed = Date.now() } = {}) {
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

export function nextTurn(state) {
  if (state.terminal) {
    return state;
  }

  if (state.pendingUserDecision?.phase === "call") {
    if (!state.userDecisionSelection) {
      return state;
    }
    const pendingCall = state.pendingUserDecision;
    const selection = state.userDecisionSelection;
    state.userDecisionSelection = null;
    const applied = applyUserCallChoice(state, pendingCall, selection);
    return applied && selection.kind === "pass" ? nextTurn(state) : state;
  }

  const pendingUserTurn = state.pendingUserDecision?.phase === "turn"
    ? state.pendingUserDecision
    : null;
  if (pendingUserTurn && !state.userDecisionSelection) {
    return state;
  }

  const seatIndex = state.activeSeat;
  const seat = state.players[seatIndex];
  const userSelection = pendingUserTurn ? state.userDecisionSelection : null;
  const turnNumber = pendingUserTurn?.turn ?? state.turn + 1;
  const events = [];
  let discardCallMade = false;
  let drawnTiles = [...(pendingUserTurn?.drawnTiles ?? [])];
  let handBeforeDiscard = null;
  let discardedTile = null;
  let callInfo = null;
  let equivalentDiscards = [];
  let discardOptions = [];
  const pendingCall = pendingUserTurn?.pendingCall ?? state.pendingCall;
  if (userSelection?.kind === "concealedKong" || userSelection?.kind === "addedKong") {
    drawnTiles = [];
  }
  state.pendingUserDecision = null;
  state.userDecisionSelection = null;
  const wasDrawRequired = state.needsDraw;
  state.pendingCall = null;
  state.lastDraw = null;

  if (!pendingUserTurn && state.needsDraw) {
    const drawn = drawLiveTile(state, seat);
    if (!drawn) {
      state.terminal = { type: "wallExhausted", winner: null, message: "The live wall is empty. No player completed a hand." };
      state.lastAction = {
        turn: turnNumber,
        seatIndex,
        kind: "wallExhausted",
        explanation: state.terminal.message,
        events
      };
      state.turn = turnNumber;
      state.history.push(state.lastAction);
      return state;
    }
    events.push(`${seat.name} draws ${tileGlyph(drawn)}.`);
    drawnTiles.push(drawn);
    state.canDeclareSelfDraw = true;
  }
  state.needsDraw = false;
  handBeforeDiscard = sortTiles(seat.concealed);
  const openingDraw = seatIndex === 0
    && !pendingUserTurn
    && state.turn <= 1
    && !wasDrawRequired
    && seat.concealed.length === 14
    ? handBeforeDiscard[handBeforeDiscard.length - 1]
    : null;
  if (openingDraw) {
    drawnTiles.push(openingDraw);
  }

  if (state.canDeclareSelfDraw !== false && isWinningHand(seat.concealed, seat.melds)) {
    state.terminal = { type: "selfDraw", winner: seatIndex, message: `${seat.name} wins by self-draw.` };
    const explanation = `${seat.name} completes four melds and a pair with the drawn hand. Self-draw is legal; ordinary discard wins are not used.`;
    state.lastAction = {
      turn: turnNumber,
      seatIndex,
      displaySeatIndex: seatIndex,
      kind: "selfDraw",
      explanation,
      events,
      handBeforeDiscard,
      drawnTiles,
      drawnTileIds: drawnTiles.map(tile => tile.id),
      discardedTile: null,
      discardedTileId: null,
      equivalentDiscards: [],
      discardOptions: [],
      call: null,
      callFromPrevious: pendingCall
    };
    state.turn = turnNumber;
    state.history.push(state.lastAction);
    return state;
  }

  if (!pendingUserTurn && state.userControl && seatIndex === 0) {
    state.turn = turnNumber;
    state.pendingUserDecision = buildUserTurnDecision(state, seatIndex, pendingCall, turnNumber);
    return state;
  }

  if (userSelection && userSelection.kind !== "selfDraw") {
    state.userActionOverrides ??= {};
    state.userActionOverrides[seatIndex] = userSelection;
  }

  const decision = chooseTurnAction(state, seatIndex);
  let explanation = pendingCall?.explanation
    ? `${pendingCall.explanation} ${decision.explanation}`
    : decision.explanation;
  let actionKind = pendingCall ? `${pendingCall.kind}+${decision.kind}` : decision.kind;

  if (decision.kind === "addedKong") {
    const robber = findRobbedKongWinner(state, seatIndex, decision.type);
    if (robber !== null) {
      const robberSeat = state.players[robber];
      state.terminal = { type: "robbedKong", winner: robber, message: `${robberSeat.name} wins by robbing ${seat.name}'s added kong.` };
      explanation += ` ${robberSeat.name} may rob this added kong because the kong tile completes a legal hand; this is the explicit exception to self-draw-only wins.`;
      actionKind = "robbedKong";
      state.lastAction = { turn: turnNumber, seatIndex, kind: actionKind, winner: robber, explanation, events };
      state.turn = turnNumber;
      state.history.push(state.lastAction);
      return state;
    }
    if (applyAddedKong(seat, decision.type)) {
      events.push(`${seat.name} upgrades a pong to a kong of ${tileGlyph(decision.type)}.`);
      const replacement = drawReplacementTile(state, seat);
      if (!replacement) {
        state.terminal = { type: "wallExhausted", winner: null, message: "The replacement wall is empty after the added kong." };
      } else {
        drawnTiles.push(replacement);
        events.push(`${seat.name} draws replacement ${tileGlyph(replacement)}.`);
        if (isWinningHand(seat.concealed, seat.melds)) {
          state.terminal = { type: "selfDraw", winner: seatIndex, message: `${seat.name} wins by drawing the replacement tile after an added kong.` };
        }
      }
    }
  } else if (decision.kind === "concealedKong") {
    applyConcealedKong(seat, decision.type);
    events.push(`${seat.name} declares a concealed kong of ${tileGlyph(decision.type)}.`);
    const replacement = drawReplacementTile(state, seat);
    if (!replacement) {
      state.terminal = { type: "wallExhausted", winner: null, message: "The replacement wall is empty after the concealed kong." };
    } else {
      drawnTiles.push(replacement);
      events.push(`${seat.name} draws replacement ${tileGlyph(replacement)}.`);
      if (isWinningHand(seat.concealed, seat.melds)) {
        state.terminal = { type: "selfDraw", winner: seatIndex, message: `${seat.name} wins by drawing the replacement tile after a concealed kong.` };
      }
    }
  }

  if (!state.terminal && state.userControl && seatIndex === 0
    && (decision.kind === "addedKong" || decision.kind === "concealedKong")) {
    state.turn = turnNumber;
    state.pendingUserDecision = buildUserTurnDecision(state, seatIndex, pendingCall, turnNumber, drawnTiles);
    return state;
  }

  if (!state.terminal) {
    handBeforeDiscard = sortTiles(seat.concealed);
    const discardDecision = decision.kind === "discard"
      ? decision
      : chooseTurnAction(state, seatIndex);
    if (discardDecision.kind === "discard" && discardDecision.tile) {
      discardOptions = discardDecision.discardOptions ?? [];
      equivalentDiscards = (discardDecision.candidate?.optimalDiscards ?? []).map(candidate => ({
        id: candidate.tile.id,
        type: candidate.tile.type
      }));
      const discarded = discardFromDecision(seat, discardDecision);
      if (discarded) {
        discardedTile = discarded;
        state.lastDiscard = { tile: discarded, fromSeat: seatIndex };
        events.push(`${seat.name} discards ${tileGlyph(discarded)}.`);
        const callResult = resolveDiscardCalls(state, seatIndex, discarded);
        if (callResult.call) {
          discardCallMade = true;
          callInfo = {
            seatIndex: state.activeSeat,
            kind: callResult.call.kind,
            explanation: callResult.call.explanation,
            takenTile: discarded,
            takenTileId: discarded.id,
            beforeCall: callResult.call.beforeCall,
            drawnTiles: callResult.replacement ? [callResult.replacement] : [],
            drawnTileIds: callResult.replacement ? [callResult.replacement.id] : []
          };
          state.pendingCall = callInfo;
          if (callResult.replacement) {
            events.push(`${state.players[state.activeSeat].name} draws a replacement tile.`);
          }
        }
      }
    }
  }

  if (!state.terminal && !discardCallMade && state.activeSeat === seatIndex) {
    state.activeSeat = nextSeat(seatIndex);
    state.needsDraw = true;
    state.canDeclareSelfDraw = false;
  }

  state.turn = turnNumber;
  state.lastAction = {
    turn: turnNumber,
    seatIndex,
    kind: actionKind,
    explanation,
    events,
    analysis: decision.beforeAnalysis,
    needed: summarizeNeeded(decision.beforeAnalysis),
    displaySeatIndex: seatIndex,
    handBeforeDiscard,
    drawnTiles: [...(pendingCall?.drawnTiles ?? []), ...drawnTiles],
    drawnTileIds: [...(pendingCall?.drawnTileIds ?? []), ...drawnTiles.map(tile => tile.id)],
    discardedTile,
    discardedTileId: discardedTile?.id ?? null,
    equivalentDiscards,
    discardOptions,
    call: callInfo,
    callFromPrevious: pendingCall
  };
  state.history.push(state.lastAction);
  return state;
}

export function formatNeededTiles(analysis) {
  return analysis.improvementTiles.map(item => `${item.glyph} ${item.name} (${item.remaining})`).join(" ") || "None currently visible";
}

export function seatLabel(seatIndex) {
  return SEAT_NAMES[seatIndex] ?? "Player";
}
