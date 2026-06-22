// PreToolUse: block edits to auto-generated types.ts, warn on migration files
const fs = require("fs");
const path = require("path");

const d = JSON.parse(fs.readFileSync(0, "utf8"));
const f = d?.tool_input?.file_path;
if (!f) process.exit(0);

// Hard block: auto-generated Supabase types
if (/integrations[/\\]supabase[/\\]types\.ts$/.test(f)) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          "src/integrations/supabase/types.ts is auto-generated from the live DB schema — do not edit by hand.\n\n" +
          "Regenerate it after schema migrations:\n" +
          "  supabase gen types typescript --local > src/integrations/supabase/types.ts",
      },
    }),
  );
  process.exit(0);
}

// Soft warn: editing an existing migration file
if (/supabase[/\\]migrations[/\\].*\.sql$/.test(f) && fs.existsSync(f)) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason:
          `Editing an existing migration is risky — it may already be applied to dev/prod databases, causing irreversible schema drift.\n\n` +
          `To add schema changes, create a new migration instead:\n` +
          `  supabase migration new <descriptive_name>\n\n` +
          `Proceed with editing ${path.basename(f)}?`,
      },
    }),
  );
  process.exit(0);
}
