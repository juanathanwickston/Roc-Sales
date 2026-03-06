# ROC Academy — Accessibility Standards

> Every user deserves equal access. Accessibility isn't a feature — it's a requirement.

---

## 1. WCAG 2.1 AA Compliance (Minimum)

We target **WCAG 2.1 Level AA** — the industry standard for enterprise web applications. This covers four principles:

1. **Perceivable** — Users can perceive the content
2. **Operable** — Users can operate the interface
3. **Understandable** — Users can understand the content
4. **Robust** — Content works with assistive technologies

---

## 2. Keyboard Navigation

### Every Feature Must Work Without a Mouse

| Interaction | Keyboard Equivalent |
|-------------|-------------------|
| Click button/link | `Enter` or `Space` |
| Navigate between elements | `Tab` (forward) / `Shift+Tab` (backward) |
| Close modal | `Escape` |
| Select dropdown option | `Arrow keys` + `Enter` |
| Toggle checkbox | `Space` |
| Navigate tabs | `Arrow keys` within tab group |
| Submit form | `Enter` on last field or submit button |

### Tab Order Rules
- Tab order must follow visual reading order (left-to-right, top-to-bottom)
- Never use `tabindex` > 0 — it breaks natural tab order
- `tabindex="0"` — element is focusable in natural order
- `tabindex="-1"` — element is focusable programmatically only (for focus management)
- Skip links: provide "Skip to main content" link as first focusable element

### Focus Trap in Modals
When a modal is open, Tab must cycle within the modal only:
```javascript
// Focus Management Pattern
function trapFocus(modalElement) {
  const focusable = modalElement.querySelectorAll(
    'button, input, select, textarea, a[href], [tabindex="0"]'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  modalElement.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  first.focus(); // Auto-focus first element when modal opens
}
```

### Focus Restoration
When a modal closes, return focus to the element that opened it:
```javascript
const triggerElement = document.activeElement; // Save before opening
openModal();
// ... modal interaction ...
closeModal();
triggerElement.focus(); // Restore focus
```

---

## 3. Color & Contrast

### Contrast Ratios (WCAG AA)
| Element | Minimum Ratio | Our Implementation |
|---------|--------------|-------------------|
| Normal text (< 18px) | 4.5:1 | `#EDF2FF` on `#0A1628` = ~13:1 ✅ |
| Large text (≥ 18px bold) | 3:1 | Same palette = well above ✅ |
| UI components (buttons, inputs) | 3:1 | `#3B82F6` on `#0A1628` = ~4.5:1 ✅ |
| Muted text | 4.5:1 | `#7B8BA8` on `#0A1628` = ~4.2:1 ⚠️ borderline |

> [!WARNING]
> Our muted text color (`--gray: #7B8BA8`) is borderline at 4.2:1. For any critical information (not just labels), use `--white` or lighten `--gray` to at least `#8B9BC0`.

### Never Convey Information by Color Alone
```javascript
// ❌ Wrong — color is the only indicator
<span style="color:green">Active</span>
<span style="color:red">Inactive</span>

// ✅ Correct — color + text/shape
<span class="status-active">● Active</span>
<span class="status-inactive">○ Inactive</span>
```

Our status indicators already use `●` dot + text — this meets the standard.

---

## 4. ARIA Labels & Semantic HTML

### Use Semantic HTML First
```html
<!-- ✅ Semantic — screen reader understands structure -->
<nav>...</nav>
<main>...</main>
<header>...</header>
<table>...</table>
<button>Save</button>

<!-- ❌ Non-semantic — screen reader sees generic boxes -->
<div class="nav">...</div>
<div class="main">...</div>
<div onclick="save()">Save</div>
```

### ARIA When Semantic HTML Isn't Enough
| Situation | ARIA Solution |
|-----------|--------------|
| Icon-only button | `aria-label="More options"` |
| Loading state | `aria-busy="true"` on container |
| Expandable section | `aria-expanded="true/false"` |
| Current navigation item | `aria-current="page"` |
| Form field error | `aria-invalid="true"` + `aria-describedby="error-msg-id"` |
| Modal dialog | `role="dialog"` + `aria-modal="true"` + `aria-labelledby="title-id"` |
| Live update (toast) | `aria-live="polite"` on toast container |
| Table sort | `aria-sort="ascending"` on sorted column header |

### Required ARIA for Our Components

```html
<!-- Search input -->
<input type="text" aria-label="Search users" placeholder="Search users...">

<!-- Action menu button (⋯) -->
<button aria-label="Actions for John Hamilton" aria-haspopup="true">⋯</button>

<!-- Modal -->
<div role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <h2 id="modal-title">Create User</h2>
  ...
</div>

<!-- Toast container -->
<div id="toastContainer" aria-live="polite" aria-atomic="true"></div>

<!-- Sortable table header -->
<th aria-sort="ascending">
  <button onclick="sort('name')">Name ↑</button>
</th>
```

---

## 5. Forms

### Labels
- Every input must have a visible `<label>` or `aria-label`
- Labels must be programmatically associated: `<label for="inputId">` or wrapping
- Placeholders are NOT labels — they disappear on focus

### Error Announcement
```html
<!-- Link error message to field -->
<label for="username">Username</label>
<input id="username" aria-invalid="true" aria-describedby="username-error">
<div id="username-error" role="alert">Username is required</div>
```

### Required Fields
- Mark required fields with `aria-required="true"`
- Visual indicator: asterisk (*) with `<abbr title="required">*</abbr>`

---

## 6. Images & Media

### Alt Text Rules
| Image Type | Alt Text |
|-----------|----------|
| Informative image | Describe the content: "Pathway progress chart" |
| Decorative icon | `alt=""` (empty alt, not missing alt) |
| Emoji in content | Keep emoji — screen readers announce them |
| Chart/graph | Detailed alt or data table alternative |

### Video Accessibility
- Embedded videos (Vimeo/YouTube): rely on platform's captioning
- Document any videos that need captions in the pathway editor
- Provide transcript option for hearing-impaired users (future consideration)

---

## 7. Accessibility Testing Checklist

### Manual Tests (Every Screen)
- [ ] Tab through entire screen — logical order?
- [ ] Every interactive element focusable and operable with keyboard?
- [ ] Focus visible on every element? (focus ring/outline)
- [ ] Modals trap focus correctly?
- [ ] Escape closes modals/dropdowns?
- [ ] Color contrast passes 4.5:1 for text?
- [ ] No information conveyed by color alone?
- [ ] Every image has alt text (or empty alt for decorative)?
- [ ] Every form field has a label?
- [ ] Error messages associated with fields via `aria-describedby`?

### Screen Reader Quick Test
- Open with Windows Narrator (Win+Ctrl+Enter) or NVDA
- Navigate the page using Tab
- Verify: buttons announce their purpose, tables announce structure, headings create navigable outline

### Automated Tools
- Chrome DevTools Lighthouse → Accessibility audit
- axe DevTools extension → Detailed violation report
- Target: 90+ Lighthouse accessibility score
