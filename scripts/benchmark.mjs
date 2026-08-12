import { cpus } from "node:os";
import { createWriteStream } from "node:fs";
import { spawnSync } from "node:child_process";
import { isMainThread, Worker, workerData, parentPort } from "node:worker_threads";
import { createGame, nextTurn, tileCode } from "../src/mahjong.js";

const modelDefinitions = [
  { key: "efficiency", column: "immediate_efficiency" },
  { key: "akagi", column: "akagi" }
];
const csvColumns = ["seed", ...modelDefinitions.map(model => model.column)];
const maxStepsPerGame = 500;
const akagiRunner = ".tools/Akagi-source/native_bot/target/x86_64-pc-windows-gnu/release/akagi_runner.exe";
const honorCodes = { east: "E", south: "S", west: "W", north: "N", red: "P", green: "F", white: "C" };
const dummyHand = ["1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "1s", "2s", "3s", "4s"];

function akagiTileCode(tile) {
  const code = tileCode(tile);
  return honorCodes[code] ?? code;
}

function askAkagi(hand) {
  if (!hand || hand.length !== 14) {
    return null;
  }
  const events = [
    {
      type: "start_game",
      names: ["East", "South", "West", "North"],
      kyoku_first: 1,
      aka_flag: true,
      id: 0,
      num_players: 4
    },
    {
      type: "start_kyoku",
      bakaze: "E",
      dora_marker: "1m",
      kyoku: 1,
      honba: 0,
      kyotaku: 0,
      oya: 0,
      scores: [25000, 25000, 25000, 25000],
      tehais: [hand.slice(0, 13).map(akagiTileCode), dummyHand, dummyHand, dummyHand]
    },
    { type: "tsumo", actor: 0, pai: akagiTileCode(hand[13]) }
  ];
  const result = spawnSync(akagiRunner, ["0", "4"], {
    input: `${events.map(event => JSON.stringify(event)).join("\n")}\n`,
    encoding: "utf8",
    windowsHide: true
  });
  if (result.status !== 0 || result.error) {
    throw result.error ?? new Error(`Akagi runner exited with code ${result.status}`);
  }
  const responses = result.stdout.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  const action = responses.reverse().find(response => response?.pai);
  return action?.pai ?? null;
}

function typeFromAkagiCode(code) {
  const normalized = code?.replace(/r$/, "");
  if (!normalized) {
    return null;
  }
  const honorType = { E: 27, S: 28, W: 29, N: 30, P: 31, F: 32, C: 33 }[normalized];
  if (honorType !== undefined) {
    return honorType;
  }
  const match = /^(\d)([msp])$/.exec(normalized);
  if (!match) {
    return null;
  }
  return "msp".indexOf(match[2]) * 9 + Number(match[1]) - 1;
}

function runGame(seed, strategy) {
  let state = createGame({ seed });
  state.decisionStrategy = strategy;
  let steps = 0;

  while (!state.terminal && steps < maxStepsPerGame) {
    if (strategy !== "akagi") {
      nextTurn(state);
    } else {
      const snapshot = structuredClone(state);
      nextTurn(state);
      const action = state.lastAction;
      const canOverride = action?.kind === "discard"
        && action.discardedTile
        && !action.call
        && action.handBeforeDiscard?.length === 14;
      if (canOverride) {
        const akagiType = typeFromAkagiCode(askAkagi(action.handBeforeDiscard));
        if (akagiType !== null && action.handBeforeDiscard.some(tile => tile.type === akagiType)) {
          const replay = structuredClone(snapshot);
          replay.discardOverrides = { [action.seatIndex]: akagiType };
          nextTurn(replay);
          state = replay;
        }
      }
    }
    state.history.length = 0;
    steps += 1;
  }

  if (!state.terminal || state.terminal.winner === null) {
    return "No Win";
  }
  return String(state.liveWall.length);
}

function runSeed(seed) {
  return Object.fromEntries([
    ["seed", seed],
    ...modelDefinitions.map(model => [model.column, runGame(seed, model.key)])
  ]);
}

function csvValue(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvRow(row) {
  return csvColumns.map(column => csvValue(row[column])).join(",");
}

if (!isMainThread) {
  for (const seed of workerData.seeds) {
    parentPort.postMessage(runSeed(seed));
  }
} else {
  const scenarioCount = Number(process.argv[2] ?? 100);
  const firstSeed = Number(process.argv[3] ?? 1);
  const requestedWorkers = Number(process.argv[4] ?? Math.min(8, Math.max(1, cpus().length - 2)));
  const outputPath = process.argv[5] ?? "benchmark-results.csv";

  if (!Number.isInteger(scenarioCount) || scenarioCount < 1) {
    throw new Error("Usage: npm run benchmark -- <scenario-count> [first-seed] [worker-count] [output-file]");
  }
  if (!Number.isInteger(firstSeed) || firstSeed < 0) {
    throw new Error("The first seed must be a non-negative integer.");
  }
  if (!Number.isInteger(requestedWorkers) || requestedWorkers < 1) {
    throw new Error("The worker count must be a positive integer.");
  }

  const workerCount = Math.min(requestedWorkers, scenarioCount);
  const seeds = Array.from({ length: scenarioCount }, (_, index) => firstSeed + index);
  const seedBatches = Array.from({ length: workerCount }, () => []);
  seeds.forEach((seed, index) => seedBatches[index % workerCount].push(seed));

  const output = createWriteStream(outputPath, { flags: "w" });
  output.write(`${csvColumns.join(",")}\n`);
  console.log(`Running ${scenarioCount} complete seeds with ${workerCount} workers.`);
  console.log(`Writing results incrementally to ${outputPath}`);
  console.log(csvColumns.join(","));

  let completed = 0;
  await new Promise((resolve, reject) => {
    let remainingWorkers = workerCount;
    for (const batch of seedBatches) {
      const worker = new Worker(new URL(import.meta.url), { workerData: { seeds: batch } });
      worker.on("message", row => {
        output.write(`${csvRow(row)}\n`);
        console.log(csvRow(row));
        completed += 1;
      });
      worker.on("error", reject);
      worker.on("exit", code => {
        if (code !== 0) {
          reject(new Error(`Benchmark worker exited with code ${code}`));
          return;
        }
        remainingWorkers -= 1;
        if (remainingWorkers === 0) {
          resolve();
        }
      });
    }
  });

  await new Promise(resolve => output.end(resolve));
  console.log(`Completed ${completed}/${scenarioCount} seeds.`);
}
