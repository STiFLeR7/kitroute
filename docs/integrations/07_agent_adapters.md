# Agent adapters

Status: integration design aligned with the completed product decisions. Sources were reviewed on 5 October 2026. No adapter has been implemented or runtime-tested.

## Shared responsibilities

Adapters register automatic lifecycle entry, obtain eligible capability metadata, normalize task context, translate route results, and record evidence using the proposed [contracts](../architecture/05_data_contracts.md).

For discovery, use supported agent information first and skill or configuration files as a fallback. Mark availability as unknown when the available evidence cannot establish it. Test each adapter's coverage before claiming complete discovery.

A host feature being documented does not establish Kitroute compatibility. Pin and test host versions, operating systems, entry modes, and permissions before making a supported claim.

## Integration matrix

| Host | Candidate entry/action | Observation and limitations | Implementation priority |
| --- | --- | --- | --- |
| Claude Code | `UserPromptSubmit` command hook adds routing context; use native skill loading. | Tool lifecycle events help track calls. Injection is not proof of loading; respect explicit-only skills. | Initial MVP |
| Codex | `UserPromptSubmit` adds developer context; a plugin can bundle hooks. | Hook trust is separate from installation. Some tool paths are outside hook coverage; transcript formats are not a stable universal API. | Initial MVP |
| Hermes Agent | Native plugin registers `pre_llm_call` and supplies routing context; skills use `skill_view`. | Tool and skill lifecycle events provide useful observation. Use the active profile and project precedence. | Subsequent integration |
| OpenCode V2 | Prompt admission hook can add selected skills through native resolution; context hook can change outgoing tool/context exposure. | Inventory APIs list current skills/tools. Prompt admission runs once, while context hooks can run on continuations. Do not reuse V2 contracts on V1. | Technical comparison |
| Gemini CLI | `BeforeAgent` injects context; `BeforeToolSelection` can shortlist tools. | Native skill activation includes consent. Tool filtering is available but requires evaluation to avoid excluding necessary operations. | Later candidate |
| Copilot CLI | `userPromptTransformed` can modify model-facing content; SDK integration is another option. | Ordinary command/HTTP `userPromptSubmitted` output is ignored. CLI and cloud runtimes differ. | Later, version-tested |
| Pi | Extension uses `before_agent_start` and related context/tool events. | Native skill selection may miss matches; keep explicit-only policy and distinguish file reads from activation evidence. | Later candidate |
| Amp | Plugin `agent.start` supplies additional message context; native skills can include MCP configuration. | Tool events support observation. Skill-contained tool bundles affect when tools become available. | Later candidate |

Claude Code and Codex are the initial implementation targets on Windows and Pop!_OS Linux. Other hosts are later candidates or technical comparisons. This plan does not claim market-share measurements or tested support.

## Claude Code and Codex spike

For each initial host, establish:

1. A minimal automatic hook that runs on an ordinary user request.
2. How active skills, plugin skills, and currently available tools can be discovered.
3. How selected instructions reach the model without changing the developer's request intent.
4. Which event proves native loading, and which events only show reads or suggestions.
5. How timeout, permissions, Windows paths, session resume, and compaction behave.

Record unsupported discovery or observation features. Do not claim complete MCP inventory from a configuration file alone.

## Distribution

Launch through a public community repository and installable package first. Developers use the guided setup command. Seek official directory listings afterward where the final package meets each directory's rules. Community release and official submission are separate steps; no listing acceptance is assumed.

Agent packages can share a core release while containing different hook configuration and adapter code. Provide one guided setup command that detects supported agents, shows planned changes, backs up affected settings, and adds Kitroute. Use supported native installation paths where appropriate. Implement command names and merge mechanisms through the [delivery checklist](../delivery/11_implementation_checklist.md).

Preserve unrelated host configuration during setup. Track Kitroute-owned entries so uninstall removes only those entries. Do not restore an entire backup over settings changed after installation. Test repeated setup, conflicting entries, partial failure, and uninstall on Windows and Pop!_OS Linux.

Codex local/community packaging and official public-directory submission are separate. The reviewed submission rules exclude lifecycle-hook ZIPs, so directory eligibility must be rechecked before release.

## Sources

- Claude Code: [skills](https://code.claude.com/docs/en/skills), [hooks](https://code.claude.com/docs/en/hooks).
- Codex: [skills](https://learn.chatgpt.com/docs/build-skills), [hooks](https://learn.chatgpt.com/docs/hooks), [plugin packaging](https://developers.openai.com/plugins/build/plugins), [submission](https://developers.openai.com/plugins/deploy/submission).
- Hermes: [skills](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills), [hooks](https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks).
- OpenCode: [V1 skills](https://opencode.ai/docs/skills/), [V2 plugin API](https://opencode.ai/v2/docs/build/plugins/).
- Gemini CLI: [skills](https://geminicli.com/docs/cli/skills/), [hook reference](https://geminicli.com/docs/hooks/reference/).
- Copilot CLI: [hook reference](https://docs.github.com/en/copilot/reference/hooks-reference).
- Pi: [skills](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md), [extensions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md).
- Amp: [plugin API](https://ampcode.com/docs/plugin-api), [skills](https://ampcode.com/docs/customize/skills).

For competitor context and research limitations, see [02 Research findings](../research/02_research_findings.md).
