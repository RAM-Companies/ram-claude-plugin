You didn't do anything wrong — I checked the repo and this is expected right now.

There are two usual causes when `claude plugin update ram@ram-companies` reports no update available:

1. The local marketplace catalog is stale (it hasn't picked up the latest commit on `main` yet).
2. No version bump has actually been merged to `main` yet.

I checked `.claude-plugin/plugin.json` on the `main` branch of `ram-claude-plugin`, and it's **#2**: `main` is currently at version `1.4.1`. The `1.4.3` bump (from commit `d421c44`, "chore: update version to 1.4.3 in plugin.json") only exists on the `feature/formatting` branch — it hasn't been merged into `main` yet. Since the marketplace always tracks `main`, there's no newer version for it to serve you, so `claude plugin update` is behaving correctly.

What I'd do next:

- If you just want to be sure the catalog itself isn't stale, refresh it first:
  ```bash
  claude plugin marketplace update ram-companies
  ```
  then retry `claude plugin update ram@ram-companies`. (Given what I found, this alone won't produce an update — but it rules out cause #1 for certain.)
- The real fix is to merge the `feature/formatting` branch (which carries the 1.4.3 bump) into `main`. Once that's merged, re-run the marketplace refresh and the update command, and `claude plugin list` should then show `1.4.3`.

So: no mistake on your end — the plugin update you're expecting simply hasn't shipped to `main` yet.
