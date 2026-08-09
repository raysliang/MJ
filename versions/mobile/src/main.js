import {
  analyzePlayer,
  createGame,
  nextTurn,
  tileCode,
  tileEnglishName,
  tileGlyph,
  tileName
} from "./mahjong.js";

let state = createGame();
let timeline = [structuredClone(state)];

const elements = {
  next: document.querySelector("#next-turn"),
  previous: document.querySelector("#previous-turn"),
  newDeal: document.querySelector("#new-deal"),
  turn: document.querySelector("#turn-number"),
  liveWall: document.querySelector("#live-wall-count"),
  liveWallMeter: document.querySelector("#live-wall-meter"),
  replacement: document.querySelector("#replacement-count"),
  dealSeed: document.querySelector("#deal-seed"),
  boardTitle: document.querySelector("#board-title"),
  riverGrid: document.querySelector("#river-grid"),
  analysisDistance: document.querySelector("#analysis-distance"),
  analysisImprovementCount: document.querySelector("#analysis-improvement-count"),
  analysisKnownCount: document.querySelector("#analysis-known-count"),
  analysisNote: document.querySelector("#analysis-note"),
  sequenceCount: document.querySelector("#sequence-count"),
  otherCount: document.querySelector("#other-count"),
  sequenceTiles: document.querySelector("#sequence-tiles"),
  otherTiles: document.querySelector("#other-tiles"),
  copyPosition: document.querySelector("#copy-position"),
  copyPositionLabel: document.querySelector("#copy-position-label")
};

const DOT_POSITIONS = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
  7: [1, 3, 4, 5, 6, 7, 9],
  8: [1, 2, 3, 4, 6, 7, 8, 9],
  9: [1, 2, 3, 4, 5, 6, 7, 8, 9]
};

function tileFaceMarkup(type, glyph, hidden) {
  if (hidden) {
    return `<span class="tile-face tile-back">${glyph}</span>`;
  }
  if (type >= 18 && type < 27) {
    const rank = type - 17;
    const pips = DOT_POSITIONS[rank].map((position, index) => `<span class="dot-pip dot-position-${position} dot-tone-${index % 5}"></span>`).join("");
    return `<span class="tile-face tile-dots-face" aria-hidden="true">${pips}</span>`;
  }
  return `<span class="tile-face">${glyph}</span>`;
}

function tileMarkup(tile, { compact = false, claimed = false, drawn = false, discarded = false, taken = false, alternative = false, decision = null, inline = false, hidden = false } = {}) {
  const type = tile.type ?? tile;
  const glyph = hidden ? "🀫" : tileGlyph(type);
  const label = hidden ? "Concealed tile" : `${tileEnglishName(type)} ${tileName(type)}`;
  const family = type < 9 ? "tile-characters" : type < 18 ? "tile-bamboo" : type < 27 ? "tile-dots" : "tile-honor";
  const classes = ["tile", family, compact ? "tile-compact" : "", claimed ? "tile-claimed" : "", drawn ? "tile-drawn" : "", discarded ? "tile-discard-target" : "", taken ? "tile-taken" : "", alternative ? "tile-alternative" : "", decision ? "tile-has-decision" : "", inline ? "tile-inline" : ""].filter(Boolean).join(" ");
  const decisionMarkup = decision ? `<span class="tile-decision-tooltip" role="tooltip"><strong>${decision.status}</strong><span>${decision.comparison}</span><small>${decision.structure} · ${decision.metrics}</small></span>` : "";
  return `<span class="${classes}" title="${label}"${decision ? " tabindex=\"0\"" : ""} aria-label="${label}">${tileFaceMarkup(type, glyph, hidden)}${decisionMarkup}</span>`;
}

function distanceMarkup(analysis) {
  if (analysis.complete) {
    return "Complete";
  }
  return `${analysis.tilesAway} ${analysis.tilesAway === 1 ? "tile" : "tiles"}`;
}

