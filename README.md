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

## Testing skills (evals)

Skills are natural-language instructions, not deterministic code — you can't unit-test them the way `tests/*.test.js` tests the hooks. Instead, this repo uses the `skill-creator` plugin to run **evals**: give the skill a few realistic prompts, run Claude with and without the skill, and grade the responses against a checklist.

### Setup

`skill-creator@claude-plugins-official` is enabled at project scope (see `.claude/settings.json`), so it's available to everyone working in this repo. If it's ever missing:

```bash
claude plugin install skill-creator@claude-plugins-official --scope project
```

### Creating evals for a skill

Add `evals/evals.json` inside the skill's own directory (sibling to `SKILL.md`), e.g. `skills/<skill-name>/evals/evals.json`:

```json
{
  "skill_name": "<skill-name>",
  "evals": [
    {
      "id": 1,
      "prompt": "A realistic user prompt that should exercise the skill",
      "expected_output": "One-sentence description of what a good response looks like",
      "files": [],
      "expectations": [
        "An objectively checkable statement about the response",
        "Another one — these become the grading checklist"
      ]
    }
  ]
}
```

Write 2-3 prompts per skill covering the common case plus at least one edge case (an ambiguous request the skill should resolve without asking a redundant question, or a failure mode it should troubleshoot correctly). Keep `expectations` objectively verifiable — "mentions running `claude plugin list`" grades cleanly, "sounds helpful" doesn't.

### Running the eval

1. Before spawning any agent, copy that eval's `files` into per-run input folders: `skills/<skill-name>-workspace/iteration-1/<eval-name>/{with_skill,without_skill}/inputs/`. Point each agent at its own copy, never at the shared `skills/<skill-name>/evals/files/` originals — an agent that goes looking for "the project" on disk will find and edit whatever's in front of it, "please don't modify the original" is an instruction, not a permission boundary, and a stray edit to the shared fixture silently corrupts every other eval case that reuses it. (Not hypothetical: a baseline run once edited the shared `ui-update` fixtures in place instead of its output folder, requiring a manual restore before the results could be trusted.)
2. For each eval case, spawn two subagents in the same turn: one instructed to read the skill's `SKILL.md` and follow it (`with_skill`), one given the same prompt with no skill reference at all (`without_skill`, the baseline). Point each at its own `inputs/` copy from step 1. Save each response under `skills/<skill-name>-workspace/iteration-1/<eval-name>/{with_skill,without_skill}/outputs/`.
3. Grade each response against that eval's `expectations`, saving `grading.json` per run (see `skill-creator`'s `references/schemas.md` for the exact field names — the viewer depends on them matching exactly).
4. Aggregate into `benchmark.json` at the iteration root (pass rates, timing, tokens per configuration).
5. Generate the review page and open it as an artifact/static file:

   ```bash
   python <skill-creator-path>/eval-viewer/generate_review.py \
     skills/<skill-name>-workspace/iteration-1 \
     --skill-name <skill-name> \
     --benchmark skills/<skill-name>-workspace/iteration-1/benchmark.json \
     --static <output.html>
   ```

Ask Claude to "run the eval harness for `<skill-name>`" and it will do all of the above. See `skills/update-plugin/evals/evals.json` for an example eval set — running it turned up a real gap in the `update-plugin` skill (it doesn't explain that `--scope project` only pins config in git and doesn't push the update to teammates' machines), caught by comparing against the no-skill baseline. `<skill-name>-workspace/` is scratch output from that run — regenerate it locally rather than committing it; it's gitignored.

### Iterating

If grading surfaces a real gap in the skill (not just a one-off phrasing issue), fix `SKILL.md` and rerun into `iteration-2/`, passing `--previous-workspace iteration-1` to the viewer so you can compare. Delete `<skill-name>-workspace/` once you're done — it's scratch output, not something to keep committed long-term (unless you want to preserve a specific run as a regression fixture).

### CI

PR checks (`.github/workflows/ci.yml`) run **structural validation only** for any skill whose files changed in the PR: `evals/evals.json`, if present, must be valid JSON matching the schema above (non-empty `prompt` and `expectations` per eval). CI does not spawn real `claude -p` calls or grade responses — that requires an Anthropic API key and real token spend, so the qualitative with-skill/without-skill run above stays a manual (Claude-assisted) step, not an automated gate.

## Project-local skills

Some skills are too project-specific to live here. Keep them in `.claude/skills/` inside the project repo (e.g. `add-admin-card`, `add-form-field` for RAM AIR EZ).
