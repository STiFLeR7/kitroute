# Product overview

Status: product direction established. All 14 guided questions are resolved; implementation work is tracked separately.

## Problem

A solo developer may have many skills, plugins, and MCP servers installed across coding agents. The agent can overlook a relevant capability, select an overlapping one, or discover it too late. The developer then has to remember names and explicitly request their use.

Many agents already support implicit activation. Kitroute's goal is to improve selection and timing, then make actual use observable. Its value must be demonstrated through better completed work.

## Intended experience

The developer makes an ordinary request, such as: “The checkout page sometimes hangs; fix it.” Kitroute examines the request, available project context, and eligible installed capabilities. It helps the host load a relevant debugging skill and identify an available browser tool. Later evidence can change the selection toward backend investigation or verification.

The developer does not need to name Kitroute, a skill, or an MCP server on each turn after setup. Native permissions and consent remain part of the host's experience.

The implementation uses TypeScript, starts when needed, and reuses a local SQLite index. The first release targets Windows and Fedora Linux. Each selection includes at most three capabilities, with fewer or none when appropriate.

## What Kitroute routes

| Concept | Meaning in Kitroute |
| --- | --- |
| Skill | Instructions and supporting assets loaded through the host's supported mechanism. |
| MCP tool | A callable operation exposed to the current host session by a connected server. |
| Plugin | A package containing skills, tools, hooks, or other features. Route its actionable components. |
| Hook or extension | The integration that runs routing at an appropriate point in the host lifecycle. |

Installed, enabled, connected, visible, and callable are separate states. Finding a configuration file does not establish that its tools are available to the agent.

## Product boundaries

The initial product works with existing installed capabilities. Marketplace discovery, package installation, automatic updates, hosted synchronization, and acting as a gateway for every MCP connection are later possibilities.

Kitroute itself uses one guided setup command. It shows planned changes, backs up affected settings, and preserves unrelated entries. Setup for Kitroute is separate from installing new third-party capabilities.

Kitroute does not override explicit-only skills, disabled capabilities, or native authorization. It can return no selection when nothing relevant is available.

Basic local usage records last 30 days and exclude user prompts and project code. Native loading or tool calls establish observed use. Suggestions, file reads, and agent statements remain separate.

## Business direction

Keep local routing free. Consider paid extras after developers see value in the core workflow. Shared team settings and cross-device synchronization are possible later features. Pricing, paid features, and willingness to pay still require research.

## Measuring success

The developer completes more tasks correctly with fewer reminders and acceptable overhead. A higher activation count alone is insufficient: unnecessary loading can consume context and worsen results.

Distinguish routing checked, skill loaded or tool called, and successful task outcome. A selection explanation is not evidence that a procedure was followed.

See the [research](research/02_research_findings.md) for evidence and competing approaches, and the [validation plan](delivery/09_validation_plan.md) for how to assess improvement.
