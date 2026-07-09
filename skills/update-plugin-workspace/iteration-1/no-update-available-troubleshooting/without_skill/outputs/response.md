You probably didn't do anything wrong on the command line — `claude plugin update ram@ram-companies` is the right syntax. "No update available" just means the marketplace catalog you have locally resolves to the same version you already have installed. There are a few different reasons that can happen, roughly in order of likelihood:

**1. The change you're expecting hasn't actually landed on `main` yet.**
I checked this repo directly: the marketplace (`marketplace.json`) always points at the GitHub repo's default branch, `main`. Right now `main` has `plugin.json` at version `1.4.1`. The `1.5.0` bump (and whatever feature came with it) only exists on a local/feature branch that hasn't been merged and pushed to `main`. If that's the change you're waiting on, there's nothing to update to yet — `claude plugin update` can only ever see what's actually merged into `main` on GitHub. This is the most likely explanation if you know a version bump was made but it was on a PR that hasn't merged.

**2. Your local marketplace catalog is stale.**
`claude plugin update` compares against your locally cached marketplace metadata, not live GitHub. If someone merged a version bump to `main` _after_ you last synced, your catalog won't know about it yet. Fix:

```bash
claude plugin marketplace update ram-companies
claude plugin update ram@ram-companies
```

Always refresh the marketplace before update-checking if you suspect something new shipped.

**3. You're already on the latest version.**
Run `claude plugin list` (or check `~/.claude/plugins/cache/.../plugin.json`) to see what version you currently have installed, and compare it to what's on `main` in GitHub. If they already match, "no update available" is correct and expected — there's nothing wrong.

**4. The version field genuinely wasn't bumped.**
Per this repo's convention (see `CLAUDE.md`), Claude Code only recognizes a new release when `version` in `plugin.json` changes — merging code changes without bumping `version` is invisible to the update mechanism by design. If a PR merged to `main` without bumping the version, that's a process miss on the repo side, not something you did wrong locally.

**What I'd check first:** run `claude plugin marketplace update ram-companies` then `claude plugin update ram@ram-companies` again. If it still says no update is available, compare your installed version against `main`'s `plugin.json` on GitHub — if they match, everything is working correctly and the update you're expecting simply hasn't been merged/released yet.
