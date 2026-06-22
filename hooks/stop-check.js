// Stop hook: run tsc + tests after every session, surface failures to the user
import { spawnSync } from "child_process";
import fs from "fs";

try {
  fs.readFileSync(0, "utf8");
} catch {}

const cwd = process.cwd();
const parts = [];
let failed = false;

const tsc = spawnSync("npx", ["tsc", "--noEmit"], {
  cwd,
  encoding: "utf8",
  shell: true,
  timeout: 60000,
});
if (tsc.signal) {
  failed = true;
  parts.push(
    `TypeScript check timed out (killed by ${tsc.signal}) — result unknown`,
  );
} else if (tsc.status === 0) {
  parts.push("TypeScript ✓");
} else {
  failed = true;
  const out = (tsc.stdout + tsc.stderr)
    .trim()
    .split("\n")
    .slice(0, 25)
    .join("\n");
  parts.push(`TypeScript errors:\n${out}`);
}

const test = spawnSync("npm", ["test"], {
  cwd,
  encoding: "utf8",
  shell: true,
  timeout: 60000,
});
if (test.signal) {
  failed = true;
  parts.push(`Tests timed out (killed by ${test.signal}) — result unknown`);
} else if (test.status === 0) {
  parts.push("Tests ✓");
} else {
  failed = true;
  const out = (test.stdout + test.stderr)
    .trim()
    .split("\n")
    .slice(-30)
    .join("\n");
  parts.push(`Test failures:\n${out}`);
}

if (failed) {
  process.stdout.write(JSON.stringify({ systemMessage: parts.join("\n\n") }));
}
