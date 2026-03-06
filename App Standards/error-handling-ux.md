# ROC Academy — Error Handling & UX Feedback Standards

> Every user-facing state must be intentionally designed. No blank screens, no mystery errors, no silent failures.

---

## 1. Error States

### API Error Display
Every API call must handle failure gracefully. Never show raw error messages to users.

```javascript
// ✅ Correct pattern
try {
  const data = await API.getUsers();
  renderUsers(data);
} catch (err) {
  container.innerHTML = `
    <div class="error-state">
      <div class="error-icon">⚠️</div>
      <div class="error-title">Unable to load users</div>
      <div class="error-detail">Please check your connection and try again.</div>
      <button onclick="retryAction()">Retry</button>
    </div>`;
}

// ❌ Wrong — raw error exposed
catch (err) {
  container.innerHTML = err.message; // Could expose "relation users does not exist"
}
```

### Error Message Rules
| Scenario | User Sees | Never Show |
|----------|-----------|------------|
| Network failure | "Unable to reach server. Check your connection." | `TypeError: Failed to fetch` |
| 401 Unauthorized | Redirect to login silently | "Invalid or expired token" |
| 403 Forbidden | "You don't have permission for this action." | "Insufficient permissions for role: rep" |
| 404 Not Found | "This content is no longer available." | "User not found" with ID |
| 500 Server Error | "Something went wrong. Please try again." | Stack traces, SQL errors |
| Validation Error | Specific field feedback: "Username is required" | Generic "Bad request" |

### Form Validation Feedback
- Validate on blur (when user leaves field), not on every keystroke
- Show error text below the invalid field in red (`--red: #FF4466`)
- Clear the error when the user starts correcting the field
- Submit button disabled until required fields are filled
- After failed submit: scroll to first error, focus the field

```
// Visual pattern
┌──────────────────────────────────┐
│ Username                         │  ← normal border
└──────────────────────────────────┘

┌──────────────────────────────────┐
│                                  │  ← red border (--red)
└──────────────────────────────────┘
  Username is required               ← red text, --fs-xs
```

---

## 2. Loading States

### Every async action needs a loading indicator
No screen should ever appear blank while data loads.

| Context | Loading Pattern |
|---------|----------------|
| Full page load | Centered spinner + "Loading..." text |
| Table data | Skeleton rows (3-5 placeholder rows with shimmer) |
| Button action (save, delete) | Button text → "Saving..." + disabled state |
| Inline update | Subtle spinner next to the element |
| Modal content | Modal shell visible, content area shows spinner |

### Button Loading Pattern
```javascript
// ✅ Correct — disable and show loading text
btn.disabled = true;
btn.textContent = 'Saving...';
try {
  await API.updateUser(id, data);
  toast('User updated');
} catch (err) {
  toast(err.message, 'error');
} finally {
  btn.disabled = false;
  btn.textContent = 'Save';
}
```

### Skeleton Loading CSS
```css
.skeleton {
  background: linear-gradient(90deg, var(--n3) 25%, var(--n4) 50%, var(--n3) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--rs);
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

## 3. Empty States

### Every list/table must handle zero items
Empty screens destroy user confidence. Always show an intentional empty state.

| Screen | Empty Message | Call to Action |
|--------|--------------|----------------|
| Users table (no results) | "No users match your filters." | "Clear filters" button |
| Users table (no users exist) | "No users yet." | "+ Create User" button |
| Pathway list (no pathways) | "No learning pathways created yet." | "Create your first pathway" |
| Module list (empty pathway) | "This pathway has no modules yet." | "Add a module" |
| Leaderboard (no scores) | "No scores recorded yet. Complete modules to start." | Link to dashboard |
| Search results (no match) | "No results for '{query}'." | "Clear search" link |
| Progress (nothing started) | "Start your first module to begin tracking progress." | Link to pathway |

### Empty State Pattern
```html
<div class="empty-state">
  <div class="empty-icon">📚</div>
  <div class="empty-title">No modules yet</div>
  <div class="empty-desc">Add your first module to start building this pathway.</div>
  <button class="admin-action-btn" onclick="addModule()">+ Add Module</button>
</div>
```

---

## 4. Confirmation Dialogs

### Destructive actions ALWAYS require confirmation
Never delete, deactivate, or reset without asking first.

| Action | Confirmation Text | Confirm Button |
|--------|-------------------|---------------|
| Delete user | "Permanently delete {name}? This cannot be undone." | "Delete" (red) |
| Deactivate user | "Deactivate {name}? They will lose access immediately." | "Deactivate" |
| Delete pathway | "Delete '{pathway}'? All assigned users will be unassigned." | "Delete Pathway" (red) |
| Delete module | "Remove '{module}' from this pathway?" | "Remove" (red) |
| Reset all scores | "Reset ALL scores for ALL users? This cannot be undone." | "Reset Everything" (red) |
| Reset password | "Reset password for {name}? They will be forced to change on next login." | "Reset Password" |

### Confirmation Pattern
- Use a modal overlay, not `window.confirm()`
- Two buttons: Cancel (secondary, left) and Confirm (primary/danger, right)
- Confirm button color matches severity: blue for safe, red for destructive
- Auto-focus the Cancel button (prevent accidental destructive actions)
- Close on Escape key and backdrop click

---

## 5. Toast Notifications

### Feedback for every completed action
Users must know their action succeeded. Silent success is bad UX.

| Action | Toast Message | Type |
|--------|--------------|------|
| User created | "User created successfully" | success |
| User updated | "Changes saved" | success |
| Password reset | "Password reset. User must change on next login." | success |
| Pathway duplicated | "Pathway duplicated" | success |
| Module reordered | "Order saved" | success |
| API error | "Unable to save. Please try again." | error |
| Network error | "Connection lost. Check your network." | error |
| Validation error | "Please fill in all required fields." | error |

### Toast Behavior
- Auto-dismiss after 3 seconds (success), 5 seconds (error)
- Stack vertically if multiple (max 3 visible)
- Slide in from right, fade out
- Never block content or cover important UI
- Position: fixed top-right, z-index highest below modal

---

## 6. Optimistic vs. Pessimistic Updates

| Action | Strategy | Reason |
|--------|----------|--------|
| Toggle checkbox | **Optimistic** — update UI immediately, revert on failure | Low-risk, instant feel |
| Reorder items | **Optimistic** — move visually, save in background | Drag UX requires instant |
| Create/delete items | **Pessimistic** — wait for server, then update UI | High-risk, need confirmation |
| Save form edits | **Pessimistic** — show "Saving...", update on success | Data integrity |
| Mark content complete | **Pessimistic** — wait for server to confirm | Progress tracking must be accurate |

### Optimistic Revert Pattern
```javascript
// Move item visually first
moveItemInDOM(fromIndex, toIndex);

try {
  await API.reorderContent('modules', newOrder);
} catch (err) {
  // Revert visual change
  moveItemInDOM(toIndex, fromIndex);
  toast('Unable to save order', 'error');
}
```

---

## 7. Edge Cases Checklist

Before shipping any screen, verify:

- [ ] What happens with 0 items?
- [ ] What happens with 1 item?
- [ ] What happens with 100+ items? (scroll, pagination, performance)
- [ ] What happens if the API is slow (3+ seconds)?
- [ ] What happens if the API is down?
- [ ] What happens if the user double-clicks a button?
- [ ] What happens if the user navigates away mid-save?
- [ ] What happens if two users edit the same item simultaneously?
- [ ] What happens if the session expires mid-action?
- [ ] What happens on mobile width?
