# P04 installable preview evidence

Task: P04.T3. Branch feat/p01-foundation-discovery. Commit: "test: prove installable preview on target systems" (see git log; hash recorded in the SDD report).

## Environment
- Windows 11 Home 10.0.26200, node v24.11.0, npm 11.6.1.
- Claude Code 2.1.289 and codex-cli 0.157.1 are installed on this machine. Neither host was driven by these tests.
- Model used to write the code and tests: claude-sonnet-5-5.
- package.json declares engines node >=24.21.0 <25. Node 24.11.0 is below that range. npm prints no error and the tests pass. This is an open mismatch to settle before M4.

## Automated sequence (Windows, synthetic homes only)
Commands: `npm run build`, then `node --test dist/tests/integration/package-preview.test.js`, then `npm test`.
- RED before implementation: the pack test failed (no README.md in the file list) and the install test failed (ERR_MODULE_NOT_FOUND for dist/src/cli.js, because the package had no `files` allowlist output). The doctor unit test failed (no `hosts` key).
- GREEN after: `npm test` gave 134 tests, 134 pass, 0 fail, 0 skipped.
- `setup --dry-run` against a temp HOME, USERPROFILE and KITROUTE_HOME with a user hook in .claude/settings.json: every byte and mtime unchanged, no manifest, no data directory created. Pass.
- `npm pack --json`: 22 files, 19044 bytes packed, 63277 bytes unpacked. Files: package.json, README.md, bin/kitroute.mjs, dist/src/**. No tests, evaluation, .superpowers, .claude, databases or docs. Pass.
- Tarball installed with `npm install --prefix <tmp>/prefix --prefer-offline <tgz>` (yaml from the registry). From the installed copy: doctor, setup --dry-run, setup, uninstall --dry-run, uninstall. Hook commands written by setup referenced the installed bin path. After uninstall, settings.json equals the original user content (user hook and keys intact, no Kitroute entries) and the manifest is gone. Pass.
- Doctor now reports `hosts` (host, present, version, supported, note; no paths) and a `trust` array holding the Codex /hooks note when Codex is present. Doctor stays read-only.

## Not run
- Manual Windows real-host setup + real prompts: NOT RUN — requires user authorization to modify real ~/.claude and ~/.codex.
- Fedora: NOT RUN.
- Codex live: deferred by user.

## Gaps
- Real-host hook trust and routing after an intentional setup is unproven.
- Linux paths, shell quoting and the Fedora Node version are unproven.
- The install test needs registry access for yaml. It skips with a message when the network is unreachable.

## Decision
FAIL for M4 as a whole: the automated Windows sequence passes, but the manual Windows, Fedora and Codex runs are not done.

## Next action
User authorizes a real-host Windows run (setup --dry-run, setup, a real prompt, uninstall) and provides a Fedora machine. Settle the engines range against the tested Node version.
