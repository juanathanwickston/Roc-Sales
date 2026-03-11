---
description: Run the exhaustive lockdown audit against all app standards before marking a step DONE
---

# Lockdown Audit Workflow

This workflow implements Section 5 of the Post-Stage Verification Standards. Run it before marking any implementation step as DONE.

## Prerequisites

- All 2.1-2.9 post-stage checks have already passed for this step
- All code changes for the step are committed

## Standards Documents

Read ALL of these in full before grading (do not rely on memory):

- `system_design_standards.md` — System Design & Architecture
- `code_comment_standards.md` — Code Comments
- `code_quality_standards.md` — Code Quality & Good Practices
- `post_stage_verification_standards.md` — Post-Stage Verification (including this lockdown section)

These are located in the conversation's brain/artifacts directory.

## Procedure

// turbo-all

### Step 1: Read All Standards

Read each of the 4 standards documents cover-to-cover using `view_file`. Extract every distinct rule from each document. Do not skip any section.

### Step 2: Read All Source Files

Read every `.js` file in the project (both `server/` and `public/js/`) cover-to-cover. Also read:
- All `.sql` migration files in `server/migrations/`
- `package.json`
- `.env.example`

### Step 3: Grade Every Rule

For each rule from each standard, check it against every relevant source file. Record:
- **PASS** with specific `file:line` evidence
- **FAIL** with specific violation details
- **EXCEPTION** with justification (must match a known exception from the standards)

### Step 4: Run G1-G7 Automated Sweep

Run all 7 grep checks from Post-Stage Verification 2.3, even if they were already run earlier:
- G1: `var` declarations (regex: `^\s*var\b`)
- G2: Em dashes (literal `\u2014`)
- G3: Box-drawing chars (literal `\u2500`)
- G4: TODO/FIXME/HACK
- G5: Empty catch blocks (regex: `catch\s*\(\s*\)\s*\{?\s*\}`)
- G6: Hardcoded secrets (`sk-`, passwords in code)
- G7: Mixed async (`.then(` in files using `await`)

### Step 5: Fix All Findings

Fix every FAIL finding. Do not carry violations forward. Each fix should be minimal and surgical.

### Step 6: Produce Audit Report

Write the audit report to the conversation's `audit_report.md` artifact. Format per Section 5.4 of the post-stage verification standards:
- Organized by standard, then section, then rule
- Each rule gets a verdict + evidence row
- Summary table at the end with totals

### Step 7: Commit and Push

```
git add -A
git commit -m "chore: lockdown audit fixes for Step [N]"
git push origin staging
```

### Step 8: Verify Deployment

- Confirm remote SHA matches local via `git ls-remote origin staging`
- Confirm health check returns `status: ok` via the health endpoint

### Step 9: Report Verdict

Report the final verdict to the user:
- Total rules checked
- Total pass / exception / finding counts
- Deployment verification status
- **CLEAR TO PROCEED** or **REWORK NEEDED**
