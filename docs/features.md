# Feature catalog

This catalog defines the complete intended Corex Code product. The
[roadmap](../ROADMAP.md) assigns each capability to an incremental release.
Planned features are not claims about the current implementation.

| Capability | Product behavior | Success measure | Milestone |
| --- | --- | --- | --- |
| Persistent memory | Remember project structure, accepted decisions, preferences, tasks, and outcomes with provenance and user controls | A resumed task retrieves relevant accepted facts without re-reading unchanged files | v0.2 |
| Smart context | Rank files, symbols, changes, tests, and memories and send only useful excerpts | Context selection fits the configured budget and identifies every included source | v0.2 |
| Token optimization | Cache stable summaries, deduplicate content, budget each task, and report usage and cost | Repeated unchanged context is not reprocessed or resent unnecessarily | v0.2 |
| Verified changes | Discover and run formatting, tests, types, linting, and builds appropriate to each patch | Every final result states which checks passed, failed, or were skipped | v0.3 |
| Safe execution | Constrain paths, secrets, commands, network access, approvals, and resource use | Policy and security tests prevent boundary escapes and unapproved effects | v0.1–v0.3 |
| Local models | Run private tasks through a supported local runtime with streaming and compact context | Local benchmark targets pass on documented reference hardware and models | v0.1–v0.4 |
| Multiple providers | Support local, native cloud, and compatible APIs behind one capability contract | Provider contract tests pass without provider logic leaking into orchestration | v0.4 |
| Autonomous tasks | Execute bounded plans, checkpoint progress, pause safely, and resume after restart | A multi-step integration task resumes from its last valid checkpoint | v0.4 |
| Agent debugger | Inspect plans, context sources, tool calls, diffs, verification, timings, tokens, and errors | A task can be reconstructed from its sanitized event trace | v0.4 |
| Multi-agent workflows | Coordinate planner, implementer, tester, and reviewer roles through a shared task graph | Parallel work respects file ownership and reviewer evidence is independent | v0.5 |
| Team collaboration | Share approved session metadata, roles, policies, approvals, and audit history | Role and retention policies are enforced in end-to-end tests | v0.6 |

## Persistent memory

Memory is structured, scoped, and evidence-backed. Users can inspect what Corex
remembers, correct it, delete it, set retention, or disable persistence. A stale
summary never overrides current repository content.

## Smart context

Context selection combines lexical search, syntax relationships, Git state,
test mappings, local embeddings when enabled, and previous accepted decisions.
Corex displays why a source was included and respects a hard context budget.

## Token and cost efficiency

Corex uses incremental indexes, content hashes, stable prompt-prefix caching,
hierarchical summaries, bounded tool output, and per-step budgets. Local models
report tokens and timing; paid providers additionally report or estimate cost.
Budgets can stop, pause, or request approval before further use.

## Verified code changes

Verification is selected by file type, project configuration, change risk, and
known test relationships. Passing a narrow test is not reported as full-project
verification. Results remain linked to the exact patch content.

## Safety

Capabilities are deny-by-default outside the active repository. Reads, writes,
commands, Git mutations, network calls, and secret access have distinct policy
classes. Approval applies to one exact action unless the user deliberately saves
a narrow reusable rule.

## Local and remote models

Local inference is optimized for privacy, predictable cost, and offline use.
Remote models remain available for tasks that require different capabilities.
Routing follows the user's privacy and budget policy, never an invisible vendor
preference.

## Autonomous execution

Autonomy is a bounded operating mode, not unlimited permission. Each task has
limits for time, steps, tokens, cost, files, commands, network access, and
verification. Corex pauses when a limit, conflict, ambiguity, or approval gate
is reached.

## Debugger and traces

The debugger exposes operational decisions and evidence without relying on
private model reasoning. Users can understand what context was chosen, why a
tool ran, what changed, what it cost, which checks ran, and where a failure
occurred.

## Multi-agent execution

Roles receive minimal scoped context and produce explicit artifacts. The task
graph manages dependencies and prevents silent file conflicts. Reviewers assess
the goal, diff, and verification evidence independently.

## Team collaboration

Teams can distribute policies, assign roles, share selected task state, route
approvals, and retain audit logs. Local repository content remains local unless
an authorized workflow explicitly shares it.
