# ROC Academy — Design System Standards

> Single source of truth. Reference this before every change.

## Typography

| Token | Size | Use |
|-------|------|-----|
| `--fs-2xs` | 11px | Micro labels, badges |
| `--fs-xs` | 12px | Captions, table headers, muted text |
| `--fs-sm` | 13px | Body text, table cells, inputs |
| `--fs-base` | 14px | Primary body |
| `--fs-md` | 16px | Subheadings |
| `--fs-lg` | 18px | Section titles |
| `--fs-xl` | 24px | Page titles |
| `--fs-2xl` | 28px | Hero headings |
| `--fs-3xl` | 36px | Landing page headers |

**Font:** Geist (400, 500, 700 weights only)
**Weights:** `--fw-normal:400` `--fw-medium:500` `--fw-semibold:600` `--fw-bold:700`
**Line height:** `--lh-tight:1.3` `--lh-normal:1.55` `--lh-relaxed:1.7`

## Spacing System (strict)

Only these values: **4px, 8px, 16px, 24px, 32px, 48px**

| Value | Use |
|-------|-----|
| 4px | Icon gaps, badge padding vertical, tight element pairs |
| 8px | Input/button padding vertical, small gaps, card inset |
| 16px | Cell padding, input padding horizontal, section gaps |
| 24px | Between major sections, card padding |
| 32px | Page-level padding, large section breaks |
| 48px | Page top/bottom padding, hero spacing |

## Color Palette

| Token | Hex | Use |
|-------|-----|-----|
| `--navy` | #0A1628 | Page background |
| `--n2` | #0F1B32 | Elevated surface (popups, dropdowns) |
| `--n3` | #152240 | Card/table backgrounds |
| `--n4` | #1C2D4E | Hover states, input backgrounds |
| `--blue` | #3B82F6 | Primary action, active states |
| `--green` | #00e0b8 | Success, active status |
| `--red` | #FF4466 | Danger, destructive actions |
| `--orange` | #FFB800 | Warnings, superuser badge |
| `--purple` | #A78BFA | Accent, decorative |
| `--white` | #EDF2FF | Primary text |
| `--gray` | #7B8BA8 | Muted text, labels |
| `--gb` | rgba(59,130,246,.12) | Subtle borders |

## Border Radius

| Token | Value | Use |
|-------|-------|-----|
| `--r-xs` | 3px | Tiny elements |
| `--r-sm` | 5px | Badges, small buttons |
| `--rs` | 8px | Inputs, filters, tabs |
| `--r` | 12px | Cards, containers, modals |

## Component Patterns

### Buttons
- **Primary:** `background:var(--blue)`, white text, `--rs` radius, `--fs-sm`, weight 600
- **Secondary/Toolbar:** `background:var(--n3)`, `border:1px solid var(--gb)`, gray text
- **Danger:** Red text, red border on hover

### Badges
- `padding:4px 10px`, `border-radius:6px`, `font-size:12px`, `font-weight:600`
- Uppercase, letter-spacing `.3px`
- Background: 12% opacity of badge color

### Cards
- `background:var(--n3)`, `border:1px solid var(--gb)`, `border-radius:12px`
- Padding: 16-24px
- No shadows (flat dark mode)

### Tables (SaaS pattern)
- Wrap in card container with `padding:4px 8px`
- `table-layout:fixed`, cell padding `0 16px`, row height `52px`
- Headers: uppercase, muted (`rgba(123,139,168,.6)`), `--fs-2xs`, weight 500
- Subtle row dividers: `rgba(255,255,255,.03)`
- Hover: `rgba(255,255,255,.02)`

### Inputs
- `background:var(--n3)`, `border:1px solid var(--gb)`, `--rs` radius
- `--fs-sm`, `padding:8px 16px`
- Focus: `border-color:rgba(59,130,246,.4)`

## Z-Index Layers

| Layer | Value | Use |
|-------|-------|-----|
| Base | 1 | Content |
| Sticky | 10 | Sticky headers |
| Sidebar | 50 | Navigation |
| Header | 100 | Top bar |
| Popup | 150 | Dropdowns, tooltips |
| Confetti | 200 | Celebration effects |
| Modal | 999 | Modals, overlays |
| Password | 1000 | Forced password change |
| Chatbot | 9999 | AI assistant |

## Interaction Standards

- **Transitions:** `all .2s` for most, `.15s` for hover states
- **Hover effects:** Subtle — border color change or `rgba(255,255,255,.02-.06)` background
- **No heavy animations** in admin/management interfaces
- **Gamification animations** allowed in learner-facing screens only
