import {
  analyzePlayer,
  analyzeKeepableDraws,
  chooseBestDiscard,
  createGame,
  nextTurn,
  tileCode,
  tileEnglishName,
  tileGlyph,
  tileName
} from "./mahjong.js";

function createInitialState(seed) {
  const initialState = createGame(seed === undefined ? {} : { seed });
  initialState.turn = 1;
  return nextTurn(initialState);
}

let state = createInitialState();
let timeline = [structuredClone(state)];

const elements = {
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
  copyPosition: document.querySelector("#copy-position"),
  copyPositionLabel: document.querySelector("#copy-position-label")
};

const DOT_POSITIONS = {
  1: [5],
  2: [2, 8],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
  7: [1, 3, 4, 5, 6, 7, 9],
  8: [1, 2, 3, 4, 6, 7, 8, 9],
  9: [1, 2, 3, 4, 5, 6, 7, 8, 9]
};

const BAMBOO_POSITIONS = {
  2: [2, 8],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
  7: [1, 3, 4, 5, 6, 7, 9],
  8: [1, 2, 3, 4, 6, 7, 8, 9],
  9: [1, 2, 3, 4, 5, 6, 7, 8, 9]
};

const TILE_ART_URLS = {
  0: "https://commons.wikimedia.org/wiki/Special:FilePath/0101%E4%B8%80%E8%90%AC.svg",
  1: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/0102%E4%BA%8C%E8%90%AC.svg/120px-0102%E4%BA%8C%E8%90%AC.svg.png",
  2: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/0103%E4%B8%89%E8%90%AC.svg/120px-0103%E4%B8%89%E8%90%AC.svg.png",
  3: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/0104%E5%9B%9B%E8%90%AC.svg/120px-0104%E5%9B%9B%E8%90%AC.svg.png",
  4: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/0105%E4%BA%94%E8%90%AC.svg/120px-0105%E4%BA%94%E8%90%AC.svg.png",
  5: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/0106%E5%85%AD%E8%90%AC.svg/120px-0106%E5%85%AD%E8%90%AC.svg.png",
  6: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/0107%E4%B8%83%E8%90%AC.svg/120px-0107%E4%B8%83%E8%90%AC.svg.png",
  7: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/0108%E5%85%AB%E8%90%AC.svg/120px-0108%E5%85%AB%E8%90%AC.svg.png",
  8: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/0109%E4%B9%9D%E8%90%AC.svg/120px-0109%E4%B9%9D%E8%90%AC.svg.png",
  9: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/0201%E4%B8%80%E9%A4%85.svg/120px-0201%E4%B8%80%E9%A4%85.svg.png",
  10: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/0202%E4%BA%8C%E9%A4%85.svg/120px-0202%E4%BA%8C%E9%A4%85.svg.png",
  11: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/0203%E4%B8%89%E9%A4%85.svg/120px-0203%E4%B8%89%E9%A4%85.svg.png",
  12: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/0204%E5%9B%9B%E9%A4%85.svg/120px-0204%E5%9B%9B%E9%A4%85.svg.png",
  13: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/0205%E4%BA%94%E9%A4%85.svg/120px-0205%E4%BA%94%E9%A4%85.svg.png",
  14: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/0206%E5%85%AD%E9%A4%85.svg/120px-0206%E5%85%AD%E9%A4%85.svg.png",
  15: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/0207%E4%B8%83%E9%A4%85.svg/120px-0207%E4%B8%83%E9%A4%85.svg.png",
  16: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/0208%E5%85%AB%E9%A4%85.svg/120px-0208%E5%85%AB%E9%A4%85.svg.png",
  17: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/0209%E4%B9%9D%E9%A4%85.svg/120px-0209%E4%B9%9D%E9%A4%85.svg.png",
  18: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/0301%E4%B8%80%E6%A2%9D.svg/120px-0301%E4%B8%80%E6%A2%9D.svg.png",
  19: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/0302%E4%BA%8C%E6%A2%9D.svg/120px-0302%E4%BA%8C%E6%A2%9D.svg.png",
  20: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/0303%E4%B8%89%E6%A2%9D.svg/120px-0303%E4%B8%89%E6%A2%9D.svg.png",
  21: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/0304%E5%9B%9B%E6%A2%9D.svg/120px-0304%E5%9B%9B%E6%A2%9D.svg.png",
  22: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/0305%E4%BA%94%E6%A2%9D.svg/120px-0305%E4%BA%94%E6%A2%9D.svg.png",
  23: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/0306%E5%85%AD%E6%A2%9D.svg/120px-0306%E5%85%AD%E6%A2%9D.svg.png",
  24: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/0307%E4%B8%83%E6%A2%9D.svg/120px-0307%E4%B8%83%E6%A2%9D.svg.png",
  25: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/0308%E5%85%AB%E6%A2%9D.svg/120px-0308%E5%85%AB%E6%A2%9D.svg.png",
  26: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/0309%E4%B9%9D%E6%A2%9D.svg/120px-0309%E4%B9%9D%E6%A2%9D.svg.png",
  27: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/0401%E6%9D%B1%E9%A2%A8.svg/120px-0401%E6%9D%B1%E9%A2%A8.svg.png",
  28: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/0403%E5%8D%97%E9%A2%A8.svg/120px-0403%E5%8D%97%E9%A2%A8.svg.png",
  29: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/0402%E8%A5%BF%E9%A2%A8.svg/120px-0402%E8%A5%BF%E9%A2%A8.svg.png",
  30: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/0404%E5%8C%97%E9%A2%A8.svg/120px-0404%E5%8C%97%E9%A2%A8.svg.png",
  31: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/0405%E4%B8%AD.svg/120px-0405%E4%B8%AD.svg.png",
  32: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/0406%E7%99%BC.svg/120px-0406%E7%99%BC.svg.png",
  33: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/0407%E7%99%BD.svg/120px-0407%E7%99%BD.svg.png"
};

