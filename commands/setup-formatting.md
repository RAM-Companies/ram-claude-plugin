# Setup Formatting

Set up Prettier, ESLint auto-fix, EditorConfig, and VS Code format-on-save for this project. Perform each step below in order.

## 1. Ensure an ESLint config file exists

Check for a flat config (`eslint.config.js`/`.mjs`/`.cjs`/`.ts`) or a legacy config (`.eslintrc.*`, or an `eslintConfig` key in `package.json`). If one already exists, leave it as-is and move to step 2.

If none exists, create a flat config baseline appropriate to the project:

- **Next.js project** (`next` listed in `package.json` dependencies): run `npm install --save-dev eslint @next/eslint-plugin-next` if either is missing, then create `eslint.config.mjs`:

  ```js
  import next from "@next/eslint-plugin-next";

  export default [
    { plugins: { "@next/next": next }, rules: { ...next.configs.recommended.rules, ...next.configs["core-web-vitals"].rules } }
  ];
  ```

(If the project has no `tsconfig.json`, skip any TypeScript-specific ESLint config additions.)

- **Any other Node/TS project**: run `npm install --save-dev eslint @eslint/js` (add `typescript-eslint` too if a `tsconfig.json` is present), then create `eslint.config.mjs`:

  ```js
  import js from "@eslint/js";
  import { defineConfig } from "eslint/config";

  export default defineConfig([js.configs.recommended]);
  ```

  Add `import tseslint from "typescript-eslint";` and spread `...tseslint.configs.recommended` into the array if TypeScript is present.

Verify with `npx eslint .` before continuing — it should run (even if it reports 0 files linted because the repo has no source yet) without an "Oops! Something went wrong!" crash.

## 2. Install ESLint and any plugins its config references

Read `package.json`. If `eslint` is not already a devDependency, run `npm install --save-dev eslint` (and `eslint-config-next` if this is a Next.js project without it).

Read the config file confirmed/created in step 1 and cross-check every plugin it _uses_ against what's actually installed:

- For each rule id with a namespace prefix (e.g. `"stylistic/brace-style"`), confirm that namespace is registered — either via a `plugins: { <namespace>: ... }` entry in the same config object, or provided transitively by an extended config (e.g. `eslint-config-next`).
- A namespace referenced in a rule but never registered means the corresponding package (e.g. `stylistic` → `@stylistic/eslint-plugin`) was never installed. Install it with `npm install --save-dev <package>`, import it, and add it to the config's `plugins` map.

Verify by running `npx eslint .` — if it prints "Oops! Something went wrong!" with "could not find plugin", a plugin is still missing or unregistered. Do not proceed until this passes (even if it reports real lint errors — those are fine, a crash is not).

## 3. Add `lint` script to `package.json`

Read `package.json`. If a `lint` script is not already present in `scripts`, add:

```json
"lint": "eslint ."
```

## 4. Install Prettier

Run `npm install --save-dev prettier` to add prettier to devDependencies.

## 5. Create `.prettierrc`

Create `.prettierrc` in the project root if it does not already exist:

```json
{
  "printWidth": 100,
  "trailingComma": "none"
}
```

If it already exists, read it and report its current contents without overwriting.

## 6. Add `format` script to `package.json`

Read `package.json`. If a `format` script is not already present in `scripts`, add:

```json
"format": "prettier --write ."
```

## 7. Create `.vscode/settings.json`

Create `.vscode/settings.json` if it does not exist:

~~~json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
~~~

If you are using a flat config (`eslint.config.*`), add `"eslint.useFlatConfig": true`. If you are using a legacy `.eslintrc.*`, omit it (or set it to `false`).

Also create `.vscode/extensions.json` (or merge into it) recommending `dbaeumer.vscode-eslint` and `esbenp.prettier-vscode` — without the ESLint extension installed, `editor.codeActionsOnSave` has nothing to trigger and saves will silently only run Prettier.

