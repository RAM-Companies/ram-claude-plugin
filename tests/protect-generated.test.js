const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { runHook } = require("./helpers/run-hook");

function run(input) {
  return runHook("protect-generated.js", input);
}

test("no file_path in tool_input -> silent pass-through", () => {
  const r = run({ tool_input: {} });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
});

test("tool_input missing entirely -> silent pass-through", () => {
  const r = run({});
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
});

test("editing auto-generated supabase types.ts is denied", () => {
  const r = run({
    tool_name: "Edit",
    tool_input: { file_path: "src/integrations/supabase/types.ts" },
  });
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny", r.stdout);
  assert.match(
    out.hookSpecificOutput.permissionDecisionReason,
    /auto-generated/,
  );
});

test("types.ts deny also matches Windows-style backslash paths", () => {
  const r = run({
    tool_name: "Write",
    tool_input: {
      file_path: "C:\\project\\src\\integrations\\supabase\\types.ts",
    },
  });
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
});

test("editing an existing migration file asks for confirmation", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ram-hook-test-"));
  const migrationDir = path.join(dir, "supabase", "migrations");
  fs.mkdirSync(migrationDir, { recursive: true });
  const migrationFile = path.join(migrationDir, "20260101000000_init.sql");
  fs.writeFileSync(migrationFile, "select 1;\n");

  try {
    const r = run({
      tool_name: "Edit",
      tool_input: { file_path: migrationFile },
    });
    const out = JSON.parse(r.stdout);
    assert.equal(out.hookSpecificOutput.permissionDecision, "ask");
    assert.match(
      out.hookSpecificOutput.permissionDecisionReason,
      /already be applied/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a new (not-yet-created) migration file is not warned about", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ram-hook-test-"));
  const migrationFile = path.join(
    dir,
    "supabase",
    "migrations",
    "20260101000001_new.sql",
  );
  try {
    const r = run({
      tool_name: "Write",
      tool_input: { file_path: migrationFile, content: "select 1;" },
    });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, "");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a non-migration, non-generated file passes through silently", () => {
  const r = run({
    tool_name: "Edit",
    tool_input: { file_path: "src/components/Button.tsx" },
  });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
});

test("malformed JSON on stdin does not crash the hook", () => {
  const r = run("not valid json");
  assert.notEqual(r.status, 2, "must not use the blocking exit code");
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /protect-generated\.js: skipping/);
});

test("empty stdin does not crash the hook", () => {
  const r = run("");
  assert.notEqual(r.status, 2);
  assert.equal(r.stdout, "");
});
