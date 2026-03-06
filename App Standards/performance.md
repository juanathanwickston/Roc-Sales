# ROC Academy — Performance Standards

> Fast apps feel professional. Slow apps feel broken. Every millisecond matters.

---

## 1. Performance Budgets

| Metric | Target | Red Flag |
|--------|--------|----------|
| Initial page load | < 2 seconds | > 4 seconds |
| API response (simple query) | < 100ms | > 500ms |
| API response (complex/join) | < 300ms | > 1 second |
| DOM render (screen change) | < 50ms | > 200ms |
| Database query | < 50ms | > 200ms |
| Time to interactive | < 3 seconds | > 5 seconds |

---

## 2. Database Performance

### Query Optimization
- **Always** specify columns: `SELECT id, name, role FROM users` not `SELECT * FROM users`
- **Always** use indexes on `WHERE`, `JOIN`, and `ORDER BY` columns
- **Always** use `LIMIT` on list queries (default 50, max 100)
- **Never** run queries in a loop — batch with `WHERE id IN (...)`

### N+1 Query Prevention
```javascript
// ❌ N+1 — one query per module
const modules = await db.query('SELECT * FROM cms_modules');
for (const mod of modules.rows) {
  const videos = await db.query('SELECT * FROM cms_videos WHERE module_id = $1', [mod.id]);
  mod.videos = videos.rows;
}

// ✅ Batch — two queries total
const modules = await db.query('SELECT * FROM cms_modules');
const videos = await db.query('SELECT * FROM cms_videos WHERE module_id = ANY($1)', [moduleIds]);
const videosByModule = groupBy(videos.rows, 'module_id');
modules.rows.forEach(m => m.videos = videosByModule[m.id] || []);
```

### Slow Query Monitoring
- `db.js` logs queries exceeding 1000ms automatically
- Investigate any logged slow query within 24 hours
- Use `EXPLAIN ANALYZE` to diagnose

### Connection Pool
- Max 20 connections (configured in `db.js`)
- Idle timeout: 30 seconds
- Connection timeout: 5 seconds
- Always release clients in `finally` block after transactions

---

## 3. Frontend Performance

### DOM Rendering
- Use `innerHTML` for bulk updates (faster than multiple `appendChild`)
- Build HTML strings in memory, assign once — never update DOM in a loop
- Use `requestAnimationFrame` for animations
- Debounce search/filter inputs (300ms delay before API call)

### Debounce Pattern
```javascript
let searchTimeout;
function onSearchInput(query) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    Admin._searchQuery = query;
    Admin.filterAndRenderTable();
  }, 300);
}
```

### Asset Loading
- Fonts: `font-display: swap` — text visible immediately, font loads async
- CSS: inline in `<style>` blocks (current pattern — zero extra requests)
- JS: load order matters — `api.js` first, then `auth.js`, then feature scripts
- Images: lazy-load anything below the fold

### Memory Management
- Clean up event listeners when navigating away from screens
- Clear timers/intervals in `cleanupGameState()`
- Don't cache unlimited data — set reasonable limits on client-side arrays

---

## 4. API Performance

### Response Size
- Return only the fields the client needs — no full row dumps
- Paginate lists exceeding 50 items
- Compress responses with gzip (Express handles via `compression` middleware if needed)

### Caching Strategy
| Data Type | Cache Duration | Where |
|-----------|---------------|-------|
| Module content (CMS) | 5 minutes | Client-side variable |
| User profile | Session duration | `Auth.user` object |
| Leaderboard | 60 seconds | Don't cache — always fresh |
| Progress | Don't cache | Always fetch latest |
| Static assets (fonts, images) | 1 year | HTTP cache headers |
| HTML/JS/CSS | 1 hour | HTTP cache headers |

### Rate Limiting (Already Implemented)
- Login: strict limiting to prevent brute force
- CMS writes: moderate limiting to prevent spam
- Score submissions: moderate limiting
- Read endpoints: no limiting (except health check abuse)

---

## 5. Scalability Considerations

### Current Scale
- ~10-50 users
- ~10-30 modules
- ~100-500 progress records
- Single PostgreSQL instance (Railway)

### When to Optimize (Triggers)
| Trigger | Action |
|---------|--------|
| Users > 200 | Add pagination to all list endpoints |
| Modules > 100 | Add search/filter to module lists |
| Progress records > 10,000 | Add materialized view for Power Score |
| Leaderboard query > 500ms | Pre-calculate Power Score in nightly job |
| Concurrent users > 50 | Increase connection pool, add connection queuing |

### What NOT to Optimize Now
- Don't add Redis caching until you need it
- Don't add a CDN until static assets are slow
- Don't add WebSocket until real-time is required
- Don't add background job queues until processing is slow
- **Premature optimization is the root of all evil** — measure first, then optimize

---

## 6. Performance Testing

### Before and After Every Change
```javascript
// Quick server-side timing
const start = Date.now();
// ... operation ...
console.log(`[PERF] Operation took ${Date.now() - start}ms`);
```

### Browser DevTools Checks
- Network tab: no requests > 1 second
- Console: no warnings about layout thrashing
- Performance tab: no long tasks > 50ms during interactions
- Memory tab: no growing memory on repeated actions (memory leak)

### Load Testing (When Scale Matters)
```bash
# Simple: 100 requests to leaderboard
for i in {1..100}; do
  curl -s -o /dev/null -w "%{time_total}\n" \
    http://localhost:3000/api/scores/leaderboard \
    -H "Authorization: Bearer $TOKEN"
done | awk '{sum+=$1} END {print "Avg:", sum/NR, "seconds"}'
```
