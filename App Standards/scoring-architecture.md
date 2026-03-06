# ROC Academy — Scoring & Gamification Standards

> Defines how points, progress, and rankings work across the platform.

## Scoring Principles

1. **Transparent** — Reps can always see why they earned points
2. **Fair** — Normalized scoring so pathway count doesn't create unfair advantages
3. **Motivating** — Frequent small rewards, milestone celebrations
4. **Trustworthy** — Metrics are accurate and auditable

---

## Point Sources

| Activity | XP Earned | Notes |
|----------|-----------|-------|
| Complete a section (video) | 10 XP | Auto-complete on video finish |
| Complete a section (document) | 10 XP | Manual "Mark Complete" |
| Complete a section (activity) | 15 XP | Submission-based |
| Complete a quiz section | 20–50 XP | Scaled by score: `base 20 + (score% × 30)` |
| Complete a game section | 25–75 XP | Based on game performance |
| Complete a module (all sections done) | 50 XP bonus | Milestone bonus |
| Complete a phase (all phase modules done) | 100 XP bonus | Phase milestone |
| Complete entire pathway | 250 XP bonus | Major celebration |

## Per-Pathway Scoring

Each pathway tracks independently:

- **Pathway XP** — Total XP earned from all activities within that pathway
- **Pathway Completion %** — Sections completed / total sections
- **Pathway Phase** — Current phase the rep is working through

**Display:** Pathway card shows both XP earned and completion percentage.

## Global Power Score

> [!IMPORTANT]
> **Decision locked:** Keep the existing 4-component weighted formula from `scoreRoutes.js` L137-140.
> It is battle-tested, already in production, and normalizes fairly across activity types.

**Production formula (per-user, scored out of 1000):**

```
Completion (40%)    = (done_count / (totalModules × 4)) × 1000 × 0.40
Quiz Accuracy (25%) = avg(score / maxScore) × 1000 × 0.25
Game Scores (20%)   = min(total_best_scores, 1000) × 0.20
Learning (15%)      = (done_count / (totalModules × 4)) × 1000 × 0.15
```

**Max Power Score: 1000** (when all modules complete, perfect quiz scores, game cap hit)

**Per-pathway extension (Phase 4):**
- Add `WHERE pathway_id = $1` scoping for per-pathway leaderboards
- Global leaderboard retains the current cross-pathway calculation
- Per-pathway leaderboard ranks by pathway-scoped Power Score

## Leaderboard

### Global Leaderboard
- Ranked by **Power Score**
- Shows: Rank, Name, Power Score, top pathway completion
- All reps visible

### Per-Pathway Leaderboard
- Ranked by **Pathway XP**
- Shows: Rank, Name, Pathway XP, Completion %, Current Phase
- Only reps assigned to that pathway visible
- Accessible from within the pathway view

## Rank System

| Rank | Power Score Range | Title |
|------|-------------------|-------|
| 1 | 0–99 | Rookie |
| 2 | 100–299 | Associate |
| 3 | 300–599 | Specialist |
| 4 | 600–999 | Senior |
| 5 | 1000–1499 | Expert |
| 6 | 1500–2499 | Elite |
| 7 | 2500+ | Master |

## Celebration Triggers

| Event | Visual |
|-------|--------|
| Section complete | Checkmark animation + XP toast |
| Module complete | Badge earned + confetti |
| Phase complete | Phase badge + rank check |
| Pathway complete | Certificate screen + major confetti |
| Rank up | Full-screen rank announcement |

## Progress Tracking (Database)

```
user_progress
  - user_id
  - section_id
  - completed_at (timestamp)
  - score (nullable — for quizzes/games)
  - xp_earned

user_pathway_stats (materialized/cached)
  - user_id
  - pathway_id
  - total_xp
  - completion_pct
  - current_phase
  - last_activity_at
```

## Audit Notes

- XP is **immutable** once earned. If a section is removed from a pathway, earned XP stays.
- Completion % recalculates based on **current** pathway structure.
- Power Score recalculates on every activity completion.
- All scoring events are timestamped for audit trail.
