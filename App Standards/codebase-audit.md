# ROC Academy — Full Codebase Audit

> Every file reviewed. Every change identified.

## Files Reviewed

| File | Lines | Status |
|------|-------|--------|
| `migrations/001_initial.sql` | 119 | ✅ Reviewed |
| `migrations/002_cms_content.sql` | 76 | ✅ Reviewed |
| `migrations/003_last_login.sql` | 5 | ✅ Reviewed |
| `server/auth.js` | 94 | ✅ Reviewed |
| `server/db.js` | 113 | ✅ Reviewed |
| `server/server.js` | 293 | ✅ Reviewed |
| `server/middleware/requireAuth.js` | 56 | ✅ Reviewed |
| `server/middleware/requireRole.js` | 26 | ✅ Reviewed |
| `server/middleware/rateLimiter.js` | ~20 | ✅ Reviewed |
| `server/routes/authRoutes.js` | 187 | ✅ Reviewed |
| `server/routes/adminRoutes.js` | 497 | ✅ Reviewed |
| `server/routes/cmsRoutes.js` | 498 | ✅ Reviewed |
| `server/routes/progressRoutes.js` | 122 | ✅ Reviewed |
| `server/routes/scoreRoutes.js` | 189 | ✅ Reviewed |
| `server/routes/exportRoutes.js` | 139 | ✅ Reviewed |
| `public/js/api.js` | 322 | ✅ Reviewed |
| `public/js/auth.js` | 57 | ✅ Reviewed |
| `public/js/admin.js` | 940 | ✅ Reviewed |
| `public/js/game.js` | 1298 | ✅ Reviewed |
| `public/js/modules.js` | 52 | ✅ Reviewed |
| `public/js/leaderboard.js` | 96 | ✅ Reviewed |
| `public/js/content.js` | — | Generated file |
| `public/js/chatbot.js` | — | Not impacted |
| `public/js/quizzes.js` | — | Not impacted |

---

## Critical Findings

### 1. Power Score Formula (scoreRoutes.js:94-153)
The EXISTING Power Score is a **4-component weighted SQL calculation**, not a simple XP sum:

```
Completion (40%) = done_count / (totalModules × 4) × 1000 × 0.40
Quiz Accuracy (25%) = avg(score/maxScore) × 1000 × 0.25
Game Scores (20%) = min(total_best_scores, 1000) × 0.20
Learning Progress (15%) = same completion formula × 1000 × 0.15
```

> [!IMPORTANT]
> Our scoring-architecture.md proposes a simpler formula. We need to decide: keep the existing 4-component formula and adapt it, or replace it. The existing formula is battle-tested and fair.

### 2. Game Engine (game.js) — Massive Coupling
`game.js` is 1298 lines containing:
- **6 game engines**: Sales Floor, Objection Blitz, Territory, CompIQ, ProductIQ, Feature Factory
- **All content viewers**: `showVideo()`, `showDoc()`, `showApply()` (these should be section viewers)
- **All progress tracking**: `completeAct()`, `getActStatus()`, `isModDone()`
- **Skill tracking**: `SKILL_MAP`, `SKILL_WEIGHTS`, readiness index
- **XP system**: `addXP()`, `streak()`
- **Navigation**: `showModule()`, `launchAct()`, `backToModule()`

> [!WARNING]
> This file handles BOTH game logic AND content viewing. Refactoring the content viewing out of game.js is necessary for the new pathway architecture but is high-risk — it touches the core learning experience.

### 3. Three Hardcoded Phases (modules.js:29-51)
`PHASES` array has exactly 3 phases:
1. Foundation (Days 1-30)
2. Applied Skill (Days 30-60)
3. Performance Validation (Days 60-90)

Each phase includes behavioral standards (Expert/Competent/Practicing). Expanding to 5 phases requires writing new behavioral standards for phases 4 and 5.

### 4. Team-Pathway Confusion in Schema
The schema has BOTH:
- `teams` table + `users.team_id` (used for admin scoping)
- `pathways` table + `users.pathway_id` (used for content assignment)
- `manager_teams` junction (associates managers to teams)

These are separate concepts currently. Our plan merges them into `learning_pathways` + `user_pathways`. Migration must handle both.

---

## File-by-File Change Map

### Backend — Must Change

| File | Change | Risk |
|------|--------|------|
| `requireRole.js` | Add `ld_manager: 3` to hierarchy, bump `superuser: 4` | Low |
| `authRoutes.js` L91-92 | Profile query: replace `team_id, pathway_id` with pathway array from junction | Medium |
| `authRoutes.js` L103-108 | Remove team name lookup, replace with pathway names | Medium |
| `adminRoutes.js` L27-68 | User query: `JOIN user_pathways` instead of `team_id` | High |
| `adminRoutes.js` L80-151 | Create user: assign to pathways via junction table | High |
| `adminRoutes.js` L158-232 | Update user: pathway assignment changes | High |
| `adminRoutes.js` team routes | Rename to pathway routes, update SQL | High |
| `cmsRoutes.js` role guards | Change `requireRole('manager')` → `requireRole('ld_manager')` on edit routes | Low |
| `progressRoutes.js` | Activity types: expand from 4 → section-based tracking | High |
| `scoreRoutes.js` L94-153 | Power Score: scope by pathway, add per-pathway scoring | High |
| `exportRoutes.js` L27-48 | Replace `teams`/`manager_teams` with `user_pathways` | Medium |
| New: `004_learning_pathways.sql` | Migration: rename tables, add junction, add ld_manager role | Critical |

### Frontend — Must Change

| File | Change | Risk |
|------|--------|------|
| `auth.js` L42 | Add `ld_manager: 3` to hierarchy, bump `superuser: 4` | Low |
| `api.js` L220-234 | Rename team methods → pathway methods | Low |
| `api.js` | Add new pathway CRUD endpoints | Low |
| `admin.js` | Rename "Team" → "Learning Pathway" in all strings | Medium |
| `admin.js` | Add LD Manager role to dropdowns and badge rendering | Medium |
| `admin.js` | Content tab → Pathway editor (major rewrite) | High |
| `modules.js` L29-51 | Expand PHASES from 3 → 5, add behavioral standards | Medium |
| `game.js` L190-263 | `renderHome()` → multi-pathway dashboard | High |
| `game.js` L265-311 | `showModule()` → pathway-scoped | Medium |
| `game.js` L352-495 | Content viewers → pathway-aware | Medium |
| `leaderboard.js` | Add per-pathway leaderboard view | Medium |
| `index.html` | New CSS for pathway cards, dashboard layout | Medium |

### New Files Needed

| File | Purpose |
|------|---------|
| `migrations/004_learning_pathways.sql` | Schema migration |
| `server/routes/pathwayRoutes.js` | Pathway CRUD API |
| TipTap integration | Rich text editor for documentation sections |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| `game.js` refactor breaks content viewing | All users affected | Extract content viewers first, verify before touching games |
| Schema migration data loss | User data lost | Write migration with rollback, test on staging first |
| Power Score regression | Leaderboard trust destroyed | Preserve existing formula as baseline, extend don't replace |
| Frontend role checks miss ld_manager | Access control gaps | Grep every instance of role checking before deployment |
