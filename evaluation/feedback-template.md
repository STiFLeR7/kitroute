# Kitroute pilot feedback template

Fill in one record for each session. Giving feedback is voluntary. Project names and source code are not needed.

    {
      "platform": "fedora",
      "host": "codex",
      "workflow": "debugging",
      "helpful": true,
      "missedSelections": 0,
      "unnecessarySelections": 0,
      "keepsEnabled": true,
      "notes": "No project identifiers or source excerpts required"
    }

## Fields

- `platform`: your system. Use `windows` or `fedora`.
- `host`: the tool you used. Use `claude-code` or `codex`.
- `workflow`: the kind of work. For example `debugging`, `feature`, `refactor`, `testing`, `docs`, or `review`.
- `helpful`: `true` if Kitroute guidance helped in this session, `false` if not.
- `missedSelections`: how many times a skill you needed was not suggested.
- `unnecessarySelections`: how many times a suggested skill was not useful.
- `keepsEnabled`: `true` if you will keep Kitroute turned on.
- `notes`: anything else, such as slow responses or confusing guidance. Do not include project names, file paths, prompts, or code.

Optionally, add your `kitroute history` output when you send the record.
