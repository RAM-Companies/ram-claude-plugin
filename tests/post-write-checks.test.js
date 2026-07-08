const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { runHook } = require("./helpers/run-hook");

function run(input) {
  return runHook("post-write-checks.js", input);
}

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ram-hook-test-"));
}

test("no file_path -> silent pass-through", () => {
  const r = run({ tool_input: {} });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
});

test("skips files under .claude/", () => {
  const r = run({
    tool_name: "Write",
    tool_input: {
      file_path: "C:/project/.claude/hooks/local.js",
      content: "const x = y as any;",
    },
  });
  assert.equal(r.stdout, "");
});

test("skips plugin hooks/ files outside src/", () => {
  const r = run({
    tool_name: "Write",
    tool_input: {
      file_path: "C:/project/hooks/format.js",
      content: "const x = y as any;",
    },
  });
  assert.equal(r.stdout, "");
});

test("flags a newly introduced `as any` cast", () => {
  const dir = tmp();
  const file = path.join(dir, "foo.ts");
  try {
    fs.writeFileSync(file, "const x = y as any;\n");
    const r = run({
      tool_name: "Write",
      tool_input: { file_path: file, content: "const x = y as any;\n" },
    });
    const out = JSON.parse(r.stdout);
    assert.match(out.hookSpecificOutput.additionalContext, /as any/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("does not re-flag `as any` that already existed before the edit", () => {
  const dir = tmp();
  const file = path.join(dir, "foo.ts");
  const content = "const x = y as any;\nconst z = 1;\n";
  try {
    fs.writeFileSync(file, content);
    const r = run({
      tool_name: "Edit",
      tool_input: {
        file_path: file,
        old_string: "const x = y as any;",
        new_string: "const x = y as any;",
      },
    });
    assert.equal(r.stdout, "");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("flags window.confirm()", () => {
  const dir = tmp();
  const file = path.join(dir, "foo.ts");
  try {
    fs.writeFileSync(file, "window.confirm('are you sure?');\n");
    const r = run({
      tool_name: "Write",
      tool_input: {
        file_path: file,
        content: "window.confirm('are you sure?');\n",
      },
    });
    const out = JSON.parse(r.stdout);
    assert.match(out.hookSpecificOutput.additionalContext, /AlertDialog/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("flags a silent empty catch", () => {
  const dir = tmp();
  const file = path.join(dir, "foo.ts");
  const content = "doThing().catch(() => {});\n";
  try {
    fs.writeFileSync(file, content);
    const r = run({
      tool_name: "Write",
      tool_input: { file_path: file, content },
    });
    const out = JSON.parse(r.stdout);
    assert.match(out.hookSpecificOutput.additionalContext, /Silent `\.catch/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("flags supabase.from() introduced under pages/", () => {
  const dir = tmp();
  const file = path.join(dir, "pages", "Orders.tsx");
  const content = "supabase.from('orders').select();\n";
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    const r = run({
      tool_name: "Write",
      tool_input: { file_path: file, content },
    });
    const out = JSON.parse(r.stdout);
    assert.match(
      out.hookSpecificOutput.additionalContext,
      /supabase\.from\(\)/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("flags inline style={{}}", () => {
  const dir = tmp();
  const file = path.join(dir, "foo.tsx");
  const content = "<div style={{ color: 'red' }} />;\n";
  try {
    fs.writeFileSync(file, content);
    const r = run({
      tool_name: "Write",
      tool_input: { file_path: file, content },
    });
    const out = JSON.parse(r.stdout);
    assert.match(out.hookSpecificOutput.additionalContext, /Tailwind/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("flags hardcoded admin layout classes in features/admin", () => {
  const dir = tmp();
  const file = path.join(dir, "src", "features", "admin", "Card.tsx");
  const content = '<div className="flex items-center gap-4" />;\n';
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    const r = run({
      tool_name: "Write",
      tool_input: { file_path: file, content },
    });
    const out = JSON.parse(r.stdout);
    assert.match(out.hookSpecificOutput.additionalContext, /AdminFormRow/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("flags hardcoded status badge colors", () => {
  const dir = tmp();
  const file = path.join(dir, "Badge.tsx");
  const content = '<span className="bg-green-500/20" />;\n';
  try {
    fs.writeFileSync(file, content);
    const r = run({
      tool_name: "Write",
      tool_input: { file_path: file, content },
    });
    const out = JSON.parse(r.stdout);
    assert.match(out.hookSpecificOutput.additionalContext, /STATUS_COLORS/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("flags a hardcoded JWT-looking string", () => {
  const dir = tmp();
  const file = path.join(dir, "config.ts");
// pragma: allowlist secret
  const content = `const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcdefghij";\n`;
  try {
    fs.writeFileSync(file, content);
    const r = run({
      tool_name: "Write",
      tool_input: { file_path: file, content },
    });
    const out = JSON.parse(r.stdout);
    assert.match(out.hookSpecificOutput.additionalContext, /JWT\/API key/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("flags a hardcoded supabase URL", () => {
  const dir = tmp();
  const file = path.join(dir, "config.ts");
  const content = `const url = "https://abcdefghijklmno.supabase.co";\n`;
  try {
    fs.writeFileSync(file, content);
    const r = run({
      tool_name: "Write",
      tool_input: { file_path: file, content },
    });
    const out = JSON.parse(r.stdout);
    assert.match(out.hookSpecificOutput.additionalContext, /Supabase URL/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("does not scan .env files for secrets", () => {
  const dir = tmp();
  const file = path.join(dir, ".env");
  const content = `VITE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcdefghij\n`;
  try {
    fs.writeFileSync(file, content);
    const r = run({
      tool_name: "Write",
      tool_input: { file_path: file, content },
    });
    assert.equal(r.stdout, "");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("does not flag env-var reads of secrets", () => {
  const dir = tmp();
  const file = path.join(dir, "config.ts");
  const content = "const url = import.meta.env.VITE_SUPABASE_URL;\n";
  try {
    fs.writeFileSync(file, content);
    const r = run({
      tool_name: "Write",
      tool_input: { file_path: file, content },
    });
    assert.equal(r.stdout, "");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("notes other files that import a changed feature file", () => {
  const dir = tmp();
  const srcRoot = path.join(dir, "src");
  const target = path.join(srcRoot, "features", "orders", "OrderCard.tsx");
  const consumer = path.join(srcRoot, "features", "orders", "OrderList.tsx");
  const content = "export function OrderCard() { return null; }\n";
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    fs.writeFileSync(
      consumer,
      `import { OrderCard } from "./OrderCard";\nexport function OrderList() { return null; }\n`,
    );
    const r = run({
      tool_name: "Write",
      tool_input: { file_path: target, content },
    });
    const out = JSON.parse(r.stdout);
    assert.match(
      out.hookSpecificOutput.additionalContext,
      /import OrderCard/,
    );
    assert.match(
      out.hookSpecificOutput.additionalContext,
      /OrderList\.tsx/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("malformed JSON on stdin does not crash the hook", () => {
  const r = run("{ not json");
  assert.notEqual(r.status, 2);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /post-write-checks\.js: skipping/);
});
