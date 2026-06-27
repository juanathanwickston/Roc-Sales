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
        options: ['Analyzer', 'Supporter', 'Controller', 'Promoter'],
        answer: 'Controller',
      },
      {
        question: "How should you adapt your communication style to match Sam Patel's Controller profile?",
        options: [
          'Begin with friendly small talk to build personal rapport',
          'Keep it brief, speak peer-to-peer, and skip the small talk',
          'Conduct a long, feature-by-feature product presentation',
          'Use high-pressure closing tactics early in the conversation'
        ],
        answer: 'Keep it brief, speak peer-to-peer, and skip the small talk',
      },
      {
        question: "What is Sam Patel's primary operational bottleneck at QuickStop Market?",
        options: [
          'Delayed customer billing collections',
          'Managing credit card merchant chargebacks',
          'Long check-in lines at the front desk salon registry',
          'Manual price updates and spreadsheet-based inventory counts'
        ],
        answer: 'Manual price updates and spreadsheet-based inventory counts',
      },
      {
        question: "What recent event represents Sam Patel's highest urgency compliance risk?",
        options: [
          'A state tax compliance audit warning notice',
          'An EBT compliance warning notice for age-verification register errors',
          'A health department food safety warning notice',
          'A credit card network data breach warning notice'
        ],
        answer: 'An EBT compliance warning notice for age-verification register errors',
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
      videoUrl: '/handouts/sam_patel_briefing.mp4',
      transcript: 'Honestly? It’s just the constant firefighting. I’ve had the store for, what... eleven years now? And it feels like the back-office stuff just eats up my entire day. Like, pricing. It sounds simple, but we\'re constantly walking the aisles, checking tags, updating them by hand... it\'s a mess. And of course, we make mistakes. Then a customer gets to the register, the price doesn\'t match, they get annoyed... it\'s just a headache. And inventory is the same story. We’re still tracking everything on these giant spreadsheets. Half the time we do manual counts, we\'re either out of stock on what actually sells, or we\'re sitting on cases of stuff we can’t move. But really, the thing that’s keeping me up right now is... compliance. We actually got a warning letter recently about EBT and age verification. One of my cashiers made a mistake. If we lose our lottery or EBT license... I mean, that is a massive chunk of our foot traffic gone. I just... I don\'t have the time to sit down and fix the process, but I can\'t risk another audit either. It\'s just a grind.',
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
      videoUrl: '/handouts/carla_reyes_briefing.mp4',
      transcript: 'We’ve got six stylists renting booths here, and they\'re all independent, so they charge their own clients. But the checkout desk is just... chaos. One stylist uses Venmo, another wants cash, another has a personal card reader... it\'s a completely disjointed experience for clients. And when multiple clients finish their appointments at the same time, the reception area gets jammed and nobody knows who is paying who. Plus, at the end of every single day, I have to sit down and manually sort through all the receipts and transactions to calculate booth rent and payouts. It takes hours, and we still make accounting errors. I know we need a better system, but my stylists hate change. I\'m terrified that if I force a complicated payment terminal on them, they’ll get frustrated and leave. I need something collaborative, but it has to be simple.',
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
      videoUrl: '/handouts/mike_turner_briefing.mp4',
      transcript: 'Look, the plumbing side is fine. The headache is getting paid. Right now, my technicians are out in the field running three or four jobs a day. But they\'re plumbers, not salespeople. They walk away from jobs without collecting payment, or they take a paper check and it rolls around in the truck for a week. Then we write up paper invoices back at the office and mail them out. It takes two, sometimes three weeks for funds to clear. During the winter slow season, those cash flow gaps get really stressful. My office staff is constantly buried in manual invoicing and chasing down unpaid bills. I already use QuickBooks, but double-entry is killing our time. My guys aren\'t tech-savvy, so whatever app we use in the field has to be dead simple. Just tap three buttons and send the invoice.',
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
      videoUrl: '/handouts/david_miller_briefing.mp4',
      transcript: 'We have about 350 active members, and their generosity is wonderful. But weekly giving is so inconsistent. If a family misses a Sunday service because of travel or weather, our donations drop significantly. Right now, we collect everything via traditional envelopes, checks, and cash. It means our volunteers spend hours after service counting money and manually writing out tax receipts. They\'re burning out, and I hate to see that. We\'re currently fundraising to repair our community basketball court for the youth program, but tracking the campaign progress on paper envelopes is so slow. Younger families keep asking for digital options. I want to make giving easier for everyone, but it’s critical that it doesn\'t feel commercial or cold. Giving is a relational, spiritual act for us.',
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
    currentStep: 1,
    champReviewed: new Set(),
    quizCurrentQuestionIndex: 0,
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
 
    if (state.personaId === 'sam_patel') {
      const mainEl = document.getElementById('briefingMain');
      if (mainEl) mainEl.classList.add('wizard-layout');
      const appEl = document.getElementById('briefingApp');
      if (appEl) appEl.classList.add('wizard-mode');
      const container = document.getElementById('wizardContainer');
      if (container) container.style.display = 'block';
      renderWizard();
    } else {
      const appEl = document.getElementById('briefingApp');
      if (appEl) appEl.classList.remove('wizard-mode');
      renderDashboard();
    }
  }

  // ─── RENDER ───

  function renderDashboard() {
    const persona = PERSONA_DATA[state.personaId];

    // Hide loading, show app
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('briefingApp').style.display = 'block';

    // Header
    document.getElementById('headerPersonaName').textContent = `${persona.displayName} (${persona.product})`;

    // Render either the Video Player card (for Sam Patel) or standard Overview card (for the other personas)
    const dossierContainer = document.getElementById('dossierCardContainer');
    if (state.personaId === 'sam_patel') {
      dossierContainer.innerHTML = `
        <div class="card" style="padding: 0; overflow: hidden;">
          <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div>
              <h3 style="font-size: 15px; font-weight: 700; color: var(--color-text-main);" id="briefingVideoTitle">Pre-Call Research: Sam Patel</h3>
              <p style="font-size: 11px; color: var(--color-text-muted);" id="briefingVideoSubtitle">Recorded Discovery Interview • Owner & Operator, QuickStop Market</p>
            </div>
            <span class="behavioral-badge" id="behavioralStyleBadge" style="margin-top: 0; padding: 4px 12px; border-radius: 50px; font-size: 12px; font-weight: 600;">${persona.style} : ${persona.styleDesc}</span>
          </div>
          
          <div style="position: relative; width: 100%; background: #000; aspect-ratio: 16/9; display: flex; align-items: center; justify-content: center;">
            <video id="briefingVideo" controls style="width: 100%; height: 100%; object-fit: cover;">
              <source id="briefingVideoSource" src="${persona.videoUrl}" type="video/mp4">
              Your browser does not support the video tag.
            </video>
          </div>

          <div style="border-top: 1px solid var(--border-color); background: #f8fafc;">
            <button id="toggleTranscriptBtn" style="width: 100%; padding: 12px 20px; background: transparent; border: none; font-family: var(--font-family); font-size: 13px; font-weight: 600; color: var(--color-primary); cursor: pointer; text-align: left; display: flex; justify-content: space-between; align-items: center;">
              <span>Show Transcript</span>
              <span id="transcriptArrow">▼</span>
            </button>
            <div id="transcriptBody" style="display: none; padding: 0 20px 20px 20px; font-size: 13px; color: var(--color-text-muted); line-height: 1.6; border-top: 1px solid var(--border-color); background: #ffffff; max-height: 220px; overflow-y: auto;">
              <div style="display: flex; gap: 12px; margin-top: 12px;">
                <div style="width: 32px; height: 32px; border-radius: 50%; background: #001D4E; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0;">${persona.initials}</div>
                <div style="background: #f8fafc; border-radius: 0 12px 12px 12px; padding: 12px 16px; font-size: 13px; color: var(--color-text-main); line-height: 1.5; border: 1px solid var(--border-color);">
                  <div style="font-weight: 700; font-size: 11px; color: var(--color-text-muted); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">${persona.displayName} (Owner)</div>
                  "${persona.transcript}"
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      // Load research video and toggleable transcript
      const video = document.getElementById('briefingVideo');
      if (video) video.load();

      const transcriptBody = document.getElementById('transcriptBody');
      const toggleBtn = document.getElementById('toggleTranscriptBtn');
      const arrow = document.getElementById('transcriptArrow');

      if (toggleBtn && transcriptBody && arrow) {
        toggleBtn.onclick = () => {
          const isHidden = transcriptBody.style.display === 'none';
          transcriptBody.style.display = isHidden ? 'block' : 'none';
          toggleBtn.querySelector('span').textContent = isHidden ? 'Hide Transcript' : 'Show Transcript';
          arrow.textContent = isHidden ? '▲' : '▼';
        };
      }
    } else {
      // Standard overview layout for other 3 personas
      dossierContainer.innerHTML = `
        <div class="card">
          <div class="persona-profile">
            <div class="persona-avatar">${persona.initials || '?'}</div>
            <div class="persona-meta">
              <h2>${persona.displayName}</h2>
              <p>${persona.business}</p>
              <div class="behavioral-badge">
                <span>${persona.style} : ${persona.styleDesc}</span>
              </div>
            </div>
          </div>
          <div class="info-grid">
            ${persona.info.map(item => `
              <div class="info-item">
                <div class="info-label">${item.label}</div>
                <div class="info-value">${item.value}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

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

  // ─── WIZARD RENDER ───

  function renderWizard() {
    const persona = PERSONA_DATA[state.personaId];
    
    // Hide loading screen, show app
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('briefingApp').style.display = 'block';

    // Header
    document.getElementById('headerPersonaName').textContent = `${persona.displayName} (${persona.product})`;

    // Update HUD step indicators
    const hud = document.getElementById('wizardHud');
    if (hud) {
      hud.querySelectorAll('.hud-step').forEach(stepEl => {
        const stepNum = parseInt(stepEl.dataset.step, 10);
        stepEl.classList.remove('active', 'completed');
        if (stepNum === state.currentStep) {
          stepEl.classList.add('active');
        } else if (stepNum < state.currentStep) {
          stepEl.classList.add('completed');
        }
      });
    }

    // Render Step Content
    const container = document.getElementById('wizardContainer');
    let stepHtml = '';

    if (state.currentStep === 1) {
      stepHtml = `
        <div class="card" style="padding: 0; overflow: hidden; max-width: 960px; margin: 0 auto 16px auto;">
          <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div>
              <h3 style="font-size: 15px; font-weight: 700; color: var(--color-text-main);">Pre-Call Research: Sam Patel</h3>
              <p style="font-size: 11px; color: var(--color-text-muted);">Recorded Discovery Interview • Owner & Operator, QuickStop Market</p>
            </div>
          </div>
          
          <div style="position: relative; width: 100%; background: #000; aspect-ratio: 16/9; display: flex; align-items: center; justify-content: center;">
            <video id="briefingVideo" controls preload="metadata" style="width: 100%; height: 100%; object-fit: cover;">
              <source id="briefingVideoSource" src="${persona.videoUrl}" type="video/mp4">
              Your browser does not support the video tag.
            </video>
          </div>

          <div style="border-top: 1px solid var(--border-color); background: #f8fafc;">
            <button id="toggleTranscriptBtn" style="width: 100%; padding: 12px 20px; background: transparent; border: none; font-family: var(--font-family); font-size: 13px; font-weight: 600; color: var(--color-primary); cursor: pointer; text-align: left; display: flex; justify-content: space-between; align-items: center;">
              <span>Show Transcript</span>
              <span id="transcriptArrow">▼</span>
            </button>
            <div id="transcriptBody" style="display: none; padding: 0 20px 20px 20px; font-size: 13px; color: var(--color-text-muted); line-height: 1.6; border-top: 1px solid var(--border-color); background: #ffffff; max-height: 220px; overflow-y: auto;">
              <div style="display: flex; gap: 12px; margin-top: 12px;">
                <div style="width: 32px; height: 32px; border-radius: 50%; background: #001D4E; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0;">${persona.initials}</div>
                <div style="background: #f8fafc; border-radius: 0 12px 12px 12px; padding: 12px 16px; font-size: 13px; color: var(--color-text-main); line-height: 1.5; border: 1px solid var(--border-color);">
                  <div style="font-weight: 700; font-size: 11px; color: var(--color-text-muted); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">${persona.displayName} (Owner)</div>
                  "${persona.transcript}"
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (state.currentStep === 2) {
      stepHtml = `
        <div class="card" style="padding: 24px;">
          <div class="card-title" style="margin-bottom: 8px;">CHAMP Framework Explorer</div>
          <p style="font-size: 13px; color: var(--color-text-muted); margin-bottom: 20px;">
            Explore each pillar to map Sam's specific situation to our product features and financial ROI.
          </p>
          <div class="champ-selector" id="champSelector">
            <button class="champ-btn" data-champ="challenges"><span class="champ-letter">CH</span><span class="champ-label">Challenges</span></button>
            <button class="champ-btn" data-champ="authority"><span class="champ-letter">A</span><span class="champ-label">Authority</span></button>
            <button class="champ-btn" data-champ="money"><span class="champ-letter">M</span><span class="champ-label">Money</span></button>
            <button class="champ-btn" data-champ="prioritization"><span class="champ-letter">P</span><span class="champ-label">Prioritization</span></button>
          </div>
          <div id="champExplorerContent" style="margin-top: 24px;">
            <!-- Populated dynamically via JS -->
        </div>
      `;
    } else if (state.currentStep === 3) {
      stepHtml = `
        <div class="handout-snippet" style="margin: 0 auto;">
          <div class="handout-snippet-header" style="flex-shrink: 0;">
            <span>Playbook & Objection Handling Guidelines</span>
          </div>
          <div class="handout-snippet-body" style="padding: 24px 28px; display: flex; flex-direction: column; gap: 20px; box-sizing: border-box;">
            <!-- Row 1: Context & Objection -->
            <div style="display: grid; grid-template-columns: 1fr 1.2fr; gap: 24px; flex-shrink: 0;">
              <div>
                <div class="explorer-label">Buyer Behavioral Profile</div>
                <div class="explorer-value" style="font-size: 12.5px;">
                  Sam Patel is a <strong>Controller</strong> (skeptical, direct, impatient). He values speed, efficiency, and profit margins. He has zero tolerance for small talk.
                </div>
              </div>
              <div>
                <div class="explorer-label">Expected Objection</div>
                <div class="explorer-value" style="font-style: italic; font-weight: 500; font-size: 12.5px; border-left: 3px solid var(--border-color); padding-left: 10px;">
                  "${persona.stage3.expectedObjection}"
                </div>
              </div>
            </div>
            
            <!-- Row 2: Chronological Objection Handling Flow -->
            <div style="border-top: 1px solid var(--border-color); padding-top: 16px; display: flex; flex-direction: column; gap: 8px;">
              <div class="explorer-label">Tactical Objection Handling Flow</div>
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">
                <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px;">
                  <div style="font-weight: 700; font-size: 11px; text-transform: uppercase; color: #dc2626; letter-spacing: 0.3px;">1. Cushion</div>
                  <div style="font-size: 12px; font-weight: 500; color: var(--color-text-main);">"That's a fair concern."</div>
                  <div style="font-size: 11px; color: var(--color-text-muted);">Validate his concern immediately without pushing back or arguing.</div>
                </div>
                <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px;">
                  <div style="font-weight: 700; font-size: 11px; text-transform: uppercase; color: #2563eb; letter-spacing: 0.3px;">2. Probe</div>
                  <div style="font-size: 11.5px; font-weight: 500; color: var(--color-text-main); line-height: 1.3;">"What worries you most: downtime or learning curve?"</div>
                  <div style="font-size: 11px; color: var(--color-text-muted);">Clarify his underlying fear to target his specific concern.</div>
                </div>
                <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px;">
                  <div style="font-weight: 700; font-size: 11px; text-transform: uppercase; color: #16a34a; letter-spacing: 0.3px;">3. Respond</div>
                  <div style="font-size: 12px; font-weight: 500; color: var(--color-text-main);">Present Solid Math</div>
                  <div style="font-size: 11px; color: var(--color-text-muted);">Reference exact cost recovery: saving $9,360/year in wasted manual labor.</div>
                </div>
                <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px;">
                  <div style="font-weight: 700; font-size: 11px; text-transform: uppercase; color: #d97706; letter-spacing: 0.3px;">4. Confirm</div>
                  <div style="font-size: 11.5px; font-weight: 500; color: var(--color-text-main); line-height: 1.3;">"Does that address your concern?"</div>
                  <div style="font-size: 11px; color: var(--color-text-muted);">Check to confirm his objection is fully addressed before closing.</div>
                </div>
              </div>
            </div>

            <!-- Row 3: Next Step Commitment & Fails -->
            <div style="border-top: 1px solid var(--border-color); padding-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; flex-shrink: 0;">
              <div>
                <div class="explorer-label">Closing & Commitment (2-Option Close)</div>
                <div class="explorer-value" style="font-size: 12.5px;">
                  Target: ${persona.stage3.targetCommitment}<br>
                  <div style="margin-top: 6px; padding: 10px 14px; background: #f0f7ff; border-left: 3px solid var(--color-primary); border-radius: 4px; font-style: italic; font-weight: 500; line-height: 1.4;">
                    "${persona.stage3.closingStatement}"
                  </div>
                </div>
              </div>
              <div>
                <div class="explorer-label">Critical Guidelines & Instant Fails</div>
                <div style="font-size: 11.5px; color: var(--color-text-muted); display: flex; flex-direction: column; gap: 4px; line-height: 1.4;">
                  <div>• <strong>Product Focus:</strong> Pitch the software solution Bodega AI. Pitching standard CC terminals instead of Bodega AI is a failure.</div>
                  <div>• <strong>Reference Prior Connection:</strong> Establish continuity by referencing last week's discovery call. Do not treat it as a cold opening.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (state.currentStep === 4) {
      stepHtml = `
        <div class="card">
          <div class="card-title">Pre-call Knowledge Check</div>
          <p style="font-size: 13px; color: var(--color-text-muted); margin-bottom: 20px;">Complete the quiz to unlock your live simulation session.</p>
          <div class="drill-progress">
            <div class="drill-progress-bar"><div class="drill-progress-fill" id="progressFill"></div></div>
            <div class="drill-progress-text" id="progressText">0 / 4 correct</div>
          </div>
          <div id="quizContainer">
            <!-- Populated by JS -->
          </div>
        </div>
      `;
    }

    // Determine disabled states
    const isChampStep = state.currentStep === 2;
    const champCompleted = state.champReviewed.size === 4;
    const isQuizStep = state.currentStep === 4;
    const quizPassed = state.correctCount === DRILL_QUESTIONS[state.personaId].length;
    
    let isNextDisabled = false;
    if (isChampStep && !champCompleted) isNextDisabled = true;
    if (isQuizStep && !quizPassed) isNextDisabled = true;

    container.innerHTML = stepHtml;

    // Update Header Navigation buttons
    const backBtn = document.getElementById('wizardBackBtn');
    const nextBtn = document.getElementById('wizardNextBtn');
    const warningEl = document.getElementById('headerWizardWarning');

    if (backBtn && nextBtn) {
      backBtn.disabled = state.currentStep === 1;
      nextBtn.disabled = state.currentStep === 4 || isNextDisabled;
      nextBtn.textContent = 'Next Step →';

      if (warningEl) {
        warningEl.textContent = '';
        warningEl.style.display = 'none';
      }
    }

    // Bind event listeners for steps
    if (state.currentStep === 1) {
      // Bind toggleable transcript (video auto-loads via preload="metadata")

      const transcriptBody = document.getElementById('transcriptBody');
      const toggleBtn = document.getElementById('toggleTranscriptBtn');
      const arrow = document.getElementById('transcriptArrow');

      if (toggleBtn && transcriptBody && arrow) {
        toggleBtn.onclick = () => {
          const isHidden = transcriptBody.style.display === 'none';
          transcriptBody.style.display = isHidden ? 'block' : 'none';
          toggleBtn.querySelector('span').textContent = isHidden ? 'Hide Transcript' : 'Show Transcript';
          arrow.textContent = isHidden ? '▲' : '▼';
        };
      }
    } else if (state.currentStep === 2) {
      setupChampSelector();
      const firstActive = state.champReviewed.size > 0 ? Array.from(state.champReviewed)[state.champReviewed.size - 1] : 'challenges';
      const activeBtn = document.querySelector(`.champ-btn[data-champ="${firstActive}"]`);
      if (activeBtn) activeBtn.click();
    } else if (state.currentStep === 3) {
      renderPlaybook(persona);
    } else if (state.currentStep === 4) {
      renderQuiz();
    }

    // Bind Back / Next buttons
    document.getElementById('wizardBackBtn').onclick = handleWizardBack;
    document.getElementById('wizardNextBtn').onclick = handleWizardNext;
  }

  function handleWizardBack() {
    if (state.currentStep > 1) {
      state.currentStep--;
      renderWizard();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handleWizardNext() {
    if (state.currentStep < 4) {
      state.currentStep++;
      renderWizard();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Step 4 "Enter Simulation" acts as completion
      handleComplete();
    }
  }

  function renderChampExplorerContent(champKey) {
    const container = document.getElementById('champExplorerContent');
    if (!container) return;

    const persona = PERSONA_DATA[state.personaId];
    let html = '';

    if (champKey === 'challenges') {
      html = `
        <div class="champ-explorer-stack">
          <div class="champ-pillar-card">
            <div class="champ-detail-section">
              <div class="explorer-label">Pillar Focus</div>
              <div class="explorer-value">Identify core operational bottlenecks and compliance risks.</div>
            </div>
            
            <div class="champ-detail-section" style="border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 12px;">
              <div class="explorer-label">Sam Patel's Challenges</div>
              <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px;">
                <div>
                  <div style="font-weight: 700; font-size: 13px; color: var(--color-text-main);">Manual Aisle Walks</div>
                  <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">Staff checks and changes store price tags by hand, wasting hours of daily labor.</div>
                </div>
                <div>
                  <div style="font-weight: 700; font-size: 13px; color: var(--color-text-main);">Inventory Discrepancies & Stockouts</div>
                  <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">Uses basic spreadsheets for inventory, leading to frequent stockouts and revenue leakage.</div>
                </div>
                <div>
                  <div style="font-weight: 700; font-size: 13px; color: var(--color-text-main);">EBT Warning Letter & Compliance Risks</div>
                  <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">QuickStop received a compliance warning letter for register check errors. Sam's highest fear is losing his cash-flow lottery and EBT licenses.</div>
                </div>
                <div>
                  <div style="font-weight: 700; font-size: 13px; color: var(--color-text-main);">Missing Tobacco Rebates</div>
                  <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">QuickStop currently misses out on valuable manufacturer tobacco rebates because the store has no scan data reporting program.</div>
                </div>
              </div>
            </div>
            
            <div class="champ-strategy-box">
              <div class="explorer-label" style="color: var(--color-primary); margin-bottom: 4px;">Discovery Strategy</div>
              <div class="explorer-value" style="font-weight: 500;">Ask targeted discovery questions to confirm how much daily time and money these errors cost the store.</div>
            </div>
          </div>
        </div>
      `;
    } else if (champKey === 'authority') {
      html = `
        <div class="champ-explorer-stack">
          <div class="champ-pillar-card">
            <div class="champ-detail-section">
              <div class="explorer-label">Pillar Focus</div>
              <div class="explorer-value">Establish who holds final decision and buying power.</div>
            </div>
            
            <div class="champ-detail-section" style="border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 12px;">
              <div class="explorer-label">Sam Patel's Profile</div>
              <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px;">
                <div>
                  <div style="font-weight: 700; font-size: 13px; color: var(--color-text-main);">Sole Owner & Decision-Maker</div>
                  <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">Sam Patel is the sole owner and decision-maker of QuickStop Market (11 years in business). There are no other stakeholders.</div>
                </div>
                <div>
                  <div style="font-weight: 700; font-size: 13px; color: var(--color-text-main);">Controller Persona Style</div>
                  <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">Highly experienced local merchant who is direct, skeptical, impatient, and has zero interest in small talk. He will test you and call you out if you treat him like a cold lead.</div>
                </div>
              </div>
            </div>
            
            <div class="champ-strategy-box">
              <div class="explorer-label" style="color: var(--color-primary); margin-bottom: 4px;">Discovery Strategy</div>
              <div class="explorer-value" style="font-weight: 500;">Speak peer-to-peer. Keep dialogue conciseness high (maintain 50/50 balance) and respect his tight schedule. Skip the pitch; focus on confirmation.</div>
            </div>
          </div>
        </div>
      `;
    } else if (champKey === 'money') {
      html = `
        <div class="champ-explorer-stack">
          <div class="champ-pillar-card">
            <div class="champ-detail-section">
              <div class="explorer-label">Pillar Focus</div>
              <div class="explorer-value">Uncover financial constraints, margins, and cost implications.</div>
            </div>
            
            <div class="champ-detail-section" style="border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 12px;">
              <div class="explorer-label">Sam Patel's Constraints</div>
              <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px;">
                <div>
                  <div style="font-weight: 700; font-size: 13px; color: var(--color-text-main);">Thin Profit Margins</div>
                  <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">QuickStop operates on thin 2-5% profit margins, making cost control critical. Wasted labor is his largest cash drain.</div>
                </div>
                <div>
                  <div style="font-weight: 700; font-size: 13px; color: var(--color-text-main);">Wasted Labor Math</div>
                  <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">Pays 2 employees $15/hour who waste ~6 hours/week each on manual updates (Calculation: 2 × $15 × 6 = $180/week, or $9,360/year in wasted labor).</div>
                </div>
                <div>
                  <div style="font-weight: 700; font-size: 13px; color: var(--color-text-main);">Extreme Fee Sensitivity</div>
                  <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">Highly sensitive to credit card rates and skeptical of standard processing rate-saving pitches.</div>
                </div>
              </div>
            </div>
            
            <div class="champ-strategy-box">
              <div class="explorer-label" style="color: var(--color-primary); margin-bottom: 4px;">Discovery Strategy</div>
              <div class="explorer-value" style="font-weight: 500;">Lead with operational cost recovery and margin protection math rather than a simple processing rate pitch.</div>
            </div>
          </div>
        </div>
      `;
    } else if (champKey === 'prioritization') {
      html = `
        <div class="champ-explorer-stack">
          <div class="champ-pillar-card">
            <div class="champ-detail-section">
              <div class="explorer-label">Pillar Focus</div>
              <div class="explorer-value">Assess timeline and urgency of solving these problems.</div>
            </div>
            
            <div class="champ-detail-section" style="border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 12px;">
              <div class="explorer-label">Sam Patel's Urgency</div>
              <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px;">
                <div>
                  <div style="font-weight: 700; font-size: 13px; color: var(--color-text-main);">Consumed by Daily Operations</div>
                  <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">Sam is overwhelmed by daily operations and will not prioritize any system changes unless compliance warnings force him.</div>
                </div>
                <div>
                  <div style="font-weight: 700; font-size: 13px; color: var(--color-text-main);">EBT License Risk</div>
                  <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">Highest underlying fear is losing QuickStop's primary cash-flow licenses (EBT and lottery) due to manual register errors.</div>
                </div>
                <div>
                  <div style="font-weight: 700; font-size: 13px; color: var(--color-text-main);">10-Minute Call Limit</div>
                  <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">Sam is giving you exactly 10 minutes before his evening rush forces him to end the call. You must remain concise and on point.</div>
                </div>
              </div>
            </div>
            
            <div class="champ-strategy-box">
              <div class="explorer-label" style="color: var(--color-primary); margin-bottom: 4px;">Discovery Strategy</div>
              <div class="explorer-value" style="font-weight: 500;">Leverage the EBT audit warning and age verification risks to build immediate timeline urgency.</div>
            </div>
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
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
      <!-- SECTION 1: SCENARIO SETUP -->
      <div class="section">
        <div class="section-title">1. Scenario Setup</div>
        <div class="meta-grid">
          <div class="meta-item blueprint-champ-zone" data-zone="authority">
            <span class="zone-tag">Authority</span>
            <div class="meta-label">Buyer Profile</div>
            <div class="meta-value">${persona.stage1.profile}</div>
          </div>
          <div class="meta-item blueprint-champ-zone" data-zone="authority">
            <div class="meta-label">Buyer Style & Dialogue Guide</div>
            <div class="meta-value">${persona.stage1.dialogueGuide}</div>
          </div>
          <div class="meta-item blueprint-champ-zone" data-zone="prioritization">
            <span class="zone-tag">Prioritization</span>
            <div class="meta-label">Time Constraint</div>
            <div class="meta-value">${persona.stage1.timeConstraint}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Designated Product</div>
            <div class="meta-value">${persona.stage1.productFocus}</div>
          </div>
        </div>

        <div class="statement-block">
          <div class="statement-label">Opening Statement</div>
          <div class="statement-text">
            "${persona.stage1.openingStatement}"
          </div>
        </div>
      </div>

      <!-- SECTION 2: DISCOVERY & VALUE ALIGNMENT -->
      <div class="section">
        <div class="section-title">2. Discovery & Value Alignment</div>
        <table class="grid-table">
          <thead>
            <tr>
              <th style="width: 30%;">Customer Need <span>(When they say...)</span></th>
              <th style="width: 35%;">Product Feature <span>(We explain...)</span></th>
              <th style="width: 35%;">Value & Business Impact <span>(Which means...)</span></th>
            </tr>
          </thead>
          <tbody>
            ${persona.stage2.grid.map((row, idx) => {
              const needParts = row.need.split(':');
              const featureParts = row.feature.split(':');
              return `
                <tr>
                  <td class="blueprint-champ-zone" data-zone="challenges">
                    ${idx === 0 ? '<span class="zone-tag">Challenges</span>' : ''}
                    <strong>${needParts[0].trim()}</strong>
                    ${needParts[1] ? needParts[1].trim() : ''}
                  </td>
                  <td>
                    <strong>${featureParts[0].trim()}</strong>
                    ${featureParts[1] ? featureParts[1].trim() : ''}
                  </td>
                  <td class="blueprint-champ-zone" data-zone="money">
                    ${idx === 0 ? '<span class="zone-tag">Money</span>' : ''}
                    ${row.impact}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- SECTION 3: OBJECTION RESPONSE & NEXT STEPS -->
      <div class="section">
        <div class="section-title">3. Objection Response & Next Steps</div>
        <div class="row-split">
          <div class="column-block blueprint-champ-zone" data-zone="prioritization">
            <span class="zone-tag">Prioritization</span>
            <div class="column-title">Objection Response</div>
            <div class="detail-item">
              <span class="detail-label">Expected Objection</span>
              <div class="detail-value">"${persona.stage3.expectedObjection}"</div>
            </div>
            <div class="detail-item">
              <span class="detail-label" style="color: #2563eb;">Recommended Dialogue Path</span>
              <ul class="step-list">
                ${persona.stage3.dialoguePath.map(step => `
                  <li><strong>${step.step}</strong> ${step.text}</li>
                `).join('')}
              </ul>
            </div>
          </div>
          <div class="column-block blueprint-champ-zone" data-zone="prioritization">
            <div class="column-title">Next Steps</div>
            <div class="detail-item">
              <span class="detail-label">Target Commitment</span>
              <div class="detail-value">${persona.stage3.targetCommitment}</div>
            </div>
            <div class="detail-item">
              <span class="detail-label" style="color: #111827;">Closing Statement</span>
              <div class="detail-value" style="font-style: italic; font-weight: 500;">
                "${persona.stage3.closingStatement}"
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- SECTION 4: CRITICAL GUIDELINES -->
      <div class="section">
        <div class="section-title">4. Critical Guidelines</div>
        <div class="guideline-container">
          <div class="guideline-item">
            ${persona.personaId === 'sam_patel' ? 
              `<strong>Product Focus:</strong> Pitch the software solution Bodega AI. Pitching standard credit card terminals instead of Bodega AI is a failure. (Saying "Payroc" is acceptable, but you must focus on Bodega AI).` :
              persona.personaId === 'carla_reyes' ?
              `<strong>Product Focus:</strong> Pitch the multi-merchant terminal solution Roc Terminal+. Pitching standard retail terminals instead of Roc Terminal+ is a failure.` :
              persona.personaId === 'mike_turner' ?
              `<strong>Product Focus:</strong> Pitch the software solution Roc Services. Pitching standalone credit card terminals instead of Roc Services is a failure.` :
              `<strong>Product Focus:</strong> Pitch the software solution Roc Giving. Pitching standard retail terminals instead of Roc Giving is a failure.`}
          </div>
          <div class="guideline-item">
            <strong>Reference Prior Connection:</strong> Establish continuity by referencing the previous scheduled appointment. Do not open the call as a cold call.
          </div>
          <div class="guideline-item">
            <strong>Avoid Technical Jargon:</strong> Use simple, direct language. Do not reference internal sales framework terminology.
          </div>
          <div class="guideline-item">
            <strong>Objection Validation:</strong> Validate customer objections before responding. Do not argue or become defensive.
          </div>

          <table class="comparison-table">
            <thead>
              <tr>
                <th style="width: 50%;">DO THIS</th>
                <th style="width: 50%;">AVOID THIS</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Pitch ${persona.product}</td>
                <td>
                  ${persona.personaId === 'sam_patel' ? 'Pitching the wrong product' :
                    persona.personaId === 'carla_reyes' ? 'Pitching the wrong product (single-merchant terminals)' :
                    persona.personaId === 'mike_turner' ? 'Pitching the wrong product (standalone retail terminals)' :
                    'Pitching the wrong product (standard credit card terminals)'}
                </td>
              </tr>
              <tr>
                <td>
                  ${persona.personaId === 'sam_patel' ? 'Discuss audits, warning letters, and licensing risks' :
                    persona.personaId === 'carla_reyes' ? 'Discuss client checkout experience and receptionist relief' :
                    persona.personaId === 'mike_turner' ? 'Discuss mobile invoicing speed and QuickBooks integrations' :
                    'Discuss donor engagement, volunteer relief, and campaign metrics'}
                </td>
                <td>
                  ${persona.personaId === 'sam_patel' ? 'Using overly technical card processing or payment routing jargon' :
                    persona.personaId === 'carla_reyes' ? 'Using overly technical card processing or payment routing jargon' :
                    persona.personaId === 'mike_turner' ? 'Using overly technical software architecture or complex payment routing jargon' :
                    'Using overly technical financial transaction or complex merchant account jargon'}
                </td>
              </tr>
              <tr>
                <td>
                  ${persona.personaId === 'sam_patel' ? 'Validate and address objections' :
                    persona.personaId === 'carla_reyes' ? 'Validate and address objections collaboratively' :
                    persona.personaId === 'mike_turner' ? 'Validate and address objections directly and concisely' :
                    'Validate and address objections with warm empathy'}
                </td>
                <td>Arguing, getting defensive, or ignoring customer concerns</td>
              </tr>
              <tr>
                <td>Engage in two-way conversation and checkpoints</td>
                <td>Monologuing or speaking without checking for agreement from the buyer</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- SECTION 5: TRAINEE SELF-CHECK CHECKLIST -->
      <div class="section">
        <div class="section-title">5. Trainee Self-Check Checklist</div>
        <div class="checklist-card">
          <p class="checklist-intro">
            Reference while completing the simulation activity. Use this checklist as a self-assessment to ensure you have met all L&D guidelines and avoided critical pitfalls.
          </p>
          <ul class="checklist-list">
            <li class="checklist-item">
              <span class="checklist-checkbox"></span>
              <span class="checklist-text"><strong>Did you confirm their challenges early?</strong> Verified the three setup issues during your opening rather than jumping straight into a product pitch.</span>
            </li>
            <li class="checklist-item">
              <span class="checklist-checkbox"></span>
              <span class="checklist-text"><strong>Did you explain the concrete business benefits?</strong> Connected product features back to customer value (such as the specific labor or financial math).</span>
            </li>
            <li class="checklist-item">
              <span class="checklist-checkbox"></span>
              <span class="checklist-text"><strong>Did you keep the conversation balanced?</strong> Avoided long monologues by checking in after every 1-2 sentences to get confirmation from the buyer.</span>
            </li>
            <li class="checklist-item">
              <span class="checklist-checkbox"></span>
              <span class="checklist-text"><strong>Did you focus only on relevant features?</strong> Sticking strictly to the tools that solve their specific problems without dumping unrelated facts.</span>
            </li>
            <li class="checklist-item">
              <span class="checklist-checkbox"></span>
              <span class="checklist-text"><strong>Did you use the 4-step objection path?</strong> Validated their concern (Cushion) and asked a question to explore it before presenting a solution.</span>
            </li>
            <li class="checklist-item">
              <span class="checklist-checkbox"></span>
              <span class="checklist-text"><strong>Did you close with a scheduled next step?</strong> Secured a specific commitment for a 15-minute demo instead of leaving the follow-up vague.</span>
            </li>
          </ul>

          <div class="score-summary-box">
            <div>
              <h4 style="font-size: 14px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.5px;">Simulation Performance Summary</h4>
              <p style="font-size: 12px; color: #6b7280; margin-top: 4px;">To be completed by the trainee or evaluator after the session.</p>
            </div>
            <div style="display: flex; gap: 16px;">
              <div style="text-align: center; border: 1px solid #d1d5db; background-color: #ffffff; padding: 10px 16px; border-radius: 4px;">
                <span style="font-size: 10px; font-weight: 700; color: #4b5563; text-transform: uppercase; display: block; margin-bottom: 4px;">Total Score</span>
                <span style="font-size: 18px; font-weight: 800; color: #111827;">____ / 100</span>
              </div>
              <div style="text-align: center; border: 1px solid #d1d5db; background-color: #ffffff; padding: 10px 16px; border-radius: 4px;">
                <span style="font-size: 10px; font-weight: 700; color: #4b5563; text-transform: uppercase; display: block; margin-bottom: 4px;">Result</span>
                <span style="font-size: 14px; font-weight: 700; color: #111827;">PASS / RETRY</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderQuiz() {
    const questions = DRILL_QUESTIONS[state.personaId];
    if (!questions) return;

    const container = document.getElementById('quizContainer');
    if (!container) return;

    const qIdx = state.quizCurrentQuestionIndex || 0;
    const q = questions[qIdx];
    const isAnswered = state.answered.has(qIdx);

    container.innerHTML = `
      <div class="quiz-question show" id="quiz-q-${qIdx}" style="animation: fadeSlideIn var(--transition-fast) forwards; display: flex; flex-direction: column; gap: 16px;">
        <div class="quiz-q-number" style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted); letter-spacing: 0.5px;">Question ${qIdx + 1} of ${questions.length}</div>
        <div class="quiz-q-text" style="font-size: 15px; font-weight: 700; color: var(--color-text-main); margin-bottom: 4px; line-height: 1.4;">${q.question}</div>
        <div class="quiz-options" style="display: flex; flex-direction: column; gap: 10px;">
          ${q.options.map((opt, oIdx) => {
            let extraClass = '';
            if (isAnswered) {
              const isCorrectOpt = opt === q.answer;
              extraClass = isCorrectOpt ? ' correct locked' : ' locked';
            }
            return `
              <div class="quiz-option${extraClass}" data-question="${qIdx}" data-option="${oIdx}">
                <span class="radio"></span>
                <span style="font-size: 13px; line-height: 1.4;">${opt}</span>
              </div>
            `;
          }).join('')}
        </div>
        <div class="quiz-feedback" id="feedback-${qIdx}" style="min-height: 20px;"></div>
        <div id="quizActionContainer" style="display: flex; justify-content: flex-end; margin-top: 8px; min-height: 38px;">
          <!-- Populated dynamically with Next Question or Completion button -->
        </div>
      </div>
    `;

    // Bind event listeners
    container.querySelectorAll('.quiz-option').forEach(el => {
      el.addEventListener('click', () => {
        const oIdx = parseInt(el.dataset.option, 10);
        handleQuizClick(qIdx, oIdx);
      });
    });

    // If already answered, show feedback and actions
    if (isAnswered) {
      showFeedback(qIdx, true, "Correct! You're locked in on this detail.");
      renderQuizActionButton(qIdx, questions.length);
    }
  }

  function renderQuizActionButton(qIdx, totalQuestions) {
    const actionContainer = document.getElementById('quizActionContainer');
    if (!actionContainer) return;

    const isLast = qIdx + 1 === totalQuestions;
    if (isLast) {
      actionContainer.innerHTML = '';
      return;
    }

    actionContainer.innerHTML = `
      <button class="btn btn-primary" id="quizNextBtn" style="padding: 10px 20px; font-size: 13px; font-weight: 600; border-radius: 6px; cursor: pointer; transition: all var(--transition-fast);">
        Next Question →
      </button>
    `;

    document.getElementById('quizNextBtn').onclick = () => {
      state.quizCurrentQuestionIndex++;
      renderQuiz();
    };
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

        if (!wasActive) {
          document.querySelectorAll('.champ-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          if (state.personaId === 'sam_patel' && state.currentStep === 2) {
            state.champReviewed.add(champ);
            renderChampExplorerContent(champ);
            if (state.champReviewed.size === 4) {
              const nextBtn = document.getElementById('wizardNextBtn');
              if (nextBtn) {
                nextBtn.disabled = false;
                const warnText = nextBtn.previousElementSibling;
                if (warnText && warnText.tagName === 'SPAN') {
                  warnText.style.display = 'none';
                }
              }
            }
          } else {
            document.querySelectorAll('.champ-detail').forEach(d => d.classList.remove('active'));
            document.querySelectorAll('.blueprint-champ-zone').forEach(z => z.classList.remove('glow'));
            
            const detail = document.querySelector(`.champ-detail[data-champ-detail="${champ}"]`);
            if (detail) detail.classList.add('active');

            const zones = document.querySelectorAll(`.blueprint-champ-zone[data-zone="${champ}"]`);
            zones.forEach(z => z.classList.add('glow'));
            if (zones.length > 0) {
              zones[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        }
      });
    });
  }

  // Quiz click handler (local binding)
  function handleQuizClick(qIdx, oIdx) {
    if (state.answered.has(qIdx)) return;

    const questions = DRILL_QUESTIONS[state.personaId];
    const question = questions[qIdx];
    const selectedOpt = question.options[oIdx];
    const isCorrect = selectedOpt === question.answer;

    const options = document.querySelectorAll(`.quiz-option[data-question="${qIdx}"]`);
    options.forEach(opt => {
      opt.classList.remove('selected', 'incorrect');
    });

    const selectedEl = document.querySelector(`.quiz-option[data-question="${qIdx}"][data-option="${oIdx}"]`);

    if (isCorrect) {
      options.forEach(opt => opt.classList.add('locked'));
      selectedEl.classList.add('correct');
      state.correctCount++;
      state.answered.add(qIdx);
      showFeedback(qIdx, true, "Correct! You're locked in on this detail.");
      renderQuizActionButton(qIdx, questions.length);
    } else {
      selectedEl.classList.add('incorrect');
      showFeedback(qIdx, false, "Not quite. Try another option!");
    }

    updateProgress();
  }

  function showFeedback(qIdx, success, message) {
    const fb = document.getElementById(`feedback-${qIdx}`);
    if (!fb) return;
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
    document.getElementById('statusText').textContent = 'Knowledge check complete: ready to proceed!';

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

      // Close the window to return to the LMS
      window.close();

      // Fallback: if the browser blocks window.close(), show a message
      setTimeout(() => {
        btn.textContent = 'Briefing Complete';
        btn.disabled = true;
        document.getElementById('statusText').textContent = 'Briefing submitted successfully. You may close this tab to return to the LMS.';
      }, 500);
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
