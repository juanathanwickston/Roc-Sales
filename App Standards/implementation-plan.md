# ROC Academy — Phased Implementation Plan

> Build order designed to ship usable increments without breaking existing functionality.

## Guiding Principle

Each phase delivers a **working, shippable state.** No phase leaves the app broken. Each phase builds on the previous. We don't move to the next phase until the current one is verified.

---

## Phase 1: Foundation (Schema + Rename)
> Goal: Data model supports multi-pathway. UI reflects new terminology. Zero feature regression.

### Database (Migration 004)

**Modify existing:**
- ALTER `teams` → rename to `learning_pathways`, add `description TEXT`, `is_active BOOLEAN DEFAULT TRUE`
- ALTER `manager_teams` → rename to `user_pathways`, add `assigned_at TIMESTAMP DEFAULT NOW()`
- ALTER `users.role` CHECK constraint → add `ld_manager` value
- ALTER `users` → DROP `team_id` FK (replaced by junction), keep `pathway_id` for backward compat during migration, then DROP

**Already exist (DO NOT recreate):**
- `pathways` table — rename to `learning_pathways`
- `cms_modules` — existing module structure
- `cms_videos`, `cms_doc_sections`, `cms_apply_items`, `cms_quiz_questions` — existing section types
- `progress` — existing progress tracking (module/activity level)
- `scores` — existing score tracking

**Create new:**
- `user_pathways` junction (user_id, pathway_id, assigned_at) — replaces single FK
- INDEX on `user_pathways(user_id)` and `user_pathways(pathway_id)`

**Data migration within 004:**
- INSERT INTO `user_pathways` FROM existing `users.team_id` assignments
- INSERT INTO `user_pathways` FROM existing `manager_teams` assignments

### API
- Update all `/teams` endpoints → `/pathways`
- Update user endpoints to support multi-pathway assignment
- New LD Manager role in auth middleware

### Frontend
- Rename "Team" → "Learning Pathway" across all UI (sidebar, admin, profile)
- Admin Users tab: "Team" column → "Pathway(s)" (show multiple)
- Admin Pathways tab: basic list view with CRUD (replaces old Teams tab)

### Verification
- Existing login/navigation works
- Users tab shows pathway assignments correctly
- Old team data migrated cleanly

---

## Phase 2: Pathway Editor (Admin Content Management)
> Goal: LD Managers can build and manage pathways, modules, and sections.

### Admin — Learning Pathways Tab
- Pathway list with cards (name, module count, rep count, phase breakdown)
- Create new pathway
- Duplicate existing pathway
- Delete pathway (Superuser only)
- Click pathway → opens Pathway Editor

### Pathway Editor
- Pathway metadata (name, description)
- Module list with drag-to-reorder
- Add new module (name, icon, phase assignment — 5 predefined phases)
- Edit module metadata
- Delete module
- Click module → Module Editor

### Module Editor
- Module metadata (name, description, icon, phase)
- Section list with drag-to-reorder
- Add section by type:
  - **Video** — Title + Vimeo/YouTube embed URL
  - **Document** — Title + rich text editor (TipTap: headings, bold, italic, lists, links, tables, block quotes)
  - **SharePoint File** — Title + SharePoint browser/link (investigate TCM overlap)
  - **Quiz** — Title + question editor (extend existing quiz system)
  - **Activity** — Title + instructions + completion type
  - **Game** — Title + pick from game library (Phase 5)
- Edit existing sections
- Delete sections

### Verification
- Create a pathway from scratch with 3+ modules and mixed section types
- Duplicate a pathway and modify it
- Reorder modules and sections via drag
- Rich text editor renders correctly in admin and in content viewer

---

## Phase 3: Rep Experience (Dashboard + Pathway View)
> Goal: Reps see their assigned pathways and consume content through the new flow.

### Dashboard Redesign
- Replace current single-pathway dashboard with multi-pathway hub
- Pathway cards: name, progress bar, completion %, current phase, "Continue" CTA
- Overall stats: Power Score, Rank, total modules completed
- Leaderboard teaser (top 3)

