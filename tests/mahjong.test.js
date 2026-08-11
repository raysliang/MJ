import test from "node:test";
import assert from "node:assert/strict";
import {
  TILE_TYPES,
  analyzeHand,
  calculateShanten,
  chooseBestDiscard,
  chooseTurnAction,
  createDeck,
  createGame,
  evaluateDiscardCall,
  getPublicCounts,
  isWinningHand,
  nextTurn,
  tileCounts
} from "../src/mahjong.js";

const tile = type => ({ id: type * 4, type });
const hand = types => types.map(tile);

function emptyState(players) {
  return {
    players,
    liveWall: [],
    replacementWall: [],
    activeSeat: 0,
    needsDraw: false,
    turn: 0,
    terminal: null,
    lastDiscard: null,
    lastAction: null,
    claimedDiscardIds: [],
    history: []
  };
}

test("the deck has four copies of 34 non-flower tile types", () => {
  const deck = createDeck();
  assert.equal(deck.length, 136);
  assert.deepEqual(tileCounts(deck), Array(34).fill(4));
  assert.equal(TILE_TYPES.length, 34);
  assert.equal(TILE_TYPES.some(item => item.name.includes("花")), false);
});

test("standard deal gives East fourteen tiles and others thirteen", () => {
  const state = createGame({ seed: 7 });
  assert.deepEqual(state.players.map(player => player.concealed.length), [14, 13, 13, 13]);
  assert.equal(state.liveWall.length + state.replacementWall.length, 83);
  assert.equal(state.replacementWall.length, 14);
});

test("standard hands with concealed sequences are complete", () => {
  const winning = hand([
    0, 1, 2,
    9, 10, 11,
    18, 19, 20,
    27, 27, 27,
    31, 31
  ]);
  assert.equal(isWinningHand(winning), true);
  assert.equal(calculateShanten(tileCounts(winning)), -1);
});

test("open melds reduce the concealed hand target", () => {
  const concealed = hand([0, 1, 2, 9, 10, 11, 18, 19, 20, 31, 31]);
  const melds = [{ kind: "pong", type: 27, open: true, tiles: hand([27, 27, 27]) }];
  assert.equal(isWinningHand(concealed, melds), true);
});

test("analysis returns tiles away and publicly remaining improvement tiles", () => {
  const concealed = hand([
    0, 1, 2,
    9, 10, 11,
    18, 19, 20,
    27, 27, 27,
    31
  ]);
  const visible = tileCounts(concealed);
  const analysis = analyzeHand(concealed, [], visible);
  assert.equal(analysis.tilesAway, 1);
  assert.equal(analysis.improvementTiles.some(item => item.type === 31), true);
  assert.equal(analysis.improvementTiles.find(item => item.type === 31).remaining, 3);
  assert.equal(analysis.winningTiles.some(item => item.type === 31), true);
  assert.equal(analysis.winningCopies, 3);
});

test("improvement tiles identify draws that create a new suited sequence", () => {
  const concealed = hand([0, 1, 9, 10, 18, 19, 27, 27, 31, 32, 33, 5, 14]);
  const analysis = analyzeHand(concealed, [], tileCounts(concealed));
  assert.equal(analysis.improvementTiles.find(item => item.type === 2).createsSequence, true);
  assert.equal(analysis.improvementTiles.find(item => item.type === 11).createsSequence, true);
  assert.equal(analysis.improvementTiles.find(item => item.type === 27).createsSequence, false);
});

test("AI decisions depend on the acting hand and public board, not hidden opponents", () => {
  const players = [
    { seatIndex: 0, name: "East", concealed: hand([0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 27, 31, 32, 5]), melds: [], discards: [] },
    { seatIndex: 1, name: "South", concealed: hand([3, 4, 5, 12, 13, 14, 21, 22, 23, 28, 28, 29, 29]), melds: [], discards: [] },
    { seatIndex: 2, name: "West", concealed: [], melds: [], discards: [] },
    { seatIndex: 3, name: "North", concealed: [], melds: [], discards: [] }
  ];
  const stateA = emptyState(players);
  const stateB = emptyState(players.map(player => ({
    ...player,
    concealed: player.seatIndex === 1 ? hand([6, 7, 8, 15, 16, 17, 24, 25, 26, 30, 30, 33, 33]) : [...player.concealed]
  })));
  const decisionA = chooseTurnAction(stateA, 0);
  const decisionB = chooseTurnAction(stateB, 0);
  assert.equal(decisionA.kind, decisionB.kind);
  assert.equal(decisionA.type, decisionB.type);
  assert.deepEqual(decisionA.beforeAnalysis.improvementTiles, decisionB.beforeAnalysis.improvementTiles);
  assert.deepEqual(getPublicCounts(stateA, 0), getPublicCounts(stateB, 0));
});

test("one Next transition records one turn and leaves a legal next phase", () => {
  const state = createGame({ seed: 7 });
  nextTurn(state);
  assert.equal(state.turn, 1);
  assert.equal(state.history.length, 1);
  assert.equal(state.players[0].discards.length, 1);
  assert.equal(state.activeSeat >= 0 && state.activeSeat < 4, true);
  assert.equal(typeof state.needsDraw, "boolean");
});

