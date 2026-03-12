---
description: Run the full lockdown audit before pushing changes. Reviews all app standards, runs G1-G7 sweep, does semantic review, fixes violations, and produces an audit report.
---

# Lockdown Audit Workflow

This workflow runs the full lockdown audit defined in Post-Stage Verification Standards Section 5. It is the final gate before pushing any changes.

## Pre-Lockdown: State Your Persona

Before starting, state:
- **Role**: I am a disciplined developer operating under the ROC Academy engineering standards. I research and prove before acting. I do not assume.
- **Behavior**: I will read all standards documents from disk (not from memory), audit every touched file, run automated sweeps, fix all findings, and produce a verifiable audit report.

## Step 1: Read All Standards Documents (from disk, not memory)

// turbo-all

Read these 4 documents in full:
1. `post_stage_verification_standards.md` (the lockdown protocol itself)
2. `system_design_standards.md`
3. `code_comment_standards.md`
4. `code_quality_standards.md`

All located in the conversation artifacts directory. If any are missing, check `App Standards/` in the repo root.

## Step 2: Run G1-G7 Automated Sweep

Run grep checks against ALL `.js` files in the project (not just touched files):

| # | Check | Pattern | Action |
|---|---|---|---|
| G1 | No `var` declarations | `^\s*var\b` (regex) | Convert to `const`/`let` |
| G2 | No em dashes | `—` (literal U+2014) | Replace with `-` or rewrite |
| G3 | No box-drawing chars | `─` (literal U+2500) | Replace with `---` or remove |
| G4 | No TODO/FIXME/HACK | `TODO\|FIXME\|HACK` | Fix or remove |
| G5 | No empty catch blocks | `catch.*\{\s*\}` (regex) | Add error handling or document exception |
| G6 | No hardcoded secrets | `sk-`, `Bearer ` in literals | Move to env vars |
| G7 | No mixed async patterns | `.then(` in files with `await` | Convert to consistent `async/await` |

**Known exceptions (skip but document):**
- Em dashes in UI display strings (not code comments)
- `.catch(() => {})` on fire-and-forget operations (e.g., cleanup, non-blocking callbacks)
- CSS `var()` is not a JS var declaration

## Step 3: Per-File Standards Compliance (touched files only)

For each file modified in this step, verify:
- No magic numbers (use named constants)
- `const` by default (`let` only for reassignment)
- JSDoc on public/exported functions
- Import order: built-ins, third-party, local (separated by blank lines)
- Naming conventions match standards

## Step 4: Semantic Review (S1-S6) (touched files only)

Re-read every touched file and verify:

| # | Check | What to look for |
|---|---|---|
| S1 | Comment accuracy | Do comments describe what code currently does? |
| S2 | Orphaned references | Any refs to removed/renamed functions? |
| S3 | Dead code | Unreachable code from refactoring? |
| S4 | Stale imports | Imports for modules no longer used? |
| S5 | JSDoc parameter sync | Do annotations match actual signatures? |
| S6 | Response shape consistency | Do new endpoints follow existing patterns? |

## Step 5: Fix All Findings

Fix every violation found in Steps 2-4 before proceeding. Do not carry violations forward.

## Step 6: Integration Verification

- Verify server starts without errors (health check or local test)
- Verify health check endpoint returns expected shape
- Verify affected endpoints respond correctly

## Step 7: Amend/Create Commit

Stage all changes (including fixes from Step 5) and commit:
- Commit message follows standard: `type: short description` (max 72 chars)
- No emojis, no em dashes in commit message
- Imperative mood ("Add" not "Added")

## Step 8: Push to Staging

Push to `staging` branch and verify remote SHA matches local.

## Step 9: Produce Audit Report

Create a POST-STAGE VERIFICATION report:

```
POST-STAGE VERIFICATION: [Step Name]
Commit: [SHA]
Files touched: [count]
G1-G7 sweep: PASS / [findings and fixes]
Semantic review: PASS / [findings and fixes]
Integration: PASS / [failures]
Verdict: CLEAR TO PROCEED / REWORK NEEDED
```
