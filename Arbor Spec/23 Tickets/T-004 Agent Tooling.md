---
id: T-004
phase: 0
status: queued
depends_on: []
---

# T-004 — Install .claude/ agent tooling and smoke-test guardrails

## Goal
The .claude/ directory contains the three subagent definitions, five hooks, and the /write-ticket skill as specified in [[24 Agent Tooling & Optimisation]]. A smoke test confirms the contract-shield hook blocks a write to `contracts/schema.sql`.

## Context links (implementer may read ONLY these)
- Architecture: [[20 Architecture#Repository layout]]
- Tooling spec: [[24 Agent Tooling & Optimisation]]

## Files
**Create:**
- `.claude/settings.json` (project hooks: post-edit lint, commit gate, session log)
- `.claude/agents/implementer.md`
- `.claude/agents/verifier.md`
- `.claude/agents/architect.md`
- `.claude/skills/write-ticket/SKILL.md`
- `.claude/hooks/contract-shield.sh`
- `.claude/hooks/spec-shield.sh`
- `.claude/hooks/post-edit-lint.sh`
- `.claude/hooks/commit-gate.sh`
- `.claude/hooks/session-log.sh`
- `tests/T-004/` (already provided — do not modify)

**Modify:** none.

## Steps
1. Create `.claude/settings.json` with hooks for PostToolUse (post-edit lint, session log) and PreToolUse (commit gate on `Bash(git commit *)`). Session log also fires on SessionStart. Use `${CLAUDE_PROJECT_DIR}` for all paths.

2. Create `.claude/agents/implementer.md` — model: sonnet; tools: Read, Glob, Grep, Edit, Write, Bash, Task; hooks (scoped to this agent): PreToolUse on Edit|Write invoking `contract-shield.sh` and `spec-shield.sh`.

3. Create `.claude/agents/verifier.md` — model: sonnet; disallowedTools: Edit, Write, NotebookEdit; hooks: PreToolUse on Edit|Write|NotebookEdit invoking `contract-shield.sh`.

4. Create `.claude/agents/architect.md` — model: opus; no tool restrictions (architect reads everything).

5. Create `.claude/skills/write-ticket/SKILL.md` — disable-model-invocation: true; body contains the ticket-writing style rules.

6. Create the five hook scripts in `.claude/hooks/`:
   - `contract-shield.sh` — denies Edit/Write to `contracts/`, `Arbor Spec/21 Contracts/`, or `tests/T-*/`. Uses jq to parse stdin (JSON hook input) and outputs `permissionDecision: "deny"` when path matches.
   - `spec-shield.sh` — denies Edit/Write to `Arbor Spec/NN *.md` where NN is 00–12.
   - `post-edit-lint.sh` — runs `tsc --noEmit` for `.ts`/`.tsx` files or `cargo clippy -- -D warnings` for `.rs` files; feeds failures back via additionalContext.
   - `commit-gate.sh` — parses `T-NNN` from the git commit command; reads ticket frontmatter; denies if `status ∉ {implemented, done}`.
   - `session-log.sh` — appends a JSONL entry to `.claude/session-logs/<session_id>.jsonl`. Async.

7. Make all `.sh` files executable: `chmod +x .claude/hooks/*.sh`.

## Acceptance criteria
- [ ] `tests/T-004/structure.test.ts` passes: all expected .claude/ files exist; settings.json parses as valid JSON with PostToolUse and PreToolUse hooks; agent files have correct frontmatter fields
- [ ] `bash tests/T-004/contract-shield-smoke.sh` exits 0: script feeds a mock Edit-to-contracts/schema.sql input to contract-shield.sh and asserts output contains `"deny"`
- [ ] `pnpm lint` exits 0

## Out of scope — DO NOT
- Do not create MCP server configs or plugin.json.
- Do not create other skills (write-contract, frontend-design, etc.) — those are future architect work.
- Do not add session-logs/ to the repo (it is git-ignored by T-001).
- Do not modify any file not listed above.
- **If anything is ambiguous: STOP. Write the question under Blocked, set `status: blocked`, end the session. Never choose.**

## Blocked

## Implementation notes

## Verification