test("chow calls and ordinary discard wins are not legal actions", () => {
  const players = [
    { seatIndex: 0, name: "East", concealed: [], melds: [], discards: [tile(2)] },
    { seatIndex: 1, name: "South", concealed: hand([0, 1, 4, 5, 6, 9, 10, 11, 18, 19, 20, 27, 27]), melds: [], discards: [] },
    { seatIndex: 2, name: "West", concealed: [], melds: [], discards: [] },
    { seatIndex: 3, name: "North", concealed: [], melds: [], discards: [] }
  ];
  const state = emptyState(players);
  const decision = evaluateDiscardCall(state, 1, tile(2));
  assert.equal(decision.kind, "pass");
  assert.doesNotMatch(decision.explanation, /Chow/);
  assert.notEqual(decision.kind, "win");
});

test("a legal pong is declined when an embedded pair has a stronger concealed sequence path", () => {
  const discarded = { id: 900, type: 21 };
  const players = [
    { seatIndex: 0, name: "East", concealed: [], melds: [], discards: [discarded] },
    { seatIndex: 1, name: "South", concealed: hand([2, 3, 16, 19, 20, 21, 21, 22, 23, 24, 25, 26, 31]), melds: [], discards: [] },
    { seatIndex: 2, name: "West", concealed: [], melds: [], discards: [] },
    { seatIndex: 3, name: "North", concealed: [], melds: [], discards: [] }
  ];
  const decision = evaluateDiscardCall(emptyState(players), 1, discarded);
  assert.equal(decision.kind, "pass");
  assert.match(decision.explanation, /more flexible concealed path/);
});

test("pong is taken when the available discard improves a structured honor-pair hand", () => {
  const discarded = { id: 900, type: 31 };
  const players = [
    { seatIndex: 0, name: "East", concealed: [], melds: [], discards: [discarded] },
    { seatIndex: 1, name: "South", concealed: hand([0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 27, 31, 31]), melds: [], discards: [] },
    { seatIndex: 2, name: "West", concealed: [], melds: [], discards: [] },
    { seatIndex: 3, name: "North", concealed: [], melds: [], discards: [] }
  ];
  const decision = evaluateDiscardCall(emptyState(players), 1, discarded);
  assert.equal(decision.kind, "pong");
  assert.match(decision.explanation, /available now/);
});

test("pong can beat exposed kong when random replacement outcomes are worse on average", () => {
  const discarded = { id: 900, type: 11 };
  const players = [
    { seatIndex: 0, name: "East", concealed: [], melds: [], discards: [discarded] },
    { seatIndex: 1, name: "South", concealed: hand([4, 8, 9, 11, 11, 11, 15, 17, 25, 25, 26, 30, 31]), melds: [], discards: [] },
    { seatIndex: 2, name: "West", concealed: [], melds: [], discards: [] },
    { seatIndex: 3, name: "North", concealed: [], melds: [], discards: [] }
  ];
  const decision = evaluateDiscardCall(emptyState(players), 1, discarded);
  assert.equal(decision.kind, "pong");
});

test("an unpaired honor is preferred over a suited tile when completion distance ties", () => {
  const concealed = hand([0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 27, 5, 31]);
  const decision = chooseBestDiscard(concealed, [], tileCounts(concealed));
  assert.equal(decision.tile.type, 31);
});

test("an isolated honor beats a connected pair tile when distance ties", () => {
  const concealed = hand([2, 3, 3, 4, 20, 25, 10, 11, 11, 13, 14, 15, 16, 32]);
  const decision = chooseBestDiscard(concealed, [], tileCounts(concealed));
  assert.equal(decision.tile.type, 32);
  const green = decision.discardOptions.find(option => option.type === 32);
  const fourCharacters = decision.discardOptions.find(option => option.type === 3);
  assert.equal(green.structureScore > fourCharacters.structureScore, true);
  assert.equal(green.improvementCopies < fourCharacters.improvementCopies, true);
});

test("discard explanations list all equally strong discard choices", () => {
  const types = [0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 27, 31, 32];
  const concealed = types.map((type, id) => ({ id, type }));
  const players = [
    { seatIndex: 0, name: "East", concealed, melds: [], discards: [] },
    { seatIndex: 1, name: "South", concealed: [], melds: [], discards: [] },
    { seatIndex: 2, name: "West", concealed: [], melds: [], discards: [] },
    { seatIndex: 3, name: "North", concealed: [], melds: [], discards: [] }
  ];
  const decision = chooseTurnAction(emptyState(players), 0);
  assert.deepEqual(decision.candidate.optimalDiscards.map(candidate => candidate.tile.type), [31, 32]);
  assert.ok(decision.discardOptions.length > 2);
  assert.equal(decision.discardOptions.every(option => typeof option.structure === "string"), true);
  assert.match(decision.explanation, /equally strong discards/);
  const state = emptyState(players);
  state.canDeclareSelfDraw = false;
  nextTurn(state);
  assert.deepEqual(state.lastAction.equivalentDiscards.map(tile => tile.type), [31, 32]);
});

