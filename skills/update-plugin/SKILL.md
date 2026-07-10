---
name: update-plugin
description: Update the installed ram plugin to the latest published version from the RAM Companies marketplace — use when the user asks to update the plugin, get the latest skills/hooks, or check for plugin updates.
---

Update the `ram` plugin (this plugin, once installed in a consumer project) to the newest version published on the `ram-companies` marketplace.

## Step 1 — Refresh the marketplace catalog

```bash
claude plugin marketplace update ram-companies
```

This pulls the latest commit from the default branch (`main`) so the local catalog knows about any version bump in `plugin.json`.

## Step 2 — Determine scope

Ask the user (if not already stated) whether the update should apply to just them or the whole team:

- **`user`** (default) — updates the plugin for the current user only. Nothing shared, nothing committed.
- **`project`** — writes `enabledPlugins`/`extraKnownMarketplaces` into the project's checked-in `.claude/settings.json`, so that anyone who opens the repo _from then on_ has the marketplace registered and the plugin enabled automatically.

**Neither scope actually pushes the update to teammates' machines.** A plugin install/update always writes to the _current user's_ local `~/.claude` plugin cache — that part never leaves this machine, regardless of scope. Project scope only commits which plugin/marketplace _should_ be enabled; it doesn't and can't force anyone else's Claude Code to pull the new version. Each teammate still has to, on their own machine: pull the branch/commit containing the `.claude/settings.json` change, then run `claude plugin marketplace update ram-companies` themselves (their local catalog won't refresh on its own). So "update it for the whole team" is really two separate things — get the config change committed and merged, _and_ tell the team to refresh — not one command that does both.

## Step 3 — Update the plugin

```bash
claude plugin update ram@ram-companies
```

Add `--scope project` if Step 2 resolved to project scope:

```bash
claude plugin update ram@ram-companies --scope project
```

If this used project scope, the `.claude/settings.json` change still needs to be committed and pushed like any other change (branch, commit, PR — see `/ram:git-workflow`) before it reaches teammates at all. Once merged, tell the team to run `claude plugin marketplace update ram-companies` on their own machines — committing the config doesn't do that for them.

## Step 4 — Verify

```bash
claude plugin list
```

Confirm the `ram` entry's version matches the current `version` field in this repo's `.claude-plugin/plugin.json` on `main`. If it doesn't, the marketplace catalog may not have refreshed yet — re-run Step 1.

## Step 5 — Reload if mid-session

If the user is running this inside an active session that already has the plugin loaded:

```shell
/reload-plugins
```

## Troubleshooting

**Update reports no newer version available:**

> Either the marketplace catalog is stale (re-run `claude plugin marketplace update ram-companies`) or no version bump has been merged to `main` yet. Check `.claude-plugin/plugin.json`'s `version` field directly on the `main` branch of the repo.

**`claude plugin update` fails with "plugin not found":**

> The marketplace isn't registered locally yet. Run `claude plugin marketplace add RAM-Companies/ram-claude-plugin` first, then retry.