function renderMelds(seat, takenTileId = null) {
  if (seat.melds.length === 0) {
    return "<span class=\"empty-inline\">none</span>";
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
  document.querySelector("#seat-distance-0").textContent = distanceMarkup(analysis);
  document.querySelector("#hand-count-0").textContent = `${handTiles.length} ${handTiles.length === 1 ? "tile" : "tiles"}`;
  document.querySelector("#hand-0").innerHTML = handTiles.map(tile => tileMarkup(tile, {
    drawn: drawnTileIds.includes(tile.id),
    discarded: discardedTileId === tile.id,
    alternative: equivalentDiscardTypes.has(tile.type) && tile.type !== selectedDiscardType,
    decision: discardOptionByType.get(tile.type) ? buildTileDecision(discardOptionByType.get(tile.type), discardOptions, discardedTileId) : null
  })).join("");
  document.querySelector("#melds-0").innerHTML = renderMelds(seat);
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
  document.querySelector(`#opponent-state-${seatIndex}`).textContent = stateLabel;
  document.querySelector(`#opponent-meld-count-${seatIndex}`).textContent = seat.melds.length;
  document.querySelector(`#opponent-melds-${seatIndex}`).innerHTML = renderMelds(seat);
}

function needTilesMarkup(items, emptyMessage) {
  if (items.length === 0) {
    return `<p class="needs-empty">${emptyMessage}</p>`;
  }
  return items.map(item => `<div class="need-tile-card"><div>${tileMarkup({ type: item.type }, { compact: true })}</div><div class="need-tile-count"><strong>${item.remaining}</strong><span>${item.remaining === 1 ? "copy" : "copies"} left</span></div></div>`).join("");
}

function renderEastAnalysis(analysis) {
  const sequenceTiles = analysis.improvementTiles.filter(item => item.createsSequence);
  const otherTiles = analysis.improvementTiles.filter(item => !item.createsSequence);
  const knownCount = analysis.visibleCounts.reduce((total, count) => total + count, 0);
  elements.analysisDistance.textContent = distanceMarkup(analysis);
  elements.analysisImprovementCount.textContent = analysis.improvementCopies;
  elements.analysisKnownCount.textContent = knownCount;
  elements.analysisNote.textContent = state.activeSeat === 0 && !state.needsDraw && !state.terminal
    ? "At a discard decision, these counts describe the hand after the recommended throw."
    : "The counts include East's hand, every discard, and every exposed meld or kong.";
  const sequenceCopies = sequenceTiles.reduce((total, item) => total + item.remaining, 0);
  const otherCopies = otherTiles.reduce((total, item) => total + item.remaining, 0);
  elements.sequenceCount.textContent = `${sequenceCopies} live ${sequenceCopies === 1 ? "copy" : "copies"}`;
  elements.otherCount.textContent = `${otherCopies} live ${otherCopies === 1 ? "copy" : "copies"}`;
  elements.sequenceTiles.innerHTML = needTilesMarkup(sequenceTiles, "No live draw creates a new sequence.");
  elements.otherTiles.innerHTML = needTilesMarkup(otherTiles, "No other live draw improves the hand.");
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
  elements.riverGrid.innerHTML = state.players.map(player => `<div class="river-lane"><div class="river-lane-label"><span>${player.name}</span><small>${player.discards.length}</small></div><div class="river-lane-tiles">${player.discards.map(tile => tileMarkup(tile, { compact: true, claimed: state.claimedDiscardIds.includes(tile.id), drawn: action?.drawnTileIds?.includes(tile.id), discarded: action?.discardedTileId === tile.id })).join("") || "<span class=\"empty-inline\">none</span>"}</div></div>`).join("");
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
  elements.replacement.textContent = state.replacementWall.length;
  elements.dealSeed.textContent = state.seed;

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
  state = createGame({ seed: Date.now() });
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
