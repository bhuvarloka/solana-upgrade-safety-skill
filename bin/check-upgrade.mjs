#!/usr/bin/env node
// npx entry point: `npx github:bhuvarloka/solana-upgrade-safety-skill before.json after.json`
// Forwards to the engine CLI (run via the engine's own tsx). Exit code is the contract:
//   1 = MIGRATE (corrupts deployed accounts), 0 = safe, 2 = bad input / not a verdict.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, "../engine/src/cli.ts");
const tsx = resolve(here, "../engine/node_modules/.bin/tsx");

const r = spawnSync(tsx, [cli, ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(r.status ?? 2);
