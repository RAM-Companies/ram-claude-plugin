Here's how to grab the latest version of the `ram` plugin:

1. **Refresh the marketplace catalog** — this pulls the latest metadata from the RAM Companies marketplace repo so Claude Code knows a new version exists:

   ```bash
   claude plugin marketplace update ram-companies
   ```

2. **Update the plugin itself**:

   ```bash
   claude plugin update ram@ram-companies
   ```

   If you installed it at the project level rather than user level, add `--scope project`:

   ```bash
   claude plugin update ram@ram-companies --scope project
   ```

3. **Pick up the changes in your current session** without restarting:

   ```
   /reload-plugins
   ```

A couple of things worth knowing:

- New skills only show up after a version bump lands in `plugin.json` on the `main` branch of the marketplace repo — if you update and don't see the new skill, the maintainers may not have merged/bumped it yet. Re-running `claude plugin marketplace update ram-companies` will confirm whether a newer version is actually published.
- Once updated, new skills appear as `/ram:<skill-name>`. Run `/help` or check the plugin's README skills table to see the full current list and confirm the one you're after is there.
- If you've never installed the plugin before, use `claude plugin install ram@ram-companies` instead (after adding the marketplace once with `claude plugin marketplace add RAM-Companies/ram-claude-plugin`).

Note: I haven't run any of these commands for you — this is just the walkthrough. Let me know if you want me to go ahead and execute them.
