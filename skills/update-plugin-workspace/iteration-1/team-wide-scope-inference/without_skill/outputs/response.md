Before I run anything, a quick clarification on what "update it for the whole team" actually requires, because it's not the same action as updating it for yourself — and I want to flag a couple of things I found while checking this repo.

**How Claude Code plugin installs actually work**

- `claude plugin install ram@ram-companies` (or `claude plugin update`) only touches your own machine — it writes into your personal `~/.claude` plugin cache. Running it yourself would _not_ update anyone else on the team, no matter how many times I run it here.
- The only thing that's genuinely shared across the team is whatever gets **committed to git** — specifically `extraKnownMarketplaces` / `enabledPlugins` in a project's checked-in `.claude/settings.json`. That file (not `.claude/settings.local.json`, which is per-user and typically gitignored) is what causes everyone who opens the project to automatically get the `ram-companies` marketplace registered and the `ram` plugin enabled.
- Even with that config committed, Claude Code doesn't "push" version bumps to teammates' machines. Each person's Claude Code still has to refresh its local marketplace catalog (`claude plugin marketplace update ram-companies`) to actually resolve to 1.6.0, since `marketplace.json` intentionally carries no version and just tracks whatever is on `main`. So "team-wide" really has two separate parts: (1) making sure the shared config is correct in git, and (2) telling people to refresh, since that pull can't be forced from a commit.

**What I found when I checked this repo**

- The current directory is `ram-claude-plugin` itself — i.e., the plugin's source repo, not a project that _consumes_ `ram@ram-companies` via the marketplace. Its own `.claude/settings.json` only has `skill-creator@claude-plugins-official` enabled; there's no `ram@ram-companies` entry here at all. That's intentional (per this repo's own docs) — it dogfoods its hooks directly against `${CLAUDE_PROJECT_DIR}` rather than installing itself as a marketplace plugin. So there's nothing to bump in _this_ repo's settings.json on that front.
- I also checked local git state: the currently checked-out branch (`feat/update-plugin-skill`) has `plugin.json` at version `1.5.0`, and the local copy of `main` only shows `1.4.1` — I don't see a merged 1.6.0 bump in this clone yet. That could just mean I need to `git fetch origin` to see the PR you mentioned, but I wanted to flag it rather than assume it's already there.

**So, before I touch anything:** did you mean update this repo (the plugin source), or a different downstream project that has `ram@ram-companies` installed via the marketplace? If it's a downstream project, point me at it and I'll:

1. `git fetch` / pull `main` there (or just confirm via GitHub) to verify the 1.6.0 tag/commit really landed.
2. Check that project's checked-in `.claude/settings.json` (not `settings.local.json`) for an `enabledPlugins: {"ram@ram-companies": true}` entry (and matching `extraKnownMarketplaces` if it's not using the default marketplace list) — add and commit it if it's missing, so anyone who opens the project from now on gets the plugin automatically, instead of it only living in your personal config.
3. Run `claude plugin marketplace update ram-companies` and `claude plugin install ram@ram-companies` locally so your own copy is on 1.6.0.
4. Post a short note to the team (Slack/PR description/README) telling them to run `claude plugin marketplace update ram-companies` themselves — that step can't be committed into git; it has to happen on each person's machine.

I haven't run any install/update commands or touched any settings.json yet — this is just the plan. Let me know which repo you mean and I'll carry it out.
