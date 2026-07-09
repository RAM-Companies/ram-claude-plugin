To get the newest version of the `ram` plugin, here's what I'll do:

**Step 1 — Refresh the marketplace catalog**, so your local catalog knows about the latest version published on `main`:

```bash
claude plugin marketplace update ram-companies
```

**Step 2 — One quick question before I update:** should this update apply just to you, or to the whole team?

- **user** (default) — updates the plugin for you only.
- **project** — pins the updated version in this project's `.claude/settings.json`, so everyone who opens the repo gets the same version.

**Step 3 — Update the plugin** (once you tell me the scope):

```bash
claude plugin update ram@ram-companies
```

Or, if you want it pinned for the whole team:

```bash
claude plugin update ram@ram-companies --scope project
```

**Step 4 — Verify** the update actually landed:

```bash
claude plugin list
```

I'll confirm the `ram` entry's version matches the current `version` field in `.claude-plugin/plugin.json` on `main`. If it doesn't match yet, the marketplace catalog may not have refreshed — I'll re-run Step 1.

**Step 5 — Reload if you're mid-session:** since you're already in an active session with the plugin loaded, after updating you'll want to run:

```
/reload-plugins
```

That'll make the new skill show up as `/ram:<skill-name>` without needing to restart.

**Troubleshooting, in case something doesn't go as expected:**

- If the update reports no newer version available: either the marketplace catalog is stale (re-run `claude plugin marketplace update ram-companies`) or no version bump has been merged to `main` yet — worth checking the `version` field in `.claude-plugin/plugin.json` on `main` directly.
- If `claude plugin update` fails with "plugin not found": the marketplace isn't registered locally yet. Run `claude plugin marketplace add RAM-Companies/ram-claude-plugin` first, then retry.

So — just let me know: **user** scope or **project** scope, and I'll run Steps 1 and 3 (then verify and reload) accordingly.
