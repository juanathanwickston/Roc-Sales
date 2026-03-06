# ROC Academy — Security, Privacy & Code Quality Standards

> Enforced on every commit. No exceptions.

---

## 1. Input Validation & Sanitization

### Server-Side (Non-Negotiable)
- **Every** user input is validated before touching the database
- String inputs: trimmed, length-limited, type-checked
- Numeric inputs: `parseInt`/`parseFloat` with `isNaN` guard
- Enum inputs: validated against explicit allowlists (e.g. `VALID_ROLES`, `VALID_ACTIVITY_TYPES`)
- IDs: always parsed as integers, rejected if `NaN`
- No raw SQL interpolation — parameterized queries only (`$1, $2, $3`)

### Client-Side
- All user-sourced strings rendered via `esc()` (HTML entity escaping) before `innerHTML`
- CMS rich text rendered via `sanitizeHTML()` — allowlist of safe tags only
- No `eval()`, no `Function()` construction, no `innerHTML` with unescaped content
- Form inputs validated before API call (fail fast, reduce server load)

### SQL Injection Prevention
```javascript
// ✅ Always parameterized
await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// ❌ Never string interpolation
await db.query(`SELECT * FROM users WHERE id = ${userId}`);
```

---

## 2. Authentication & Authorization

### Token Security
- JWT signed with `JWT_SECRET` (env var, never hardcoded)
- 8-hour token expiry with sliding window renewal
- Single-session enforcement: new login invalidates all previous sessions
- Token stored in `localStorage` — cleared on logout and 401 responses

### Role Enforcement — Defense in Depth
Every protected action must be checked at **both** layers:

| Layer | How | Why |
|-------|-----|-----|
| **Backend middleware** | `requireRole('ld_manager')` | Server is the authority |
| **Frontend UI** | `Auth.hasRole('ld_manager')` | UX — hide buttons user can't use |

> [!CAUTION]
> Frontend role checks are cosmetic only. They hide UI elements but do NOT enforce security. The backend middleware is the only enforcement that matters. Never rely on frontend-only checks.

### Role Hierarchy Maintenance
When adding new roles:
1. Update `ROLE_HIERARCHY` in `requireRole.js` (backend)
2. Update `hierarchy` in `Auth.hasRole()` (frontend `auth.js`)
3. Update `CHECK` constraint on `users.role` column (migration)
4. Grep entire codebase for hardcoded role strings
5. Update `roles-access.md` in App Standards

### Password Security
- Bcrypt with 12 salt rounds (industry standard)
- Minimum 8 chars, requires lowercase + uppercase + number
- Forced password change on first login (`must_change_password` flag)
- Password changes invalidate existing sessions

---

## 3. Access Control Patterns

### Scoped Data Access
Managers must only see data for their assigned pathways. Every query that returns user data must enforce scoping:

```javascript
// ✅ Correct — scoped to manager's pathways
if (req.user.role === 'manager') {
  query += ' AND u.id IN (SELECT user_id FROM user_pathways WHERE pathway_id IN (SELECT pathway_id FROM user_pathways WHERE user_id = $1))';
}

// ❌ Wrong — trusting client-provided filter
if (req.query.pathwayId) {
  query += ` AND pathway_id = ${req.query.pathwayId}`;
}
```

### Destructive Action Guards
- User self-deletion: blocked at API level
- Last-admin deletion: blocked at API level
- Superuser role changes: superuser-only
- Pathway deletion: superuser-only
- Score/progress reset: superuser-only

### Audit Trail
Every admin action logged to `audit_log` table:
- `actor_id` — who performed the action
- `action` — what they did (e.g. `user_created`, `pathway_deleted`)
- `target_id` — what was affected
- `details` — JSONB with change specifics
- `created_at` — timestamp

---

## 4. Data Privacy

### Personal Data Handling
- Usernames, names, emails stored in PostgreSQL only — never in client-side storage except session cache
- No PII in URLs or query parameters
- No PII in console.log statements in production
- Error messages never expose internal data (table names, column names, stack traces)

### Session Data
- Auth token in `localStorage` — contains userId, role, sessionHash (no PII)
- OpenAI API key in `localStorage` — user-provided, user-controlled
- Chat state in `localStorage` — cleared on logout

### Data Retention
- Audit logs: retained indefinitely (compliance)
- Sessions: auto-expire after 8 hours
- Progress/scores: retained as long as user account exists
- Deactivated users: soft-delete (`is_active = FALSE`), data preserved

---

## 5. Responsible AI Use

### Chatbot Guardrails
- AI responses are advisory only — never execute database operations
- No PII fed to AI models beyond what the user explicitly provides in their message
- API keys are user-managed and stored client-side only
- AI cost tracking implemented — every API call logged with token count and cost
- Rate limiting on AI endpoints to prevent abuse

### Content Generation
- AI-generated content must be reviewed by LD Manager before publishing
- No automatic content creation or modification without human approval
- AI suggestions clearly labeled as AI-generated

### Data Boundaries
- AI models do not receive: passwords, auth tokens, session data, other users' data
- AI context limited to: current user's pathway content, public module data
- No cross-user data leakage through AI prompts

---

## 6. Code Cleanliness Standards

### File Organization
- One concern per file: routes, middleware, utilities separated
- Server files: `camelCase.js`
- Frontend files: `camelCase.js`
- CSS: in `index.html` `<style>` blocks (existing pattern)
- Migrations: `NNN_description.sql` (numbered, sequential)

### Naming Conventions
| Element | Convention | Example |
|---------|-----------|---------|
| Variables | camelCase | `powerScore`, `userId` |
| Functions | camelCase | `renderHome()`, `filterAndRenderTable()` |
| Constants | UPPER_SNAKE | `VALID_ROLES`, `MAX_SCORE_LIMIT` |
| SQL columns | snake_case | `first_name`, `team_id` |
| API JSON | camelCase | `{ firstName, teamId }` |
| CSS classes | kebab-case | `.admin-table`, `.col-name` |
| HTML IDs | camelCase | `adminSearch`, `toastContainer` |

### Error Handling
```javascript
// ✅ Every route wrapped in try/catch with generic client error
try {
  // logic
} catch (err) {
  console.error('[MODULE] Action description:', err.message);
  res.status(500).json({ error: 'Internal server error' });
}

// ❌ Never expose stack traces or internal errors
res.status(500).json({ error: err.message, stack: err.stack });
```

### Dead Code
- No commented-out code in production
- No unused imports or variables
- No orphaned CSS rules (if HTML element removed, remove its CSS)
- No console.log debugging left in committed code (use console.error for actual errors)

### Comments
- Functions: JSDoc comment with description
- Complex logic: inline comment explaining WHY, not WHAT
- Sections: `// ─── SECTION NAME ───` dividers for visual grouping
- No obvious comments: `// increment counter` on `counter++`

---

## 7. Pre-Commit Checklist

Before every push:

- [ ] All inputs validated and sanitized (server-side)
- [ ] All user-facing strings escaped with `esc()`
- [ ] All SQL queries parameterized (no string interpolation)
- [ ] Role checks present at backend AND frontend
- [ ] No PII in console.log, URLs, or error messages
- [ ] No hardcoded secrets, keys, or passwords
- [ ] Error handling: try/catch with generic client messages
- [ ] No dead code, no debugging console.logs
- [ ] Audit logging for admin actions
- [ ] AI interactions bounded — no PII leakage
