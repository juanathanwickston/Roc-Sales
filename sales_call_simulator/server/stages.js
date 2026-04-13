/**
 * Payroc Sales Stages
 * The 6-stage sales process that structures the Sales Call Simulator.
 * Each stage maps to zero or more practice scenarios.
 * Stages with no scenarioId are displayed as locked/coming-soon.
 */

const SALES_STAGES = [
  {
    id: 1,
    key: 'identify',
    name: 'Identify The Customer',
    shortName: 'Identify',
    scenarioId: 'module1_identifying_customer',
    description: 'Learn to qualify suspects through discovery calls.',
  },
  {
    id: 2,
    key: 'appointment',
    name: 'Ask For Appointment',
    shortName: 'Appointment',
    scenarioId: null,
    description: 'Earn the right to schedule a follow-up meeting.',
  },
  {
    id: 3,
    key: 'prep',
    name: 'Prep For Appointment',
    shortName: 'Prep',
    scenarioId: null,
    description: 'Research and prepare for a productive sales meeting.',
  },
  {
    id: 4,
    key: 'sale',
    name: 'Make The Sale',
    shortName: 'Make Sale',
    scenarioId: null,
    description: 'Present solutions tailored to the customer\'s needs.',
  },
  {
    id: 5,
    key: 'close',
    name: 'Close The Sale',
    shortName: 'Close',
    scenarioId: null,
    description: 'Handle objections and close with confidence.',
  },
  {
    id: 6,
    key: 'referrals',
    name: 'Ask For Referrals',
    shortName: 'Referrals',
    scenarioId: null,
    description: 'Turn satisfied customers into referral sources.',
  },
];

module.exports = { SALES_STAGES };
