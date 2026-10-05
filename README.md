# Kitroute

Kitroute is a local router for Claude Code and Codex skills. When you send a prompt, a host hook asks Kitroute which of your installed skills fit. Kitroute replies with short guidance that names up to three skills. It runs on your computer.

## Status

This is a development preview.

- Tested only on Windows 11 with Node 24.11.0.
- Not tested on Fedora.
- The Codex hook entry is not verified against a live Codex session.
- The package is marked private. It is not published to any registry.

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

Adds Kitroute hook entries to `~/.claude/settings.json` and `~/.codex/hooks.json`, for each host that is present and supported. On Windows, setup currently skips Codex, because the hook command form has not yet been proven in a live Codex session there. It keeps your other settings. It records what it added in a manifest in the Kitroute data folder, and saves a backup there. Run `setup --dry-run` first and read the result.

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
