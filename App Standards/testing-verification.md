# ROC Academy — Testing & Verification Standards

> Nothing ships without proof it works. Testing is not optional.

---

## 1. Verification Tiers

Every change goes through three tiers, matched to risk level:

| Change Risk | Tier 1: Code Review | Tier 2: Manual Test | Tier 3: Regression |
|------------|--------------------|--------------------|-------------------|
| CSS-only | Trace cascade, verify math | Visual check in browser | Confirm no other screens broken |
| Single JS file | Read all affected functions | Test the feature in browser | Test adjacent features |
| API endpoint | Trace DB query, roles, validation | cURL/browser test | Test related endpoints |
| Database migration | Review SQL, check rollback | Run on staging | Verify all queries still work |
| Multi-file / architecture | Full codebase audit per protocol | End-to-end walkthrough | Full regression suite |

---

## 2. Pre-Push Verification Checklist

### For Every Change
- [ ] Code compiles / no syntax errors (server starts without crash)
- [ ] Changed feature works as expected
- [ ] No console errors in browser dev tools
- [ ] No server-side error logs during operation

### For Frontend Changes
- [ ] Renders correctly at admin panel width (1000px)
- [ ] Renders correctly at mobile width (375px)
- [ ] All interactive elements clickable and responsive
- [ ] Loading states display during async operations
- [ ] Error states display when API fails
- [ ] Empty states display when no data exists

### For API Changes
- [ ] Endpoint returns correct status code
- [ ] Endpoint validates all required fields (test with missing data)
- [ ] Endpoint rejects unauthorized access (test with wrong role)
- [ ] Endpoint handles invalid IDs gracefully (test with `NaN`, negative, 999999)
- [ ] Endpoint logs to audit trail for admin actions

### For Database Changes
- [ ] Migration applies cleanly on fresh database
- [ ] Migration applies cleanly on existing database with data
- [ ] All existing queries still work after schema change
- [ ] Indexes exist for new frequently-queried columns
- [ ] Foreign key cascades behave correctly

---

## 3. Manual Testing Protocol

### Browser Testing Steps
```
1. Clear cache and hard reload (Ctrl+Shift+R)
2. Open DevTools Console — check for errors
3. Open DevTools Network — check for failed requests
4. Test the happy path (everything works as expected)
5. Test the sad path (break it on purpose):
   a. Submit empty forms
   b. Enter invalid data (special characters, very long strings)
   c. Double-click submit buttons
   d. Navigate away mid-operation
   e. Test with different user roles
6. Test edge cases:
   a. Zero items
   b. One item
   c. Many items (create 10+ if possible)
   d. Simultaneous edits (two tabs)
```

### Role-Based Testing
For every feature that has role restrictions, test with:
- [ ] Rep account — should be blocked or see limited view
- [ ] Manager account — should see scoped data
- [ ] LD Manager account — should have full content access
- [ ] Superuser account — should have unrestricted access

### Mobile Testing
- [ ] Test at 375px width (iPhone SE)
- [ ] Test at 768px width (iPad)
- [ ] Test touch interactions (no hover-only features)
- [ ] Test with on-screen keyboard visible (form fields)

---

## 4. API Testing with cURL

### Quick Validation Commands
```bash
# Login and get token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Test1234"}' | jq -r '.token')

# Test authenticated endpoint
curl -s http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer $TOKEN" | jq

# Test validation (missing required field)
curl -s -X POST http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":""}' | jq

# Test authorization (wrong role)
REP_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"john","password":"Test1234"}' | jq -r '.token')

curl -s -X DELETE http://localhost:3000/api/admin/users/1 \
  -H "Authorization: Bearer $REP_TOKEN" | jq
# Should return 403
```

---

## 5. Regression Testing

### After Schema Changes
Run every API endpoint that touches the modified tables:
- [ ] `GET /api/auth/me` — profile still returns correctly
- [ ] `GET /api/admin/users` — user list still works
- [ ] `GET /api/cms/modules` — content tree still loads
- [ ] `GET /api/progress` — progress tracking intact
- [ ] `GET /api/scores/leaderboard` — Power Score calculates correctly

### After Role Changes
- [ ] Login works for every role
- [ ] Admin panel visibility correct for every role
- [ ] Content editing restricted to correct roles
- [ ] Manager scoping still works (only sees their data)

### After Frontend Changes
- [ ] All navigation links work (sidebar, breadcrumbs, back buttons)
- [ ] All screens render without console errors
- [ ] Login → Dashboard → Pathway → Module → Content flow works end-to-end
- [ ] Admin panel all tabs render (Users, Pathways, Content)
- [ ] Leaderboard loads and displays data

---

## 6. Common Bugs to Check For

| Bug Category | Specific Check |
|-------------|----------------|
| **Off-by-one** | Sort orders start at 0 or 1? Array vs. DB index mismatch? |
| **Null handling** | What if `team_id` is NULL? What if `nickname` is NULL? |
| **Empty strings vs NULL** | API receiving `""` vs `null` — both handled? |
| **Race conditions** | Two rapid clicks creating duplicate records? |
| **Stale data** | After edit, does the list refresh? Or show old data? |
| **Case sensitivity** | Username `John` vs `john` — treated the same? |
| **XSS** | Nickname `<script>alert(1)</script>` — properly escaped? |
| **Timezone** | Dates displaying in user's timezone or UTC? |
| **Integer overflow** | Score of 999999999 — handled? |
| **Orphaned records** | Delete pathway — are user assignments cleaned up? |

---

## 7. Verification Evidence

After every significant change, document what was verified:
- Screenshot or browser recording of the working feature
- Console output showing no errors
- API response showing correct data
- Summary written in the commit message or walkthrough

### Template
```markdown
## Verified
- [x] Feature works: [description]
- [x] Edge case: [what was tested]
- [x] Role check: [which roles tested]
- [x] Mobile: [tested at 375px]
- [x] No console errors
- [x] No network failures
```