test("a connected suited tile is not equivalent to an isolated honor", () => {
  const types = [9, 0, 3, 4, 8, 1, 3, 7, 3, 27, 33, 26, 26, 5];
  const concealed = types.map((type, id) => ({ id, type }));
  const decision = chooseTurnAction(emptyState([
    { seatIndex: 0, name: "East", concealed, melds: [], discards: [] },
    { seatIndex: 1, name: "South", concealed: [], melds: [], discards: [] },
    { seatIndex: 2, name: "West", concealed: [], melds: [], discards: [] },
    { seatIndex: 3, name: "North", concealed: [], melds: [], discards: [] }
  ]), 0);
  assert.equal(decision.candidate.optimalDiscards.some(candidate => candidate.tile.type === 9), false);
  assert.equal(decision.candidate.optimalDiscards.some(candidate => candidate.tile.type === 27), true);
});

test("routine opponent pass details are omitted from the turn explanation", () => {
  const state = createGame({ seed: 7 });
  nextTurn(state);
  assert.doesNotMatch(state.lastAction.explanation, /cannot make a legal pong or kong/);
});

test("turn snapshots identify the drawn hand, thrown tile, and focused actor", () => {
  const concealedTypes = [0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 28, 5, 6];
  const players = [
    { seatIndex: 0, name: "East", concealed: concealedTypes.map((type, id) => ({ id, type })), melds: [], discards: [] },
    { seatIndex: 1, name: "South", concealed: [], melds: [], discards: [] },
    { seatIndex: 2, name: "West", concealed: [], melds: [], discards: [] },
    { seatIndex: 3, name: "North", concealed: [], melds: [], discards: [] }
  ];
  const state = emptyState(players);
  state.needsDraw = true;
  state.canDeclareSelfDraw = false;
  state.liveWall = [{ id: 100, type: 33 }];
  nextTurn(state);
  assert.equal(state.lastAction.displaySeatIndex, 0);
  assert.equal(state.lastAction.handBeforeDiscard.length, 14);
  assert.deepEqual(state.lastAction.drawnTileIds, [100]);
  assert.equal(state.lastAction.discardedTileId, state.lastAction.discardedTile.id);
  assert.equal(state.lastAction.call, null);
});

test("call snapshots focus the caller and identify the taken discard", () => {
  const state = createGame({ seed: 23 });
  let callAction = null;
  for (let turn = 0; turn < 100 && !state.terminal; turn += 1) {
    nextTurn(state);
    if (state.lastAction.call) {
      callAction = state.lastAction;
      break;
    }
  }
  assert.ok(callAction);
  assert.equal(callAction.displaySeatIndex, callAction.seatIndex);
  assert.equal(callAction.call.takenTileId, callAction.discardedTileId);
  nextTurn(state);
  assert.equal(state.lastAction.displaySeatIndex, callAction.call.seatIndex);
  assert.equal(state.lastAction.callFromPrevious.seatIndex, callAction.call.seatIndex);
  assert.equal(state.lastAction.discardedTileId, state.lastAction.discardedTile.id);
});

test("a claimed discard is counted once in public visibility", () => {
  const claimed = tile(0);
  const players = [
    { seatIndex: 0, name: "East", concealed: [], melds: [], discards: [claimed] },
    { seatIndex: 1, name: "South", concealed: [], melds: [{ kind: "pong", type: 0, open: true, tiles: [claimed, tile(0), tile(0)] }], discards: [] },
    { seatIndex: 2, name: "West", concealed: [], melds: [], discards: [] },
    { seatIndex: 3, name: "North", concealed: [], melds: [], discards: [] }
  ];
  const state = emptyState(players);
  state.claimedDiscardIds = [claimed.id];
  assert.equal(getPublicCounts(state, 2)[0], 3);
});

test("a complete starting hand ends as a self-draw win", () => {
  const players = [
    { seatIndex: 0, name: "East", concealed: hand([0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 27, 27, 31, 31]), melds: [], discards: [] },
    { seatIndex: 1, name: "South", concealed: [], melds: [], discards: [] },
    { seatIndex: 2, name: "West", concealed: [], melds: [], discards: [] },
    { seatIndex: 3, name: "North", concealed: [], melds: [], discards: [] }
  ];
  const state = emptyState(players);
  nextTurn(state);
  assert.equal(state.terminal.type, "selfDraw");
  assert.equal(state.terminal.winner, 0);
});

test("a pong caller must discard even when its effective hand is complete", () => {
  const players = [
    { seatIndex: 0, name: "East", concealed: [], melds: [], discards: [] },
    { seatIndex: 1, name: "South", concealed: hand([0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 27]), melds: [{ kind: "pong", type: 30, open: true, tiles: hand([30, 30, 30]) }], discards: [] },
    { seatIndex: 2, name: "West", concealed: [], melds: [], discards: [] },
    { seatIndex: 3, name: "North", concealed: [], melds: [], discards: [] }
  ];
  const state = emptyState(players);
  state.activeSeat = 1;
  state.canDeclareSelfDraw = false;
  nextTurn(state);
  assert.equal(state.terminal, null);
  assert.equal(state.players[1].discards.length, 1);
});
