# ram-claude-plugin

Shared Claude Code skills and hooks for RAM React / TypeScript / Supabase / Vercel projects.

## Install

Add to `.claude/settings.json` in any RAM project:

```json
{
  "enabledPlugins": {
    "ram-claude-plugin@RAM-Companies": true
  }
}
```

## Skills

| Skill               | Invoke                   | Purpose                                                            |
| ------------------- | ------------------------ | ------------------------------------------------------------------ |
| `add-migration`     | `/ram:add-migration`     | Create a Supabase migration (DDL + pgTAP tests + type regen)       |
| `deno-tests`        | `/ram:deno-tests`        | Add unit tests to a Supabase Edge Function                         |
| `extract-component` | `/ram:extract-component` | Pull a section out of a large file into a standalone component     |
| `extract-service`   | `/ram:extract-service`   | Move inline Supabase queries into a service layer                  |
| `find-usages`       | `/ram:find-usages`       | Find every file that uses a component, function, or class string   |
| `new-feature`       | `/ram:new-feature`       | Scaffold a new feature folder following feature-based architecture |
| `pr-review`         | `/ram:pr-review`         | Full PR review: conventions, security, code quality, docs accuracy |
| `ui-update`         | `/ram:ui-update`         | Safely apply a UI change everywhere it appears across the repo     |
| `unit-tests`        | `/ram:unit-tests`        | Write Vitest unit tests for pure functions in src/                 |

## Hooks

Automatically wired when the plugin is enabled:

| Hook                   | Trigger                | What it does                                                               |
| ---------------------- | ---------------------- | -------------------------------------------------------------------------- |
| `protect-generated.js` | PreToolUse Write/Edit  | Blocks edits to auto-generated `types.ts`; warns before editing migrations |
| `format.js`            | PostToolUse Write/Edit | Runs ESLint `--fix` + Prettier on every saved file                         |
| `post-write-checks.js` | PostToolUse Write/Edit | Flags `as any`, silent catch, inline Supabase in pages, hardcoded secrets  |
| `stop-check.js`        | Stop                   | Runs `tsc --noEmit` + `npm test` at session end                            |

## Project-local skills

Some skills are too project-specific to live here. Keep them in `.claude/skills/` inside the project repo (e.g. `add-admin-card`, `add-form-field` for RAM AIR EZ).
