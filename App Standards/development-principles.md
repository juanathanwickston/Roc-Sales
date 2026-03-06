# ROC Academy — Development Principles

> Non-negotiable standards for every change we make.

## Core Philosophy

**Completeness over speed.** Every change must be fully researched, understood, and verified before implementation. A thorough, correct implementation done once is faster than three rushed attempts.

## Pre-Implementation Audit Protocol (Mandatory)

> [!CAUTION]
> This protocol is NON-NEGOTIABLE. No code is written until every item is checked.

Before writing ANY code for a multi-file or architectural change:

### Step 1: Identify Every Affected File
- [ ] List every file that will be touched (backend + frontend)
- [ ] List every file that REFERENCES what you're changing (grep for all mentions)
- [ ] List every file that DEPENDS on what you're changing (imports, API calls, CSS selectors)

### Step 2: Read Every Affected File
- [ ] Read the FULL content of every identified file, not just outlines
- [ ] Document what each file does and how it relates to the change
- [ ] Identify every hardcoded value, magic string, or assumption that will break

### Step 3: Map the Data Flow
- [ ] Trace the data from database → API → frontend for every affected feature
- [ ] Identify where data shape changes (column renames, new fields, removed fields)
- [ ] Verify every SQL query that touches affected tables

### Step 4: Map the Auth/Access Chain
- [ ] Identify every role check (backend middleware + frontend `hasRole()`)
- [ ] Verify the cascade: role in DB → role in JWT → role in middleware → role in UI
- [ ] Confirm no access control gaps

### Step 5: Document Before Coding
- [ ] Write the audit findings into `App Standards/codebase-audit.md`
- [ ] Present findings with file-by-file change map and risk assessment
- [ ] Get explicit approval before writing ANY implementation code

**If you cannot check every box, you are not ready to code.**

## The Rules

### 1. Measure Three Times, Cut Once
- **Audit first.** Before writing a single line, understand the full context — the DOM hierarchy, the CSS cascade, the data flow, the container constraints.
- **Trace the chain.** If editing CSS, trace from the element up through every parent. If editing JS, trace from the render call through to the final DOM output.
- **Verify assumptions.** If you think `.app` has `max-width:540px`, confirm it. Don't assume.

### 2. No Guessing, No Assumptions
- Every decision must be **fact-based**. Reference the actual code, actual token values, actual container sizes.
- If unsure, **ask**. A question costs nothing. A wrong assumption costs a broken UI and lost trust.
- Document the rationale for non-obvious decisions.

### 3. Surgical, Precise Changes
- Change only what needs to change. Don't refactor unrelated code while fixing a bug.
- Understand the **blast radius** of every edit. A CSS change on `.screen` affects every screen. Know that before you write it.
- If a change requires touching more than one file, map all affected files before starting.

### 4. Understand the Full Context
- **Container hierarchy:** Always know what wraps the element you're styling. Parents constrain children.
- **CSS specificity:** Know which rule wins. ID > class > element. Count selectors.
- **Data flow:** Know where the data comes from (API → JS → DOM) before changing how it renders.

### 5. Visual Verification Before Shipping
- If you can't run the app locally, do a thorough code review tracing the exact DOM output and CSS cascade.
- Never push CSS changes without calculating the actual pixel values that will result.
- Math matters: column widths, padding, content area = width − padding-left − padding-right.

### 6. Standards Compliance
- Reference `App Standards/design-system.md` before every UI change.
- Use only the defined spacing system (4, 8, 16, 24, 32, 48px).
- Use only the defined tokens for colors, fonts, radii.
- New CSS must follow existing patterns (naming, structure, specificity level).

### 7. No Orphaned Code
- If you remove an HTML element, remove its CSS rules.
- If you rename a class, update every reference.
- If you add a feature, ensure it works with existing features (mobile, print, accessibility).

### 8. Communication Before Coding
- For any non-trivial change, discuss the approach first.
- Present the proposed DOM structure, the CSS rules, and the expected visual outcome.
- Get alignment before writing code.

## Quality Checklist (Before Every Push)

- [ ] Does this change use only standard spacing values?
- [ ] Does this change use only defined design tokens?
- [ ] Have I traced the full CSS cascade for every modified rule?
- [ ] Have I verified the container/parent constraints?
- [ ] Does this change work at the admin panel's 1000px width?
- [ ] Does this change break any existing screens?
- [ ] Have I removed all orphaned CSS/JS from this change?
- [ ] Have I tested the math (column widths, padding, content areas)?
