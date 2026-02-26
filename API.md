# ROC Academy API Reference

Base URL: `/api`

All endpoints except `/api/auth/login` and `/api/health` require a Bearer token in the Authorization header.

---

## Auth

### POST /api/auth/login
Rate limited: 5 attempts per 15 minutes.
```
Body: { "username": "string", "password": "string" }
Response: { "token": "jwt", "user": { "id", "username", "firstName", "lastName", "nickname", "role", "mustChangePassword" } }
```

### GET /api/auth/me
Returns current user profile.
```
Response: { "id", "username", "firstName", "lastName", "nickname", "email", "role", "teamId", "teamName", "pathwayId", "mustChangePassword" }
```

### POST /api/auth/change-password
```
Body: { "currentPassword": "string", "newPassword": "string" }
Response: { "message": "Password updated successfully" }
```

---

## Progress

### GET /api/progress
Returns all progress for the authenticated user in `D.modules` compatible format.
```
Response: { "modules": { "m1": { "video": true, "doc": false, "game": false, "apply": false, "applyItems": { "0": true } } } }
```

### PUT /api/progress
```
Body: { "moduleId": "m1", "activityType": "video|doc|game|apply", "status": "done|in_progress|not_started" }
Response: { "message": "Progress saved" }
```

### PUT /api/progress/checklist
```
Body: { "moduleId": "m1", "itemIndex": 0, "checked": true }
Response: { "message": "Checklist updated" }
```

---

## Scores

### POST /api/scores
```
Body: { "activityType": "quiz|game", "activityId": "quiz_m1", "score": 85, "maxScore": 100, "details": {} }
Response: { "message": "Score recorded" }
```

### GET /api/scores/leaderboard?period=week|month|all
```
Response: { "leaderboard": [{ "id", "firstName", "lastName", "nickname", "displayName", "powerScore", "rank" }], "myRank": 3, "totalReps": 12 }
```

---

## Profile

### PUT /api/profile/nickname
```
Body: { "nickname": "string" }
Response: { "message": "Nickname updated" }
```

---

## Admin (Manager+)

### GET /api/admin/users?all=1
### POST /api/admin/users
```
Body: { "username", "firstName", "lastName", "email", "password", "role": "rep|manager", "teamId" }
```

### PUT /api/admin/users/:id
```
Body: { "firstName", "lastName", "email", "nickname", "teamId", "isActive" }
```

### POST /api/admin/users/:id/reset-password
```
Body: { "newPassword": "string" }
```

### GET /api/admin/users/:id/progress
### GET /api/admin/teams
### POST /api/admin/teams
```
Body: { "name": "string" }
```

### PUT /api/admin/teams/:id
```
Body: { "name": "string" }
```

### PUT /api/admin/manager-teams (Superuser only)
```
Body: { "managerId": 1, "teamIds": [1, 2] }
```

---

## CMS (Manager+)

### GET /api/cms/content
Returns all CMS content (modules, videos, docs, apply items, quizzes) for the game engine.

### GET /api/cms/content/:moduleId
Returns full module data including videos, docs, and apply items.

### GET /api/cms/modules/admin
Returns all modules with related content for the admin CMS editor.

### PUT /api/cms/modules/:id
```
Body: { "title", "description", "icon", "phase", "game_id", "game_title", "game_desc", "sort_order" }
```

### POST /api/cms/modules
```
Body: { "id", "title", "description", "icon", "phase", "game_id", "game_title", "game_desc" }
```

### POST /api/cms/videos
```
Body: { "module_id", "title", "url", "description", "icon" }
```

### PUT /api/cms/videos/:id
### DELETE /api/cms/videos/:id
Min-1 guard: cannot delete last video in a module.

### POST /api/cms/doc-sections
```
Body: { "module_id", "heading", "body" }
```

### PUT /api/cms/doc-sections/:id
### DELETE /api/cms/doc-sections/:id
Min-1 guard: cannot delete last doc section in a module.

### POST /api/cms/apply-items
```
Body: { "module_id", "text", "icon", "url" }
```

### PUT /api/cms/apply-items/:id
### DELETE /api/cms/apply-items/:id
Min-1 guard: cannot delete last apply item in a module.

### GET /api/cms/quizzes/admin
### POST /api/cms/quizzes
```
Body: { "pool", "question", "options": ["A","B","C","D"], "correct_index": 0, "explanation" }
```

### PUT /api/cms/quizzes/:id
### DELETE /api/cms/quizzes/:id
Min-4 guard: quiz pool must have at least 4 questions.

---

## Export (Manager+)

### GET /api/export/leaderboard
Downloads leaderboard data as CSV. Managers see their teams only; superusers see all.
```
Response: CSV file (text/csv) with headers: First Name, Last Name, Username, Email, Team, Total Score, Activities Completed
```

### GET /api/export/progress
Downloads detailed progress data as CSV. Same team-scoping as leaderboard.
```
Response: CSV file (text/csv) with headers: First Name, Last Name, Username, Team, Module, Activity, Status, Completed At
```

---

## Health

### GET /api/health
```
Response: { "status": "ok", "uptime": 12345, "db": { "status": "connected", "time": "..." }, "version": "1.0.0" }
```

---

## Error Responses

All errors return `{ "error": "message" }` with appropriate HTTP status codes:
- 400: Bad request (validation)
- 401: Unauthorized (no token, expired, invalidated)
- 403: Forbidden (insufficient role)
- 404: Not found
- 409: Conflict (duplicate username)
- 429: Too many requests (rate limited)
- 500: Internal server error
