/**
 * continuityHelper.js
 * Provides default relationship summaries for Module 5 launches
 * when no prior Module 4 session summary exists in the database.
 */

const DEFAULT_SUMMARIES = {
  sam_patel: {
    relationship_summary: `**Discovered Facts:**
- Sam Patel is the owner of QuickStop Market (independent convenience store in suburban Michigan).
- Expressed strong interest in Bodega AI to automate pricing, manage inventory, and handle tobacco rebates.
**Operational Pain Points:**
- Pricing errors and manual audits consume extensive hours and create compliance risk.
**Merchant Confirmed Details:**
- Transition must not disrupt store hours or operations. Cost savings must justify the switch.`,
    relationship_summary_json: {
      discovered_facts: [
        'Sam Patel is the owner of QuickStop Market',
        'Interested in Bodega AI for pricing and inventory',
      ],
      operational_pain_points: [
        'Manual pricing errors consume hours',
        'High compliance risk',
      ],
      merchant_confirmed_details: [
        'Transition must not disrupt store hours',
      ],
    },
  },
  carla_reyes: {
    relationship_summary: `**Discovered Facts:**
- Carla Reyes is the owner of Studio Collective Salon in Denver, Colorado.
- Expressed interest in Roc Terminal+ to simplify checkout and track stylist payouts separately.
**Operational Pain Points:**
- Checkouts at the front desk are confusing, and end-of-day reporting is tedious.
**Merchant Confirmed Details:**
- Stylists must feel comfortable with the switch; she will not force a system they hate.`,
    relationship_summary_json: {
      discovered_facts: [
        'Carla Reyes is the owner of Studio Collective Salon',
        'Interested in Roc Terminal+ for payouts',
      ],
      operational_pain_points: [
        'Front desk checkouts are confusing',
        'End-of-day reporting is tedious',
      ],
      merchant_confirmed_details: [
        'Stylists must feel comfortable with the switch',
      ],
    },
  },
  mike_turner: {
    relationship_summary: `**Discovered Facts:**
- Mike Turner is the owner of Precision Plumbing & Drain.
- Expressed interest in Roc Services to invoice on-site and collect payments immediately.
**Operational Pain Points:**
- Office paperwork is slow, and techs are resistant to complicated administrative tools.
**Merchant Confirmed Details:**
- Setup and technician learning curve must be extremely simple.`,
    relationship_summary_json: {
      discovered_facts: [
        'Mike Turner is the owner of Precision Plumbing',
        'Interested in Roc Services for invoicing',
      ],
      operational_pain_points: [
        'Slow office paperwork',
        'Techs resist complex administrative tools',
      ],
      merchant_confirmed_details: [
        'Setup and tech learning curve must be simple',
      ],
    },
  },
  david_miller: {
    relationship_summary: `**Discovered Facts:**
- Pastor David Miller leads New Hope Community Church.
- Expressed interest in Roc Giving to support recurring donations and campaign tools.
**Operational Pain Points:**
- Volunteers are bogged down by donation tracking and administrative work.
**Merchant Confirmed Details:**
- The giving experience must remain warm, welcoming, and personal.`,
    relationship_summary_json: {
      discovered_facts: [
        'Pastor David Miller leads New Hope Community Church',
        'Interested in Roc Giving for campaigns',
      ],
      operational_pain_points: [
        'Volunteers are bogged down by tracking',
      ],
      merchant_confirmed_details: [
        'Giving experience must remain warm and welcoming',
      ],
    },
  },
};

/**
 * Returns a deep copy of the default relationship summary for a persona.
 * Returns null if the persona is unknown or lacks a default summary.
 * @param {string} personaId
 * @returns {{ relationship_summary: string, relationship_summary_json: Object }|null}
 */
function getFallbackSummary(personaId) {
  if (!personaId || !DEFAULT_SUMMARIES[personaId]) {
    return null;
  }
  return JSON.parse(JSON.stringify(DEFAULT_SUMMARIES[personaId]));
}

module.exports = { getFallbackSummary };
