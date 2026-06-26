/**
 * briefing.js: Pre-call Briefing Dashboard Logic
 * Handles persona data rendering, CHAMP interactions, MCQ drills, and completion flow.
 */

(function () {
  'use strict';

  // ─── QUIZ DATA (hardcoded per plan) ───

  const DRILL_QUESTIONS = {
    sam_patel: [
      {
        question: "What is Sam Patel's primary behavioral style?",
        options: ['Controller', 'Supporter', 'Doer', 'Talker'],
        answer: 'Controller',
      },
      {
        question: 'What is the correct Payroc product to recommend for QuickStop Market?',
        options: ['Bodega AI', 'Roc Terminal+', 'Roc Services', 'Roc Giving'],
        answer: 'Bodega AI',
      },
      {
        question: "What is Sam's primary operational bottleneck that drains his time?",
        options: [
          'Manual price updates and spreadsheet inventory tracking',
          'Delayed billing collections',
          'Checkout confusion at shared desk',
          'Inconsistent donations',
        ],
        answer: 'Manual price updates and spreadsheet inventory tracking',
      },
      {
        question: "What recent regulatory event represents Sam's highest compliance risk?",
        options: [
          'An EBT compliance warning for age-verification errors',
          'A health department audit',
          'An IRS tax compliance warning',
          'A credit card processing breach',
        ],
        answer: 'An EBT compliance warning for age-verification errors',
      },
    ],
    carla_reyes: [
      {
        question: "What is Carla Reyes' primary behavioral style?",
        options: ['Supporter', 'Controller', 'Doer', 'Talker'],
        answer: 'Supporter',
      },
      {
        question: 'What is the correct Payroc product to recommend for Studio Collective Salon?',
        options: ['Roc Terminal+', 'Bodega AI', 'Roc Services', 'Roc Giving'],
        answer: 'Roc Terminal+',
      },
      {
        question: "What is Carla's biggest underlying fear about changing the salon's checkout system?",
        options: [
          'Losing her top stylists due to onboarding disruption',
          'Increased processing fees',
          'Losing client data',
          'Regulatory compliance issues',
        ],
        answer: 'Losing her top stylists due to onboarding disruption',
      },
      {
        question: 'How many independent stylists rent booths at Studio Collective Salon?',
        options: ['6', '4', '8', '10'],
        answer: '6',
      },
    ],
    mike_turner: [
      {
        question: "What is Mike Turner's primary behavioral style?",
        options: ['Doer', 'Supporter', 'Controller', 'Talker'],
        answer: 'Doer',
      },
      {
        question: 'What is the correct Payroc product to recommend for Precision Plumbing & Drain?',
        options: ['Roc Services', 'Bodega AI', 'Roc Terminal+', 'Roc Giving'],
        answer: 'Roc Services',
      },
      {
        question: 'What is the primary cash flow bottleneck that Precision Plumbing faces?',
        options: [
          'Delayed billing collections taking 2-3 weeks to clear',
          'Manual price updates',
          'Inconsistent donations',
          'Checkout confusion',
        ],
        answer: 'Delayed billing collections taking 2-3 weeks to clear',
      },
      {
        question: 'How many trucks and field technicians does Mike manage?',
        options: [
          '4 trucks and 4 technicians',
          '6 trucks and 6 technicians',
          '3 trucks and 5 technicians',
          '8 trucks and 8 technicians',
        ],
        answer: '4 trucks and 4 technicians',
      },
    ],
    david_miller: [
      {
        question: "What is Pastor David Miller's primary behavioral style?",
        options: ['Talker-Supporter Hybrid', 'Controller', 'Doer', 'Supporter'],
        answer: 'Talker-Supporter Hybrid',
      },
      {
        question: 'What is the correct Payroc product/platform to recommend for the church?',
        options: ['Roc Giving', 'Bodega AI', 'Roc Terminal+', 'Roc Services'],
        answer: 'Roc Giving',
      },
      {
        question: 'What specific fundraising goal is the church currently trying to achieve?',
        options: [
          'Repairing the community basketball court for their youth basketball program',
          'Building a new sanctuary',
          'Funding a food pantry',
          'Renovating the parking lot',
        ],
        answer: 'Repairing the community basketball court for their youth basketball program',
      },
      {
        question: 'What primary administrative burden is burning out church volunteers?',
        options: [
          'Manual tracking of cash/checks and generating tax receipts',
          'Scheduling services',
          'Managing social media',
          'Coordinating transportation',
        ],
        answer: 'Manual tracking of cash/checks and generating tax receipts',
      },
    ],
  };

  // ─── PERSONA DISPLAY DATA ───

  const PERSONA_DATA = {
    sam_patel: {
      displayName: 'Sam Patel',
      initials: 'SP',
      business: 'QuickStop Market : Independent Convenience Store',
      location: 'Suburban Michigan',
      style: 'Controller',
      styleDesc: 'Analytical, efficient, highly skeptical',
      product: 'Bodega AI',
      segment: 'Convenience / Bodega',
      info: [
        { label: 'Industry', value: 'Convenience Store' },
        { label: 'Product Fit', value: 'Bodega AI' },
        { label: 'Behavioral Style', value: 'Controller' },
        { label: 'Risk Level', value: 'High Skepticism' },
      ],
      champ: {
        challenges: {
          title: 'Challenges',
          body: 'Manual price updates drain hours every week. Spreadsheet inventory tracking leads to leakage. Credit card processing fees are eating into thin margins. Recent EBT compliance warning threatens his license.',
          action: 'Ask about how he currently handles price changes and inventory counts. Follow up on compliance concerns.',
        },
        authority: {
          title: 'Authority (Decision-Making)',
          body: 'Sam is the sole owner and decision-maker. No board or partners to consult. Decisions are fast when he sees hard data, but he will not act on vague promises.',
          action: 'Speak in terms of ROI, data, and measurable outcomes. Avoid fluff.',
        },
        money: {
          title: 'Money & Budget',
          body: 'Thin margins (2 to 5 percent on most items). Every dollar matters. Processing fees are a known pain point. He has been quoted cheaper rates before and is skeptical of savings claims.',
          action: 'Lead with margin protection and cost avoidance, not just lower rates.',
        },
        prioritization: {
          title: 'Prioritization & Timeline',
          body: 'Sam is in survival mode: day-to-day operations consume him. He will not prioritize a new system unless the pain of the status quo is clearly worse. The EBT warning created urgency.',
          action: 'Connect automation to time savings he can feel immediately. Use the compliance urgency.',
        },
      },
      questions: [
        'How do you currently handle price changes across your store?',
        'Walk me through what inventory management looks like week-to-week.',
        'How much time does your team spend on manual counts and restocking?',
        'Tell me about the compliance situation: I heard there may have been a warning?',
        'What would it mean for the business if you lost your EBT license?',
      ],
      objections: [
        { trigger: "We've always done it this way.", response: 'Acknowledge the comfort of routine, then quantify the cost of manual work: "Totally fair. When you add up the hours on pricing alone, what does that look like each week?"' },
        { trigger: 'I already got quoted cheaper rates.', response: 'Do not compete on rate. Pivot to total cost of ownership: "Rates are one piece. What about the shrink and labor cost from manual inventory?"' },
        { trigger: "I don't have time for a new system.", response: 'Mirror his time pressure back: "That is exactly the problem we solve. The current system is what is stealing your time."' },
      ],
      stage1: {
        title: 'Stage 1: The Hook (First 2 Mins)',
        profile: 'Sam Patel, Owner, QuickStop Market (11 years in business)',
        dialogueGuide: 'Controller. Skeptical and direct. Conciseness is key. Dialogue Pace: maintain 50/50 balance, check in every 1-2 sentences. Avoid monologues.',
        timeConstraint: '10 minutes (call must finish before the evening rush)',
        productFocus: 'Bodega AI (Automation and Inventory Software)',
        openingStatement: 'Thanks for jumping on, Sam. I know you have your evening rush starting in about ten minutes, so I will get straight to it. When we chatted last week, you mentioned you guys were dealing with some manual pricing errors, keeping track of inventory on spreadsheets, and worrying about EBT audits. Is that still accurate?',
      },
      stage2: {
        title: 'Stage 2: Discovery and ROI Grid (Middle 6 Mins)',
        grid: [
          {
            need: 'Manual Aisle Walks: Staff walks aisles checking prices and changing tags manually.',
            feature: 'Centralized Pricing: Automates price updates and syncs pricing changes instantly to registers.',
            impact: 'Labor Savings Math: Saves 6 hours per week. At $15/hour, this equals $180/week or $9,360/year saved in labor costs.',
          },
          {
            need: 'Spreadsheet Inventory and Stockouts: Manual counts cause frequent out-of-stock items and supplier margin leakage.',
            feature: 'Automated Inventory Tracking: Tracks stock levels in real time and automates reordering.',
            impact: 'Financial Recovery Math: Protects store margins, reduces manual count labor, and prevents walk-away customer losses.',
          },
          {
            need: 'Compliance and Audit Risks: Recent warnings regarding manual age verification and EBT administration.',
            feature: 'Age and EBT Compliance Prompts: System forces register prompts for age check and blocks invalid EBT purchases.',
            impact: 'License Safeguard: Protects the store EBT/lottery licenses, prevents regulatory audits, and avoids costly fines.',
          }
        ],
      },
      stage3: {
        title: 'Stage 3: Friction and Close (Last 2 Mins)',
        expectedObjection: "Look, I just don't have the time to switch systems right now. I can't risk having my registers down during our busy hours.",
        dialoguePath: [
          { step: 'Step 1 (Cushion):', text: 'That is a totally fair concern. I know any downtime at the register directly impacts your business.' },
          { step: 'Step 2 (Explore):', text: 'Just so I understand, what is the main concern there, are you worried about actual system downtime during the switch, or is it more about how long it will take your cashiers to learn it?' },
          { step: 'Step 3 (Solve):', text: 'Explain how our onboarding team handles the heavy lifting overnight, keeping register downtime to under 15 minutes.' },
          { step: 'Step 4 (Commit):', text: 'Pivot back to scheduling the demo to show them the interface.' },
        ],
        targetCommitment: 'Secure a scheduled 15-minute demo.',
        closingStatement: 'Let us grab 15 minutes to run through a quick demo so you can see it in action. Do you have some time Tuesday morning, or would Thursday afternoon work better?',
        fails: [
          'Pitching the wrong product: Standalone card terminals instead of Bodega AI.',
          'Treating the appointment as a cold call: Forgetting to reference the previous conversation.',
          'Arguing or pushing back defensively when the customer raises objections.',
        ],
      },
    },
    carla_reyes: {
      displayName: 'Carla Reyes',
      initials: 'CR',
      business: 'Studio Collective Salon : Multi-booth Beauty Salon',
      location: 'Denver, Colorado',
      style: 'Supporter',
      styleDesc: 'Relationship-driven, warm, collaborative, cautious of disruption',
      product: 'Roc Terminal+',
      segment: 'Beauty / Salon',
      info: [
        { label: 'Industry', value: 'Beauty Salon' },
        { label: 'Product Fit', value: 'Roc Terminal+' },
        { label: 'Behavioral Style', value: 'Supporter' },
        { label: 'Team Size', value: '6 Booth Renters' },
      ],
      champ: {
        challenges: {
          title: 'Challenges',
          body: 'Checkout confusion at the shared reception desk. Disjointed client experience where some stylists accept Venmo, others cash. Manual reconciliation at the end of the day is tedious.',
          action: 'Ask how checkout currently works when multiple stylists have clients finishing at the same time.',
        },
        authority: {
          title: 'Authority (Decision-Making)',
          body: 'Carla owns the salon but the stylists are independent renters. She needs their buy-in: any change that feels forced will cause pushback. Decisions are collaborative.',
          action: 'Frame the solution as something that helps the team, not just Carla. Use inclusive language.',
        },
        money: {
          title: 'Money & Budget',
          body: 'Each stylist manages their own revenue through shared infrastructure. The current single-terminal setup means Carla absorbs reconciliation costs. Stylists want transparent payment tracking.',
          action: 'Show how split payments give each stylist their own transparent revenue stream with no extra hardware.',
        },
        prioritization: {
          title: 'Prioritization & Timeline',
          body: 'Carla will not rush a decision. She needs to feel confident that her team is onboard. The biggest fear is losing top stylists to disruption.',
          action: 'Propose a low-pressure trial or demo that stylists can experience before committing.',
        },
      },
      questions: [
        'How does the checkout process work when multiple stylists finish with clients at the same time?',
        'What does end-of-day reconciliation look like for you and the stylists?',
        'Have any stylists ever had issues with payment tracking or missing transactions?',
        'If you could change one thing about how payments work in the salon, what would it be?',
        'How do your stylists feel about trying new tools or technology?',
      ],
      objections: [
        { trigger: "My stylists won't want to learn something new.", response: 'Validate the concern, then reframe: "I hear you. That is why this is designed to be simpler than what they do now, not more complex."' },
        { trigger: "We've managed fine so far.", response: 'Agree and elevate: "You have built something great. This is about protecting that by reducing the friction points that could frustrate your team."' },
        { trigger: "I need to talk to my stylists first.", response: 'Support the collaborative process: "Absolutely, I would expect nothing less. Would a quick demo for the team make that conversation easier?"' },
      ],
      stage1: {
        title: 'Stage 1: The Hook (First 2 Mins)',
        profile: 'Carla Reyes, Owner, Studio Collective Salon (6 independent stylists renting booths)',
        dialogueGuide: 'Supporter. Relationship-driven, warm, and collaborative. Reassurance is key. Dialogue Pace: maintain 50/50 balance, check in every 1-2 sentences. Avoid high pressure or complex jargon.',
        timeConstraint: '10 minutes (brief discussion on checkout operations)',
        productFocus: 'Roc Terminal+ (Multi-merchant split payment terminal)',
        openingStatement: 'Hey Carla, thanks for taking the call. I know running a busy salon keeps you on your feet, so I will keep this quick. When we talked last week, you mentioned you guys were dealing with some checkout confusion at the front desk, a disjointed payment experience for clients, and a lot of manual reconciliation at the end of the day. Does that still sound like the main challenges?',
      },
      stage2: {
        title: 'Stage 2: Discovery and ROI Grid (Middle 6 Mins)',
        grid: [
          {
            need: 'Shared Reception Confusion: Desk gets chaotic with booth renters using multiple payment apps or personal readers.',
            feature: 'Multi-Merchant Split Payments: Allows independent booth renters to accept payments on a single physical terminal.',
            impact: 'Stress-Free Reception: Routes funds directly to individual stylist accounts, keeping business finances separate.',
          },
          {
            need: 'Disjointed Client Experience: Clients pay stylists via cash or personal apps, slowing checkout and feeling unprofessional.',
            feature: 'Unified Client Checkout: A high-end payment terminal interface accepting tap, chip, and mobile wallets in one spot.',
            impact: 'Premium Brand Perception: Gives clients a sleek, professional checkout experience that matches the high quality of your salon.',
          },
          {
            need: 'Manual End-of-Day Reconciliation: Spent hours sorting through payments to calculate booth rentals and stylist transactions.',
            feature: 'Simplified Reporting: Tracks rental dues and individual transactions automatically in the back office.',
            impact: 'Time Savings: Saves hours of bookkeeping every week and prevents stylist accounting errors.',
          }
        ],
      },
      stage3: {
        title: 'Stage 3: Friction and Close (Last 2 Mins)',
        expectedObjection: "I'm just worried my stylists won't want to use it. They aren't very tech-savvy and hate when we change things on them.",
        dialoguePath: [
          { step: 'Step 1 (Cushion):', text: 'I completely get that. Your team comfort is the most important thing here.' },
          { step: 'Step 2 (Explore):', text: 'Just to make sure we address it right, are they mostly worried about a complicated setup process, or is it more about the daily learning curve of using the app?' },
          { step: 'Step 3 (Solve):', text: 'Explain that we provide dedicated, hands-on training for each stylist so they feel comfortable before we go live.' },
          { step: 'Step 4 (Commit):', text: 'Pivot back to the demo so they can see how straightforward the stylist interface is.' },
        ],
        targetCommitment: 'Secure a scheduled 15-minute demo.',
        closingStatement: 'Let us grab 15 minutes to do a quick demo and I will show you how simple it is for your stylists to track their own sales. Would Tuesday morning or Thursday afternoon work best for you?',
        fails: [
          'Pitching the wrong product: Single-merchant terminals instead of Roc Terminal+.',
          'Treating the appointment as a cold call: Forgetting to reference the previous conversation.',
          'Arguing or pushing back defensively when the customer raises objections.',
        ],
      },
    },
    mike_turner: {
      displayName: 'Mike Turner',
      initials: 'MT',
      business: 'Precision Plumbing & Drain : Residential Plumbing',
      location: 'Columbus, Ohio',
      style: 'Doer',
      styleDesc: 'Fast-paced, direct, results-oriented, highly impatient',
      product: 'Roc Services',
      segment: 'Field Services / Plumbing',
      info: [
        { label: 'Industry', value: 'Plumbing Services' },
        { label: 'Product Fit', value: 'Roc Services' },
        { label: 'Behavioral Style', value: 'Doer' },
        { label: 'Fleet Size', value: '4 Trucks, 4 Techs' },
      ],
      champ: {
        challenges: {
          title: 'Challenges',
          body: 'Technicians leave jobs without collecting payment. Paper invoices are sent days after job completion. Payments take 2 to 3 weeks to arrive. Office staff spend hours chasing unpaid invoices manually.',
          action: 'Ask how techs currently handle billing when they finish a job in the field.',
        },
        authority: {
          title: 'Authority (Decision-Making)',
          body: 'Mike is the sole owner and makes all decisions quickly. He values directness: get to the point fast or he will cut you off. No committee, no approval chain.',
          action: 'Be direct. Lead with the result, then explain how. Skip the small talk.',
        },
        money: {
          title: 'Money & Budget',
          body: 'Cash flow gaps create severe stress during winter slow season. Delayed invoicing means delayed revenue. Lost estimates to faster competitors cost real money.',
          action: 'Quantify the cash flow impact: "If 4 techs run 3 jobs/day and each invoice is delayed 2 weeks..."',
        },
        prioritization: {
          title: 'Prioritization & Timeline',
          body: 'Mike knows operations are inefficient but hates dealing with new technology. He will prioritize a change only if it is dead simple for his crew and solves an immediate pain.',
          action: 'Emphasize crew-friendly design: "Your guys tap 3 buttons on their phone and the invoice goes out."',
        },
      },
      questions: [
        'When a tech finishes a job, what happens with billing right now?',
        'How long does it typically take from job completion to payment received?',
        'How does your office handle the follow-up on unpaid invoices?',
        'Have you lost any jobs recently because a competitor got an estimate out faster?',
        'What does cash flow look like during the slow season with these delays?',
      ],
      objections: [
        { trigger: "We've always done it this way.", response: 'Do not argue. Validate and redirect: "Makes sense. When you look at the 2-3 week delay on getting paid, what is that costing you over a quarter?"' },
        { trigger: "My guys won't use it. They're plumbers, not computer guys.", response: 'Meet the objection head-on: "Exactly. This is built for field crews, not office workers. Three taps and the invoice is sent."' },
        { trigger: 'I already use QuickBooks.', response: 'Do not compete. Complement: "QuickBooks is great for the back office. This gets the data to QuickBooks faster by capturing it in the field."' },
      ],
      stage1: {
        title: 'Stage 1: The Hook (First 2 Mins)',
        profile: 'Mike Turner, Owner, Precision Plumbing & Drain (4 field technicians, 4 trucks)',
        dialogueGuide: 'Doer. Highly practical, results-oriented, impatient, direct. Dialogue Pace: maintain 50/50 balance, conciseness is key. Focus immediately on cash flow and time savings.',
        timeConstraint: '10 minutes (between calls on a job site)',
        productFocus: 'Roc Services (Mobile Invoicing and Dispatch Software)',
        openingStatement: 'Hey Mike, thanks for grabbing the phone. I know you are busy on a job site today, so I will get right to the point. When we spoke last week, you mentioned that technicians are collecting payments inconsistently in the field, paper invoices are dragging out your collection times, and you have got a backlog of manual invoicing in the office. Is that still what is going on?',
      },
      stage2: {
        title: 'Stage 2: Discovery and ROI Grid (Middle 6 Mins)',
        grid: [
          {
            need: 'Inconsistent Field Payments: Technicians walk away from jobs without collecting payment, or paper checks sit in trucks.',
            feature: 'Mobile In-Field Processing: Allows field technicians to invoice and process card/ACH payments on-site via mobile app.',
            impact: 'Zero Billing Lag: You collect payments immediately on job completion, preventing revenue leakage.',
          },
          {
            need: 'Paper Invoice Delay: Writing and mailing paper invoices takes days, delaying payment clearances by weeks.',
            feature: 'Mobile Invoice Generator: Generates and sends digital estimates and invoices to customers instantly on-site.',
            impact: 'Accelerated Cash Flow: Gets funds cleared in minutes rather than weeks, supporting business during slow seasons.',
          },
          {
            need: 'Office Bookkeeping Backlog: Office staff spends hours typing paper invoices and manually reconciling billing details.',
            feature: 'QuickBooks Sync: Automatically syncs all generated field invoices and payments into accounting.',
            impact: 'Admin Time Recovery: Eliminates double-entry and saves manual reconciliation and billing follow-up hours.',
          }
        ],
      },
      stage3: {
        title: 'Stage 3: Friction and Close (Last 2 Mins)',
        expectedObjection: "Look, my guys are plumbers, not tech guys. They're going to complain and refuse to use some complicated app.",
        dialoguePath: [
          { step: 'Step 1 (Cushion):', text: 'I hear you. If the field techs find it complicated, it is just going to sit there unused.' },
          { step: 'Step 2 (Explore):', text: 'What is the biggest concern there, is it that the app itself has too many steps, or is it the time it takes to get them set up on their phones?' },
          { step: 'Step 3 (Solve):', text: 'Explain that the field tech interface is designed for 1-click invoicing and takes less than 5 minutes to learn.' },
          { step: 'Step 4 (Commit):', text: 'Pivot back to the demo so they can see how simple the app looks on a mobile screen.' },
        ],
        targetCommitment: 'Secure a scheduled 15-minute demo.',
        closingStatement: 'Let us set up a quick 15-minute online walkthrough so you can see how simple the mobile screen is for your techs. Do you have some time Tuesday morning, or would Thursday afternoon work better?',
        fails: [
          'Pitching the wrong product: Standalone retail terminals instead of Roc Services.',
          'Treating the appointment as a cold call: Forgetting to reference the previous conversation.',
          'Arguing or pushing back defensively when the customer raises objections.',
        ],
      },
    },
    david_miller: {
      displayName: 'Pastor David Miller',
      initials: 'DM',
      business: 'New Hope Community Church : Church & Nonprofit',
      location: 'Western Pennsylvania',
      style: 'Talker-Supporter Hybrid',
      styleDesc: 'Warm, relational, deeply mission-focused',
      product: 'Roc Giving',
      segment: 'Church / Nonprofit',
      info: [
        { label: 'Organization', value: 'Church & Nonprofit' },
        { label: 'Product Fit', value: 'Roc Giving' },
        { label: 'Behavioral Style', value: 'Talker-Supporter Hybrid' },
        { label: 'Congregation', value: '~350 Active Members' },
      ],
      champ: {
        challenges: {
          title: 'Challenges',
          body: 'Donations are inconsistent: heavily reliant on Sunday collections. Manual tracking of cash and checks is time-consuming. Volunteers are burning out generating handwritten tax receipts. Younger families want digital giving options.',
          action: 'Ask about how the church currently collects and tracks donations week-to-week.',
        },
        authority: {
          title: 'Authority (Decision-Making)',
          body: 'Pastor David leads the church but values community input. Major decisions involve the church board. He needs to feel personally aligned with the mission before advocating.',
          action: 'Connect the solution to the church mission and community impact. Make him a champion.',
        },
        money: {
          title: 'Money & Budget',
          body: 'The church operates on tight budgets funded by donations. The basketball court fundraiser is the current priority. Processing fees are a concern but secondary to engagement.',
          action: 'Frame costs as an investment in the basketball court project. Show how digital giving increases total donations.',
        },
        prioritization: {
          title: 'Prioritization & Timeline',
          body: 'The basketball court repair is the immediate priority. Volunteer burnout is a growing concern. Pastor David will move when he believes the solution genuinely serves his community.',
          action: 'Tie everything to the basketball court timeline: "What if you could fund the court project by Q4?"',
        },
      },
      questions: [
        'How does the church currently collect donations on a typical Sunday?',
        'What does the process look like after service for counting and recording donations?',
        'Have younger families mentioned wanting other ways to give?',
        'How is the basketball court fundraiser going? Are you on track?',
        'How many volunteer hours go into donation tracking and receipts each week?',
      ],
      objections: [
        { trigger: 'We already have ways to collect donations.', response: 'Honor the tradition: "Your congregation generosity is clear. This is about making it easier for everyone to give in the way that is most comfortable for them."' },
        { trigger: "We don't want giving to feel transactional.", response: 'Align with the mission: "100 percent. This is about deepening engagement, not processing payments. Think of it as extending the giving experience beyond Sunday."' },
        { trigger: "We're not very tech-savvy.", response: 'Remove the burden: "Your volunteers won not need to be. The system handles tracking and receipts automatically. It actually reduces the tech burden on your team."' },
      ],
      stage1: {
        title: 'Stage 1: The Hook (First 2 Mins)',
        profile: 'Pastor David Miller, New Hope Community Church (350 active members)',
        dialogueGuide: 'Talker-Supporter Hybrid. Warm, relational, mission-focused, community-oriented. Dialogue Pace: maintain 50/50 balance. Focus on trust, stories, and community impact.',
        timeConstraint: '10 minutes (relaxed but respectful of church programs)',
        productFocus: 'Roc Giving (Donor Management and Mobile Campaigns)',
        openingStatement: 'Hi Pastor David, thanks for chatting today. I have been following your basketball court project and would love to hear how it is coming along. I will keep this brief, but when we spoke last week, you mentioned that giving is inconsistent when members miss a service, your volunteers are burning out tracking checks manually, and it is hard to get younger givers excited about the court project. Is that still what you are seeing?',
      },
      stage2: {
        title: 'Stage 2: Discovery and ROI Grid (Middle 6 Mins)',
        grid: [
          {
            need: 'Inconsistent Weekly Giving: Weekly giving drops off whenever members are traveling or cannot make Sunday service.',
            feature: 'Recurring Online Donations: Set-and-forget digital giving options that members can configure on your website or mobile portal.',
            impact: 'Consistent Church Funding: Provides the church with steady, predictable monthly support to run community outreach programs.',
          },
          {
            need: 'Court Campaign Momentum: Traditional envelopes and paper checks make it hard to track fundraising progress dynamically.',
            feature: 'Text-to-Give and Mobile Campaigns: Simple Text-to-Give keywords and mobile campaign pages built specifically for community projects.',
            impact: 'Accelerated Project Completion: Keeps donors engaged and excited on the spot, with visible real-time campaign tracking.',
          },
          {
            need: 'Volunteer Administrative Burnout: Volunteers spend hours counting cash, sorting checks, and manually writing out tax receipts.',
            feature: 'Automated Contribution Tracking: Secure donor management software that logs donations and generates tax statements with one click.',
            impact: 'Ministry-First Operations: Frees up volunteer hours from administrative paperwork, letting them focus on community service.',
          }
        ],
      },
      stage3: {
        title: 'Stage 3: Friction and Close (Last 2 Mins)',
        expectedObjection: 'We really care about keeping our church community personal. I do not want giving to feel commercial or like a cold business transaction.',
        dialoguePath: [
          { step: 'Step 1 (Cushion):', text: 'I completely agree. Giving is a spiritual act, not a business transaction.' },
          { step: 'Step 2 (Explore):', text: 'What is the main concern there, are you worried the digital giving page will look too commercial, or is it more about making sure older members do not feel excluded?' },
          { step: 'Step 3 (Solve):', text: 'Show how the giving page is customized with church imagery and photos of the court, keeping it relational, while traditional check-giving remains fully supported.' },
          { step: 'Step 4 (Commit):', text: 'Pivot back to showing them a mockup of their custom page.' },
        ],
        targetCommitment: 'Secure a scheduled 15-minute demo.',
        closingStatement: 'Let us take 15 minutes next week to look at a simple mockup of what your custom basketball court giving page could look like. Would Tuesday morning or Thursday afternoon work better?',
        fails: [
          'Pitching the wrong product: Standard credit card terminals instead of Roc Giving.',
          'Treating the appointment as a cold call: Forgetting to reference the previous conversation.',
          'Arguing or pushing back defensively when the customer raises objections.',
        ],
      },
    },
  };

  // ─── STATE ───

  let state = {
    token: '',
    scenarioId: '',
    userId: '',
    moduleId: '',
    personaId: '',
    scenario: null,
    correctCount: 0,
    answered: new Set(),
    completed: false,
  };

  // ─── INIT ───

  async function init() {
    const params = new URLSearchParams(window.location.search);
    state.token = params.get('token') || '';
    state.scenarioId = params.get('scenarioId') || '';
    state.userId = params.get('userId') || '';
    state.moduleId = params.get('moduleId') || '';

    if (!state.token || !state.scenarioId) {
      showError('Missing launch parameters. Please relaunch from the LMS.');
      return;
    }

    // Extract personaId from scenarioId (e.g., 'module4_sam_patel' -> 'sam_patel')
    state.personaId = state.scenarioId.replace(`${state.moduleId}_`, '');

    if (!PERSONA_DATA[state.personaId]) {
      showError(`Unknown persona: ${state.personaId}. Please contact your administrator.`);
      return;
    }

    try {
      // Fetch scenario data
      const res = await fetch(`/api/scenarios/${state.scenarioId}`, {
        headers: { 'Authorization': `Bearer ${state.token}` },
      });
      if (res.ok) {
        const json = await res.json();
        state.scenario = json.data || json;
      }
    } catch (err) {
      console.warn('Failed to fetch scenario config, using local data:', err);
    }

    renderDashboard();
  }

  // ─── RENDER ───

  function renderDashboard() {
    const persona = PERSONA_DATA[state.personaId];

    // Hide loading, show app
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('briefingApp').style.display = 'block';

    // Header
    document.getElementById('headerPersonaName').textContent = `${persona.displayName} (${persona.product})`;

    // Persona profile
    document.getElementById('personaAvatar').textContent = persona.initials;
    document.getElementById('personaFullName').textContent = persona.displayName;
    document.getElementById('personaBusiness').textContent = persona.business + ' • ' + persona.location;
    document.getElementById('behavioralStyle').textContent = `${persona.style} : ${persona.styleDesc}`;

    // Info grid
    const infoGrid = document.getElementById('infoGrid');
    infoGrid.innerHTML = persona.info.map(item => `
      <div class="info-item">
        <div class="info-label">${item.label}</div>
        <div class="info-value">${item.value}</div>
      </div>
    `).join('');

    // CHAMP details
    renderChampDetails(persona);

    // Playbook
    renderPlaybook(persona);

    // Blueprint
    renderBlueprint(persona);

    // Quiz
    renderQuiz();

    // Tabs
    setupTabs();

    // CHAMP selector
    setupChampSelector();

    // Blueprint title
    document.getElementById('blueprintTitle').textContent = `Pre-call Handout : ${persona.displayName}`;
    document.getElementById('blueprintSubtitle').textContent = `${persona.business}`;
  }

  function renderChampDetails(persona) {
    const container = document.getElementById('champDetails');
    container.innerHTML = Object.entries(persona.champ).map(([key, data]) => `
      <div class="champ-detail" data-champ-detail="${key}">
        <div class="champ-detail-box">
          <div class="champ-detail-header">${data.title}</div>
          <div class="champ-detail-body">${data.body}</div>
          <div class="champ-detail-action">Action: ${data.action}</div>
        </div>
      </div>
    `).join('');
  }

  function renderPlaybook(persona) {
    // Questions
    const questionList = document.getElementById('questionList');
    questionList.innerHTML = persona.questions.map((q, i) => `
      <div class="question-item">
        <span class="question-number">${i + 1}.</span> ${q}
      </div>
    `).join('');

    // Objections
    const objectionList = document.getElementById('objectionList');
    objectionList.innerHTML = persona.objections.map(obj => `
      <div class="objection-item">
        <div class="objection-trigger">
          <div class="objection-label">They Say</div>
          "${obj.trigger}"
        </div>
        <div class="objection-response">
          <div class="objection-label">You Say</div>
          ${obj.response}
        </div>
      </div>
    `).join('');
  }

  function renderBlueprint(persona) {
    const body = document.getElementById('blueprintBody');
    body.innerHTML = `
      <!-- STAGE 1: THE HOOK -->
      <div class="blueprint-champ-zone" data-zone="challenges" style="margin-bottom: 20px; border-left: 4px solid var(--color-primary); padding-left: 16px;">
        <span class="zone-tag">Challenges</span>
        <h4 style="font-size: 13px; font-weight: 700; color: var(--color-primary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
          Stage 1: The Hook (First 2 Mins)
        </h4>
        
        <div class="blueprint-champ-zone" data-zone="authority" style="padding: 6px; border-radius: 4px; margin-bottom: 6px;">
          <span class="zone-tag">Authority</span>
          <div style="font-size: 12px; margin-bottom: 4px;">
            <strong>Profile:</strong> ${persona.stage1.profile}
          </div>
          <div style="font-size: 12px;">
            <strong>Buyer Style & Guide:</strong> ${persona.stage1.dialogueGuide}
          </div>
        </div>

        <div style="font-size: 12px; margin-bottom: 6px;">
          <strong>Time Limit:</strong> ${persona.stage1.timeConstraint}
        </div>
        <div style="font-size: 12px; margin-bottom: 12px;">
          <strong>Product Focus:</strong> ${persona.stage1.productFocus}
        </div>
        <div style="background: #f1f5f9; padding: 12px; border-radius: 6px; font-size: 12px; font-style: italic; border-left: 3px solid #cbd5e1;">
          <strong>Opening Cue:</strong> "${persona.stage1.openingStatement}"
        </div>
      </div>

      <!-- STAGE 2: DISCOVERY & ROI GRID -->
      <div class="blueprint-champ-zone" data-zone="money" style="margin-bottom: 20px; border-left: 4px solid var(--color-success); padding-left: 16px;">
        <span class="zone-tag">Money</span>
        <h4 style="font-size: 13px; font-weight: 700; color: var(--color-success); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
          Stage 2: Discovery and ROI Grid (Middle 6 Mins)
        </h4>
        <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left;">
              <th style="padding: 6px; font-weight: 700;">Customer Need</th>
              <th style="padding: 6px; font-weight: 700;">Product Feature</th>
              <th style="padding: 6px; font-weight: 700;">Math and Value</th>
            </tr>
          </thead>
          <tbody>
            ${persona.stage2.grid.map(row => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 6px; vertical-align: top; width: 33%;"><strong>${row.need.split(':')[0]}</strong>:${row.need.split(':')[1] || ''}</td>
                <td style="padding: 6px; vertical-align: top; width: 33%;"><strong>${row.feature.split(':')[0]}</strong>:${row.feature.split(':')[1] || ''}</td>
                <td style="padding: 6px; vertical-align: top; width: 33%; background: #f0fdf4;">${row.impact}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- STAGE 3: FRICTION & CLOSE -->
      <div class="blueprint-champ-zone" data-zone="prioritization" style="border-left: 4px solid var(--color-danger); padding-left: 16px; margin-bottom: 12px;">
        <span class="zone-tag">Priority</span>
        <h4 style="font-size: 13px; font-weight: 700; color: var(--color-danger); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
          Stage 3: Friction and Close (Last 2 Mins)
        </h4>
        <div style="font-size: 12px; margin-bottom: 8px;">
          <strong>Expected Objection:</strong> "${persona.stage3.expectedObjection}"
        </div>
        <div style="background: #fff5f5; padding: 12px; border-radius: 6px; font-size: 12px; border-left: 3px solid #fecaca; margin-bottom: 8px;">
          <strong style="display: block; margin-bottom: 4px; color: var(--color-danger);">Dialogue Path:</strong>
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${persona.stage3.dialoguePath.map(step => `
              <li style="margin-bottom: 4px;"><strong>${step.step}</strong> ${step.text}</li>
            `).join('')}
          </ul>
        </div>
        <div style="font-size: 12px; margin-bottom: 4px;">
          <strong>Target Commitment:</strong> ${persona.stage3.targetCommitment}
        </div>
        <div style="font-size: 12px; font-style: italic; margin-bottom: 8px;">
          <strong>Closing Cue:</strong> "${persona.stage3.closingStatement}"
        </div>
        <div style="background: #fffbeb; padding: 10px; border-radius: 6px; font-size: 11px; border: 1px dashed #fde68a;">
          <strong style="color: #b45309; display: block; margin-bottom: 4px;">Fails Matrix (0% Score):</strong>
          <ul style="margin: 0; padding-left: 14px;">
            ${persona.stage3.fails.map(fail => `
              <li style="margin-bottom: 2px;">${fail}</li>
            `).join('')}
          </ul>
        </div>
      </div>
    `;
  }

  function renderQuiz() {
    const questions = DRILL_QUESTIONS[state.personaId];
    if (!questions) return;

    const container = document.getElementById('quizContainer');
    container.innerHTML = questions.map((q, qIdx) => `
      <div class="quiz-question" id="quiz-q-${qIdx}">
        <div class="quiz-q-number">Question ${qIdx + 1} of ${questions.length}</div>
        <div class="quiz-q-text">${q.question}</div>
        <div class="quiz-options">
          ${q.options.map((opt, oIdx) => `
            <div class="quiz-option" data-question="${qIdx}" data-option="${oIdx}" onclick="window.__handleQuizClick(${qIdx}, ${oIdx})">
              <span class="radio"></span>
              <span>${opt}</span>
            </div>
          `).join('')}
        </div>
        <div class="quiz-feedback" id="feedback-${qIdx}"></div>
      </div>
    `).join('');
  }

  // ─── INTERACTIONS ───

  function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
      });
    });
  }

  function setupChampSelector() {
    document.querySelectorAll('.champ-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const champ = btn.dataset.champ;
        const wasActive = btn.classList.contains('active');

        // Toggle off all
        document.querySelectorAll('.champ-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.champ-detail').forEach(d => d.classList.remove('active'));
        document.querySelectorAll('.blueprint-champ-zone').forEach(z => z.classList.remove('glow'));

        if (!wasActive) {
          btn.classList.add('active');
          const detail = document.querySelector(`.champ-detail[data-champ-detail="${champ}"]`);
          if (detail) detail.classList.add('active');
          const zone = document.querySelector(`.blueprint-champ-zone[data-zone="${champ}"]`);
          if (zone) {
            zone.classList.add('glow');
            zone.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      });
    });
  }

  // Quiz click handler (global for inline onclick)
  window.__handleQuizClick = function (qIdx, oIdx) {
    if (state.answered.has(qIdx)) return;

    const questions = DRILL_QUESTIONS[state.personaId];
    const question = questions[qIdx];
    const selectedOpt = question.options[oIdx];
    const isCorrect = selectedOpt === question.answer;

    // Lock all options for this question
    const options = document.querySelectorAll(`.quiz-option[data-question="${qIdx}"]`);
    options.forEach(opt => opt.classList.add('locked'));

    // Mark selected
    const selectedEl = document.querySelector(`.quiz-option[data-question="${qIdx}"][data-option="${oIdx}"]`);

    if (isCorrect) {
      selectedEl.classList.add('correct');
      state.correctCount++;
      state.answered.add(qIdx);
      showFeedback(qIdx, true, 'Correct! You\'re locked in on this detail.');
    } else {
      selectedEl.classList.add('incorrect');
      // Show correct answer
      const correctIdx = question.options.indexOf(question.answer);
      document.querySelector(`.quiz-option[data-question="${qIdx}"][data-option="${correctIdx}"]`).classList.add('correct');
      state.answered.add(qIdx);
      showFeedback(qIdx, false, `Not quite. The correct answer is: ${question.answer}`);
    }

    updateProgress();
  };

  function showFeedback(qIdx, success, message) {
    const fb = document.getElementById(`feedback-${qIdx}`);
    fb.className = `quiz-feedback show ${success ? 'success' : 'error'}`;
    fb.textContent = message;
  }

  function updateProgress() {
    const total = DRILL_QUESTIONS[state.personaId].length;
    const pct = (state.correctCount / total) * 100;
    document.getElementById('progressFill').style.width = `${pct}%`;
    document.getElementById('progressText').textContent = `${state.correctCount} / ${total} correct`;

    if (state.correctCount === total) {
      unlockCompletion();
    }
  }

  function unlockCompletion() {
    const btn = document.getElementById('completeBtn');
    btn.classList.add('unlocked');
    btn.disabled = false;
    document.getElementById('statusText').textContent = 'All drills passed: ready to proceed!';

    btn.addEventListener('click', handleComplete);
  }

  async function handleComplete() {
    const btn = document.getElementById('completeBtn');
    btn.textContent = 'Submitting...';
    btn.disabled = true;

    try {
      const res = await fetch('/api/briefing/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.token}`,
        },
        body: JSON.stringify({
          scenarioId: state.scenarioId,
          moduleId: state.moduleId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${res.status}`);
      }

      state.completed = true;
      showSuccess();
    } catch (err) {
      console.error('Completion failed:', err);
      btn.textContent = 'Retry Submission';
      btn.disabled = false;
      btn.classList.add('unlocked');
    }
  }

  function showSuccess() {
    const overlay = document.getElementById('successOverlay');
    overlay.classList.add('show');
    document.getElementById('successTimestamp').textContent = `Completed: ${new Date().toLocaleString()}`;
    document.querySelector('.bottom-bar').style.display = 'none';

    // Confetti
    spawnConfetti();

    // Enter sim button
    document.getElementById('enterSimBtn').addEventListener('click', () => {
      const params = new URLSearchParams({
        token: state.token,
        scenarioId: state.scenarioId,
        userId: state.userId,
        moduleId: state.moduleId,
      });
      window.location.href = `/?${params.toString()}`;
    });
  }

  function spawnConfetti() {
    const container = document.getElementById('confettiContainer');
    const colors = ['#4f46e5', '#00e0b8', '#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#7c3aed', '#fde047'];

    for (let i = 0; i < 60; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.setProperty('--duration', `${1.5 + Math.random() * 2}s`);
      piece.style.animationDelay = `${Math.random() * 1}s`;
      piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      piece.style.width = `${6 + Math.random() * 8}px`;
      piece.style.height = `${6 + Math.random() * 8}px`;
      container.appendChild(piece);
    }
  }

  // ─── ERROR ───

  function showError(message) {
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('errorScreen').style.display = 'flex';
    document.getElementById('errorMessage').textContent = message;
  }

  // ─── BOOT ───

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
