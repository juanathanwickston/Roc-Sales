# ROC Academy — User Journey Map

> Complete flow from login to content completion for all user roles.

## Role Definitions

| Role | Access |
|------|--------|
| **Rep** | Assigned Learning Pathways → Modules → Content. Leaderboard. Profile. |
| **Manager** | Everything a Rep sees + Admin Panel (Users, Pathways, Content) |
| **Superuser** | Everything a Manager sees + Destructive actions (Reset, Delete) |

---

## Rep Journey

### Screen 1: Login
- Username + password
- Clean, branded entry point
- Redirect to Dashboard on success

### Screen 2: Dashboard (Home)
> First thing the rep sees after login. The hub.

**Layout:**
- Welcome header: "Welcome back, {firstName}"
- Overall stats summary (Power Score, Rank, total progress)
- **Learning Pathway cards** — one per assigned pathway:
  - Pathway name
  - Progress indicator (e.g. "4 of 10 modules complete")
  - Current phase label (e.g. "Phase 1 — Foundational")
  - Continue / Start button
  - Visual progress bar
- Leaderboard teaser (top 3)

**Behavior:**
- If rep has **1 pathway** → still shows the card, consistent experience
- If rep has **3 pathways** → 3 cards in a grid
- Click a pathway card → enters Pathway View (Screen 3)

### Screen 3: Pathway View
> Inside one specific learning pathway. Shows all modules in order.

**Layout:**
- Breadcrumb: Dashboard > {Pathway Name}
- Pathway title + description
- Phase sections (Phase 1: Foundational, Phase 2: Intermediate, Phase 3: Advanced)
- Module cards within each phase:
  - Module name + icon
  - Completion status (locked / in progress / complete)
  - Activity count (e.g. "5 activities")
  - Click → enters Module View

**Behavior:**
- Modules presented in order (foundational → advanced)
- Progress unlocking: configurable (sequential or open access)
- Back button returns to Dashboard

### Screen 4: Module View
> Inside one module. Shows all sections/activities.

**Layout:**
- Breadcrumb: Dashboard > {Pathway} > {Module Name}
- Module title + description
- Section list (ordered):
  - Section name
  - Content type indicator (📹 Video, 📄 Document, ✍️ Activity, 📝 Quiz)
  - Completion checkmark
  - Click → enters Content Viewer

**Behavior:**
- Sections presented in defined order
- Completing all sections = module complete
- Module completion → celebration animation + XP award

### Screen 5: Content Viewer
> Consuming actual content.

**Layout:**
- Breadcrumb: Dashboard > {Pathway} > {Module} > {Section}
- Content area (video player, document reader, quiz interface, activity)
- Previous / Next navigation
- Module outline sidebar (optional — shows progress within module)
- "Mark Complete" action for non-auto-completing content

**Behavior:**
- Videos: auto-complete on finish
- Quizzes: auto-complete on submission (score recorded)
- Documents: manual "Mark Complete" button
- Activities/exercises: manual completion or submission-based

### Supporting Screens

**Leaderboard** — Power Score rankings across all users
**Profile** — Account settings, password, progress overview

---

## Manager/Admin Journey

### Admin Panel — Three Tabs

**Tab 1: Users**
- User table (current SaaS design) ✅ Done
- Create, edit, deactivate users
- Assign users to Learning Pathways (multi-select)

**Tab 2: Learning Pathways** (renamed from "Teams")
- Pathway list/grid
- Create new pathway
- Duplicate existing pathway
- Delete pathway
- Click a pathway → Pathway Editor

**Tab 3: Content (Pathway Editor)**
> Entered by clicking a pathway from Tab 2

- Pathway metadata (name, description)
- Module list with drag-to-reorder
- Add new module
- Click module → Module Editor:
  - Module metadata (name, icon, phase assignment)
  - Section list with drag-to-reorder
  - Add new section:
    - Type: Video upload, File upload, Documentation (rich text), Quiz, Activity
  - Edit existing sections
  - Delete sections

---

## Content Type Details

| Type | Admin Creates | Rep Sees |
|------|--------------|----------|
| **Video** | Upload video file or provide URL | Video player with transcript |
| **Document** | Rich text editor (in-platform) | Formatted reading view |
| **File** | Upload PDF/PPT/etc. | File viewer or download |
| **Quiz** | Question editor (existing) | Quiz interface (existing) |
| **Activity** | Instructions + submission type | Activity card with action |

---

## Navigation Model

```
Sidebar (persistent):
  📊 Dashboard        → Screen 2
  ⭐ Leaderboard      → Leaderboard
  ⚙ Profile           → Profile
  🔧 Admin            → Admin Panel (managers only)
```

**Within pathway content:** Breadcrumb trail for orientation + Back button for quick return.

---

## Gamification Touchpoints

| Event | Reward |
|-------|--------|
| Complete a section | XP + checkmark animation |
| Complete a module | XP bonus + badge + celebration |
| Complete a pathway phase | Phase badge + rank progress |
| Complete entire pathway | Certificate + major celebration |
| Daily login streak | Streak indicator on dashboard |
