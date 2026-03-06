/**
 * Score and leaderboard routes.
 * Submit scores, retrieve composite leaderboard.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');

const MAX_SCORE_LIMIT = 10000;

/**
 * POST /api/scores
 * Body: { activityType, activityId, score, maxScore, details }
 * Records a score for the authenticated user.
 */
router.post('/', requireAuth, async (req, res) => {
  const { activityType, activityId, score, maxScore, details } = req.body;

  if (!activityType || !activityId || score === undefined || !maxScore) {
    return res.status(400).json({ error: 'activityType, activityId, score, and maxScore are required' });
  }

  if (typeof score !== 'number' || typeof maxScore !== 'number') {
    return res.status(400).json({ error: 'score and maxScore must be numbers' });
  }

  if (score < 0 || score > MAX_SCORE_LIMIT || maxScore < 1 || maxScore > MAX_SCORE_LIMIT) {
    return res.status(400).json({ error: 'Score values out of valid range' });
  }

  if (score > maxScore) {
    return res.status(400).json({ error: 'Score cannot exceed maxScore' });
  }

  try {
    await db.query(
      `INSERT INTO scores (user_id, activity_type, activity_id, score, max_score, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, activityType, activityId, score, maxScore, details ? JSON.stringify(details) : null]
    );

    res.json({ message: 'Score recorded' });
  } catch (err) {
    console.error('[SCORES] Submit error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/scores/my
 * Returns the current user's best score per game activity.
 * Used to rebuild the skills readiness index on page load.
 */
router.get('/my', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT activity_id, MAX(score) as best_score, MAX(max_score) as max_score,
              COUNT(*) as attempts, MAX(submitted_at) as last_date
       FROM scores
       WHERE user_id = $1 AND activity_type = 'game'
       GROUP BY activity_id`,
      [req.user.id]
    );
    res.json({ scores: result.rows });
  } catch (err) {
    console.error('[SCORES] My scores error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/leaderboard
 * Query: ?period=week|month|all (default: all)
 * Returns ranked list of active reps by composite Power Score.
 * Also returns the requesting user's rank.
 */
router.get('/leaderboard', requireAuth, async (req, res) => {
  const period = req.query.period || 'all';
  const pathway = req.query.pathway || null;

  let dateFilter = '';
  if (period === 'week') {
    dateFilter = "AND s.submitted_at >= NOW() - INTERVAL '7 days'";
  } else if (period === 'month') {
    dateFilter = "AND s.submitted_at >= NOW() - INTERVAL '30 days'";
  }

  // Optional pathway filter: limit to users assigned to this pathway
  let pathwayFilter = '';
  let pathwayParams = [];
  if (pathway) {
    pathwayFilter = 'AND u.id IN (SELECT up.user_id FROM user_pathways up WHERE up.pathway_id = $1)';
    pathwayParams = [parseInt(pathway)];
  }

  try {
    // Count actual activities across all active modules (not hardcoded * 4)
    const actCount = await db.query(`
      SELECT
        (SELECT COUNT(DISTINCT m.id) FROM cms_modules m WHERE m.is_active = TRUE AND EXISTS (SELECT 1 FROM cms_videos v WHERE v.module_id = m.id)) +
        (SELECT COUNT(DISTINCT m.id) FROM cms_modules m WHERE m.is_active = TRUE AND EXISTS (SELECT 1 FROM cms_doc_sections d WHERE d.module_id = m.id)) +
        (SELECT COUNT(*) FROM cms_modules m WHERE m.is_active = TRUE AND m.game_id IS NOT NULL AND m.game_id != '') +
        (SELECT COUNT(DISTINCT m.id) FROM cms_modules m WHERE m.is_active = TRUE AND EXISTS (SELECT 1 FROM cms_apply_items a WHERE a.module_id = m.id))
        AS total_activities
    `);
    const totalActivities = Math.max(parseInt(actCount.rows[0].total_activities) || 1, 1);

    const result = await db.query(`
      WITH user_completion AS (
        SELECT
          p.user_id,
          COUNT(DISTINCT CASE WHEN p.status = 'done' THEN p.module_id || '|' || p.activity_type END) AS done_count
        FROM progress p
        JOIN users u ON u.id = p.user_id
        WHERE u.is_active = TRUE AND u.role = 'rep' ${pathwayFilter}
        GROUP BY p.user_id
      ),
      user_accuracy AS (
        SELECT
          s.user_id,
          AVG(CASE WHEN s.max_score > 0 THEN s.score::FLOAT / s.max_score ELSE 0 END) AS avg_accuracy
        FROM scores s
        JOIN users u ON u.id = s.user_id
        WHERE u.is_active = TRUE AND u.role = 'rep'
          AND s.activity_type = 'quiz' ${dateFilter} ${pathwayFilter}
        GROUP BY s.user_id
      ),
      user_games AS (
        SELECT
          s.user_id,
          SUM(best_score) AS total_best
        FROM (
          SELECT
            s.user_id,
            s.activity_id,
            MAX(s.score) AS best_score
          FROM scores s
          JOIN users u ON u.id = s.user_id
          WHERE u.is_active = TRUE AND u.role = 'rep'
            AND s.activity_type = 'game' ${dateFilter} ${pathwayFilter}
          GROUP BY s.user_id, s.activity_id
        ) s
        GROUP BY s.user_id
      ),
      composite AS (
        SELECT
          u.id,
          u.first_name,
          u.last_name,
          u.nickname,
          COALESCE(uc.done_count, 0)::FLOAT / ${totalActivities} * 1000 * 0.40 +
          COALESCE(ua.avg_accuracy, 0) * 1000 * 0.25 +
          LEAST(COALESCE(ug.total_best, 0), 1000) * 0.20 +
          COALESCE(uc.done_count, 0)::FLOAT / ${totalActivities} * 1000 * 0.15 AS power_score
        FROM users u
        LEFT JOIN user_completion uc ON uc.user_id = u.id
        LEFT JOIN user_accuracy ua ON ua.user_id = u.id
        LEFT JOIN user_games ug ON ug.user_id = u.id
        WHERE u.is_active = TRUE AND u.role = 'rep' ${pathwayFilter}
      )
      SELECT
        id, first_name, last_name, nickname,
        ROUND(power_score::NUMERIC, 0) AS power_score,
        RANK() OVER (ORDER BY power_score DESC) AS rank
      FROM composite
      ORDER BY power_score DESC
    `, pathwayParams);

    // Find the requesting user's rank
    const myRank = result.rows.find(r => r.id === req.user.id);

    res.json({
      leaderboard: result.rows.map(r => ({
        id: r.id,
        firstName: r.first_name,
        lastName: r.last_name,
        nickname: r.nickname,
        displayName: formatDisplayName(r.first_name, r.last_name, r.nickname),
        powerScore: parseInt(r.power_score) || 0,
        rank: parseInt(r.rank)
      })),
      myRank: myRank ? parseInt(myRank.rank) : null,
      myScore: myRank ? parseInt(myRank.power_score) || 0 : 0,
      totalReps: result.rows.length
    });
  } catch (err) {
    console.error('[SCORES] Leaderboard error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Format display name: "John 'The Hammer' Hamilton"
 */
function formatDisplayName(firstName, lastName, nickname) {
  if (nickname) {
    return `${firstName} '${nickname}' ${lastName}`;
  }
  return `${firstName} ${lastName}`;
}

module.exports = router;
