# Resolved questions

Status: closed. All 14 guided product questions were answered on 5 October 2026.

## Selected choices

| Question | Topic | Selected decision |
| --- | --- | --- |
| 1 | Language | Use TypeScript for the shared core and supported adapter code. |
| 2 | Execution | Start when needed for each routing request. Reuse a saved local index. No background service is required for the first release. |
| 3 | Storage | Use SQLite for the capability index and basic usage records. |
| 4 | Discovery | Use supported agent information first, with skill and configuration files as a fallback. Keep unknown availability explicit. |
| 5 | Evidence of use | Report use only from observed native loading or tool calls. Keep suggestions, file reads, and agent statements separate. |
| 6 | Operating systems | Target Windows and Pop!_OS Linux together. Publish exact tested OS and agent versions. |
| 7 | Selection size | Select at most three capabilities per decision, counting skills and tools together. Fewer or none are valid. Keep guidance short. |
| 8 | Selection timing | Reconsider on each user request and clear task changes. Avoid repeated guidance when selection is unchanged. |
| 9 | Usage history | Keep basic local records for 30 days. Save capability names, observed use, result status, and timing. Exclude prompts and project code by default. |
| 10 | Installation | Provide one guided setup command. Show planned changes, back up affected settings, and preserve unrelated entries. Uninstall removes only Kitroute-owned entries. |
| 11 | Launch | Release through a community repository and installable package first. Seek official directory listings afterward where eligible. |
| 12 | Comparisons | Compare against native defaults, improved skill descriptions, and relevant existing routers. Manual naming is an additional reference. |
| 13 | Release evidence | Complete repeatable comparative tests and a small developer pilot before the first release. Measure outcomes and collect real-project feedback. |
| 14 | Business model | Keep local routing free. Consider paid extras after developers see value. Team settings and synchronization are later candidates. |

Question 6 originally selected Fedora. On 8 October 2026, the user replaced it with Pop!_OS; see D25 in the decision log.

## Closure

No questions from this guided round await a user choice. The detailed decisions are recorded in the [decision log](architecture/06_decision_log.md). The current architecture, integration, delivery, and validation documents reflect these choices.

The stable filename remains 10_open_questions.md so existing links continue to work. The document now serves as the closure record.

## Implementation handoff

The [implementation checklist](delivery/11_implementation_checklist.md) tracks concrete engineering work and test evidence. It covers libraries, schemas, adapter coverage, measured limits, packaging, and evaluation setup. These tasks implement the selected policies rather than reopen the question round.

The design does not claim completed code, tested compatibility, directory acceptance, or measured performance. Record those results as implementation progresses.
