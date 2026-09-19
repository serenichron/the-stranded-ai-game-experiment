# Comms protocol (agent 1 <-> agent 2)

Drafted by agent 2. Agent 1: amend anything here in your log, and I will follow your version.

## Files

| File | Who writes | Rule |
|---|---|---|
| `comms/agent-1.md` | agent 1 only | Append-only log. Newest message at the bottom. |
| `comms/agent-2.md` | agent 2 only | Append-only log. Newest message at the bottom. |
| `comms/PROTOCOL.md` | agent 2 wrote it | Changes go through a log message first. |
| `DESIGN.md` | both, by section owner | Each section names its owner. Only the owner edits it. Ask in your log for changes to the other's section. |
| `CONTRACTS.md` + `src/core/contracts.ts` | both | Shared interfaces. Announce every change in your log BEFORE saving it, with the diff. |

Nobody edits the other agent's log. That removes write races entirely.

## Message format

```
## [A2-007] 2026-09-18 15:10 | TYPE | short title
Body. Plain and short.
Refs: A1-003 (the message this answers, if any)
Needs: what you want back from the other agent, or "nothing"
```

- IDs: `A1-001`, `A1-002`... and `A2-001`, `A2-002`... Never reuse one.
- TYPE is one of: `PROPOSAL`, `DECISION`, `ACK`, `QUESTION`, `ANSWER`, `CLAIM`, `DONE`, `BLOCKED`, `REVIEW`, `BUG`.
- A `PROPOSAL` becomes a `DECISION` when the other agent writes `ACK` to it, or after 15 minutes with no objection.
- `CLAIM` a task before starting it. `DONE` when it builds and passes its check.

## Ownership

Code is split by folder. Each agent only edits files in folders it owns. If you need a change in the other agent's folder, send a `QUESTION` or `BUG` with the exact change. For a one-line fix while the owner is busy, make it and say so in your log straight after.

## Tie-breaks

- Structure, stack and scaffolding: agent 1 decides if we disagree. Fast beats perfect.
- Game design and story: whoever owns that section of `DESIGN.md` decides.
- Lore: `../ai/canon.md` wins over both of us. Anything we invent goes in `LORE-INVENTIONS.md`, marked as game-only.

## Waking up

Each agent polls the other's log file for changes (file size or last ID). Read the whole new tail before acting.

## Hard rules from the user

- Everything lives inside `ai-game-experiment/`. No global installs, no caches outside. npm cache is pinned to `./.npm-cache` via `.npmrc`.
- Do not touch anything in the parent repo.

---

# Phase 2 additions

Phase 2 has two new leads: **agent A (world)** and **agent B (characters and the ruin fight)**. Brief: `comms/PHASE-2.md`. State of the game: `comms/HANDOVER-PHASE-1.md`.

- Logs: `comms/p2-agent-A.md` (only A writes) and `comms/p2-agent-B.md` (only B writes). IDs `A-001`, `B-001`, and so on.
- Doorbell: after appending, ping the other lead with SendMessage if you can find their session. The file stays the source of truth. If you cannot find them, poll their log.
- Browser lock: `comms/BROWSER.lock`, see the load rules in `PHASE-2.md`. Anyone may delete a lock older than 10 minutes.
- Everything else from phase 1 still applies: append-only logs, CLAIM before starting, DONE when it builds and passes its check, contract changes announced before saving, canon wins, inventions logged.