## 8. Add Claude Code post-edit hook

If you're using this plugin, PostToolUse formatting is already provided by `hooks/format.js` via `hooks/hooks.json` — no `.claude/settings.json` changes are needed.

For a project repo without this plugin, read `.claude/settings.json` (create it if missing). Merge in a `PostToolUse` hook on matcher `Write|Edit` that runs Prettier (the edited file, using `--ignore-unknown`) and ESLint (JS/TS only) after every file edit.
Detect the OS you're running on (e.g. check the platform the current shell/tools report, or ask if genuinely ambiguous) and use the matching variant below — do not default to Windows.

**Windows** — `shell: "powershell"`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "shell": "powershell",
            "command": "$j = [Console]::In.ReadToEnd() | ConvertFrom-Json; $f = $j.tool_input.file_path; if ($f) { npx prettier --write --ignore-unknown \"$f\" 2>$null; if ($LASTEXITCODE -ne 0) { Write-Output 'Prettier failed - run npx prettier manually to see the error'; exit 1 } $ext = [IO.Path]::GetExtension($f); if ($ext -match '^\\.(ts|tsx|js|jsx|cjs|mjs)$') { npx eslint --fix \"$f\" 2>$null; if ($LASTEXITCODE -eq 2) { Write-Output 'ESLint config is broken (fatal error, exit 2) - run npx eslint manually to see the crash'; exit 1 } } }; exit 0",
            "timeout": 30,
            "statusMessage": "Formatting and linting..."
          }
        ]
      }
    ]
  }
}
```

**macOS / Linux** — `shell: "bash"`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "shell": "bash",
            "command": "f=$(node -e \"let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);process.stdout.write((j.tool_input&&j.tool_input.file_path)||'')}catch(e){}})\"); if [ -n \"$f\" ]; then npx prettier --write --ignore-unknown \"$f\" 2>/dev/null; pcode=$?; if [ \"$pcode\" -ne 0 ]; then echo 'Prettier failed - run npx prettier manually to see the error'; exit 1; fi; if [[ \"$f\" =~ \\.(ts|tsx|js|jsx|cjs|mjs)$ ]]; then npx eslint --fix \"$f\" 2>/dev/null; code=$?; if [ \"$code\" -eq 2 ]; then echo 'ESLint config is broken (fatal error, exit 2) - run npx eslint manually to see the crash'; exit 1; fi; fi; fi; exit 0",
            "timeout": 30,
            "statusMessage": "Formatting and linting..."
          }
        ]
      }
    ]
  }
}
```

The bash variant reads stdin JSON via `node -e` (not `jq`) because Claude Code / this plugin’s hook runner already invokes hooks via `node` (see `hooks/hooks.json`), while `jq` is not guaranteed to be installed. If Node isn’t available in your environment, replace this JSON-parsing step with a tool that is.

ESLint exits `1` for ordinary lint findings (expected, non-blocking — keep swallowing these) but exits `2` for fatal errors like a missing/misconfigured plugin. Don't swallow exit `2` silently — surface it, otherwise a broken ESLint config becomes permanently invisible to every future edit.

If a `PostToolUse` / `Write|Edit` hook already exists, show the existing command and ask whether to replace it or leave it.

## 9. Create `.editorconfig`

Create `.editorconfig` in the project root if it does not already exist:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

If it already exists, read it and report its current contents without overwriting.

## 10. Format and lint the repo

Run `npx eslint --fix .` (ESLint) and `npm run format` (Prettier) to apply both configs across all existing files. Running only Prettier here would leave pre-existing files in violation of any newly-added lint rules until each one happens to be touched later.

## 11. Verify

Run `npx tsc --noEmit` and `npx eslint .` to confirm no errors were introduced by formatting. If `npx eslint .` prints "Oops! Something went wrong!" instead of lint results, the config itself is broken (e.g. a rule references a plugin that was never installed/registered) — fix that before treating the setup as complete.
