---
description: Post-change audit that checks completeness, code quality, and standards compliance before moving to the next phase
---

# Postflight Checklist

Run this workflow after completing any phase or significant change. Every item must pass before declaring the work done.

## 1. Completeness Audit

Review the implementation plan for this phase and verify every item was delivered.

- [ ] Open the implementation plan and go through each file listed
- [ ] For every NEW file listed: verify it exists on disk and contains the expected content
- [ ] For every MODIFIED file listed: verify the modification was applied correctly
- [ ] For every feature described: verify it is wired end-to-end (not just the file, but the integration)
- [ ] Check for orphaned code: any imports that reference files that do not exist
- [ ] Check for dead code: any exports that nothing imports

## 2. Syntax and Error Scan

Scan every file touched in this change for mechanical errors.

- [ ] No syntax errors (missing brackets, unclosed tags, mismatched quotes)
- [ ] No typos in function names, variable names, or string literals
- [ ] No undefined references (variables or functions used but never declared)
- [ ] No missing `require` or `import` statements
- [ ] No duplicate function or variable declarations
- [ ] HTML files: all tags properly closed, all IDs unique
- [ ] CSS files: no unclosed rules, no invalid property values
- [ ] SQL files: valid syntax, proper semicolons, correct column types

## 3. Logic and Edge Cases

Review the logic of every function and route touched in this change.

- [ ] Every async function has error handling (try/catch or .catch)
- [ ] Error paths return meaningful messages (no silent swallowing)
- [ ] Edge cases handled: null inputs, empty strings, missing parameters
- [ ] Resource cleanup: every opened connection, timer, or listener is cleaned up on destroy
- [ ] No race conditions: concurrent operations do not corrupt shared state
- [ ] Database queries use parameterized values (no string concatenation)

## 4. Standards Compliance

Check against all 9 app standards. Reference specific sections.

### Codebase Quality (codebase_and_code_quality.md)
- [ ] File naming follows conventions (Section 2.1)
- [ ] JS uses const/let (never var), arrow functions for callbacks (Section 3.1)
- [ ] Naming: camelCase variables, verb-first functions, PascalCase classes (Section 3.3)
- [ ] Comments explain WHY, not WHAT (Section 3.4)
- [ ] CSS uses design tokens from tokens.css, no hardcoded values (Section 4.1)
- [ ] BEM-lite class naming (Section 4.2)
- [ ] Every external API has a dedicated wrapper in services/ (Section 8.1)
- [ ] API calls have timeout, logging, retry, defensive parsing (Section 8.2)
- [ ] No process.env references outside config/ (Section 6.3)

### Execution Standards (execution_standards.md)
- [ ] No emojis in code or comments (Section 2)
- [ ] No AI language in code comments or UI text (Section 2)
- [ ] No em dashes in any output (Section 2)
- [ ] No commented-out code (Section 11.3)

### Security (security_and_data_privacy_requirements.md)
- [ ] All API keys from config only, never hardcoded (Section 3.2)
- [ ] No PII beyond first name in LLM prompts (Section 7.4)
- [ ] Parameterized SQL queries only (Section 9)
- [ ] CSP headers allow all required resources (Section 9)

### Voice/Persona (voice_and_persona_consistency.md)
- [ ] System prompt follows 8-section structure (Section 7.1)
- [ ] System prompt under 2000 tokens (Section 7.2)
- [ ] No coaching or evaluation language in persona (Section 10)
- [ ] Emotion tags included in prompt guidance (Section 2.3)

### Latency (latency_targets_and_performance_budgets.md)
- [ ] Sentence-level streaming implemented (Section 4)
- [ ] Latency instrumentation at handoff points (Section 6.2)

## 5. UI/UX Verification

If any UI changes were made:

- [ ] Check both light and dark themes
- [ ] Check responsive: desktop (1024+), tablet (768), mobile (640)
- [ ] All interactive elements have unique IDs and aria-labels
- [ ] No inline styles or inline event handlers
- [ ] Transitions and animations are smooth

## 6. Git Hygiene

- [ ] Commit message follows convention: `type: description` (Section 11.1)
- [ ] One logical change per commit (Section 5)
- [ ] Pushed to correct branch (staging, never main)
- [ ] No secrets, API keys, or credentials in committed code

## 7. Report

After completing all checks, report:
- Total items checked
- Items passed
- Items failed (with details)
- Items deferred (with justification)
- Recommendation: PASS or FAIL
