// PostToolUse: eslint --fix + prettier --write on every Write/Edit
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const d = JSON.parse(fs.readFileSync(0, "utf8"));
const f = d?.tool_input?.file_path;
if (!f) process.exit(0);

const cwd = process.cwd();
const messages = [];

// ESLint only understands JS/TS source files — running it on README.md,
// package.json, etc. produces noisy "fatal" errors for unsupported file types.
if (/\.(ts|tsx|js|jsx|cjs|mjs)$/.test(f)) {
  const eslint = spawnSync("npx", ["eslint", "--fix", f], {
    cwd,
    encoding: "utf8",
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  // Exit 1 = unfixable lint warnings (expected). Exit 2 = fatal: bad config, parse error.
  if (eslint.status === 2) {
    const detail = ((eslint.stdout || "") + (eslint.stderr || ""))
      .trim()
      .split("\n")
      .slice(0, 10)
      .join("\n");
    messages.push(
      `ESLint fatal error on ${path.basename(f)} — linting was not applied:\n${detail}`,
    );
  }
}

const prettier = spawnSync(
  "npx",
  ["prettier", "--write", "--ignore-unknown", f],
  {
    cwd,
    encoding: "utf8",
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  },
);
if (prettier.status !== 0) {
  const detail = ((prettier.stdout || "") + (prettier.stderr || ""))
    .trim()
    .split("\n")
    .slice(0, 10)
    .join("\n");
  messages.push(
    `Prettier error on ${path.basename(f)} — formatting was not applied:\n${detail}`,
  );
}

// Emit a single JSON payload — concatenated JSON objects are invalid and may be ignored.
if (messages.length) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: messages.join("\n\n"),
      },
    }),
  );
}
