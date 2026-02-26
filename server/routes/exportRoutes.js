/**
 * Export Routes — CSV data export for admin/managers.
 * Provides leaderboard and progress data as downloadable CSV files.
 * 
 * Managers export their team's data only.
 * Superusers export all data.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');

/**
 * GET /api/export/leaderboard
 * Export leaderboard data as CSV.
 * Managers: their teams only. Superusers: all.
 */
router.get('/leaderboard', requireAuth, requireRole('manager'), async (req, res) => {
  try {
    let query;
    let params = [];

    if (req.user.role === 'superuser') {
      query = `
        SELECT u.first_name, u.last_name, u.username, u.email, t.name AS team,
               COALESCE(SUM(s.best_score), 0) AS total_score,
               COUNT(DISTINCT s.activity_id) AS activities_completed
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.id
        LEFT JOIN scores s ON s.user_id = u.id
        WHERE u.role = 'rep' AND u.is_active = TRUE
        GROUP BY u.id, u.first_name, u.last_name, u.username, u.email, t.name
        ORDER BY total_score DESC`;
    } else {
      // Manager: only their assigned teams
      query = `
        SELECT u.first_name, u.last_name, u.username, u.email, t.name AS team,
               COALESCE(SUM(s.best_score), 0) AS total_score,
               COUNT(DISTINCT s.activity_id) AS activities_completed
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.id
        LEFT JOIN scores s ON s.user_id = u.id
        WHERE u.role = 'rep' AND u.is_active = TRUE
          AND u.team_id IN (SELECT team_id FROM manager_teams WHERE manager_id = $1)
        GROUP BY u.id, u.first_name, u.last_name, u.username, u.email, t.name
        ORDER BY total_score DESC`;
      params = [req.user.id];
    }

    const result = await db.query(query, params);

    // Build CSV
    const headers = ['First Name', 'Last Name', 'Username', 'Email', 'Team', 'Total Score', 'Activities Completed'];
    let csv = headers.join(',') + '\n';
    result.rows.forEach(r => {
      csv += [
        csvEsc(r.first_name), csvEsc(r.last_name), csvEsc(r.username),
        csvEsc(r.email || ''), csvEsc(r.team || 'Unassigned'),
        r.total_score, r.activities_completed
      ].join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="roc_leaderboard_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('[EXPORT] Leaderboard export error:', err.message);
    res.status(500).json({ error: 'Export failed' });
  }
});

/**
 * GET /api/export/progress
 * Export detailed progress data as CSV.
 * Managers: their teams only. Superusers: all.
 */
router.get('/progress', requireAuth, requireRole('manager'), async (req, res) => {
  try {
    let query;
    let params = [];

    if (req.user.role === 'superuser') {
      query = `
        SELECT u.first_name, u.last_name, u.username, t.name AS team,
               p.module_id, p.activity_type, p.status, p.completed_at
        FROM progress p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE u.is_active = TRUE
        ORDER BY u.last_name, u.first_name, p.module_id, p.activity_type`;
    } else {
      query = `
        SELECT u.first_name, u.last_name, u.username, t.name AS team,
               p.module_id, p.activity_type, p.status, p.completed_at
        FROM progress p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE u.is_active = TRUE
          AND u.team_id IN (SELECT team_id FROM manager_teams WHERE manager_id = $1)
        ORDER BY u.last_name, u.first_name, p.module_id, p.activity_type`;
      params = [req.user.id];
    }

    const result = await db.query(query, params);

    const headers = ['First Name', 'Last Name', 'Username', 'Team', 'Module', 'Activity', 'Status', 'Completed At'];
    let csv = headers.join(',') + '\n';
    result.rows.forEach(r => {
      csv += [
        csvEsc(r.first_name), csvEsc(r.last_name), csvEsc(r.username),
        csvEsc(r.team || 'Unassigned'), csvEsc(r.module_id),
        csvEsc(r.activity_type), csvEsc(r.status),
        r.completed_at ? new Date(r.completed_at).toISOString() : ''
      ].join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="roc_progress_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('[EXPORT] Progress export error:', err.message);
    res.status(500).json({ error: 'Export failed' });
  }
});

/** Escape CSV field — wraps in quotes if contains comma, quote, or newline */
function csvEsc(val) {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

module.exports = router;
