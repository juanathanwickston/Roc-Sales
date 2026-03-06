# ROC Academy — Mobile & Responsive Standards

> One codebase, every screen size. No feature left behind on mobile.

---

## 1. Breakpoints (System)

Three breakpoints, matching industry standards:

| Name | Width | Devices | CSS |
|------|-------|---------|-----|
| **Mobile** | ≤ 767px | Phones | `@media (max-width: 767px)` |
| **Tablet** | 768px–1023px | Tablets, small laptops | `@media (min-width: 768px) and (max-width: 1023px)` |
| **Desktop** | ≥ 1024px | Laptops, desktops | Default (mobile-first) or `@media (min-width: 1024px)` |

### Approach: Mobile-First
Write base CSS for mobile, enhance for larger screens:
```css
/* Base: mobile */
.pathway-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

/* Tablet: 2 columns */
@media (min-width: 768px) {
  .pathway-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
  }
}

/* Desktop: 3 columns */
@media (min-width: 1024px) {
  .pathway-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

---

## 2. Existing Mobile Patterns (Reference)

The app already implements these mobile patterns — maintain consistency:

### Sidebar → Drawer
- Desktop: fixed sidebar (220px width)
- Mobile: hidden by default, opens as overlay drawer via hamburger menu
- Drawer closes on: backdrop click, Escape key, link click
- Breakpoint: 768px (existing `@media` in `index.html`)

### App Container
- Desktop: `.app` with `max-width` per screen type
- Mobile: Full width with padding
- Admin panel: `max-width: 1000px` on desktop, full width on mobile

---

## 3. Touch Targets

### Minimum Size: 44×44px (WCAG / Apple HIG)
Every tappable element must be at least 44×44 CSS pixels.

| Element | Current Size | Compliant? |
|---------|-------------|------------|
| Sidebar nav links | Full width × 48px height | ✅ |
| Button (primary) | Auto width × ~40px | ⚠️ Increase padding |
| Table row (clickable) | Full width × 52px | ✅ |
| Action menu (⋯) | 32×32px | ❌ Needs 44×44px touch area |
| Tab buttons | Auto × ~36px | ⚠️ Increase for mobile |
| Filter dropdowns | Auto × ~38px | ⚠️ Increase for mobile |

### Fix for Small Elements
```css
/* Add touch area without changing visual size */
.admin-more-btn {
  width: 32px;
  height: 32px;
  /* Invisible touch expansion */
  position: relative;
}
.admin-more-btn::before {
  content: '';
  position: absolute;
  top: -6px;
  left: -6px;
  right: -6px;
  bottom: -6px;
}

/* Or just make it bigger on mobile */
@media (max-width: 767px) {
  .admin-more-btn {
    width: 44px;
    height: 44px;
  }
}
```

---

## 4. Responsive Tables

Tables don't work well on narrow screens. Strategy per table size:

### Small Tables (< 5 columns, admin user list)
- Horizontal scroll with `overflow-x: auto` on container
- Sticky first column (name) if possible
- Reduce padding on mobile: `8px` instead of `16px`

```css
@media (max-width: 767px) {
  .admin-table-card {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .admin-table td,
  .admin-table th {
    padding: 8px;
    font-size: var(--fs-xs);
    white-space: nowrap;
  }
  /* Hide less important columns */
  .col-login,
  .col-status {
    display: none;
  }
}
```

### Large Tables (many columns)
- Stack into cards on mobile: each row becomes a card showing all fields vertically
- Show truncated info in card with "expand" to see full details

### Priority Columns (What to Show on Mobile)
| Column | Desktop | Mobile |
|--------|---------|--------|
| Name | ✅ Always | ✅ Always |
| Role | ✅ Always | ✅ Always |
| Pathway | ✅ Always | ⚠️ Truncate |
| Status | ✅ Always | ❌ Hide |
| Last Login | ✅ Always | ❌ Hide |
| Actions | ✅ Always | ✅ Always |

---

## 5. Responsive Typography

| Token | Desktop | Mobile | Adjustment |
|-------|---------|--------|-----------|
| `--fs-3xl` (36px) | Page landing | 28px | Reduce |
| `--fs-2xl` (28px) | Hero heading | 24px | Reduce |
| `--fs-xl` (24px) | Page title | 20px | Reduce |
| `--fs-lg` (18px) | Section title | 16px | Reduce |
| `--fs-md` (16px) | Subheading | 16px | Keep |
| `--fs-base` (14px) | Body | 14px | Keep |
| `--fs-sm` (13px) | Table cells | 13px | Keep |
| `--fs-xs` (12px) | Captions | 12px | Keep |

```css
@media (max-width: 767px) {
  :root {
    --fs-3xl: 1.75rem;     /* 28px instead of 36px */
    --fs-2xl: 1.5rem;      /* 24px instead of 28px */
    --fs-xl: 1.25rem;      /* 20px instead of 24px */
  }
}
```

---

## 6. Mobile-Specific Patterns

### Forms on Mobile
- Inputs: full width (`width: 100%`)
- Labels above inputs (never beside)
- Large input padding: `12px 16px` minimum
- Use appropriate input types: `type="email"`, `type="tel"`, `type="number"` (triggers correct keyboard)
- Submit button: full width at bottom, sticky if form scrolls

### Modals on Mobile
- Full screen on mobile (not floating center dialog)
- Close button in top corner (easily reachable)
- Content scrollable within modal
```css
@media (max-width: 767px) {
  .modal {
    width: 100vw;
    height: 100vh;
    border-radius: 0;
    max-height: none;
  }
}
```

### Navigation on Mobile
- Breadcrumbs: truncate middle items with `...`
- Back button: always visible, top-left
- Bottom action bars for primary CTAs (easily thumb-reachable)

### Content Viewing on Mobile
- Videos: full width, 16:9 aspect ratio maintained
- Documents: full width with `padding: 16px`
- Sidebars: collapse to top/bottom panels or accordion

---

## 7. No Hover-Only Features

Hover states don't exist on touch devices. Every hover interaction must have a tap equivalent:

| Desktop (Hover) | Mobile (Tap) |
|----------------|--------------|
| Row hover highlight | Row tap to select/expand |
| Tooltip on hover | Tap to show tooltip (or use visible labels) |
| Dropdown on hover | Dropdown on tap |
| Preview on hover | Preview as inline expand |

### Rule: If removing all `:hover` styles breaks a feature, the feature is broken.

---

## 8. Testing Checklist

### For Every Screen
- [ ] Renders correctly at 375px (iPhone SE — smallest common phone)
- [ ] Renders correctly at 414px (iPhone 14 / standard phone)
- [ ] Renders correctly at 768px (iPad / tablet portrait)
- [ ] No horizontal scrollbar (unless intentional for tables)
- [ ] All text readable without zooming
- [ ] All touch targets ≥ 44×44px
- [ ] No hover-only interactions
- [ ] Forms usable with on-screen keyboard visible
- [ ] Modals don't overflow screen
- [ ] Drawer/sidebar opens and closes correctly

### Browser DevTools Mobile Simulation
```
1. Open DevTools (F12)
2. Toggle Device Toolbar (Ctrl+Shift+M)
3. Select iPhone SE (375px)
4. Test all interactions
5. Switch to iPad (768px)
6. Test all interactions
7. Rotate to landscape — verify layout adjusts
```

### Real Device Testing (Before Major Releases)
- Test on actual iPhone (Safari) — rendering differs from Chrome emulation
- Test on actual Android (Chrome) — touch behavior differs
- Test with slow 3G throttling — verify loading states appear
