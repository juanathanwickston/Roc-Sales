# ROC Academy — Deployment & Git Workflow Standards

> Every deployment is controlled, traceable, and reversible. No cowboy deploys.

---

## 1. Branch Strategy

```
main (production)
  └── staging (pre-production testing)
        └── feature branches (individual changes)
```

| Branch | Purpose | Who Deploys | Auto-Deploy |
|--------|---------|-------------|-------------|
| `main` | Production — users see this | Superuser approval only | Yes (Railway) |
| `staging` | Pre-production testing | Any developer | Yes (Railway staging) |
| `feature/*` | Individual features/fixes | Developer | No |

### Branch Rules
- Never push directly to `main` — always merge from `staging` after verification
- Feature branches branch from `staging`, merge back to `staging`
- Name feature branches descriptively: `feature/pathway-editor`, `fix/search-autofill`
- Delete feature branches after merge

---

## 2. Commit Message Format

```
[Type] Short description (50 chars max)

Longer explanation if needed. What changed and why.
Files affected if non-obvious.
```

### Types
| Type | Use |
|------|-----|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `refactor:` | Code restructuring without changing behavior |
| `style:` | CSS/visual changes only |
| `schema:` | Database migration |
| `docs:` | Documentation changes |
| `chore:` | Build tools, config, dependencies |

### Examples
```
feat: Add LD Manager role to auth system

Adds ld_manager to ROLE_HIERARCHY in requireRole.js (backend)
and Auth.hasRole() in auth.js (frontend). Migration 004 adds
the CHECK constraint update for users.role.

fix: Actions column ⋯ button spacing

Increased col-actions width from 40px to 64px and added 8px
card padding. Previous fix failed because button was 32px in
24px content area.
```

### Rules
- First line: imperative mood ("Add" not "Added" or "Adds")
- First line: max 50 characters
- Body: explain WHY, not just WHAT
- Reference related changes if multi-commit feature

---

## 3. Deployment Checklist

### Before Deploying to Staging
- [ ] All changes committed with descriptive messages
- [ ] Server starts locally without errors (`npm run dev`)
- [ ] All affected features tested locally
- [ ] No console errors in browser
- [ ] Database migration tested locally (if applicable)

### Before Promoting to Production
- [ ] Feature verified on staging by another person (or thorough self-review)
- [ ] All regression tests pass on staging
- [ ] Database migration confirmed successful on staging
- [ ] No error spikes in staging logs
- [ ] Rollback plan documented (which commit to revert to)

### After Production Deployment
- [ ] Verify app loads at production URL
- [ ] Verify login works
- [ ] Verify critical paths: Dashboard, Admin, Leaderboard
- [ ] Check server logs for errors (first 5 minutes)
- [ ] Hard refresh to bypass cache

---

## 4. Rollback Procedures

### Code Rollback
```bash
# Identify the last good commit
git log --oneline -10

# Revert to it
git revert HEAD          # Undo last commit (safe, creates new commit)
git push origin staging

# Emergency: force reset (destructive)
git reset --hard <commit-hash>
git push origin staging --force
```

### Database Rollback
- Schema changes: write reverse migration SQL before deploying
- Data changes: always backup affected rows before modifying
- **Never** drop columns or tables without confirming no code references them

### Environment Variables
- Changed env vars take effect on next deploy
- Document all env vars in `.env.example`
- Never commit `.env` to git (in `.gitignore`)

---

## 5. Environment Management

| Variable | Purpose | Required |
|----------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | JWT signing key (min 32 chars) | Yes |
| `NODE_ENV` | `production` or `development` | Yes |
| `PORT` | Server port (default 3000) | No |
| `SUPERUSER_USERNAME` | Bootstrap superuser on first deploy | First deploy only |
| `SUPERUSER_PASSWORD` | Bootstrap superuser password | First deploy only |

### Secrets Management
- All secrets in environment variables — never in code
- Rotate `JWT_SECRET` quarterly (invalidates all sessions)
- Use unique passwords per environment (staging ≠ production)
- `.env` in `.gitignore` — always

---

## 6. Dependency Management

### Rules
- Pin exact versions in `package.json` (no `^` or `~`)
- Review changelogs before updating any dependency
- Test the full app after dependency updates
- Keep dependencies minimal — only add what's truly needed

### Current Dependencies (from package.json)
- `express` — HTTP server
- `pg` — PostgreSQL client
- `bcrypt` — Password hashing
- `jsonwebtoken` — JWT auth
- `helmet` — Security headers
- `dotenv` — Environment variables

### Adding New Dependencies
1. Verify the package is actively maintained (last publish < 6 months)
2. Check for known vulnerabilities (`npm audit`)
3. Confirm it doesn't duplicate existing functionality
4. Document why it was added in the commit message
