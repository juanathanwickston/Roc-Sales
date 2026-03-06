# ROC Academy — Roles & Access Control

> Defines what each role can see and do.

## Role Hierarchy

```
Rep → Manager → LD Manager → Superuser
```

## Access Matrix

| Capability | Rep | Manager | LD Manager | Superuser |
|-----------|-----|---------|------------|-----------|
| **View assigned pathways** | ✅ | ✅ | ✅ | ✅ |
| **Consume content** | ✅ | ✅ | ✅ | ✅ |
| **View leaderboard** | ✅ | ✅ | ✅ | ✅ |
| **Edit own profile** | ✅ | ✅ | ✅ | ✅ |
| **Admin Panel access** | — | ✅ | ✅ | ✅ |
| **Create/edit/delete reps** | — | Scoped¹ | ✅ All | ✅ All |
| **Assign reps to pathways** | — | Scoped¹ | ✅ All | ✅ All |
| **Monitor rep progress** | — | Scoped¹ | ✅ All | ✅ All |
| **View all pathways** | — | — | ✅ | ✅ |
| **Create/edit/delete pathways** | — | — | ✅ | ✅ |
| **Create/edit/delete modules** | — | — | ✅ | ✅ |
| **Create/edit/delete sections** | — | — | ✅ | ✅ |
| **Manage game library** | — | — | ✅ | ✅ |
| **Reset all scores** | — | — | — | ✅ |
| **Delete users permanently** | — | — | — | ✅ |
| **System-level destructive actions** | — | — | — | ✅ |

¹ **Scoped** = Only for reps and pathways the Manager is assigned to.

## Admin Panel Tabs by Role

| Tab | Manager | LD Manager | Superuser |
|-----|---------|------------|-----------|
| **Users** | Their pathway reps only | All users | All users |
| **Learning Pathways** | — | Full CRUD | Full CRUD + delete |
| **Content (Pathway Editor)** | — | Full CRUD | Full CRUD |
| **Game Library** | — | Full CRUD | Full CRUD |
| **Monitoring** | Their reps | All reps | All reps |

## Manager Pathway Assignment

- Managers are assigned to pathways by **LD Manager** or **Superuser**
- A Manager can be assigned to **one or more** pathways
- Their admin view is filtered to show only reps within their assigned pathways
