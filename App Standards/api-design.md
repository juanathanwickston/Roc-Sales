# ROC Academy — API Design Standards

> Every endpoint follows the same patterns. No surprises.

---

## 1. URL Conventions

### Pattern: `/api/{resource}/{id?}/{action?}`

```
GET    /api/pathways              → List all pathways
POST   /api/pathways              → Create pathway
GET    /api/pathways/:id          → Get single pathway
PUT    /api/pathways/:id          → Update pathway
DELETE /api/pathways/:id          → Delete pathway
POST   /api/pathways/:id/duplicate → Duplicate pathway
GET    /api/pathways/:id/modules  → List modules in pathway
```

### Rules
- Resources are **plural nouns**: `/users`, `/pathways`, `/modules`, `/sections`
- Actions are **verbs** appended to the resource: `/duplicate`, `/reset-password`
- IDs are always integers (parsed with `parseInt`, guarded with `isNaN`)
- Nested resources: max 2 levels deep (`/pathways/:id/modules`, never `/pathways/:id/modules/:mid/sections/:sid/content`)
- Query parameters for filtering: `?role=rep&status=active&pathwayId=3`

---

## 2. HTTP Methods

| Method | Use | Idempotent | Body |
|--------|-----|------------|------|
| `GET` | Read data, list resources | Yes | No |
| `POST` | Create resource, trigger action | No | Yes |
| `PUT` | Update existing resource | Yes | Yes (partial OK) |
| `DELETE` | Remove resource | Yes | No |

### Never:
- Use `GET` to modify data
- Use `POST` for updates (use `PUT`)
- Accept `DELETE` with a request body

---

## 3. Response Shapes

### Success — Single Resource
```json
{
  "id": 1,
  "name": "Direct Sales",
  "description": "90-day program for new reps",
  "moduleCount": 10,
  "createdAt": "2026-03-04T14:00:00Z"
}
```

### Success — List
```json
{
  "pathways": [
    { "id": 1, "name": "Direct Sales" },
    { "id": 2, "name": "Channel Partners" }
  ],
  "total": 2
}
```

### Success — Action
```json
{
  "message": "Pathway duplicated",
  "id": 3
}
```

### Error
```json
{
  "error": "Pathway name is required"
}
```

### Rules
- All property names: **camelCase** (never snake_case in JSON)
- Dates: ISO 8601 strings (`2026-03-04T14:00:00Z`)
- Nulls: include the key with `null` value, don't omit the key
- Lists: always return an array (empty `[]` if no results, never `null`)
- IDs: always integers (never strings)

---

## 4. Status Codes

| Code | When | Example |
|------|------|---------|
| `200` | Success (GET, PUT) | User updated, list returned |
| `201` | Created (POST) | User created, module added |
| `400` | Client sent invalid data | Missing required field, invalid email format |
| `401` | Not authenticated | Missing/expired token |
| `403` | Authenticated but not authorized | Rep trying to access admin endpoint |
| `404` | Resource not found | User ID doesn't exist |
| `409` | Conflict | Username already taken |
| `429` | Rate limited | Too many login attempts |
| `500` | Server error | Database connection failed |

### Never:
- Return `200` with an error message in the body
- Return `500` for validation errors (use `400`)
- Return `404` for authorization failures (use `403`)

---

## 5. Request Validation Pattern

Every endpoint validates in this order:

```javascript
router.post('/pathways', requireAuth, requireRole('ld_manager'), async (req, res) => {
  // 1. Extract and validate input
  const { name, description } = req.body;
  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Pathway name is required' });
  }
  if (name.trim().length > 100) {
    return res.status(400).json({ error: 'Pathway name must be 100 characters or less' });
  }

  // 2. Check business rules (uniqueness, limits)
  const existing = await db.query('SELECT id FROM learning_pathways WHERE name = $1', [name.trim()]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'A pathway with this name already exists' });
  }

  // 3. Execute operation
  try {
    const result = await db.query(
      'INSERT INTO learning_pathways (name, description) VALUES ($1, $2) RETURNING id',
      [name.trim(), description?.trim() || null]
    );
    // 4. Audit log
    await logAudit(req.user.id, 'pathway_created', result.rows[0].id, { name: name.trim() });
    // 5. Return success
    res.status(201).json({ id: result.rows[0].id, message: 'Pathway created' });
  } catch (err) {
    console.error('[PATHWAY] Create error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

---

## 6. Pagination (Future-Proofing)

Once lists exceed 50 items, implement cursor-based pagination:

```
GET /api/pathways?limit=20&offset=0
```

Response:
```json
{
  "pathways": [...],
  "total": 47,
  "limit": 20,
  "offset": 0,
  "hasMore": true
}
```

### Rules
- Default `limit`: 50
- Max `limit`: 100
- Always return `total` count
- Always return `hasMore` boolean
- Frontend must handle pagination controls

---

## 7. Field Length Limits

| Field | Max Length | Validated At |
|-------|-----------|-------------|
| `username` | 50 chars | DB constraint + API |
| `first_name` | 100 chars | DB constraint + API |
| `last_name` | 100 chars | DB constraint + API |
| `email` | 255 chars | DB constraint + API |
| `pathway.name` | 100 chars | DB constraint + API |
| `module.title` | 200 chars | DB constraint + API |
| `section.heading` | 200 chars | DB constraint + API |
| `doc.body` (rich text) | 50,000 chars | API only |
| `password` | 8–128 chars | API only |

### Always validate at BOTH layers:
- Database `VARCHAR(N)` constraint (safety net)
- API validation with clear error message (user experience)

---

## 8. API Versioning
Not needed now. If needed later, prefix: `/api/v2/pathways`. Never break existing v1 endpoints without migration period.
