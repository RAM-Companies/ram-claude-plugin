// PostToolUse: quality guard + secret scan on every Write/Edit
const fs = require("fs");
const path = require("path");

try {
const d = JSON.parse(fs.readFileSync(0, "utf8"));
const f = d?.tool_input?.file_path;
if (!f) process.exit(0);
// Skip hook scripts themselves (.claude/hooks/ or plugin hooks/ outside src/)
if (/[/\\]\.claude[/\\]/.test(f)) process.exit(0);
if (/[/\\]hooks[/\\]/.test(f) && !/[/\\]src[/\\]/.test(f)) process.exit(0);

const newContent =
  d.tool_name === "Edit"
    ? (d.tool_input?.new_string ?? "")
    : (d.tool_input?.content ?? "");
// Edit gives us the pre-existing snippet via old_string. For Write, the file has already
// been persisted by the time this PostToolUse hook runs, so reading it back would just
// return the new content — meaning everything looks "unchanged". Treat the old content as
// empty for Write so all content is scanned and newly introduced secrets aren't missed.
const oldContent =
  d.tool_name === "Edit" ? (d.tool_input?.old_string ?? "") : "";

if (!newContent) process.exit(0);

const issues = [];
const notes = [];

// Quality checks — TS/JS source files only
if (/\.(ts|tsx|js|jsx)$/.test(f)) {
  // Line-set diff: flag a pattern only when new lines carrying it appear that weren't in old.
  const oldLineSet = new Set(oldContent.split("\n"));
  const added = (re) =>
    newContent
      .split("\n")
      .some((line) => re.test(line) && !oldLineSet.has(line));

  if (added(/\bas any\b/))
    issues.push(
      "`as any` cast — use a proper type (being phased out across the codebase)",
    );
  if (added(/window\.confirm\(/))
    issues.push(
      "`window.confirm()` — use the AlertDialog component (src/components/ui/alert-dialog.tsx)",
    );
  if (added(/\.catch\s*\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/))
    issues.push(
      "Silent `.catch(() => {})` — call `toast.error()` for user-visible failures",
    );
  if (/[/\\]pages[/\\]/.test(f) && added(/supabase\.from\(/))
    issues.push(
      "`supabase.from()` introduced in pages/ — move to a service function in src/features/",
    );
  if (added(/style=\{\{/))
    issues.push("Inline `style={{}}` — use Tailwind utility classes instead");

  // Style constant drift — read the written file to check resulting state.
  // Using file content (not the diff) means quote style doesn't matter, and we
  // catch drift in new files as well as edits. PostToolUse runs after the file
  // is persisted, so fs.readFileSync gives us the post-edit content.
  if (/\.(ts|tsx)$/.test(f)) {
    const fileContent = fs.readFileSync(f, "utf8");
    const isAdminFile = /[/\\]features[/\\]admin[/\\]/.test(f);

    if (isAdminFile) {
      if (fileContent.includes("flex items-center gap-4"))
        issues.push(
          "Hardcoded `flex items-center gap-4` in an admin component — use `<AdminFormRow>` or `ADMIN_FORM_ROW` from `@/shared/lib/styles`",
        );
      if (fileContent.includes("flex justify-end mt-4"))
        issues.push(
          "Hardcoded `flex justify-end mt-4` in an admin component — use `FORM_SAVE_ROW` from `@/shared/lib/styles`",
        );
    }

    // Badge status colors: match the distinctive /20 suffix rather than full class strings.
    // This covers all STATUS_COLORS variants without hardcoding each one here.
    if (
      /bg-(?:green-500|amber-500|destructive)\/20/.test(fileContent) &&
      !fileContent.includes("STATUS_COLORS")
    )
      issues.push(
        "Hardcoded status badge color — use `STATUS_COLORS.<status>` from `@/shared/lib/styles` instead of inline class strings",
      );
  }
}

// Secret scan — all file types except .env files
if (!/\.(env|env\.local|env\.example)$/.test(f) && !/node_modules/.test(f)) {
  const oldLines = new Set(oldContent.split("\n").map((l) => l.trim()));
  newContent.split("\n").forEach((line, i) => {
    if (oldLines.has(line.trim())) return;
    if (/import\.meta\.env|process\.env/.test(line)) return;
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) return;

    if (/(?<![A-Za-z0-9_])eyJ[A-Za-z0-9_-]{20,}/.test(line))
      issues.push(
        `Line ${i + 1}: Possible hardcoded JWT/API key — use import.meta.env.VITE_*`,
      );
    if (/https?:\/\/[a-z0-9]{15,}\.supabase\.co/.test(line))
      issues.push(
        `Line ${i + 1}: Hardcoded Supabase URL — use import.meta.env.VITE_SUPABASE_URL`,
      );
  });
}

// Related-files note — for feature components, list other files that import this one.
// Helps Claude notice when a change to a shared helper should propagate to consumers.
// Skips ui/ primitives (too many importers) and non-feature files.
// Resolve to absolute path so regex matching and srcRoot derivation work for both
// absolute and relative file_path values supplied by the tool.
const absF = path.resolve(f);
if (
  /[/\\]src[/\\]features[/\\]/.test(absF) &&
  !/[/\\]components[/\\]ui[/\\]/.test(absF) &&
  /\.(tsx|ts)$/.test(absF)
) {
  const baseName = path.basename(absF).replace(/\.(tsx|ts)$/, "");
  const importRe = new RegExp(`from\\s+["'][^"']*/` + baseName + `["']`);

  // Walk src/ recursively collecting importers
  const srcRoot = absF.replace(/\\/g, "/").replace(/\/src\/.*$/, "/src");
  const importers = [];

  function walkDir(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!["node_modules", ".git", "dist", ".claude"].includes(entry.name))
          walkDir(full);
      } else if (
        /\.(tsx|ts)$/.test(entry.name) &&
        path.resolve(full) !== absF
      ) {
        try {
          if (importRe.test(fs.readFileSync(full, "utf8")))
            importers.push(
              full.replace(/\\/g, "/").replace(/.*\/src\//, "src/"),
            );
        } catch {
          /* skip unreadable */
        }
      }
    }
  }

  walkDir(srcRoot);

  if (importers.length >= 1 && importers.length <= 12)
    notes.push(
      `${importers.length} other file${importers.length > 1 ? "s" : ""} import ${baseName} — check whether they also need updating:\n  ${importers.join("\n  ")}`,
    );
}

if (issues.length || notes.length) {
  const parts = [];
  if (issues.length)
    parts.push(
      `Code issues in ${path.basename(f)} — please fix before continuing:\n${issues.map((i) => `• ${i}`).join("\n")}`,
    );
  if (notes.length) parts.push(notes.map((n) => `ℹ️ ${n}`).join("\n"));
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: parts.join("\n\n"),
      },
    }),
  );
}
} catch (err) {
  process.stderr.write(`post-write-checks.js: skipping — ${err.message}\n`);
  process.exit(0);
}