function localTileArtPath(type) {
  return `./assets/tiles/tile-${String(type).padStart(2, "0")}.png`;
}

function tileFaceMarkup(type, glyph, hidden) {
  if (hidden) {
    return `<span class="tile-face tile-back">${glyph}</span>`;
  }
  if (TILE_ART_URLS[type]) {
    return `<img class="tile-art" src="${localTileArtPath(type)}" data-fallback="${TILE_ART_URLS[type]}" alt="" draggable="false" onerror="this.onerror=null;this.src=this.dataset.fallback">`;
  }
  if (type >= 18 && type < 27) {
    const rank = type - 17;
    const pips = DOT_POSITIONS[rank].map(position => {
      const row = Math.floor((position - 1) / 3);
      return `<span class="dot-pip dot-position-${position} dot-row-${row}"></span>`;
    }).join("");
    return `<span class="tile-face tile-dots-face tile-dots-rank-${rank}" aria-hidden="true">${pips}</span>`;
  }
  if (type >= 9 && type < 18) {
    const rank = type - 8;
    if (rank === 1) {
      return `<span class="tile-face tile-bamboo-one">${glyph}</span>`;
    }
    const sticks = BAMBOO_POSITIONS[rank].map(position => `<span class="bamboo-stick bamboo-position-${position}"></span>`).join("");
    return `<span class="tile-face tile-bamboo-face tile-bamboo-rank-${rank}" aria-hidden="true">${sticks}</span>`;
  }
  return `<span class="tile-face">${glyph}</span>`;
}

