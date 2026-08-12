import {
  analyzePlayer,
  analyzeKeepableDraws,
  chooseBestDiscard,
  createGame,
  nextTurn,
  sortTiles,
  tileCode,
  tileEnglishName,
  tileGlyph,
  tileName
} from "./mahjong.js";

const BUILD_VERSION = __BUILD_VERSION__;
const decisionStrategy = "efficiency";

function createInitialState(seed) {
  const initialState = createGame(seed === undefined ? {} : { seed });
  initialState.decisionStrategy = decisionStrategy;
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

document.querySelector("#build-version").textContent = `Build ${BUILD_VERSION}`;

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
    "0101一萬.svg.webp", "0102二萬.svg.webp", "0103三萬.svg.webp", "0104四萬.svg.webp", "0105五萬.svg.webp", "0106六萬.svg.webp", "0107七萬.svg.webp", "0108八萬.svg.webp", "0109九萬.svg.webp",
    "0301一條.svg.webp", "0302二條.svg.webp", "0303三條.svg.webp", "0304四條.svg.webp", "0305五條.svg.webp", "0306六條.svg.webp", "0307七條.svg.webp", "0308八條.svg.webp", "0309九條.svg.webp",
    "0201一餅.svg.webp", "0202二餅.svg.webp", "0203三餅.svg.webp", "0204四餅.svg.webp", "0205五餅.svg.webp", "0206六餅.svg.webp", "0207七餅.svg.webp", "0208八餅.svg.webp", "0209九餅.svg.webp",
    null, null, "0403南風.svg.webp", "0404北風.svg.webp", "0405中.svg.webp", "0406發.svg.webp", "0407白.svg.webp"
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
  const glyph = hidden ? "🀫" : tileGlyph(type);
  const label = hidden ? "Concealed tile" : `${tileEnglishName(type)} ${tileName(type)}`;
  const family = type < 9 ? "tile-characters" : type < 18 ? "tile-bamboo" : type < 27 ? "tile-dots" : "tile-honor";
  const classes = ["tile", family, `tile-type-${type}`, compact ? "tile-compact" : "", claimed ? "tile-claimed" : "", drawn ? "tile-drawn" : "", discarded ? "tile-discard-target" : "", taken ? "tile-taken" : "", alternative ? "tile-alternative" : "", decision ? "tile-has-decision" : "", inline ? "tile-inline" : ""].filter(Boolean).join(" ");
  const decisionMarkup = decision ? `<span class="tile-decision-tooltip" role="tooltip"><span>${decision.comparison}</span></span>` : "";
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
    && lastAction.turn === 1
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
  elements.heldTileSummary.hidden = keepableDraws.length === 0;
  elements.heldCount.textContent = `${keepableCopies} live ${keepableCopies === 1 ? "tile" : "tiles"}`;
  elements.heldTile.innerHTML = needTilesMarkup(keepableDraws, "");
  renderEastAnalysis(analysis);
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

function needTilesMarkup(items, emptyMessage) {
  if (items.length === 0) {
    return `<p class="needs-empty">${emptyMessage}</p>`;
  }
  return items.map(item => `<div class="need-tile-card has-draw-discard" data-draw-type="${item.type}" tabindex="0" aria-label="${item.remaining} live tiles"><div>${tileMarkup({ type: item.type }, { compact: true })}</div><div class="need-tile-count"><strong>${item.remaining}</strong></div></div>`).join("");
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
  tooltip.innerHTML = discardTiles.map(tile => tileMarkup(tile, { compact: true })).join("");
  card.append(tooltip);
}

function renderEastAnalysis(analysis) {
  const sequenceTiles = analysis.improvementTiles.filter(item => item.createsSequence);
  const otherTiles = analysis.improvementTiles.filter(item => !item.createsSequence);
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
  const best = options.find(candidate => candidate.id === selectedId) ?? options[0];
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
  const hasDiscards = state.players.some(player => player.discards.length > 0);
  const publicMelds = state.players.slice(1).flatMap(player => player.melds.map(meld => ({ player, meld })));
  if (!hasDiscards && publicMelds.length === 0) {
    elements.riverGrid.innerHTML = "<div class=\"river-empty\">No tiles have entered the river yet.</div>";
    return;
  }
  const action = state.lastAction;
  const publicMeldTileIds = new Set(publicMelds.flatMap(({ meld }) => meld.tiles.map(tile => tile.id)));
  const historyDiscards = state.history.map(entry => entry.discardedTile).filter(Boolean);
  const historyIds = new Set(historyDiscards.map(tile => tile.id));
  const unrecordedDiscards = state.players.flatMap(player => player.discards).filter(tile => !historyIds.has(tile.id));
  const discardedTiles = [...historyDiscards, ...unrecordedDiscards].filter(tile => !publicMeldTileIds.has(tile.id));
  const meldMarkup = publicMelds.map(({ player, meld }) => {
    const label = meld.kind === "kong" ? "Kong" : "Pong";
    return `<span class="river-public-meld" title="${label} · ${player.name}">${meld.tiles.map(tile => tileMarkup(tile, { compact: true })).join("")}</span>`;
  }).join("");
  elements.riverGrid.innerHTML = `<div class="river-lane-tiles">${meldMarkup}${discardedTiles.map(tile => tileMarkup(tile, { compact: true, claimed: state.claimedDiscardIds.includes(tile.id), drawn: action?.drawnTileIds?.includes(tile.id), discarded: action?.discardedTileId === tile.id })).join("") || "<span class=\"empty-inline\">none</span>"}</div>`;
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

function promptHandTiles(action, reviewSeat) {
  const hand = [...(action?.handBeforeDiscard ?? reviewSeat.concealed)];
  const discardedTile = action?.discardedTile;
  if (!discardedTile || hand.some(tile => tile.id === discardedTile.id)) {
    return hand;
  }
  return sortTiles([...hand, discardedTile]);
}

function buildPositionPrompt() {
  const action = state.lastAction?.seatIndex === 0 ? state.lastAction : null;
  const reviewSeat = state.players[0];
  const currentPlayer = state.players[state.activeSeat];
  const promptHand = promptHandTiles(action, reviewSeat);
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
    "- Tile notation: m = characters, p = dots, s = bamboo; honors use east, south, west, north, red, green, white.",
    "- The reviewed discard may appear both in the pre-discard hand and East's discard row; it is the same physical tile and must be counted once."
  ];
  const moveLines = action
    ? [
        "Move under review:",
        `  Actor: ${reviewSeat.name}`,
        `  Draw this move: ${formatTileCodes(action.drawnTiles)}`,
        `  Discard this move: ${action.discardedTile ? describeTile(action.discardedTile) : `none (${action.kind})`}`,
        `  Description: ${action.discardedTile ? `${reviewSeat.name} throws ${describeTile(action.discardedTile)}.` : `${reviewSeat.name} makes a ${action.kind} action.`}`,
        ...(action.call ? [`  Response: ${state.players[action.call.seatIndex].name} calls ${action.call.kind} on ${describeTile(action.call.takenTile)}.`] : []),
        ...(action.callFromPrevious ? [`  Prior call: ${state.players[action.callFromPrevious.seatIndex].name} called ${action.callFromPrevious.kind} on ${describeTile(action.callFromPrevious.takenTile)}.`] : []),
        `  Simulation note: ${action.explanation}`
      ]
    : [
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
  const card = event.target instanceof Element ? event.target.closest(".need-tile-card.has-draw-discard") : null;
  if (card) {
    renderDrawDiscardTooltip(card);
  }
});

document.addEventListener("focusin", event => {
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
