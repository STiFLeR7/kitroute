# Kitroute

Kitroute is a local router for Claude Code and Codex skills. When you send a prompt, a host hook asks Kitroute which of your installed skills fit. Kitroute replies with short guidance that names up to three skills. It runs on your computer.

## Status

This is a development preview.

- Tested on Windows 11 with Node 24.11.0.
- Tested on Pop!_OS 24.04 LTS with Node 24.21.0: automated tests, setup and uninstall, generated hook commands, and package installation pass. Live smoke tests passed with Claude Code 2.1.293 and Codex 0.160.1. See [the Pop!_OS report](docs/implementation/evidence/35_popos_compatibility_testing.md).
- Not tested on Fedora or other Linux distributions.
- Codex CLI 0.157.1 passed a live Windows smoke test with ChatGPT sign-in. See [the test report](docs/implementation/evidence/34_codex_windows_live_testing.md).
- The package declares Node >=24.21.0 <25. The Pop!_OS tests used 24.21.0. The Windows tests used 24.11.0, so Windows on the declared runtime remains untested.
- The package is marked private. It is not published to any registry.

## Development storage

Keep development artifacts inside this checkout. `npm test` uses `.local/tmp/` for temporary files and `.local/kitroute-data/` for development data. npm uses `.local/npm-cache/`. Store captures and local archives under `.local/artifacts/`, and create additional worktrees under `.worktrees/`. These directories are excluded from Git. Read [AGENTS.md](AGENTS.md) before running direct tests or live probes.

## Install from a local tarball

Build and pack from a checkout of this repository:

    npm install
    npm run build
    npm pack

Install the resulting `kitroute-0.1.0.tgz` into a folder of your choice:

    npm install --prefix ~/kitroute-prefix ./kitroute-0.1.0.tgz

The command to run is `node ~/kitroute-prefix/node_modules/kitroute/bin/kitroute.mjs`. Below, `kitroute` means that command.

## Commands

### kitroute doctor

Shows the Node version, whether `node:sqlite` is available, and the status of each host (Claude Code and Codex). It changes nothing. If Codex is present, it also shows the trust note below.

### kitroute setup --dry-run

Shows what setup would add to your host configuration. It writes nothing.

### kitroute setup

Adds Kitroute hook entries to `~/.claude/settings.json` and `~/.codex/hooks.json`, for each host that is present and supported. On Windows, Codex commands use the PowerShell call operator, `&`. Setup keeps your other configuration. It records its entries in a manifest and saves a backup in the Kitroute data folder. Run `setup --dry-run` first and read the result.

Setup does not read `CLAUDE_CONFIG_DIR` or `CODEX_HOME`. If you set either variable, the host reads its configuration from that folder and ignores the entries that setup adds.

### kitroute uninstall --dry-run

Shows which Kitroute entries uninstall would remove. It writes nothing.

### kitroute uninstall

Removes only the entries that Kitroute added and that are still unchanged. It does not restore old backups over your later edits. An entry that you edited is reported as a conflict and left in place.

## Codex: review hooks before they run

Codex requires you to review new hooks with `/hooks` before they run. Kitroute does not bypass this. After `setup`, open Codex and review the Kitroute hooks there.

## Privacy

- Kitroute keeps basic usage records for 30 days, then deletes them.
- Kitroute does not store your prompts or your code.
- Records stay on your computer, in the Kitroute data folder. Set `KITROUTE_HOME` to choose another folder.

### kitroute history

Prints the stored usage records as JSON. It also removes records older than 30 days.
