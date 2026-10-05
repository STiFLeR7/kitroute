# Automatic capability routing for coding agents

Document status: research snapshot. The guided product questions are now resolved in [10 Resolved questions](../10_open_questions.md). Use the [decision log](../architecture/06_decision_log.md) for the selected direction. Recommendations below preserve the original research and do not override later choices.

Research date: 5 October 2026. Scope: helping a solo developer's agent use skills, plugin features, and MCP tools that are already installed. This is a documentation and public-project review, not a tested compatibility report. Recommendations and proposed architecture below are analysis; cited agent behavior comes from primary documentation.

## Conclusion

The idea is feasible across several CLI agents, but the integration must enter the agent's turn lifecycle. A shared local router with host-specific plugins or extensions is the strongest design. MCP can expose its catalog and routing functions, but an MCP-only installation does not guarantee that routing runs before each user request.

Automatic invocation already exists natively in many agents. The unmet problem is consistent selection, appropriate timing, and proof of useful execution. Existing open-source projects tackle substantial parts of this problem, so differentiation needs measured results rather than a claim that automatic routing is new.

## What the evidence establishes

Claude Code and Codex choose skills implicitly from their descriptions. Claude's troubleshooting documents missing triggers and catalog-budget pressure; Codex documents skill-list limits and possible omission. A router can search a richer index independently of the initial model-visible catalog. It must still respect the host's active scopes, permissions, and explicit-only settings. Sources: [Claude skills](https://code.claude.com/docs/en/skills), [Codex skills](https://learn.chatgpt.com/docs/build-skills).

Vercel's focused Next.js evaluation found that skills were never invoked in 56% of cases in its default setup. Prompt changes improved invocation and task success, and instruction ordering mattered. This establishes a failure mode in that benchmark, not a universal failure rate for developers or agents. Source: [Vercel evaluation](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals).

## Agent comparison

| Agent | Verified integration surface | Implication for this product |
| --- | --- | --- |
| Claude Code | `UserPromptSubmit` can inject context before processing; tool lifecycle hooks can observe activity. | Package a plugin with a command hook and local routing core. Initial routing is automatic, but a suggestion does not guarantee native skill loading or correct use. [Hooks](https://code.claude.com/docs/en/hooks) |
| Codex | Current docs include `UserPromptSubmit`; its stdout or `additionalContext` becomes developer context. Plugins can bundle hooks. | A prompt-hook adapter is feasible. Hook trust is separate from plugin installation. Do not confuse the event with unsupported `prompt` handler types. [Hooks](https://learn.chatgpt.com/docs/hooks), [Packaging](https://developers.openai.com/plugins/build/plugins) |
| Hermes Agent | Plugins register `pre_llm_call`, which receives turn context and can inject text; tool and skill lifecycle events are available. | Use a native plugin to route each turn and observe subsequent loading. Native skill loading uses `skills_list` and `skill_view`. [Hooks](https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks), [Skills](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills) |
| OpenCode V2 | `ctx.session.hook("prompt", ...)` can add selected skills before native resolution. `context` hooks can modify tools and model context on continuations. | Especially useful for automatic native skill attachment. Inventory APIs expose current skills and tools. V1 and V2 require separate compatibility work. [V2 plugin API](https://opencode.ai/v2/docs/build/plugins/) |
| Gemini CLI | `BeforeAgent` injects context; `BeforeModel` modifies requests; `BeforeToolSelection` can constrain available functions. | Route skills and shortlist tools. Use native `activate_skill` and retain its consent flow. Official examples already show retrieval-based tool filtering. [Hook reference](https://geminicli.com/docs/hooks/reference/), [Skills](https://geminicli.com/docs/cli/skills/), [Hook examples](https://geminicli.com/docs/hooks/writing-hooks/) |
| GitHub Copilot CLI | `userPromptTransformed` can rewrite model-facing content. Command/HTTP `userPromptSubmitted` output is dropped; SDK hooks can honor `modifiedPrompt`. | Use the documented transformed-prompt path or SDK integration, and test the chosen runtime. A generic Claude-style stdout adapter would be incorrect. Native configuration also includes skill retrieval. [Hook reference](https://docs.github.com/en/copilot/reference/hooks-reference), [Configuration](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference) |
| Pi | Extensions expose `before_agent_start`, context, and tool events. Skill docs acknowledge missed selection. | A native extension can supply relevant routing context and record use. Explicit-only skill controls remain meaningful. [Extensions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md), [Skills](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md) |
| Amp | Plugin `agent.start` can append context to a submitted message; tool events support observation. Skills can bundle MCP configuration. | A plugin can route automatically; Amp already supports loading tool bundles with skills. [Plugin API](https://ampcode.com/docs/plugin-api), [Skills](https://ampcode.com/docs/customize/skills) |

Codex distribution caveat: local/community plugin packaging and public-directory submission are different. Current public submission rules exclude ZIPs containing lifecycle hooks. Plan initial distribution accordingly and recheck this before release. Source: [Submission rules](https://developers.openai.com/plugins/deploy/submission).

These are documented integration opportunities. No adapter was installed or exercised during this research. In particular, V2 APIs should not be claimed to work on OpenCode V1, and CLI behavior should not be assumed identical to cloud-agent behavior.

## Direct competition and precedents

| Project | Documented overlap | What to investigate before building |
| --- | --- | --- |
| [SkillRoute](https://github.com/jestatsio/skillroute) | Indexes full skill bundles; returns ranked matches, evidence, and confidence over MCP. Offers Claude/Codex plugins, multiple harness manifests, traces, and evaluations. | Closest broad competitor. A supported manifest does not prove automatic interception in every host. Compare actual loading and end-task success. |
| [Claude Code infrastructure showcase](https://github.com/diet103/claude-code-infrastructure-showcase/blob/main/.claude/hooks/README.md) | Prompt/file matching injects skill suggestions. Activation tracking and a verification guard attempt to ensure loading. | Automatic suggestions plus activation verification already have a public implementation. Test its behavior with realistic skill libraries. |
| [OpenCode prompt router](https://github.com/anderssv/opencode-prompt-router) | Matches user prompts to local skills using TF-IDF and injects a selected skill preamble. | Establish a simple lexical-routing baseline before spending on model-based routing. |
| [Hermes Local Knowledge](https://github.com/stepanov1975/hermes-local-knowledge) | Indexes skills, scripts, runbooks, MCP-related material, and other local capabilities; per-turn guidance and feedback support discovery. | Broad capability indexing is already present. Compare current tool availability, phase changes, and invocation evidence. |
| [Hermes Jev Skills](https://github.com/kerpopule/hermes-jev-skills) | Offers native Hermes per-turn skill suggestions and related agent functions; distributes portable skills for other clients. | Separate native automatic integration from portable skill installation. Author performance claims need independent reproduction. |
| [OpenCode triage](https://github.com/cascharly/opencode-triage) | On-demand scoring/loading via a triage tool while reducing default catalog exposure. | Useful retrieval precedent, but the model must still choose the triage tool. |

These are verified public projects, not proof of mature adoption or reliable performance. This research did not independently benchmark their advertised results.

## Why MCP alone is insufficient

MCP tools are exposed by servers and invoked through clients. The protocol does not require a host to call a particular routing tool on each prompt. Optional sampling lets a server request model generations under client control; it does not provide a universal subscription to user turns or unconditional access to other servers' tools. Sources: [MCP tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools), [MCP sampling](https://modelcontextprotocol.io/specification/2025-11-25/client/sampling).

Architectural inference: to guarantee the routing check runs, register it in the host's lifecycle. Export the host's actual capability state into the router where supported. If the product acts as an MCP gateway, it sees tools behind that gateway, but becomes responsible for their connections and execution. That is a larger initial scope than a lightweight routing plugin.

## Proposed product behavior

Example: the user says, “The checkout page sometimes spins forever; fix it.” The router sees the project's frontend stack and installed debugging skill, browser MCP, backend tooling, and testing skill. It first helps reproduce the issue, then changes recommendations when evidence points to a backend failure, then suggests relevant verification. The user does not need extension names.

The router should distinguish three outcomes:

1. **Checked:** routing ran and considered eligible capabilities.
2. **Loaded or called:** the host loaded the selected skill, or a tool invocation occurred.
3. **Useful:** the task outcome improved and the selected procedure was followed appropriately.

Hooks can reliably establish the first event. Some host APIs make the second more direct. Neither proves the third. Product wording and metrics should preserve this distinction.

A practical shared core would contain:

- **Inventory:** normalize enabled skills and currently available tool metadata. Track installed, configured, connected, and callable states separately; unresolved state stays unknown.
- **Selection:** combine request, recent context, repository clues, and task phase. Start with a local lexical baseline; add richer retrieval only when measurements justify it.
- **Adapter action:** attach selected skills where supported, otherwise provide concise instructions to use native loading and real tools. Keep native permissions and explicit-only restrictions.
- **Observation:** record selections, native load events where exposed, tool calls, skips, and outcomes. A file read is not automatically proof of native activation.
- **Continuation:** reconsider after meaningful new evidence or phase changes, without adding repetitive routing context to every model call.

Plugins are containers for capabilities. The router should select their constituent skills and tools rather than treating each plugin name as a universally invocable operation. Existing hooks may already run automatically.

An optional MCP interface can offer `route`, `inspect`, and `explain` operations for interactive use and clients with weaker extension APIs. This complements automatic host adapters.

## Positioning and launch recommendation

Proposed promise: “Use the right installed skill or tool at the right stage, without remembering its name.” Reliability should be the product's focus. A catalog, semantic search, traces, and cross-agent setup already appear in competitors.

My recommended commercial MVP targets Claude Code and Codex because they match the user's initial audience. Use OpenCode V2 as a technical comparison for direct native loading, and Hermes as a subsequent integration. This is a scope recommendation, not a measured market-share ranking.

For the first release:

- Support installed skills and connected MCP tool recommendations, with verified loading/calling where the host permits it.
- Include automatic prompt routing, a “nothing relevant” result, a short explanation, and a visible usage trail.
- Test multi-turn tasks, changing project context, duplicate skills, compaction, and explicit-only capabilities.
- Make router failure return control promptly to the agent.
- Keep updates and marketplace discovery as later work; they add little evidence that this core utilization problem is solved.

A business model could offer free local routing and adapters, then charge for synchronization, shared routing policies, and advanced evaluation. Willingness to pay remains unvalidated; free competitors and improving native hosts are meaningful commercial constraints.

## Validation before substantial development

Run the same tasks on fixed host/model versions using native defaults, improved descriptions/project instructions, an existing router, and the proposed router. Include libraries of roughly 10, 50, and 200 skills, overlapping capabilities, unavailable MCPs, and tasks needing no special capability.

Measure task success, missed relevant capabilities, unnecessary activations, native load/call rates, extra tokens, routing latency, and repeated prompts. Include manual naming as a reference condition, not as the target user experience. Repeat trials because tool decisions are stochastic.

The decision criterion is better completed work with tolerable overhead. An increased invocation count alone could mean the product is activating irrelevant extensions.

The most useful next experiment is a small benchmark-backed Claude/Codex router prototype against native behavior and existing projects. Evidence from that experiment should determine whether to build a standalone product, contribute to an existing router, or narrow the idea to a specific workflow.
