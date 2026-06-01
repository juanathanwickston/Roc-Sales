/**
 * Sales Call Simulator — Shared Client Configuration
 * Canonical scoring thresholds used by all UI surfaces.
 *
 * Decision: 80/50 approved as canonical thresholds (2026-06-01).
 * Rationale: The stricter dashboard threshold of 80 avoids overstating
 * learner proficiency. All rendering code must reference these globals.
 */

window.SCORE_PASS_THRESHOLD = 80;
window.SCORE_WARNING_THRESHOLD = 50;