function tileMarkup(tile, { compact = false, claimed = false, drawn = false, discarded = false, taken = false, alternative = false, decision = null, inline = false, hidden = false } = {}) {
  const type = tile.type ?? tile;
  const glyph = hidden ? "🀫" : tileGlyph(type);
  const label = hidden ? "Concealed tile" : `${tileEnglishName(type)} ${tileName(type)}`;
  const family = type < 9 ? "tile-characters" : type < 18 ? "tile-bamboo" : type < 27 ? "tile-dots" : "tile-honor";
  const classes = ["tile", family, `tile-type-${type}`, compact ? "tile-compact" : "", claimed ? "tile-claimed" : "", drawn ? "tile-drawn" : "", discarded ? "tile-discard-target" : "", taken ? "tile-taken" : "", alternative ? "tile-alternative" : "", decision ? "tile-has-decision" : "", inline ? "tile-inline" : ""].filter(Boolean).join(" ");
  const decisionMarkup = decision ? `<span class="tile-decision-tooltip" role="tooltip"><strong>${decision.status}</strong><span>${decision.comparison}</span><small>${decision.structure} · ${decision.metrics}</small></span>` : "";
  const discardMarker = discarded ? "<span class=\"discard-marker\" aria-hidden=\"true\"></span>" : "";
  return `<span class="${classes}" title="${label}"${decision ? " tabindex=\"0\"" : ""} aria-label="${label}">${tileFaceMarkup(type, glyph, hidden)}${discardMarker}${decisionMarkup}</span>`;
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
  return seat.melds.map(meld => {
    const label = meld.kind === "kong" ? "Kong" : "Pong";
    return `<span class="meld-group" title="${label}${meld.open ? " · open" : " · concealed"}"><span class="meld-label">${label}</span>${meld.tiles.map(tile => tileMarkup(tile, { compact: true, taken: tile.id === takenTileId })).join("")}</span>`;
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
  const openingAction = lastAction?.seatIndex === 0
    && lastAction.turn === 2
    && !(lastAction.drawnTiles?.length);
  const openingTile = handTiles.length === 14
    && ((!lastAction && state.turn === 0) || openingAction)
    ? handTiles[handTiles.length - 1]
    : null;
  const newTileIds = drawnTileIds.length ? drawnTileIds : openingTile ? [openingTile.id] : [];
  const displayHandTiles = handTiles.filter(tile => !newTileIds.includes(tile.id));
  const displayDrawnTiles = handTiles.filter(tile => newTileIds.includes(tile.id));
  const discardedTileId = showingPreDiscardHand ? lastAction.discardedTileId : null;
  const discardOptions = showingPreDiscardHand ? lastAction?.discardOptions ?? [] : [];
  const discardOptionByType = new Map(discardOptions.map(option => [option.type, option]));
  const selectedDiscardType = lastAction?.discardedTile?.type ?? null;
  const equivalentDiscardTypes = new Set((lastAction?.equivalentDiscards ?? []).map(tile => tile.type));
  const winner = state.terminal?.winner === 0;
  const stateLabel = state.terminal
    ? winner ? "Winner" : "Finished"
    : active
      ? showingPreDiscardHand ? "Throw marked" : state.needsDraw ? "Draw next" : "Choose discard"
      : next ? state.needsDraw ? "Next draw" : "Next discard" : "Waiting";

  card.classList.toggle("is-active", active);
  card.classList.toggle("is-next", next);
  card.classList.toggle("is-winner", winner);
  card.classList.toggle("is-finished", Boolean(state.terminal) && !winner);
  card.setAttribute("aria-current", active ? "step" : "false");
  document.querySelector("#seat-state-0").textContent = stateLabel;
  document.querySelector("#seat-distance-0").textContent = `${distanceMarkup(analysis)} to win`;
  const compactHandLayout = card.querySelector(".compact-hand-layout");
  compactHandLayout.classList.toggle("has-melds", seat.melds.length > 0);
  document.querySelector("#hand-0").innerHTML = displayHandTiles.map(tile => tileMarkup(tile, {
    drawn: drawnTileIds.includes(tile.id),
    discarded: discardedTileId === tile.id,
    alternative: equivalentDiscardTypes.has(tile.type) && tile.type !== selectedDiscardType,
    decision: discardOptionByType.get(tile.type) ? buildTileDecision(discardOptionByType.get(tile.type), discardOptions, discardedTileId) : null
  })).join("");
  document.querySelector("#melds-0").innerHTML = renderMelds(seat);
  elements.newTile.innerHTML = displayDrawnTiles.map(tile => tileMarkup(tile, {
    drawn: true,
    discarded: discardedTileId === tile.id
  })).join("");
  const improvementTypes = new Set(analysis.improvementTiles.map(item => item.type));
  const keepableDraws = analyzeKeepableDraws(state, 0).tiles.filter(item => !improvementTypes.has(item.type));
  const keepableCopies = keepableDraws.reduce((total, item) => total + item.remaining, 0);
  const drawHand = analyzedHandForDraws(analysis);
  const drawMelds = seat.melds;
  elements.heldTileSummary.hidden = keepableDraws.length === 0;
  elements.heldCount.textContent = `${keepableCopies} live ${keepableCopies === 1 ? "tile" : "tiles"}`;
  elements.heldTile.innerHTML = needTilesMarkup(keepableDraws, "", drawHand, drawMelds, analysis.visibleCounts);
  renderEastAnalysis(analysis);
}

function renderOpponentSeat(seatIndex) {
  const seat = state.players[seatIndex];
  const card = document.querySelector(`#opponent-${seatIndex}`);
  const lastAction = state.lastAction;
  const focusSeatIndex = lastAction?.displaySeatIndex ?? state.activeSeat;
  const active = !state.terminal && focusSeatIndex === seatIndex;
  const next = !state.terminal && Boolean(lastAction) && state.activeSeat === seatIndex && !active;
  const winner = state.terminal?.winner === seatIndex;
  const stateLabel = state.terminal
    ? winner ? "Winner" : "Finished"
    : active ? "Acting" : next ? "Next" : "Waiting";

  card.classList.toggle("is-active", active);
  card.classList.toggle("is-next", next);
  card.classList.toggle("is-winner", winner);
  card.classList.toggle("is-finished", Boolean(state.terminal) && !winner);
  document.querySelector(`#opponent-label-${seatIndex}`).textContent = `${seat.name} [${seat.concealed.length}]:`;
  document.querySelector(`#opponent-melds-${seatIndex}`).innerHTML = renderMelds(seat);
}

function analyzedHandForDraws(analysis) {
  const seat = state.players[0];
  if (state.activeSeat === 0 && !state.needsDraw && !state.terminal) {
    return chooseBestDiscard(seat.concealed, seat.melds, analysis.visibleCounts)?.remaining ?? seat.concealed;
  }
  return seat.concealed;
}

function discardTilesForDraw(item, hand, melds, visibleCounts) {
  const decision = chooseBestDiscard([...hand, { id: -1, type: item.type }], melds, visibleCounts);
  if (!decision) {
    return [];
  }
  const seen = new Set();
  return decision.optimalDiscards
    .map(candidate => candidate.tile)
    .filter(tile => {
      if (seen.has(tile.type)) {
        return false;
      }
      seen.add(tile.type);
      return true;
    });
}

function needTilesMarkup(items, emptyMessage, hand, melds, visibleCounts) {
  if (items.length === 0) {
    return `<p class="needs-empty">${emptyMessage}</p>`;
  }
  return items.map(item => {
    const discardTiles = discardTilesForDraw(item, hand, melds, visibleCounts);
    const tooltip = discardTiles.length
      ? `<span class="draw-discard-tooltip" role="tooltip" aria-hidden="true">${discardTiles.map(tile => tileMarkup(tile, { compact: true })).join("")}</span>`
      : "";
    return `<div class="need-tile-card${discardTiles.length ? " has-draw-discard" : ""}"${discardTiles.length ? " tabindex=\"0\"" : ""} aria-label="${item.remaining} live tiles"><div>${tileMarkup({ type: item.type }, { compact: true })}</div><div class="need-tile-count"><strong>${item.remaining}</strong></div>${tooltip}</div>`;
  }).join("");
}

function renderEastAnalysis(analysis) {
  const sequenceTiles = analysis.improvementTiles.filter(item => item.createsSequence);
  const otherTiles = analysis.improvementTiles.filter(item => !item.createsSequence);
  elements.analysisImprovementCount.textContent = `${analysis.improvementCopies} live`;
  const sequenceCopies = sequenceTiles.reduce((total, item) => total + item.remaining, 0);
  const otherCopies = otherTiles.reduce((total, item) => total + item.remaining, 0);
  const drawHand = analyzedHandForDraws(analysis);
  const drawMelds = state.players[0].melds;
  elements.sequenceCount.textContent = `${sequenceCopies} live ${sequenceCopies === 1 ? "copy" : "copies"}`;
  elements.otherCount.textContent = `${otherCopies} live ${otherCopies === 1 ? "copy" : "copies"}`;
  elements.sequenceTiles.innerHTML = needTilesMarkup(sequenceTiles, "No live draw creates a new sequence.", drawHand, drawMelds, analysis.visibleCounts);
  elements.otherTiles.innerHTML = otherTiles.length ? needTilesMarkup(otherTiles, "", drawHand, drawMelds, analysis.visibleCounts) : "";
}

function buildTileDecision(option, options, selectedId) {
  const selected = option.id === selectedId;
  const best = options.find(candidate => candidate.id === selectedId) ?? options[0];
  const metrics = `${option.tilesAway} away · ${option.improvementCopies} live copies · ${option.improvementTypes} tile types`;
  if (selected) {
    return {
      status: "Chosen throw",
      comparison: "This is the deterministic best path from the visible hand and public tiles.",
      structure: option.structure,
      metrics
    };
  }
  if (option.equivalent) {
    return {
      status: "Equivalent throw",
      comparison: "It preserves the same completion distance, live improvement count, and structural quality as the selected throw.",
      structure: option.structure,
      metrics
    };
  }
  let comparison;
  if (option.tilesAway > best.tilesAway) {
    comparison = `Keep it: throwing this leaves the hand ${option.tilesAway} tiles away instead of ${best.tilesAway}.`;
  } else if (option.improvementCopies < best.improvementCopies) {
    comparison = `Keep it: the distance ties, but it leaves only ${option.improvementCopies} live improvement copies instead of ${best.improvementCopies}.`;
  } else if (option.improvementTypes < best.improvementTypes) {
    comparison = `Keep it: the distance ties, but it has only ${option.improvementTypes} improvement tile types instead of ${best.improvementTypes}.`;
  } else {
    comparison = "Keep it: its pair or sequence structure is stronger than the selected throw.";
  }
  return {
    status: "Keep this tile",
    comparison,
    structure: option.structure,
    metrics
  };
}

function renderEvents() {
  const events = state.lastAction?.events ?? [];
  elements.eventList.innerHTML = events.length
    ? events.map(event => `<div class="event-line"><span aria-hidden="true">•</span>${event}</div>`).join("")
    : "";
}

function renderPublicRiver() {
  const hasDiscards = state.players.some(player => player.discards.length > 0);
  if (!hasDiscards) {
    elements.riverGrid.innerHTML = "<div class=\"river-empty\">No tiles have entered the river yet.</div>";
    return;
  }
  const action = state.lastAction;
  const historyDiscards = state.history.map(entry => entry.discardedTile).filter(Boolean);
  const historyIds = new Set(historyDiscards.map(tile => tile.id));
  const unrecordedDiscards = state.players.flatMap(player => player.discards).filter(tile => !historyIds.has(tile.id));
  const discardedTiles = [...historyDiscards, ...unrecordedDiscards];
  elements.riverGrid.innerHTML = `<div class="river-lane-tiles">${discardedTiles.map(tile => tileMarkup(tile, { compact: true, claimed: state.claimedDiscardIds.includes(tile.id), drawn: action?.drawnTileIds?.includes(tile.id), discarded: action?.discardedTileId === tile.id })).join("") || "<span class=\"empty-inline\">none</span>"}</div>`;
}

function actionTilesMarkup(tiles, options = {}) {
  return tiles?.length
    ? tiles.map(tile => `<span class="action-tile">${tileMarkup(tile, { inline: true, ...options })}</span>`).join("")
    : "";
}

function renderActionSummary() {
  const action = state.lastAction;
  renderEquivalentDiscards(action);
  if (!action) {
    elements.drawSummary.innerHTML = "<span class=\"action-empty\">Opening hand</span>";
    elements.throwSummary.innerHTML = "<span class=\"action-empty\">Choose a discard</span>";
    return;
  }

  if (action.callFromPrevious) {
    const taken = action.callFromPrevious.takenTile ? actionTilesMarkup([action.callFromPrevious.takenTile], { taken: true }) : "";
    const replacement = actionTilesMarkup(action.callFromPrevious.drawnTiles, { drawn: true });
    elements.drawSummary.innerHTML = `${taken}${replacement}<small class="action-note">taken${replacement ? " + replacement" : ""}</small>`;
    elements.throwSummary.innerHTML = action.discardedTile
      ? actionTilesMarkup([action.discardedTile], { discarded: true })
      : "<span class=\"action-empty\">Winning hand</span>";
    return;
  }

  elements.drawSummary.innerHTML = actionTilesMarkup(action.drawnTiles, { drawn: true }) || "<span class=\"action-empty\">No draw · opening hand</span>";
  elements.throwSummary.innerHTML = action.discardedTile
    ? actionTilesMarkup([action.discardedTile], { discarded: true })
    : "<span class=\"action-empty\">Winning hand</span>";
}

function renderEquivalentDiscards(action) {
  const equivalents = action?.equivalentDiscards ?? [];
  const visible = equivalents.length > 1;
  elements.equivalentSummary.hidden = !visible;
  elements.equivalentThrows.innerHTML = visible ? actionTilesMarkup(equivalents, { alternative: true }) : "";
}

function renderBoardStatus() {
  const activePlayer = state.players[state.activeSeat];
  const displayedPlayer = state.players[state.lastAction?.displaySeatIndex ?? state.activeSeat];
  const pendingCallDisplay = Boolean(state.lastAction?.call && !state.lastAction?.callFromPrevious);
  elements.turn.textContent = state.turn;
  elements.liveWall.textContent = state.liveWall.length;
  elements.liveWallMeter.style.width = `${Math.max(0, Math.min(100, (state.liveWall.length / 69) * 100))}%`;

  if (state.terminal) {
    elements.boardTitle.textContent = state.terminal.winner === null ? "Table complete" : `${state.players[state.terminal.winner].name} wins`;
    elements.next.disabled = true;
  } else {
    elements.boardTitle.textContent = pendingCallDisplay ? `${displayedPlayer.name} just acted` : `${activePlayer.name} to act`;
    elements.next.disabled = false;
  }
  elements.previous.disabled = timeline.length <= 1;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function explanationMarkup(text) {
  let markup = escapeHtml(text);
  for (let type = 0; type < 34; type += 1) {
    markup = markup.split(tileGlyph(type)).join(tileMarkup({ type }, { inline: true }));
  }
  return markup;
}

function renderExplanation() {
  const explanation = state.lastAction?.explanation;
  elements.explanation.innerHTML = explanationMarkup(explanation || "East begins with the only fourteen-tile hand. Press Next to inspect the first public-information decision.");
}

function positionTooltip(anchor) {
  const tooltip = anchor.querySelector(".needed-preview, .tile-decision-tooltip");
  if (!tooltip) {
    return;
  }

  const anchorRect = anchor.getBoundingClientRect();
  const viewportPadding = 12;
  const gap = 12;
  const prefersAbove = tooltip.classList.contains("tile-decision-tooltip");
  tooltip.style.position = "absolute";
  tooltip.style.left = "0px";
  tooltip.style.top = "0px";
  tooltip.style.right = "auto";
  tooltip.style.bottom = "auto";
  tooltip.style.transform = "none";

  const tooltipRect = tooltip.getBoundingClientRect();
  const spaceAbove = anchorRect.top - viewportPadding;
  const spaceBelow = window.innerHeight - anchorRect.bottom - viewportPadding;
  const fitsAbove = spaceAbove >= tooltipRect.height + gap;
  const fitsBelow = spaceBelow >= tooltipRect.height + gap;
  const placeAbove = prefersAbove ? fitsAbove || !fitsBelow : !fitsBelow && fitsAbove;
  let top = placeAbove
    ? anchorRect.top - tooltipRect.height - gap
    : anchorRect.bottom + gap;
  let left = anchorRect.left + ((anchorRect.width - tooltipRect.width) / 2);

  top = Math.max(viewportPadding, Math.min(top, window.innerHeight - viewportPadding - tooltipRect.height));
  left = Math.max(viewportPadding, Math.min(left, window.innerWidth - viewportPadding - tooltipRect.width));
  tooltip.style.left = `${Math.round(left - anchorRect.left)}px`;
  tooltip.style.top = `${Math.round(top - anchorRect.top)}px`;
}

function tooltipAnchor(target) {
  return target instanceof Element ? target.closest(".needed-summary-trigger, .tile-has-decision") : null;
}

function repositionVisibleTooltips() {
  document.querySelectorAll(".needed-summary-trigger:hover, .needed-summary-trigger:focus-visible, .tile-has-decision:hover, .tile-has-decision:focus-visible").forEach(positionTooltip);
}

function formatTileCodes(tiles, { markClaimed = false } = {}) {
  if (!tiles?.length) {
    return "none";
  }
  return tiles.map(tile => `${tileCode(tile)}${markClaimed && state.claimedDiscardIds.includes(tile.id) ? "*" : ""}`).join(" ");
}

function formatMelds(melds) {
  if (!melds?.length) {
    return "none";
  }
  return melds.map(meld => `${meld.kind} [${formatTileCodes(meld.tiles)}]`).join("; ");
}

function describeTile(tile) {
  return `${tileCode(tile)} (${tileEnglishName(tile)})`;
}

function buildPositionPrompt() {
  const action = state.lastAction?.seatIndex === 0 ? state.lastAction : null;
  const reviewSeat = state.players[0];
  const currentPlayer = state.players[state.activeSeat];
  const boardLines = state.players.map(player => `  ${player.name}: ${formatTileCodes(player.discards, { markClaimed: true })}`);
  const meldLines = state.players.map(player => `  ${player.name}: ${formatMelds(player.melds)}`);
  const rules = [
    "Rules:",
    "- 136 tiles: four copies each of 34 tile types; no flowers.",
    "- The winning shape is four melds and one pair.",
    "- Chow calls are not allowed; legal pong and kong calls are considered.",
    "- Wins are by self-draw, except for robbing an added kong; ordinary discard wins are not used.",
    "- Decisions use only the acting hand and public tiles; opponent concealed hands are hidden.",
    "- No scores are tracked.",
    "- Tile notation: m = characters, p = dots, s = bamboo; honors use east, south, west, north, red, green, white."
  ];
  const moveLines = action
    ? [
        "Move under review:",
        `  Actor: ${reviewSeat.name}`,
        `  Throw: ${action.discardedTile ? describeTile(action.discardedTile) : `none (${action.kind})`}`,
        `  Description: ${action.discardedTile ? `${reviewSeat.name} throws ${describeTile(action.discardedTile)}.` : `${reviewSeat.name} makes a ${action.kind} action.`}`,
        ...(action.call ? [`  Response: ${state.players[action.call.seatIndex].name} calls ${action.call.kind} on ${describeTile(action.call.takenTile)}.`] : []),
        ...(action.callFromPrevious ? [`  Prior call: ${state.players[action.callFromPrevious.seatIndex].name} called ${action.callFromPrevious.kind} on ${describeTile(action.callFromPrevious.takenTile)}.`] : []),
        `  Simulation note: ${action.explanation}`,
        `Question: Why is this the best move for ${reviewSeat.name}? Compare it with the other legal discards or calls and explain the hand-building tradeoffs.`
      ]
    : [
        "Move under review:",
        "  Actor: East",
        "  Throw: no East move recorded at this position.",
        "  Description: East's concealed hand is the only private hand included.",
        "Question: What should East do next, and why? Compare the legal alternatives using only public information."
      ];

  return [
    ...rules,
    "",
    `Turn: ${state.turn}`,
    `Player to act next: ${currentPlayer.name}`,
    `Live wall: ${state.liveWall.length}`,
    `Replacement tiles: ${state.replacementWall.length}`,
    "",
    "Current public board (discards):",
    ...boardLines,
    "",
    "Current public melds:",
    ...meldLines,
    "",
    "East hand used for analysis:",
    `  Concealed: ${formatTileCodes(action?.handBeforeDiscard ?? reviewSeat.concealed)}`,
    `  Open melds: ${formatMelds(reviewSeat.melds)}`,
    "",
    ...moveLines,
    "",
    "* claimed discard"
  ].join("\n");
}

function render() {
  renderEastSeat();
  for (let seatIndex = 1; seatIndex < state.players.length; seatIndex += 1) {
    renderOpponentSeat(seatIndex);
  }
  renderBoardStatus();
  renderPublicRiver();
}

elements.next.addEventListener("click", () => {
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

document.addEventListener("keydown", event => {
  const target = event.target;
  const isEditing = target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target.isContentEditable;
  if (isEditing || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) {
    return;
  }

  event.preventDefault();
  if (event.key === "ArrowLeft") {
    elements.previous.click();
  } else if (event.key === "ArrowRight") {
    elements.next.click();
  }
});

document.addEventListener("pointerover", event => {
  const anchor = tooltipAnchor(event.target);
  if (anchor && !(event.relatedTarget instanceof Node && anchor.contains(event.relatedTarget))) {
    positionTooltip(anchor);
  }
});

document.addEventListener("focusin", event => {
  const anchor = tooltipAnchor(event.target);
  if (anchor) {
    positionTooltip(anchor);
  }
});

document.addEventListener("scroll", repositionVisibleTooltips, true);
window.addEventListener("resize", repositionVisibleTooltips);

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
