# ram-claude-plugin — Development Guide

This is the RAM Companies Claude Code plugin. It ships shared skills and hooks for RAM React/TypeScript/Supabase/Vercel projects. Install it via:

```bash
claude plugin marketplace add RAM-Companies/ram-claude-plugin
claude plugin install ram@ram-companies
```

Official docs this file enforces:

- [Creating plugins](https://code.claude.com/docs/en/plugins)
- [Plugins reference](https://code.claude.com/docs/en/plugins-reference)
- [Skills authoring](https://code.claude.com/docs/en/skills)
- [Hooks authoring](https://code.claude.com/docs/en/hooks)
- [Plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)

---

## Directory layout

```text
ram-claude-plugin/
├── .claude-plugin/
│   ├── plugin.json          # Plugin identity (name, version, description)
│   └── marketplace.json     # RAM Companies marketplace registration
├── .claude/
│   └── settings.json        # Dogfoods this repo's own hooks (see below)
├── skills/
│   └── <skill-name>/
│       └── SKILL.md         # One skill per subdirectory
├── hooks/
│   ├── hooks.json           # Hook configuration (event → handler mapping)
│   ├── protect-generated.js # PreToolUse: block edits to auto-gen files
│   ├── format.js            # PostToolUse: ESLint + Prettier
│   ├── post-write-checks.js # PostToolUse: code quality + secret scan
│   └── stop-check.js        # Stop: tsc + npm test
├── tests/                   # node:test suite for the hook scripts
└── README.md
```

`.claude/settings.json` wires this repo's own `hooks/*.js` scripts up via `${CLAUDE_PROJECT_DIR}` so working on this plugin exercises the same hooks a consumer project gets — most usefully, `stop-check.js` runs `npm test` (the hook test suite) at the end of every session in this repo. It intentionally duplicates the four hook entries from `hooks/hooks.json` (which uses `${CLAUDE_PLUGIN_ROOT}`, only resolved when the plugin is actually installed) rather than self-installing via a local marketplace path — marketplace-installed plugins are copied into `~/.claude/plugins/cache`, so hook script edits wouldn't take effect without a reinstall. Keep both files in sync when adding or changing a hook.

**Rules enforced by the official spec:**

- `.claude-plugin/` holds only `plugin.json` (and `marketplace.json` for this project). Never put `skills/`, `hooks/`, `agents/`, or scripts inside `.claude-plugin/`.
- `skills/` and `hooks/` must be at the plugin root, not nested inside `.claude-plugin/`.
- Each skill is a directory containing exactly one `SKILL.md` — the directory name becomes the skill's invocation name (e.g., `skills/add-migration/SKILL.md` → `/ram:add-migration`).

---

## plugin.json

Reference: [Plugin manifest schema](https://code.claude.com/docs/en/plugins-reference#plugin-manifest-schema)

```json
{
  "name": "ram",
  "description": "Shared skills and hooks for RAM React/Supabase/Vercel projects",
  "version": "1.0.1",
  "repository": "https://github.com/RAM-Companies/ram-claude-plugin",
  "skills": "./skills/",
  "hooks": "./hooks/hooks.json"
}
```

Field rules:

| Field         | Rule                                                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`        | The namespace prefix — skills invoke as `/ram:<skill>`. Keep it short, lowercase, hyphen-only.                                                                                                          |
| `version`     | Bump this with every release. Users only get updates when the version field changes. Omitting it causes every commit to count as a new version, triggering reinstalls. Use semver: `MAJOR.MINOR.PATCH`. |
| `description` | One sentence. Shown in the plugin manager.                                                                                                                                                              |
| `repository`  | Full GitHub URL. Required for marketplace distribution.                                                                                                                                                 |
| `skills`      | Optional. Points to a custom skill directory; adds to (not replaces) the default `skills/` scan. Our value `"./skills/"` is the default location — redundant but harmless.                              |
| `hooks`       | Optional. Points to the hooks config file. Our value `"./hooks/hooks.json"` is the default location — redundant but explicit.                                                                           |

Claude Code ignores unrecognized fields and reports extra fields as warnings (not errors) from `claude plugin validate`. Known component path fields (`skills`, `hooks`, `agents`, `mcpServers`, etc.) are all valid per the official schema.

---

## Skills

Reference: [Agent Skills](https://code.claude.com/docs/en/skills)

### File format

Every skill is a folder under `skills/` with a `SKILL.md`:

```text
skills/
└── my-skill/
    ├── SKILL.md          # Required — instructions + frontmatter
    └── reference.md      # Optional — large reference loaded on demand
```

### SKILL.md frontmatter

```yaml
---
name: my-skill # Optional — overrides directory name
description: One sentence. # Required — controls when Claude auto-invokes this skill
disable-model-invocation: true # Optional — makes skill user-only (no auto-invocation)
---
```

**`description` is the most important field.** Claude uses it to decide when to invoke the skill automatically. Write it as a use-case sentence: what the skill does and when to use it. Bad: `"Migration helper"`. Good: `"Makes a change to the database schema — add a column, create a table, add a policy, etc. Always use this instead of editing the database directly."`.

**`disable-model-invocation: true`** prevents Claude from auto-invoking the skill mid-conversation. Use this for skills that require explicit user intent (e.g., destructive operations, PR review). Omit it for skills Claude should discover and apply automatically.

### Arguments

Use `$ARGUMENTS` anywhere in the skill body to capture text typed after the skill name:

```bash
/ram:find-usages MyComponent
# $ARGUMENTS → "MyComponent"
```

If a skill needs no arguments, don't add `$ARGUMENTS` — calling with extra text is harmless.

### Writing effective skill bodies

1. **State the goal first.** Open with what Claude is doing, not with rules.
2. **Use numbered steps.** Skills run sequentially — numbered steps make progress checkable.
3. **Encode the decisions.** A skill that says "add RLS" is weaker than one that shows the exact SQL pattern. Embed the team's hard-won knowledge directly.
4. **Include examples.** Show correct output patterns, not just descriptions of them.
5. **End with a commit checklist.** Prevents Claude from finishing a skill and forgetting to commit related files together.
6. **Don't duplicate CLAUDE.md content** in skills. CLAUDE.md is always loaded; skill bodies load only when invoked — use skills for step-by-step procedures, use CLAUDE.md for always-on rules.

### Adding a new skill

```bash
mkdir skills/<skill-name>
# Write skills/<skill-name>/SKILL.md
```

Test it:

```bash
claude --plugin-dir . /ram:<skill-name>
```

Then run `/reload-plugins` inside an active session to pick up changes without restarting.

---

## Hooks

Reference: [Hooks](https://code.claude.com/docs/en/hooks)

### hooks.json format

```json
{
  "hooks": {
    "<EventName>": [
      {
        "matcher": "ToolName|OtherTool",
        "hooks": [
          {
            "type": "command",
            "command": "node",
            "args": ["${CLAUDE_PLUGIN_ROOT}/hooks/my-hook.js"],
            "timeout": 30,
            "statusMessage": "Running check..."
          }
        ]
      }
    ]
  }
}
```

### Path resolution — use `${CLAUDE_PLUGIN_ROOT}`

Always reference hook scripts using the `${CLAUDE_PLUGIN_ROOT}` path placeholder in `args`:

```json
{
  "type": "command",
  "command": "node",
  "args": ["${CLAUDE_PLUGIN_ROOT}/hooks/protect-generated.js"]
}
```

This resolves to the plugin's installation directory at runtime. Do not hardcode `~/.claude/plugins/cache/...` paths or use PowerShell globs to find scripts — those are fragile workarounds. The exec form (`args` array) avoids shell tokenization and quoting issues on Windows, and is preferred by the official docs for hooks with path variables.

### Keep `hooks/hooks.json` and `.claude/settings.json` in sync

`.claude/settings.json` exists solely so this repo dogfoods its own hooks while you develop them — it's never shipped to or read by consumer projects (they only get `hooks/hooks.json`, via `plugin.json`'s `hooks` field). The two files must stay structurally identical: same events, same matchers, same script list, same order, same `timeout`/`statusMessage` — the **only** difference is the path variable in `args`:

| File                    | Path variable                             |
| ----------------------- | ----------------------------------------- |
| `hooks/hooks.json`      | `${CLAUDE_PLUGIN_ROOT}/hooks/<script>.js` |
| `.claude/settings.json` | `${CLAUDE_PROJECT_DIR}/hooks/<script>.js` |

Whenever you add, remove, or change a hook entry in `hooks/hooks.json` (new script, changed matcher, changed timeout), make the identical edit in `.claude/settings.json`, swapping only the path variable. Nothing enforces this automatically — `claude plugin validate` only checks `hooks/hooks.json` — so treat it as one logical change across two files, not two separate edits. If the files drift, this repo silently stops dogfooding whatever changed.

### Exit codes — the contract

| Exit code     | Meaning            | Effect                                                  |
| ------------- | ------------------ | ------------------------------------------------------- |
| `0`           | Success            | Parse stdout for optional JSON control output           |
| `2`           | Blocking error     | Prevent the action; send stderr to Claude as the reason |
| Anything else | Non-blocking error | Log the error, continue normally                        |

Exit 2 is the correct code to block a tool call. Never exit 1 to block — that's a non-blocking error that logs and continues.

### Stdin protocol

Every hook receives the full event payload as JSON on stdin. Parse it with `fs.readFileSync(0, 'utf8')` (synchronous) or the async equivalent. Key fields always present:

```json
{
  "session_id": "...",
  "cwd": "/path/to/project",
  "hook_event_name": "PreToolUse",
  "tool_name": "Write",
  "tool_input": { "file_path": "...", "content": "..." }
}
```

For `Write` and `Edit`, `tool_input.file_path` is the file being written.

### Structured JSON output (exit 0)

To provide richer control than exit codes alone, write JSON to stdout on exit 0:

```json
{
  "continue": true,
  "systemMessage": "Warning: this file looks auto-generated",
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "ask",
    "permissionDecisionReason": "Editing migration files may cause schema drift"
  }
}
```

For `PreToolUse`, set `permissionDecision` to `"allow"`, `"deny"`, or `"ask"`. For `PostToolUse`, set `"decision": "block"` to prevent Claude from proceeding after a write.

### Matchers

The `matcher` field controls which tool events fire the hook:

| Syntax                              | How it's evaluated                                       |
| ----------------------------------- | -------------------------------------------------------- |
| `"Write\|Edit"`                     | Exact string match on tool name — fires on Write OR Edit |
| Any string with non-word characters | JavaScript regex                                         |
| `"*"` or omitted                    | Fires on all tools                                       |

`"Write|Edit"` uses exact match — the `|` is the OR operator for the plain-string syntax, not regex. Use `"Write\|Edit\|Bash"` to add more tools. To match MCP tools, use regex: `"mcp__memory__.*"`.

### Timeouts

Default timeout for command hooks is 600 seconds. Set shorter timeouts for hooks that should fail fast:

```json
{ "timeout": 10 }
{ "timeout": 30 }
{ "timeout": 120 }
```

Respectively: `protect-generated.js` (fast path check), `format.js` (ESLint + Prettier), `stop-check.js` (tsc + npm test). `Stop` hooks with long timeouts are fine — they run after Claude finishes, not during tool calls.

### Hook script guidelines

1. **Read stdin completely before doing anything.** Use `fs.readFileSync(0, 'utf8')` or the async stream pattern.
2. **Exit 2 + write to stderr** to block and explain: `process.stderr.write('Reason\n'); process.exit(2);`
3. **Exit 0 silently** if there's nothing to report — don't emit noise on every write.
4. **Keep PreToolUse hooks fast** (≤10s). They block the tool call and the user is waiting.
5. **Don't spawn heavy processes in PreToolUse.** Linting belongs in PostToolUse.
6. **Write to stderr for user-visible messages, stdout for JSON control output.** Mixing them breaks JSON parsing.
7. **No `console.log` in hook scripts.** Use `process.stderr.write()` for diagnostics and `process.stdout.write(JSON.stringify(...))` for structured output.

### Hook events reference

| Event              | When                             | Blockable                                    |
| ------------------ | -------------------------------- | -------------------------------------------- |
| `PreToolUse`       | Before a tool executes           | Yes (exit 2 or `permissionDecision: "deny"`) |
| `PostToolUse`      | After a tool succeeds            | Yes (`"decision": "block"`)                  |
| `Stop`             | After Claude finishes responding | Yes (prevents stopping)                      |
| `SessionStart`     | New or resumed session           | No                                           |
| `UserPromptSubmit` | User submits a message           | Yes (exit 2 rejects the prompt)              |

Adding a new hook event? Check the [full event list](https://code.claude.com/docs/en/hooks#hook-events) first — there are 20+ events.

---

## Testing locally

Reference: [Test your plugins locally](https://code.claude.com/docs/en/plugins#test-your-plugins)

### Load the plugin for a session

```bash
claude --plugin-dir .
```

This loads the plugin from the current directory without requiring installation. Skills appear as `/ram:<name>` and hooks fire automatically.

### Reload without restarting

Inside an active session:

```shell
/reload-plugins
```

This reloads skills, hooks, and agents. Use it after editing any plugin file during development.

### Test hooks individually

Simulate hook input by piping JSON:

```bash
echo '{"hook_event_name":"PostToolUse","tool_name":"Write","tool_input":{"file_path":"src/foo.ts","content":"const x: any = 1;"}}' | node hooks/post-write-checks.js
```

### Automated hook tests

`tests/*.test.js` covers all four hook scripts using Node's built-in test runner (no dependencies). They spawn each hook as a real child process with controlled stdin and a stubbed `npx`/`npm` on `PATH` (`tests/helpers/`), so they exercise actual exit-code/stdout behavior — including the failure modes that tend to go unnoticed when this plugin runs inside someone else's project (malformed stdin, ESLint/Prettier/tsc missing or misbehaving, timeouts).

```bash
npm test
```

Run this after changing any hook script. If you add a new hook, add a matching `tests/<hook-name>.test.js`.

### Validate before release

```bash
claude plugin validate
```

This runs the same checks the community marketplace review pipeline uses. Fix all validation errors before bumping the version. Pass `--strict` to treat unrecognized-field warnings as errors.

---

## Versioning

Reference: [Version management](https://code.claude.com/docs/en/plugins-reference#version-management)

- The `version` field in `plugin.json` controls when users receive updates.
- **Bump once, on the PR that introduces the change** — not on every commit during review, and not separately after merge. The version bump and the feature land together.
- Follow semver: `MAJOR.MINOR.PATCH`.
  - **PATCH**: bug fixes in hooks or skill wording
  - **MINOR**: new skill or new hook
  - **MAJOR**: breaking change (renamed skill, changed hook behavior that affects projects)
- Do not bump version for changes to `README.md`, `CLAUDE.md`, or `.gitattributes` only — those don't affect plugin behavior and don't need a release.
- After bumping version, update the `marketplace.json` if needed (it doesn't carry a version — it points to the repo).

---

## marketplace.json

Reference: [Plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)

```json
{
  "name": "ram-companies",
  "owner": { "name": "RAM Companies" },
  "plugins": [
    {
      "name": "ram",
      "source": { "source": "github", "repo": "RAM-Companies/ram-claude-plugin" }
    }
  ]
}
```

This file registers the RAM Companies marketplace. Users add it and install the plugin with:

```bash
claude plugin marketplace add RAM-Companies/ram-claude-plugin
claude plugin install ram@ram-companies
```

To update the local marketplace catalog:

```bash
claude plugin marketplace update ram-companies
```

Rules:

- Do not add `version` to `marketplace.json` — the marketplace always points to the current default branch.
- The `name` in `marketplace.json → plugins[].name` must match the `name` field in `plugin.json` exactly (`"ram"`).
- The top-level `name` (`"ram-companies"`) is the marketplace identifier used in `claude plugin install ram@ram-companies`.
- Plugin install syntax is `<plugin-name>@<marketplace-name>`, not `<marketplace>/<plugin>`.

---

## Common mistakes

These are caught by `claude plugin validate` or by reading the official docs:

| Mistake                                                          | Correct approach                                                             |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Putting `skills/` inside `.claude-plugin/`                       | `skills/` goes at the plugin root                                            |
| Hardcoding `~/.claude/plugins/cache/...` paths in hooks          | Use `${CLAUDE_PLUGIN_ROOT}/hooks/my-hook.js` in `args`                       |
| Using PowerShell glob to find hook scripts                       | Use exec form with `${CLAUDE_PLUGIN_ROOT}`                                   |
| Exit 1 to block a tool                                           | Exit 2 to block; exit 1 is a non-blocking error                              |
| `console.log()` in hooks                                         | `process.stderr.write()` for messages, JSON to stdout for structured output  |
| Skill `description` that names the skill instead of the use-case | Write a sentence describing when to use it                                   |
| Not bumping `version` after a change                             | Bump version for every release                                               |
| Committing secrets in hook scripts or skill bodies               | Use env vars; hooks receive `cwd` — read project `.env` at runtime if needed |
| Editing `supabase/migrations/*.sql` files                        | Create a new migration — never edit existing ones                            |
| Install syntax `ram-companies/ram`                               | Correct syntax is `ram@ram-companies` (`<plugin>@<marketplace>`)             |

---

## Git workflow conventions

Reference: [Conventional Commits spec](https://www.conventionalcommits.org/en/v1.0.0/)

RAM projects use the `/ram:git-workflow` skill to enforce these rules. The official `commit-commands` plugin (from the Anthropic marketplace) provides generic git scaffolding, but does not know RAM's branch naming, base branch (`dev`), or scope taxonomy — so the RAM skill is the authoritative source.

Install the companion plugin for generic git scaffolding (optional, user scope):

```bash
claude plugin install commit-commands@claude-plugins-official
```

### Branch naming

Pattern: `<type>/<short-description>` — lowercase, hyphen-separated, ≤5 words.

Valid types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`.

Always branch from `dev`, not `main`:

```bash
git checkout dev && git pull origin dev
git checkout -b feat/your-feature-name
```

`main` is the production branch. Feature branches must target `dev`. PRs against `main` are for release merges only.

### Conventional commit format

```text
<type>(<scope>): <description>
```

- **Type**: same values as branch types
- **Scope**: `db`, `auth`, `ui`, `api`, `admin`, `hooks`, `skills` — or omit for cross-cutting changes
- **Description**: imperative, lowercase, ≤72 chars, no trailing period

Examples:

```text
feat(db): add status column to quotes table
fix(api): handle null profile in notification service
chore(ui): upgrade shadcn/ui button component
refactor(admin): extract invoice list into service layer
```

Breaking changes — add `!` and a footer:

```text
feat(db)!: rename quotes table to proposals

BREAKING CHANGE: all references to `quotes` must be updated to `proposals`
```

### PR rules

- Title follows the same conventional commit format as the first commit on the branch
- Target branch is always `dev`
- Include migration steps if there is a DB change; include a screenshot or Loom if there is a UI change
- Do not self-merge without review (exception: `chore`/`docs` branches)

---

## Adding a new skill checklist

- [ ] Create `skills/<name>/SKILL.md`
- [ ] Frontmatter has a `description` that explains when Claude should invoke it
- [ ] Skill body uses numbered steps
- [ ] Skill body encodes team conventions (not just vague advice)
- [ ] Skill ends with a commit checklist if it produces files
- [ ] Test with `claude --plugin-dir . /ram:<name>`
- [ ] Add row to `README.md` skills table
- [ ] Bump `PATCH` version in `plugin.json`

## Adding a new hook checklist

- [ ] Hook script reads full stdin before processing (`fs.readFileSync(0, 'utf8')`)
- [ ] Hook uses `${CLAUDE_PLUGIN_ROOT}` in `hooks.json` via exec form (`args` array)
- [ ] Fast checks (≤10s) go in `PreToolUse`; slow checks go in `PostToolUse` or `Stop`
- [ ] Exit 2 + stderr for blocking; exit 0 for pass
- [ ] No `console.log` — use `process.stderr.write` or JSON stdout
- [ ] Timeout is set appropriately in `hooks.json`
- [ ] Test by piping JSON to the script directly
- [ ] Top-level logic is wrapped in try/catch so malformed/unexpected input exits clean instead of crashing uncaught (see existing hooks for the pattern)
- [ ] Mirror the new/changed hook entry in `.claude/settings.json` (see [Keep hooks.json and .claude/settings.json in sync](#keep-hookshooksjson-and-claudesettingsjson-in-sync))
- [ ] Add `tests/<hook-name>.test.js` covering the normal path, guard clauses, and malformed input; run `npm test`
- [ ] Bump `PATCH` version in `plugin.json`
