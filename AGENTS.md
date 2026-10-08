# Kitroute workspace rules

Keep project files, test homes, captures, databases, caches, packages, and worktrees inside this repository.
The Windows workspace is `D:\kitroute`. Do not create Kitroute artifacts on C:.
On Pop!_OS, use the mounted or transferred repository root as the workspace boundary.

Use these ignored directories:

- `.local/tmp/` for temporary test homes and files.
- `.local/artifacts/` for captures, logs, archives, and local packages.
- `.local/kitroute-data/` for development usage history.
- `.local/npm-cache/` for the npm cache.
- `.worktrees/` for additional Git worktrees.

Run the full test suite with `npm test`. Its runner supplies repository-local temporary paths to child processes.
For direct tests or live probes, set `TEMP`, `TMP`, and `TMPDIR` to the absolute `.local/tmp` path.
Set `KITROUTE_HOME` to a directory inside `.local` for development commands that write data.
Use a temporary host home inside `.local/tmp` for setup and live host tests.
Keep the controlling agent's normal home unchanged.

Create worktrees with Git under `.worktrees`.
Do not use a managed worktree tool if it places the checkout outside this repository.
Preserve unrelated worktrees and application files belonging to other projects.
Before recursive removal or moving files, resolve the exact paths and confirm their workspace ownership.

Keep credentials and private captures out of Git. Remove temporary credential copies when testing ends.
Commit reviewed evidence summaries instead of raw account data.
Record test failures, skips, and untested platforms accurately.
