// PreToolUse: block edits to auto-generated types.ts, warn on migration files
const fs = require("fs");
const path = require("path");

// RAM projects have used more than one convention for where the Supabase
// CLI writes its generated types file — add new ones here as they show up:
//   - Vite/CRA SPA:        src/integrations/supabase/types.ts
//   - any src/**/supabase: src/lib/supabase/types.ts, etc.
//   - Next.js App Router:  lib/types/database.types.ts (matched by filename
//                           alone, since `database.types.ts` is distinctive
//                           enough not to collide with unrelated types files)
const GENERATED_TYPES_PATTERNS = [
  /integrations[/\\]supabase[/\\]types\.ts$/,
  /[/\\]supabase[/\\]types\.ts$/,
  /database\.types\.ts$/
];

function isGeneratedTypesFile(f) {
  return GENERATED_TYPES_PATTERNS.some((re) => re.test(f));
}

try {
  const d = JSON.parse(fs.readFileSync(0, "utf8"));
  const f = d?.tool_input?.file_path;
  if (!f) process.exit(0);

  // Hard block: auto-generated Supabase types
  if (isGeneratedTypesFile(f)) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason:
            `${f} is auto-generated from the live DB schema — do not edit by hand.\n\n` +
            "Regenerate it after schema migrations, e.g.:\n" +
            `  supabase gen types typescript --local > ${f}\n` +
            `  # or, for a hosted project: npx supabase gen types typescript --project-id <id> > ${f}`
        }
      })
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
            `Proceed with editing ${path.basename(f)}?`
        }
      })
    );
    process.exit(0);
  }
} catch (err) {
  process.stderr.write(`protect-generated.js: skipping — ${err.message}\n`);
  process.exit(0);
}
