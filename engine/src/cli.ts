import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { parseArgs } from "node:util";
import { analyzeUpgrade } from "./diff.ts";
import { generateArtifacts } from "./codegen.ts";
import type { Idl } from "./layout.ts";
import type { Model } from "./detect-model.ts";

function main(argv: string[]): number {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      out: { type: "string" },
      assume: { type: "string" },
      json: { type: "boolean" },
    },
  });

  const [beforePath, afterPath] = positionals;
  if (!beforePath || !afterPath) {
    console.error("usage: cli.ts <before.json> <after.json> [--out <dir>] [--json] [--assume <model>]");
    return 2;
  }

  let before: Idl;
  let after: Idl;
  try {
    before = JSON.parse(readFileSync(beforePath, "utf8")) as Idl;
    after = JSON.parse(readFileSync(afterPath, "utf8")) as Idl;
  } catch (e) {
    // Exit 2, never 1: a bad-input crash must not look like a MIGRATE verdict to the CI gate.
    console.error(`error reading IDL: ${(e as Error).message}`);
    return 2;
  }

  const result = analyzeUpgrade(before, after, { assumeModel: values.assume as Model | undefined });
  if (result.model.caveat) console.error(`caveat: ${result.model.caveat}`);
  if (result.model.refuse) console.error(`refused: ${result.model.reason}`);

  const out = values.out;
  if (values.json) {
    console.log(JSON.stringify({ verdict: result.verdict, artifacts: generateArtifacts(before, after, result) }));
  } else {
    console.log(`verdict: ${result.verdict}`);
    if (out !== undefined) {
      const artifacts = generateArtifacts(before, after, result);
      mkdirSync(out, { recursive: true });
      for (const [name, content] of Object.entries(artifacts)) {
        writeFileSync(`${out}/${name}`, content);
      }
      console.log(`wrote ${Object.keys(artifacts).length} artifact(s) to ${out}/`);
    }
  }

  return result.verdict === "MIGRATE" ? 1 : 0; // exit 1 = CI gate fails
}

process.exit(main(process.argv.slice(2)));
