# Kitroute developer pilot guide

Thank you for testing Kitroute. Taking part is voluntary. You can stop at any time.

## What the pilot is

- 5 developers, over 5 days.
- At least 2 participants on each target system: Windows 11 and Fedora.
- Each participant completes at least 3 ordinary development sessions with Kitroute turned on. Work on what you would do anyway. Do not make up tasks for the test.

## Current limits

- The preview is tested only on Windows 11 with Node 24.11.0.
- Codex setup is skipped on Windows until it is verified. Windows participants use Claude Code. Fedora participants may use Claude Code or Codex.
- The package is private. It is not on any registry.

## 1. Install from a local tarball

You receive the Kitroute source or a tarball. From a checkout, build and pack it:

    npm install
    npm run build
    npm pack

Install the tarball into a folder of your choice:

    npm install --prefix ~/kitroute-prefix ./kitroute-0.1.0.tgz

The command to run is `node ~/kitroute-prefix/node_modules/kitroute/bin/kitroute.mjs`. Below, `kitroute` means that command.

## 2. Check, dry-run, then set up

1. Run `kitroute doctor`. It changes nothing. It shows your Node version and which hosts it found.
2. Run `kitroute setup --dry-run`. It writes nothing. Read what it would add.
3. If the result looks right, run `kitroute setup`.

Setup adds hook entries and keeps your other settings. It saves a backup and a manifest in the Kitroute data folder.

## 3. Your permissions stay in place

Kitroute does not change the permission prompts of Claude Code or Codex. Keep answering them as you normally do.

Codex needs you to review new hooks. After setup, open Codex, run `/hooks`, and review the Kitroute hooks. Kitroute does not skip this step. Until you trust them, they do not run.

## 4. What Kitroute stores

- Basic usage records stay on your computer, for 30 days. Then they are deleted.
- Kitroute does not store your prompts or your code.
- Set `KITROUTE_HOME` if you want the data in another folder.

## 5. Share your history (optional)

Run `kitroute history`. It prints your usage records as JSON. You may paste some or all of it into your feedback. You may also share none of it. Check the output first and remove anything you do not want to share.

## 6. Give feedback

After each session, fill in one record from `evaluation/feedback-template.md`. Do not include project names, file paths, prompts, or source code.

## 7. Uninstall

1. Run `kitroute uninstall --dry-run` and read the result.
2. Run `kitroute uninstall`.

It removes only the entries Kitroute added that are still unchanged. If you edited one, it reports a conflict and leaves it. You can then delete the `~/kitroute-prefix` folder.

## Report a problem at once

Tell the team right away if Kitroute blocks your work or changes your host settings in a way you did not expect. Uninstall first if you need to keep working.
