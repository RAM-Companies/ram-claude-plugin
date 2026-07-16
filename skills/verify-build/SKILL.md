---
name: verify-build
description: Runs TypeScript type-checking and the test suite before you consider a coding task finished, commit, or open a PR. Always invoke this after making code changes in a project, right before telling the user the work is done.
---

This replaces what used to be a `Stop` hook (`stop-check.js`) that force-ran `tsc` and `npm test` at the end of every session. Stop hooks run outside the conversation, can't explain a failure in context, and were unreliable in practice — this skill does the same checks, but as a step you run yourself, so you can read the output and fix problems before reporting completion.

## Step 1 — Type-check, if this project uses TypeScript

Check whether `tsconfig.json` exists at the project root. If it doesn't, skip this step entirely — do not run `tsc` at all. (Without a `tsconfig.json`, `npx tsc` silently falls back to an unrelated npm package that always exits non-zero, which reads as a fake type error.)

If `tsconfig.json` exists, run:

```bash
npx tsc --noEmit
```

If it reports errors, fix them (or, if they're pre-existing and unrelated to your change, tell the user rather than silently ignoring them) and re-run until clean.

## Step 2 — Run the test suite, if this project has one

Check `package.json` for a `"test"` script. If there isn't one, skip this step — do not run `npm test` (a project with no test script exits with "Missing script: test", which is not a real failure).

If a `test` script exists, run:

```bash
npm test
```

If tests fail, read the failure output, fix the underlying issue (or the test, if the test itself is wrong), and re-run until the suite passes. Do not report a task as complete with known-failing tests.

## Step 3 — Report

Tell the user which checks ran (type-check, tests, or both — or that neither applies) and confirm they're clean. If something failed and you couldn't fix it (e.g. a pre-existing failure unrelated to your change), say so explicitly instead of staying silent about it.
