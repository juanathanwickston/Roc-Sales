/**
 * module5_briefing_data.js: Module 5 Close-the-Sale Briefing Data
 * Contains UI_COPY, FRAMEWORK_SECTIONS, DRILL_QUESTIONS, PERSONA_DATA,
 * and FRAMEWORK_CONTENT for the Module 5 closing briefing.
 */

(function () {
  'use strict';

  // ─── MODULE 5 UI COPY (9 approved strings) ───

  const UI_COPY = {
    step1Heading: 'Pre-Close Preparation',
    step2HudLabel: 'Close Action Guide',
    step2CardTitle: 'Close Action Guide',
    step2CardSubtitle: 'Review the value already established, identify any remaining concerns, and prepare to ask for a clear buying commitment.',
    step3Header: 'Closing & Concern Handling Guidelines',
    step3CommitmentLabel: 'Direct Buying Commitment',
    strategyLabel: 'Closing Strategy',
    criticalGuidelinesLabel: 'Critical Closing Guidelines',
    continuityGuidance: 'Reference the Demonstration: Continue from the completed demonstration, reinforce the value already established, and address any remaining concerns before asking for the buying commitment.',
  };

  // ─── FRAMEWORK SECTIONS (6 Close Action Guide pillars) ───

  const FRAMEWORK_SECTIONS = [
    { key: 'stack_wins', letter: 'SW', label: 'Stack Wins' },
    { key: 'trial_close', letter: 'TC', label: 'Trial Close' },
    { key: 'buying_signals', letter: 'BS', label: 'Buying Signals' },
    { key: 'approved_closes', letter: 'AC', label: 'Approved Closes' },
    { key: 'resolve_and_test', letter: 'RT', label: 'Resolve & Test' },
    { key: 'direct_cta', letter: 'DC', label: 'Direct CTA' },
  ];

  // ─── QUIZ DATA (4 questions per persona) ───

  const DRILL_QUESTIONS = {
    sam_patel: [
      {
        question: 'What are Sam\u2019s main concerns after the Bodega AI demonstration?',
        options: [
          'Whether Bodega AI accepts enough payment types',
          'Whether the savings justify the cost and whether the transition could disrupt the store',
          'Whether his employees need new uniforms',
          'Whether Bodega AI can schedule employee shifts',
        ],
        answer: 'Whether the savings justify the cost and whether the transition could disrupt the store',
      },
      {
        question: 'Which closing approach best fits Sam\u2019s Controller style?',
        options: [
          'Use a long personal story and avoid discussing numbers',
          'Create urgency and pressure him to decide immediately',
          'Be concise, factual, specific, and prepared with measurable value',
          'Keep the conversation casual and avoid asking directly for a decision',
        ],
        answer: 'Be concise, factual, specific, and prepared with measurable value',
      },
      {
        question: 'What commitment should the rep secure during the closing conversation?',
        options: [
          'Agreement to schedule another Bodega AI demonstration',
          'Permission to call Sam again in several months',
          'Agreement to begin the Bodega AI application',
          'Agreement to review a standard terminal proposal',
        ],
        answer: 'Agreement to begin the Bodega AI application',
      },
      {
        question: 'Sam asks, \u201cWhat information do you need from me to get started?\u201d How should the rep respond?',
        options: [
          'Treat it as a buying signal, answer the question, and move toward beginning the application',
          'Restart discovery to confirm all of Sam\u2019s original problems',
          'Repeat the full Bodega AI presentation',
          'Offer to schedule another demonstration before discussing next steps',
        ],
        answer: 'Treat it as a buying signal, answer the question, and move toward beginning the application',
      },
    ],
    carla_reyes: [
      {
        question: 'What is Carla\u2019s main concern after the Roc Terminal+ demonstration?',
        options: [
          'Whether the terminal accepts mobile wallets',
          'Whether the stylists will feel comfortable with the change',
          'Whether the salon needs a second front desk',
          'Whether clients will still be able to leave tips',
        ],
        answer: 'Whether the stylists will feel comfortable with the change',
      },
      {
        question: 'Which closing approach best fits Carla\u2019s Supporter style?',
        options: [
          'Apply pressure and ask for an immediate decision',
          'Focus only on technical details and account routing',
          'Be calm, reassuring, and connect the solution to the team',
          'Avoid discussing the concern and move straight to the agreement',
        ],
        answer: 'Be calm, reassuring, and connect the solution to the team',
      },
      {
        question: 'What commitment should the trainee secure from Carla?',
        options: [
          'Agreement to schedule another Roc Terminal+ demonstration',
          'Agreement to move forward, sign the agreement, and begin setup',
          'Permission to contact each stylist before speaking with Carla again',
          'Agreement to test a standard single-merchant terminal',
        ],
        answer: 'Agreement to move forward, sign the agreement, and begin setup',
      },
      {
        question: 'Carla asks, \u201cWho will help my stylists learn the system?\u201d What should the trainee do next?',
        options: [
          'Treat it as a buying signal, answer the training question, confirm it is addressed, and move toward the commitment',
          'Restart discovery and ask Carla to explain the checkout problems again',
          'Repeat the full Roc Terminal+ demonstration',
          'Schedule another meeting before discussing training',
        ],
        answer: 'Treat it as a buying signal, answer the training question, confirm it is addressed, and move toward the commitment',
      },
    ],
    mike_turner: [
      {
        question: 'What is Mike\u2019s main concern after the Roc Services demonstration?',
        options: [
          'Whether Roc Services accepts ACH payments',
          'Whether his technicians will use it without feeling slowed down',
          'Whether the office needs a new accounting system',
          'Whether customers can receive printed receipts',
        ],
        answer: 'Whether his technicians will use it without feeling slowed down',
      },
      {
        question: 'Which closing approach best fits Mike\u2019s Doer style?',
        options: [
          'Use a long explanation and cover every product feature again',
          'Be direct, practical, and focused on the result',
          'Avoid asking for a decision until another meeting',
          'Focus mainly on building personal rapport before discussing the next step',
        ],
        answer: 'Be direct, practical, and focused on the result',
      },
      {
        question: 'What commitment should the trainee secure from Mike?',
        options: [
          'Agreement to schedule another Roc Services demonstration',
          'Permission to send more information for review',
          'Agreement to move forward, sign the agreement, and begin setup',
          'Agreement to test a standard payment terminal',
        ],
        answer: 'Agreement to move forward, sign the agreement, and begin setup',
      },
      {
        question: 'Mike asks, \u201cHow fast can we get the crew set up?\u201d What should the trainee do next?',
        options: [
          'Treat it as a buying signal, answer the question, confirm it is handled, and move toward the commitment',
          'Restart discovery and ask Mike to explain the billing problem again',
          'Repeat the full Roc Services demonstration',
          'Schedule another call before discussing setup',
        ],
        answer: 'Treat it as a buying signal, answer the question, confirm it is handled, and move toward the commitment',
      },
    ],
    david_miller: [
      {
        question: 'What is Pastor David\u2019s main concern after the Roc Giving demonstration?',
        options: [
          'Whether the basketball court campaign can accept large donations',
          'Whether digital giving will still feel personal and welcoming',
          'Whether the church needs a new accounting system',
          'Whether volunteers can use a standard payment terminal',
        ],
        answer: 'Whether digital giving will still feel personal and welcoming',
      },
      {
        question: 'Which closing approach best fits Pastor David\u2019s Talker-Supporter style?',
        options: [
          'Focus only on cost and agreement terms',
          'Use pressure and ask for an immediate decision',
          'Be warm, collaborative, and connect the solution to the church\u2019s mission and people',
          'Avoid asking for a commitment so the conversation stays comfortable',
        ],
        answer: 'Be warm, collaborative, and connect the solution to the church\u2019s mission and people',
      },
      {
        question: 'What commitment should the trainee secure from Pastor David?',
        options: [
          'Agreement to schedule another Roc Giving demonstration',
          'Permission to send more information to the church board',
          'Agreement to move forward, sign the agreement, and begin setup',
          'Agreement to test a standard payment terminal at one event',
        ],
        answer: 'Agreement to move forward, sign the agreement, and begin setup',
      },
      {
        question: 'Pastor David asks, \u201cCan members still give by cash or check?\u201d What should the trainee do next?',
        options: [
          'Treat it as a buying signal, answer the question, confirm the concern is addressed, and move toward the commitment',
          'Restart discovery and ask how members currently give',
          'Repeat the full Roc Giving demonstration',
          'Schedule another meeting before discussing traditional giving options',
        ],
        answer: 'Treat it as a buying signal, answer the question, confirm the concern is addressed, and move toward the commitment',
      },
    ],
  };

  // ─── PERSONA DISPLAY DATA ───

  const PERSONA_DATA = {
    sam_patel: {
      displayName: 'Sam Patel',
      initials: 'SP',
      business: 'QuickStop Market : Independent Convenience Store',
      subtitle: 'Recorded Closing Preparation \u2022 Owner, QuickStop Market',
      location: 'Suburban Michigan',
      style: 'Controller',
      styleDesc: 'Analytical, efficient, highly skeptical',
      product: 'Bodega AI',
      segment: 'Convenience / Bodega',
      videoUrl: '/handouts/Close%20the%20Sale/sam_patel_briefing.mp4',
      behavioralProfile: 'Sam is a <strong>Controller</strong>. He makes deliberate, logical decisions based on clear facts, measurable value, and operational risk. Keep the close concise, use the numbers already established, answer his concern directly, and avoid pressure or long explanations.',
      productFocusGuideline: 'Close Sam on Bodega AI. Attempting to close him on a standard terminal or any other product is a failure.',
      objectionFlow: [
        { label: 'Cushion', color: '#dc2626', quote: '\u201cThat is a fair concern. You should be able to see a clear return and know the change will not create problems for the store.\u201d', desc: '' },
        { label: 'Probe', color: '#2563eb', quote: '\u201cIs the bigger concern the total investment, or how the changeover could affect your operation?\u201d', desc: '' },
        { label: 'Respond', color: '#16a34a', quote: 'Connect the investment to the approximately $9,360 per year spent on manual pricing work. Reinforce the added value of fewer pricing errors, better inventory visibility, fewer stockouts, tobacco rebate opportunities, and lower compliance risk.', desc: '' },
        { label: 'Confirm', color: '#d97706', quote: '\u201cIf the numbers make sense and we can handle the transition without disrupting the store, would you be comfortable moving forward with the application?\u201d', desc: '' },
      ],
      transcript: 'That demonstration gave me a much clearer picture of how Bodega AI could help the store. I can see the value in reducing the manual pricing work, improving inventory control, and lowering some of the compliance risk. What I still need to understand is whether the savings justify the investment and whether the transition can happen without disrupting the business.',
      info: [
        { label: 'Industry', value: 'Convenience Store' },
        { label: 'Product Fit', value: 'Bodega AI' },
        { label: 'Behavioral Style', value: 'Controller' },
        { label: 'Risk Level', value: 'High Skepticism' },
      ],
      stage3: {
        expectedObjection: 'I can see how Bodega AI would help, but I need to know that the savings justify the cost and that changing systems will not disrupt the store.',
        targetCommitment: 'Secure Sam\u2019s agreement to move forward with Bodega AI and begin the application.',
        closingStatement: 'Sam, Bodega AI addresses the manual pricing cost, inventory problems, and compliance risk we discussed. May we begin the Bodega AI application today?',
      },
    },
    carla_reyes: {
      displayName: 'Carla Reyes',
      initials: 'CR',
      business: 'Studio Collective Salon : Multi-booth Beauty Salon',
      subtitle: 'Recorded Closing Preparation \u2022 Owner, Studio Collective Salon',
      location: 'Denver, Colorado',
      style: 'Supporter',
      styleDesc: 'Relationship-driven, warm, collaborative, cautious of disruption',
      product: 'Roc Terminal+',
      segment: 'Beauty / Salon',
      videoUrl: '/handouts/Close%20the%20Sale/carla_reyes_briefing.mp4',
      behavioralProfile: 'Carla is a <strong>Supporter</strong>. She is warm, relationship-driven, and careful about changes that could create stress for her team. Keep the close calm and collaborative, address the team concern directly, and show how Roc Terminal+ supports the stylists, the front desk, and the client experience.',
      productFocusGuideline: 'Close Carla on Roc Terminal+. Attempting to close her on a standard single-merchant terminal or another product is a failure.',
      objectionFlow: [
        { label: 'Cushion', color: '#dc2626', quote: '\u201cThat makes sense. You want the system to make things easier without creating stress for the team.\u201d', desc: '' },
        { label: 'Probe', color: '#2563eb', quote: '\u201cIs the bigger concern learning the system, or how the stylists will react to changing the checkout process?\u201d', desc: '' },
        { label: 'Respond', color: '#16a34a', quote: 'Explain that each stylist can be set up separately, the daily checkout process is simple, and the team can be supported through training and setup. Connect the change to less front-desk confusion, cleaner reporting, separate stylist deposits, and a better client experience.', desc: '' },
        { label: 'Confirm', color: '#d97706', quote: '\u201cIf we can keep the setup simple and make sure the stylists are supported, would you feel comfortable moving forward with Roc Terminal+?\u201d', desc: '' },
      ],
      transcript: 'That demonstration helped me see how Roc Terminal+ could make checkout easier for our clients, reduce the confusion at the front desk, and keep each stylist\u2019s payments separate. I also liked how it could simplify the reporting at the end of the day. My main concern is making sure the team feels comfortable with the change and does not feel like a new system is being forced on them.',
      info: [
        { label: 'Industry', value: 'Beauty Salon' },
        { label: 'Product Fit', value: 'Roc Terminal+' },
        { label: 'Behavioral Style', value: 'Supporter' },
        { label: 'Team Size', value: '6 Booth Renters' },
      ],
      stage3: {
        expectedObjection: 'I like what I saw, but I am worried some of the stylists will resist the change or feel like a new system is being forced on them.',
        targetCommitment: 'Secure Carla\u2019s agreement to move forward with Roc Terminal+, sign the agreement, and begin setting up the salon and stylist accounts.',
        closingStatement: 'Carla, this gives the salon one professional checkout experience, keeps each stylist\u2019s funds separate, and takes pressure off the front desk. Are you comfortable moving forward with Roc Terminal+ and getting the agreement started?',
      },
    },
    mike_turner: {
      displayName: 'Mike Turner',
      initials: 'MT',
      business: 'Precision Plumbing & Drain : Residential Plumbing',
      subtitle: 'Recorded Closing Preparation \u2022 Owner, Precision Plumbing & Drain',
      location: 'Columbus, Ohio',
      style: 'Doer',
      styleDesc: 'Fast-paced, direct, results-oriented, highly impatient',
      product: 'Roc Services',
      segment: 'Field Services / Plumbing',
      videoUrl: '/handouts/Close%20the%20Sale/mike_turner_briefing.mp4',
      behavioralProfile: 'Mike is a <strong>Doer</strong>. He is direct, practical, and focused on results. Keep the close brief, answer his concern clearly, and connect Roc Services to faster collections, less paperwork, and an easier process for his technicians.',
      productFocusGuideline: 'Close Mike on Roc Services. Attempting to close him on a standard terminal or another product is a failure.',
      objectionFlow: [
        { label: 'Cushion', color: '#dc2626', quote: '\u201cThat is fair. If the crew will not use it, it does not solve anything.\u201d', desc: '' },
        { label: 'Probe', color: '#2563eb', quote: '\u201cIs the concern the number of steps in the app, or getting the crew trained and using it on every job?\u201d', desc: '' },
        { label: 'Respond', color: '#16a34a', quote: 'Bring Mike back to the simple field process shown in the demonstration. The technician opens the job, sends the invoice, and collects payment before leaving. The office receives the information without retyping paperwork. Answer any cost, training, or setup question directly.', desc: '' },
        { label: 'Confirm', color: '#d97706', quote: '\u201cIf we can keep this simple for your technicians, would you be comfortable moving forward with the setup?\u201d', desc: '' },
      ],
      transcript: 'That demo made the value pretty clear. I can see how Roc Services could help my technicians invoice and collect before they leave the job, while cutting down the paperwork in the office. My main concern is whether the guys will actually use it without feeling like it slows them down or makes their day more complicated.',
      info: [
        { label: 'Industry', value: 'Plumbing Services' },
        { label: 'Product Fit', value: 'Roc Services' },
        { label: 'Behavioral Style', value: 'Doer' },
        { label: 'Fleet Size', value: '4 Trucks, 4 Techs' },
      ],
      stage3: {
        expectedObjection: 'I can see the value, but my guys are plumbers, not tech people. I do not want to pay for something they are going to complain about and refuse to use.',
        targetCommitment: 'Secure Mike\u2019s agreement to move forward with Roc Services, sign the agreement, and start the setup for his team.',
        closingStatement: 'Mike, this gives your guys a simple way to invoice and collect before they leave the job, and it gets the paperwork off your office staff. Let\u2019s get the agreement completed and start the setup. Are you ready to move forward?',
      },
    },
    david_miller: {
      displayName: 'Pastor David Miller',
      initials: 'DM',
      business: 'New Hope Community Church : Church & Nonprofit',
      subtitle: 'Recorded Closing Preparation \u2022 Pastor, New Hope Community Church',
      location: 'Western Pennsylvania',
      style: 'Talker-Supporter Hybrid',
      styleDesc: 'Warm, relational, deeply mission-focused',
      product: 'Roc Giving',
      segment: 'Church / Nonprofit',
      videoUrl: '/handouts/Close%20the%20Sale/david_miller_briefing.mp4',
      behavioralProfile: 'Pastor David is a <strong>Talker-Supporter Hybrid</strong>. He is warm, community-focused, and guided by relationships and mission. Keep the close collaborative, connect Roc Giving to the church\u2019s people and programs, and make sure the giving experience still feels personal and welcoming.',
      productFocusGuideline: 'Close Pastor David on Roc Giving. Attempting to close him on a standard payment terminal or another product is a failure.',
      objectionFlow: [
        { label: 'Cushion', color: '#dc2626', quote: '\u201cI understand. Giving should still feel connected to the church, the mission, and the people.\u201d', desc: '' },
        { label: 'Probe', color: '#2563eb', quote: '\u201cIs the bigger concern how the digital experience will feel, or making sure traditional giving options remain available?\u201d', desc: '' },
        { label: 'Respond', color: '#16a34a', quote: 'Explain that Roc Giving can reflect New Hope\u2019s message, imagery, and basketball court campaign while cash and checks remain available. Connect the solution to more consistent giving, easier campaign participation, less manual work for volunteers, and a giving experience that still feels connected to the church.', desc: '' },
        { label: 'Confirm', color: '#d97706', quote: '\u201cIf we can keep the experience personal and continue supporting the way members already give, would you feel comfortable moving forward with Roc Giving?\u201d', desc: '' },
      ],
      transcript: 'That demonstration gave me a much clearer picture of how Roc Giving could support our church. I liked the recurring giving options, the basketball court campaign tools, and the way it could take some of the administrative work off our volunteers. I am encouraged by what I saw. I just want to make sure the giving experience still feels personal and welcoming for everyone in the church.',
      info: [
        { label: 'Organization', value: 'Church & Nonprofit' },
        { label: 'Product Fit', value: 'Roc Giving' },
        { label: 'Behavioral Style', value: 'Talker-Supporter Hybrid' },
        { label: 'Congregation', value: '~350 Active Members' },
      ],
      stage3: {
        expectedObjection: 'I like what I saw, but I want to make sure digital giving still feels personal. I do not want members who prefer cash or checks to feel pushed aside.',
        targetCommitment: 'Secure Pastor David\u2019s agreement to move forward with Roc Giving, sign the agreement, and begin setting up the church giving experience and basketball court campaign.',
        closingStatement: 'Pastor David, Roc Giving gives New Hope a more consistent way to support the ministry, helps the basketball court campaign reach more people, and takes work off the volunteers. Are you comfortable moving forward and getting the agreement started?',
      },
    },
  };

  // ─── FRAMEWORK CONTENT (per-persona, per-pillar) ───

  const FRAMEWORK_CONTENT = {
    sam_patel: {
      stack_wins: {
        pillarFocus: 'Reinforce the value Sam already saw during the completed demonstration.',
        sectionLabel: 'Key Wins to Reference',
        items: [
          { title: 'Manual Pricing Labor', desc: 'Two employees spend enough time on manual price updates to cost the business approximately $9,360 per year.' },
          { title: 'Inventory and Margin Control', desc: 'Better inventory visibility can reduce stockouts, pricing errors, and lost sales.' },
          { title: 'Rebates and Compliance', desc: 'Scan-data reporting can support tobacco rebate opportunities, while stronger controls can reduce age-verification and EBT compliance risk.' },
        ],
        discoveryStrategy: 'Lead with the measurable business case and connect each win to cost control, margin protection, or operational risk.',
      },
      trial_close: {
        pillarFocus: 'Ask for Sam\u2019s opinion to gauge readiness and identify what concerns remain.',
        sectionLabel: 'Readiness Questions',
        items: [
          { title: 'Solution Fit', desc: '\u201cFrom what you saw, does Bodega AI solve the pricing, inventory, and compliance problems we discussed?\u201d' },
          { title: 'Remaining Concern', desc: '\u201cAre there any additional concerns we should discuss before moving forward?\u201d' },
          { title: 'Value Check', desc: '\u201cDoes the value we reviewed justify making the change?\u201d' },
        ],
        discoveryStrategy: 'Ask one clear question at a time, listen to the answer, and use his response to decide whether to resolve a concern or move to the close. Trial closing questions should ask for an opinion, not a final decision.',
      },
      buying_signals: {
        pillarFocus: 'Recognize when Sam\u2019s questions or behavior show that he is considering the purchase.',
        sectionLabel: 'Signals to Watch For',
        items: [
          { title: 'Cost and Agreement Questions', desc: 'Sam asks about the total investment, agreement terms, or what is included.' },
          { title: 'Implementation Questions', desc: 'Sam asks about setup, training, timing, or how the changeover will work.' },
          { title: 'Next-Step Questions', desc: 'Sam asks what information is needed, when the process can begin, or what happens after the application.' },
        ],
        discoveryStrategy: 'Answer the question directly, confirm that it is addressed, and move the conversation toward the buying commitment instead of returning to the presentation. Questions about price, implementation, training, timing, and next steps are buying signals in this scenario.',
      },
      approved_closes: {
        pillarFocus: 'Use a clear closing method that fits Sam\u2019s deliberate and logical decision style.',
        sectionLabel: 'Closing Methods to Use',
        items: [
          { title: 'Summary Close', desc: 'Briefly recap the strongest business outcomes, then ask for the decision.' },
          { title: 'Incremental Close', desc: 'Gain agreement that the solution fits, the value justifies the investment, and the transition concern has been answered.' },
          { title: 'If-Then Close', desc: '\u201cIf the labor savings and margin protection justify the investment, and we can handle the transition without disrupting the store, is there anything else that would stop this from moving forward?\u201d' },
        ],
        discoveryStrategy: 'Keep the close factual and confident. Build agreement in small steps, then ask directly for the business.',
      },
      resolve_and_test: {
        pillarFocus: 'Address any final hesitation, confirm the concern is answered, and test whether another blocker remains.',
        sectionLabel: 'Final Concerns to Resolve',
        items: [
          { title: 'Clarify the Blocker', desc: 'Find out whether the real issue is cost, return, implementation, training, or another approval.' },
          { title: 'Confirm Resolution', desc: 'Ask, \u201cDoes that answer your concern about the return and the transition?\u201d' },
          { title: 'Test Intent', desc: 'Ask, \u201cIf we address that concern, is there anything else that would stop you from moving forward?\u201d' },
        ],
        discoveryStrategy: 'Do not assume the concern is resolved. Confirm the answer, use an If-Then question to uncover hidden blockers, and then move back to the commitment.',
      },
      direct_cta: {
        pillarFocus: 'Ask Sam for a clear buying commitment that defines what happens next.',
        sectionLabel: 'Final Ask',
        items: [
          { title: 'Primary Ask', desc: '\u201cSam, may we begin the Bodega AI application today?\u201d' },
          { title: 'Clear Next Action', desc: 'If Sam agrees, move directly to the information or authorization needed to start the application.' },
          { title: 'No Extra Demo', desc: 'Do not offer another demonstration or end with a vague follow-up.' },
        ],
        discoveryStrategy: 'Ask the question clearly, stop talking, and give Sam time to answer. A successful close asks for a commitment to an actionable next step.',
      },
    },
    carla_reyes: {
      stack_wins: {
        pillarFocus: 'Reinforce the value Carla already saw during the completed demonstration.',
        sectionLabel: 'Key Wins to Reference',
        items: [
          { title: 'One Checkout Experience', desc: 'Clients can complete checkout in one place instead of dealing with different apps or payment methods.' },
          { title: 'Separate Stylist Deposits', desc: 'Each stylist\u2019s payments stay separate and go to the correct account.' },
          { title: 'Less Front-Desk Work', desc: 'Simpler reporting and fewer manual reconciliation problems reduce stress at the end of the day.' },
        ],
        discoveryStrategy: 'Connect the value to Carla\u2019s team, the client experience, and a smoother daily process.',
      },
      trial_close: {
        pillarFocus: 'Ask for Carla\u2019s opinion to find out whether she is ready and what concern remains.',
        sectionLabel: 'Readiness Questions',
        items: [
          { title: 'Solution Fit', desc: '\u201cFrom what you saw, does Roc Terminal+ solve the checkout and reconciliation problems we discussed?\u201d' },
          { title: 'Team Comfort', desc: '\u201cHow do you feel the team would respond if the setup and training were handled carefully?\u201d' },
          { title: 'Remaining Concern', desc: '\u201cWhat would you still need to feel comfortable moving forward?\u201d' },
        ],
        discoveryStrategy: 'Ask one question at a time, listen carefully, and use Carla\u2019s answer to decide whether to resolve a concern or move to the close.',
      },
      buying_signals: {
        pillarFocus: 'Recognize questions or comments that show Carla is thinking about moving forward.',
        sectionLabel: 'Signals to Watch For',
        items: [
          { title: 'Training Questions', desc: 'Carla asks who will train the team or how the stylists will learn the system.' },
          { title: 'Setup Questions', desc: 'Carla asks how each stylist account is created, how long setup takes, or whether the rollout can happen gradually.' },
          { title: 'Next-Step Questions', desc: 'Carla asks what information is needed, what the agreement includes, or what happens next.' },
        ],
        discoveryStrategy: 'Answer the question, confirm it is addressed, and move toward the buying commitment instead of returning to the full presentation.',
      },
      approved_closes: {
        pillarFocus: 'Use closing methods that feel supportive, clear, and low pressure.',
        sectionLabel: 'Closing Methods to Use',
        items: [
          { title: 'Summary Close', desc: 'Recap the smoother checkout, separate deposits, simpler reporting, and less front-desk stress before asking for the decision.' },
          { title: 'Incremental Close', desc: 'Confirm that the solution helps clients, the front desk, and the stylists before asking Carla to move forward.' },
          { title: 'If-Then Close', desc: '\u201cIf we can make the setup simple, give the stylists clear training, and keep each person\u2019s payments separate, is there anything else that would stop you from moving forward?\u201d' },
        ],
        discoveryStrategy: 'Build agreement around the team benefits, then make a direct ask in a calm and reassuring way.',
      },
      resolve_and_test: {
        pillarFocus: 'Address Carla\u2019s concern about team adoption and find out whether any other blocker remains.',
        sectionLabel: 'Final Concerns to Resolve',
        items: [
          { title: 'Clarify the Real Concern', desc: 'Find out whether Carla is more worried about learning the system or the team\u2019s reaction to the change.' },
          { title: 'Confirm Support', desc: 'Explain how separate account setup, training, and a clear rollout can help the team feel comfortable.' },
          { title: 'Test Intent', desc: 'Ask, \u201cIf the team is supported through the change, is there anything else that would stop you from moving forward?\u201d' },
        ],
        discoveryStrategy: 'Confirm that Carla\u2019s concern has been answered before asking for the agreement.',
      },
      direct_cta: {
        pillarFocus: 'Ask Carla for a clear buying commitment and define the next step.',
        sectionLabel: 'Final Ask',
        items: [
          { title: 'Primary Ask', desc: '\u201cCarla, are you comfortable moving forward with Roc Terminal+?\u201d' },
          { title: 'Agreement Ask', desc: '\u201cCan we get the agreement completed and begin setting up the salon and stylist accounts?\u201d' },
          { title: 'Next Action', desc: 'After Carla agrees, move directly to the salon information, stylist account setup, and training plan.' },
        ],
        discoveryStrategy: 'Ask clearly, give Carla time to answer, and do not end with another demo or a vague follow-up.',
      },
    },
    mike_turner: {
      stack_wins: {
        pillarFocus: 'Reinforce the practical value Mike already saw during the completed demonstration.',
        sectionLabel: 'Key Wins to Reference',
        items: [
          { title: 'Faster Field Collection', desc: 'Technicians can create the invoice and collect card or ACH payment before leaving the job.' },
          { title: 'Shorter Billing Delays', desc: 'Roc Services can reduce the two-to-three-week delay caused by paper invoices and checks.' },
          { title: 'Less Office Work', desc: 'QuickBooks sync reduces duplicate entry and cuts down on paperwork for the office staff.' },
        ],
        discoveryStrategy: 'Keep the recap short and connect each win to faster cash flow, less paperwork, or a simpler field process.',
      },
      trial_close: {
        pillarFocus: 'Ask for Mike\u2019s opinion to find out whether the solution fits and what concern remains.',
        sectionLabel: 'Readiness Questions',
        items: [
          { title: 'Field Fit', desc: '\u201cFrom what you saw, does Roc Services give your guys a practical way to invoice and collect before they leave the job?\u201d' },
          { title: 'Crew Adoption', desc: '\u201cDo you feel the field process is simple enough for the crew to use on every job?\u201d' },
          { title: 'Remaining Concern', desc: '\u201cWhat, if anything, would keep you from moving ahead today?\u201d' },
        ],
        discoveryStrategy: 'Ask one direct question at a time, listen to the answer, and move quickly to the next step.',
      },
      buying_signals: {
        pillarFocus: 'Recognize questions that show Mike is thinking about cost, setup, and getting started.',
        sectionLabel: 'Signals to Watch For',
        items: [
          { title: 'Cost Questions', desc: 'Mike asks what Roc Services will cost each month or what is included.' },
          { title: 'Setup and Training Questions', desc: 'Mike asks how fast the crew can be set up or how much training they need.' },
          { title: 'Next-Step Questions', desc: 'Mike asks how quickly he gets paid, what information is needed, or what happens next.' },
        ],
        discoveryStrategy: 'Answer the question directly, confirm it is handled, and move toward the buying commitment.',
      },
      approved_closes: {
        pillarFocus: 'Use clear, practical closing methods that fit Mike\u2019s Doer style.',
        sectionLabel: 'Closing Methods to Use',
        items: [
          { title: 'Summary Close', desc: 'Recap faster collections, less paperwork, and less office re-entry, then ask for the decision.' },
          { title: 'Incremental Close', desc: 'Confirm that the field process fits, the crew can use it, and the cash flow benefit matters before asking Mike to move forward.' },
          { title: 'If-Then Close', desc: '\u201cMike, if we can keep this simple for your technicians, is there anything else that would stop you from moving forward today?\u201d' },
        ],
        discoveryStrategy: 'Be direct, keep the pace moving, and do not bury Mike in details he already heard.',
      },
      resolve_and_test: {
        pillarFocus: 'Address Mike\u2019s concern about technician adoption and find out whether another blocker remains.',
        sectionLabel: 'Final Concerns to Resolve',
        items: [
          { title: 'Clarify the Concern', desc: 'Find out whether the real issue is the number of steps, training, cost, or setup timing.' },
          { title: 'Confirm the Answer', desc: 'Ask, \u201cDoes that address the crew adoption concern?\u201d' },
          { title: 'Test Intent', desc: 'Ask, \u201cIf we can keep this simple for your technicians, is there anything else that would stop you from moving forward today?\u201d' },
        ],
        discoveryStrategy: 'Resolve the concern, confirm it is answered, and move straight back to the commitment.',
      },
      direct_cta: {
        pillarFocus: 'Ask Mike for a clear buying commitment and begin the setup process.',
        sectionLabel: 'Final Ask',
        items: [
          { title: 'Primary Ask', desc: '\u201cMike, are you ready to move forward with Roc Services?\u201d' },
          { title: 'Agreement Ask', desc: '\u201cLet\u2019s get the agreement completed and start the setup for your team.\u201d' },
          { title: 'Next Action', desc: 'After Mike agrees, collect the account information and begin onboarding.' },
        ],
        discoveryStrategy: 'Ask clearly, stop talking, and give Mike time to answer.',
      },
    },
    david_miller: {
      stack_wins: {
        pillarFocus: 'Reinforce the value Pastor David already saw during the completed demonstration.',
        sectionLabel: 'Key Wins to Reference',
        items: [
          { title: 'More Consistent Giving', desc: 'Recurring giving helps members continue supporting the church when they miss a service.' },
          { title: 'Basketball Court Campaign', desc: 'A clear mobile campaign makes the project easier to share and gives more people a way to participate.' },
          { title: 'Volunteer Relief', desc: 'Automated contribution tracking and simpler tax statements reduce manual work for church volunteers.' },
        ],
        discoveryStrategy: 'Connect each benefit to the church\u2019s mission, its members, and the people serving behind the scenes.',
      },
      trial_close: {
        pillarFocus: 'Ask for Pastor David\u2019s opinion to find out whether the solution fits and what concern remains.',
        sectionLabel: 'Readiness Questions',
        items: [
          { title: 'Mission Fit', desc: '\u201cFrom what you saw, does Roc Giving support the way New Hope wants to serve its members and community?\u201d' },
          { title: 'Personal Experience', desc: '\u201cDo you feel the giving experience can still reflect the church\u2019s message and relationships?\u201d' },
          { title: 'Remaining Concern', desc: '\u201cWhat would you still need to feel comfortable moving forward?\u201d' },
        ],
        discoveryStrategy: 'Ask one question at a time, listen carefully, and use his answer to decide whether to resolve a concern or move to the close.',
      },
      buying_signals: {
        pillarFocus: 'Recognize questions that show Pastor David is thinking about how the church would move forward.',
        sectionLabel: 'Signals to Watch For',
        items: [
          { title: 'Congregation Questions', desc: 'Pastor David asks how Roc Giving would be introduced to members or whether cash and checks can remain available.' },
          { title: 'Campaign and Setup Questions', desc: 'He asks how quickly the basketball court campaign can be ready or who will help set it up.' },
          { title: 'Next-Step Questions', desc: 'He asks what information is needed, what the agreement includes, or what happens after the church says yes.' },
        ],
        discoveryStrategy: 'Answer the question, confirm it is addressed, and move toward the buying commitment instead of returning to the full presentation.',
      },
      approved_closes: {
        pillarFocus: 'Use closing methods that feel warm, clear, and connected to the church\u2019s mission.',
        sectionLabel: 'Closing Methods to Use',
        items: [
          { title: 'Summary Close', desc: 'Recap consistent giving, the basketball court campaign, volunteer relief, and the personal giving experience before asking for the decision.' },
          { title: 'Incremental Close', desc: 'Confirm that recurring giving helps support the ministry, the campaign is easier to share, and the experience can remain personal.' },
          { title: 'If-Then Close', desc: '\u201cPastor David, if we can keep the giving experience personal, continue supporting cash and checks, and make the court campaign easier to share, is there anything else that would stop the church from moving forward?\u201d' },
        ],
        discoveryStrategy: 'Build agreement around the church\u2019s mission and people, then make a direct ask in a warm and confident way.',
      },
      resolve_and_test: {
        pillarFocus: 'Address the concern that digital giving could feel impersonal and find out whether another blocker remains.',
        sectionLabel: 'Final Concerns to Resolve',
        items: [
          { title: 'Clarify the Concern', desc: 'Find out whether the issue is the look and feel of digital giving or keeping traditional giving options available.' },
          { title: 'Confirm the Answer', desc: 'Ask, \u201cDoes that address the concern about keeping giving personal and inclusive?\u201d' },
          { title: 'Test Intent', desc: 'Ask, \u201cIf we can keep the experience personal and continue supporting the way members already give, is there anything else that would stop the church from moving forward?\u201d' },
        ],
        discoveryStrategy: 'Confirm the concern has been answered before asking for the agreement.',
      },
      direct_cta: {
        pillarFocus: 'Ask Pastor David for a clear buying commitment and begin the setup process.',
        sectionLabel: 'Final Ask',
        items: [
          { title: 'Primary Ask', desc: '\u201cPastor David, are you comfortable moving forward with Roc Giving?\u201d' },
          { title: 'Agreement Ask', desc: '\u201cCan we get the agreement completed and begin setting up the church giving experience?\u201d' },
          { title: 'Next Action', desc: 'After he agrees, gather the church information and begin planning the giving page and basketball court campaign.' },
        ],
        discoveryStrategy: 'Ask clearly, give him time to answer, and do not end with another demo or a vague follow-up.',
      },
    },
  };

  window.module5BriefingData = {
    UI_COPY,
    FRAMEWORK_SECTIONS,
    DRILL_QUESTIONS,
    PERSONA_DATA,
    FRAMEWORK_CONTENT,
  };
})();
