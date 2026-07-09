# ram-claude-plugin

Shared Claude Code skills and hooks for RAM React / TypeScript / Supabase / Vercel projects.

## Install

Add the RAM Companies marketplace:

```bash
claude plugin marketplace add RAM-Companies/ram-claude-plugin
```

Then install the plugin:

```bash
claude plugin install ram@ram-companies
```

This plugin can also be used with [copilot](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-finding-installing) by replacing `claude` with `copilot`. E.g.

```bash
copilot plugin marketplace add RAM-Companies/ram-claude-plugin
copilot plugin install ram@ram-companies
```

## Update

```bash
claude plugin marketplace update ram-companies
```

## Developing this plugin

To try a skill from this repo before it's released, load it unreleased with:

```bash
claude --plugin-dir .
```

then invoke it as `/ram:<skill-name>` and run `/reload-plugins` after edits to pick up changes without restarting.

**This only works from a plain terminal, not the VS Code extension.** The VS Code extension launches its own managed `claude` process and has no setting to pass `--plugin-dir` (or any extra CLI flag) to it. If you're working in the VS Code extension, open a separate integrated or external terminal and run the command above there — it starts an independent CLI session, not the extension's chat panel. Hooks don't have this limitation: `.claude/settings.json` wires this repo's own hooks up directly via `${CLAUDE_PROJECT_DIR}`, so they run in any session (including the VS Code extension) without needing `--plugin-dir`.

## Skills

| Skill               | Invoke                   | Purpose                                                                           |
| ------------------- | ------------------------ | --------------------------------------------------------------------------------- |
| `add-migration`     | `/ram:add-migration`     | Create a Supabase migration (DDL + pgTAP tests + type regen)                      |
| `codebase-review`   | `/ram:codebase-review`   | Full-codebase audit: security, performance, best practices (for vibe-coded apps)  |
| `deno-tests`        | `/ram:deno-tests`        | Add unit tests to a Supabase Edge Function                                        |
| `extract-component` | `/ram:extract-component` | Pull a section out of a large file into a standalone component                    |
| `extract-service`   | `/ram:extract-service`   | Move inline Supabase queries into a service layer                                 |
| `find-usages`       | `/ram:find-usages`       | Find every file that uses a component, function, or class string                  |
| `git-workflow`      | `/ram:git-workflow`      | Create a feature branch, write a conventional commit, and open a PR against `dev` |
| `new-feature`       | `/ram:new-feature`       | Scaffold a new feature folder following feature-based architecture                |
| `pr-review`         | `/ram:pr-review`         | Full PR review: conventions, security, code quality, docs accuracy                |
| `setup-env-local`   | `/ram:setup-env-local`   | Write VITE_SUPABASE_ANON_KEY to .env.local for local Supabase development         |
| `setup-formatting`  | `/ram:setup-formatting`  | Set up Prettier, ESLint auto-fix, EditorConfig, and VS Code format-on-save        |
| `ui-update`         | `/ram:ui-update`         | Safely apply a UI change everywhere it appears across the repo                    |
| `unit-tests`        | `/ram:unit-tests`        | Write Vitest unit tests for pure functions in src/                                |
| `update-plugin`     | `/ram:update-plugin`     | Update the installed ram plugin to the latest marketplace version                 |

## Hooks

Automatically wired when the plugin is enabled:

| Hook                   | Trigger                | What it does                                                                                                                                                     |
| ---------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `protect-generated.js` | PreToolUse Write/Edit  | Blocks edits to auto-generated `types.ts`; warns before editing migrations                                                                                       |
| `format.js`            | PostToolUse Write/Edit | Runs ESLint `--fix` + Prettier on every saved file                                                                                                               |
| `post-write-checks.js` | PostToolUse Write/Edit | Flags `as any`, `window.confirm()`, silent `.catch`, inline `style={{}}`, Supabase in pages/, admin layout constants, hardcoded secrets; notes related importers |
| `stop-check.js`        | Stop                   | Runs `tsc --noEmit` + `npm test` at session end; silent on pass                                                                                                  |

## Project-local skills

Some skills are too project-specific to live here. Keep them in `.claude/skills/` inside the project repo (e.g. `add-admin-card`, `add-form-field` for RAM AIR EZ).
