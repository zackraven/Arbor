---
id: T-015
phase: 4
depends_on: []
---

# T-015 — Model call spike: CLI subprocess from Rust backend

## Goal
Prove that the Rust backend can make a model call authenticated against the user's Claude Code subscription (no API key, no spend), and characterise the call surface for pipeline use. This validates the entire v1 model-call architecture before any pipeline work begins. Beyond basic round-trip, the spike must answer: output format stability, usage-window exhaustion behaviour, latency at realistic prompt sizes, concurrency behaviour, and timeout failure signature.

**Product dependency (v1 constraint):** Arbor v1 depends on Claude Code being installed and authenticated on the user's machine. This is acceptable for a solo-developer tool. Any commercial path would require API-key auth or a hosted backend. This constraint must be logged in the sidecar.

## System prerequisites
- Claude Code CLI installed and on PATH (`claude --version` succeeds)
- User logged into Claude Code (`claude` opens an interactive session without auth errors)

## Context links (implementer may read ONLY these)
- Architecture section: [[20 Architecture#Repository layout]], [[20 Architecture#Module boundaries]]
- Decisions log: [[12 Open Questions & Decisions Log#pipeline-rename-model-call-2026-08-08]]

## Files
**Create:** `src-tauri/src/pipeline/mod.rs`, `src-tauri/src/pipeline/model_call.rs`, `tests/T-015/model-call.rs`
**Modify:** `src-tauri/src/lib.rs` (add `mod pipeline;` and register the Tauri command), `tsconfig.json` (remove `"tests/T-014"` from exclude — T-014 is a separate ticket but the exclude is blocking the full test suite; piggyback the cleanup here)

## Steps

1. **Create `src-tauri/src/pipeline/mod.rs`** — module declaration:
   ```rust
   pub mod model_call;
   ```

2. **Create `src-tauri/src/pipeline/model_call.rs`** — a function that spawns the Claude CLI as a subprocess:
   ```rust
   use std::process::Command;
   use serde::Deserialize;

   #[derive(Debug, Deserialize)]
   pub struct ModelResponse {
       pub result: String,
       pub session_id: String,
       pub is_error: bool,
   }

   /// Sends a prompt to Claude via the CLI and returns the response.
   /// Authenticates via the user's Claude Code subscription (no API key).
   /// Uses `--output-format json` for structured output.
   /// Uses `--bare` is intentionally NOT set — bare mode skips subscription auth.
   pub fn call_model(prompt: &str) -> Result<ModelResponse, String> {
       let output = Command::new("claude")
           .args(["-p", prompt, "--output-format", "json"])
           .output()
           .map_err(|e| format!("Failed to spawn claude CLI: {e}"))?;

       if !output.status.success() {
           let stderr = String::from_utf8_lossy(&output.stderr);
           return Err(format!("claude CLI exited with {}: {stderr}", output.status));
       }

       let stdout = String::from_utf8_lossy(&output.stdout);
       serde_json::from_str::<ModelResponse>(&stdout)
           .map_err(|e| format!("Failed to parse claude response: {e}\nRaw: {stdout}"))
   }
   ```

   Handle the JSON response shape that `claude -p --output-format json` actually returns. The struct above is a starting point — adjust fields based on what the CLI actually emits. The implementer should run `claude -p "say hello" --output-format json` manually first to inspect the real response shape, then match the struct to it.

3. **Create a Tauri command** in `model_call.rs`:
   ```rust
   #[tauri::command]
   pub async fn probe_model() -> Result<String, String> {
       // Run on a blocking thread since Command::output() blocks
       tokio::task::spawn_blocking(|| {
           let response = call_model("Respond with exactly: ARBOR_SPIKE_OK")?;
           if response.result.contains("ARBOR_SPIKE_OK") {
               Ok(response.result)
           } else {
               Err(format!("Unexpected response: {}", response.result))
           }
       })
       .await
       .map_err(|e| format!("Task join error: {e}"))?
   }
   ```

4. **Modify `src-tauri/src/lib.rs`** — add `mod pipeline;` and register the `probe_model` command in the Tauri builder's `invoke_handler`.

5. **Create `tests/T-015/model-call.rs`** — this is a Rust integration test (not a vitest test). It directly calls `call_model()` and asserts the response contains the expected text. Mark it `#[ignore]` so it doesn't run in CI (requires live Claude Code auth):
   ```rust
   #[test]
   #[ignore] // Requires live Claude Code subscription auth
   fn probe_model_returns_expected_response() {
       let response = arbor::pipeline::model_call::call_model(
           "Respond with exactly the text ARBOR_SPIKE_OK and nothing else"
       ).expect("model call should succeed");
       assert!(response.result.contains("ARBOR_SPIKE_OK"));
       assert!(!response.is_error);
   }
   ```

   Place the test where Cargo can find it. If Rust integration tests need to be in `src-tauri/tests/`, put it there instead of `tests/T-015/`. The important thing is that `cargo test --ignored -p arbor -- probe_model` runs it.

6. **Run the spike manually** — the implementer must run the ignored test with live auth and record ALL results in the sidecar. This is the core of the spike — the code is just scaffolding to make these measurements repeatable.

   **6a. Basic round-trip** (required):
   - Does the CLI spawn successfully?
   - Does subscription auth work (no `ANTHROPIC_API_KEY` set)?
   - What is the actual JSON response shape? (paste a sanitized example)
   - Does it work from within a Tauri app context (spawn from a running Tauri backend)?

   **6b. Output format stability** (required):
   - Run `claude -p` with `--output-format json` five times with the same prompt. Are the JSON field names and structure consistent across runs? Record the schema.
   - Try a prompt that produces a longer response (~500 words). Does the JSON shape change?
   - Try `--output-format stream-json`. Record the event shape. (Observation only — streaming is Phase 5, but recording the shape now costs nothing.)

   **6c. Realistic prompt latency** (required):
   - Craft a decomposition-scale prompt: ~300–500 words of context + instructions (simulate what a scoping or decomposition stage would send). NOT a toy "say hello" prompt.
   - Example: "Given the subject 'Classical Mechanics from Newton's Laws to Lagrangian Mechanics', list all prerequisite concepts a university student would need, grouped by category. For each concept, write a one-line description and 3–5 learning outcomes."
   - Record: wall-clock time, input token count (from response metadata if available), output token count.
   - Run three times, record all three measurements.

   **6d. Concurrency** (required):
   - Spawn two `call_model` invocations in parallel (e.g. two `tokio::spawn_blocking` tasks). Do both succeed? Does the CLI serialise them or run concurrently? Record timings.
   - Spawn three. Record whether any fail or queue.
   - Note: Claude Code may enforce concurrency limits. Record whatever happens — the result informs pipeline design (sequential vs parallel stages).

   **6e. Timeout and failure signatures** (required):
   - What happens when the CLI is not on PATH? Record the exact error.
   - What happens when the user is not authenticated? Record the exact error/exit code.
   - Set a very short timeout on `Command` (e.g. 2 seconds) and send a long prompt. Record the failure mode — does it kill the process cleanly? What exit code?
   - If usage-window exhaustion can be tested (unlikely in a single session), record the error. Otherwise, note that it was not testable and record the expected failure mode from `claude --help` or documentation if available.

   **6f. Log product dependency** (required):
   - Record in sidecar: "Arbor v1 depends on Claude Code CLI installed and authenticated. No API key. Acceptable for solo use; commercial path requires API-key auth or hosted backend."

7. **Modify `tsconfig.json`** — remove `"tests/T-014"` from the `exclude` array (cleanup: this exclusion was left from before T-014 was implemented).

## Acceptance criteria
- [ ] `cargo build -p arbor` succeeds with the new `pipeline` module
- [ ] `cargo test -p arbor` succeeds (the `#[ignore]` test is skipped)
- [ ] `cargo test --ignored -p arbor -- probe_model` succeeds when run manually by the implementer with live Claude Code auth — result recorded in sidecar
- [ ] `pnpm lint` exits 0 (tsc + cargo clippy)
- [ ] Sidecar contains the actual JSON response shape from `claude -p --output-format json` (step 6a)
- [ ] Sidecar contains `stream-json` event shape observation (step 6b)
- [ ] Sidecar confirms output format is stable across 5 identical runs (step 6b)
- [ ] Sidecar contains 3× latency measurements at decomposition-scale prompt size, with token counts (step 6c)
- [ ] Sidecar contains concurrency test results for 2 and 3 parallel calls (step 6d)
- [ ] Sidecar contains timeout/failure signatures for: CLI not on PATH, not authenticated, process timeout (step 6e)
- [ ] Sidecar confirms no `ANTHROPIC_API_KEY` was set during the test
- [ ] Sidecar contains product dependency acknowledgement (step 6f)

## Out of scope — DO NOT
- Do not implement streaming, multi-turn, or `--json-schema` — this spike tests the basic round-trip only. Observing `stream-json` output shape (step 6b) is in scope; building streaming infrastructure is not.
- Do not add retry logic, timeout handling, or error recovery beyond basic error reporting.
- Do not add any frontend UI for the model call.
- Do not install the `@anthropic-ai/claude-agent-sdk` npm package or the `anthropic` Python package.
- Do not set `--bare` mode (it skips subscription auth).
- Do not modify any contract file, any test file outside `tests/T-015/`, or any spec note.
- Never invoke `node -e`, `python -c`, or other interpreter one-liners for diagnostics or version checks. bash-guard denies the command class regardless of argument content.
- **If anything is ambiguous: STOP. Write the question under Blocked in the state sidecar, set `status: blocked`, end the session. Never choose.**

## State sidecar
Mutable ticket state (status, Blocked, Implementation notes, Verification) lives in **`Arbor Spec/23 Tickets/state/T-015.md`**, NOT in this file. This ticket spec file is architect-only (protected by contract-shield). The sidecar is writable by all roles.