### Pathway View (new screen)
- Breadcrumb: Dashboard > {Pathway Name}
- Phase sections (Foundations → Mastery & Certification)
- Module cards within each phase: name, icon, section count, completion status
- Click module → Module View

### Module View (new screen)
- Breadcrumb: Dashboard > {Pathway} > {Module}
- Section list: name, type icon, completion checkmark
- Click section → Content Viewer

### Content Viewer (new screen)
- Breadcrumb trail
- Video player (Vimeo/YouTube embed)
- Document viewer (rendered rich text)
- SharePoint file embed/viewer
- Quiz interface (existing, adapted)
- Activity card
- Previous / Next navigation
- "Mark Complete" button where applicable

### Verification
- Rep with 1 pathway: clean dashboard experience
- Rep with 3 pathways: card grid, each pathway independent
- Full navigation: Dashboard → Pathway → Module → Section → back
- Mobile responsive at each level

---

## Phase 4: Scoring & Leaderboard
> Goal: XP tracking, Power Score, per-pathway and global leaderboards.

### Progress Tracking
- Record completions in `user_progress` table
- Calculate XP per scoring-architecture.md rules
- Cache per-pathway stats in `user_pathway_stats`

### Power Score
- **Keep existing 4-component formula** (scoreRoutes.js L137-140) — already in production, battle-tested:
  - Completion (40%) + Quiz Accuracy (25%) + Game Scores (20%) + Learning Progress (15%)
- **Extend** to scope by pathway: add `WHERE pathway_id = $1` for per-pathway scores
- **Add** per-pathway leaderboard endpoint alongside global leaderboard
- Display on dashboard, profile, leaderboard

### Leaderboard
- Global leaderboard: ranked by Power Score
- Per-pathway leaderboard: ranked by Pathway XP (accessible from pathway view)
- Rank system with 7 tiers

### Celebrations
- Section complete: checkmark + XP toast
- Module complete: badge + confetti
- Phase complete: phase badge
- Pathway complete: certificate screen
- Rank up: full-screen announcement

### Verification
- XP awards correctly for each section type
- Power Score normalizes fairly across reps with different pathway counts
- Leaderboards display correctly and update in real-time
- Celebrations trigger at correct milestones

---

## Phase 5: Game Library & Manager Monitoring
> Goal: Complete the platform with game integration and manager oversight tools.

### Game Library
- Admin: Game Library tab (card grid)
- Each game: name, thumbnail, description, tags, difficulty
- Existing games migrated as library entries (Blitz, Sales Floor, Feature Factory, Territory, Coach)
- LD Manager can tag games and manage library
- When adding a Game section to a module, LD Manager picks from library

### Manager Monitoring
- Manager admin view: filtered to their assigned pathways
- Rep progress dashboard: per-rep completion %, current module, last activity
- Drilldown: click rep → see module-by-module progress
- Exportable reports

### SharePoint Browser (deeper investigation needed)
- Audit TCM's Microsoft Graph implementation
- Identify reusable components vs. new build
- Implement in-app file browser for SharePoint content

### Verification
- Games render correctly as sections within modules
- Game XP integrates with scoring system
- Manager sees only their scoped data
- SharePoint browser authenticates and displays files

---

## Phase Summary

| Phase | Scope | Depends On |
|-------|-------|------------|
| **1: Foundation** | Schema, rename, roles | Nothing — start here |
| **2: Pathway Editor** | Admin content CRUD | Phase 1 |
| **3: Rep Experience** | Dashboard, navigation, content viewing | Phase 2 |
| **4: Scoring** | XP, Power Score, leaderboards, celebrations | Phase 3 |
| **5: Games & Monitoring** | Game library, manager tools, SharePoint | Phase 4 |

---

## Open Items

- [ ] SharePoint browser — audit TCM overlap (deferred to Phase 5 investigation)
- [ ] Rich text editor choice — TipTap recommended (lightweight, extensible, table support)
- [ ] Drag-to-reorder library — SortableJS or similar
- [ ] Video embed approach — oEmbed API for Vimeo/YouTube thumbnail previews
- [ ] Mobile breakpoints for new screens
