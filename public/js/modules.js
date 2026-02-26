// ===== ROC ACADEMY . MODULE DEFINITIONS =====
// Edit titles, descriptions, video URLs, doc content, and checklists here.
// Game data lives in content.js. Game engines live in game.js.

const MODULES = [
// --- PHASE 1: FOUNDATION (Days 1-30) ---
{
  id:'m1', phase:1, title:'Know Your Products', icon:'📦',
  desc:'Master the ROC product suite. what each product does and who it serves.',
  video:{ title:'ROC Product Suite Overview',
    playlist:[
      { title:'ROC Giving', icon:'💒',
        url:'https://www.youtube.com/embed/PentTG35MTQ?rel=0&modestbranding=1&enablejsapi=1',
        desc:'Digital giving platform for churches and nonprofits. Accept donations via text, QR code, or branded campaign pages with optional donor fee offset.' },
      { title:'ROC Services', icon:'🔧',
        url:'https://www.youtube.com/embed/SdA6m6cHPx0?rel=0&modestbranding=1&enablejsapi=1',
        desc:'Field service management software for contractors and mobile businesses. Schedule jobs, invoice on-site, and accept payments in the field.' },
      { title:'ROC Terminal+', icon:'💳',
        url:'https://www.youtube.com/embed/35p2qYhW6Rs?rel=0&modestbranding=1&enablejsapi=1',
        desc:'Full-featured POS terminal for restaurants and retail. X800 dual-screen system with inventory management, tableside ordering, and integrated payments.' },
      { title:'RewardPay Choice', icon:'💰',
        url:'https://www.youtube.com/embed/grIvvSTlGk4?rel=0&modestbranding=1&enablejsapi=1',
        desc:'Cost-savings program that reduces or eliminates processing fees. Merchants offer transparent dual pricing so customers choose their payment method.' }
    ]},
  doc:{ title:'Product Cheat Sheets', sections:[
    {h:'💒 ROC Giving Cheat Sheet', body:'<b>Who It\'s For:</b> Churches, nonprofits, charities, schools, booster clubs. any org taking donations.<br><br><b>What It Does:</b> All-in-one digital giving platform. Donors give online, via text, or by scanning a QR code. Orgs create branded campaign pages in minutes. Supports one-time, recurring, and pledge donations via credit card, debit, or ACH.<br><br><b>Key Selling Points:</b><br>• <b>Fee Offset</b>. Donors can choose to cover processing fees (most do), so the org keeps 100% of the gift.<br>• <b>Text-to-Give</b>. Members text a keyword to give instantly. No app download required.<br>• <b>QR Code Giving</b>. Print on bulletins, posters, or event signage. Scan → Give → Done.<br>• <b>Branded Campaign Pages</b>. Fully customizable to match the org\'s brand. Set up in minutes, not days.<br>• <b>Recurring Giving</b>. Members set it and forget it. Predictable revenue for the org, every month.<br>• <b>Real-Time Analytics</b>. Track campaign performance, donor engagement, and giving trends in one dashboard.<br>• <b>Human Support</b>. Dedicated support from real people, not chatbots.<br><br><b>Killer Pitch:</b> "More members giving, more often, with zero platform fees. Every dollar goes to the mission."<br><br><b>Objection Killer:</b> "Other platforms charge monthly fees AND take a cut. ROC Giving has no platform fee. and with fee offset, donors cover the processing cost. Net cost to the church? Zero."'},
    {h:'🔧 ROC Services Cheat Sheet', body:'<b>Who It\'s For:</b> Field service businesses. contractors, plumbers, electricians, HVAC, landscapers, any mobile workforce that invoices on-site.<br><br><b>What It Does:</b> Mobile invoicing + payment collection + scheduling + QuickBooks sync. all from one app on the tech\'s phone.<br><br><b>Key Selling Points:</b><br>• <b>Invoice On-Site</b>. Tech finishes the job, creates the invoice on their phone, customer pays before they leave. No more chasing payments.<br>• <b>Send Payment Links</b>. Text or email an invoice with a pay link. Customer clicks, pays, done.<br>• <b>Estimate → Invoice</b>. Create estimates in the field, convert to invoices with one tap when the job\'s done. Speeds up cash flow.<br>• <b>Mobile Card Reader</b>. BBPOS Chipper 3X accepts EMV chip, contactless, and digital wallet payments anywhere.<br>• <b>QuickBooks Online Sync</b>. Every invoice and payment syncs to QuickBooks automatically, in real time. No double entry, no end-of-week reconciliation headaches.<br>• <b>Scheduling & Job Tracking</b>. Book appointments, assign techs, track job progress, and send automated reminders to customers.<br>• <b>Recurring Payments</b>. Set up monthly service contracts that bill automatically.<br>• <b>Item Catalog</b>. Pre-load your services and parts. Techs pick from the catalog instead of typing line items manually.<br><br><b>Killer Pitch:</b> "Your tech finishes the job, invoices from their phone, customer pays before they leave, and it\'s in QuickBooks by dinner."<br><br><b>Objection Killer:</b> "How much time does your office staff spend chasing invoices and matching payments to QuickBooks? ROC Services eliminates that entirely. The tech handles it on-site, and your books update automatically."'},
    {h:'💳 ROC Terminal+ (X800) Cheat Sheet', body:'<b>Who It\'s For:</b> Restaurants, retail, any countertop business that needs a full POS at the register.<br><br><b>What It Does:</b> All-in-one dual-display POS terminal. 8-inch merchant screen + 5-inch customer-facing display. Handles payments, itemization, inventory, and reporting from one device.<br><br><b>Key Selling Points:</b><br>• <b>Dual Display</b>. 8" merchant screen for operations, 5" customer screen for order confirmation and engagement. Customers see what they\'re paying for.<br>• <b>All Payment Types</b>. NFC/Apple Pay, chip, swipe, contactless, plus cash with cashback. No transaction left behind.<br>• <b>Itemization</b>. Build a full product/menu catalog. Ring up items from the catalog instead of manually keying amounts. Faster checkout, fewer errors.<br>• <b>Bill Splitting & Tips</b>. Restaurants can split checks and adjust tips directly on the terminal. No workarounds needed.<br>• <b>Inventory Management</b>. Track stock levels, get low-stock alerts, manage product availability in real time.<br>• <b>QuickBooks Online Sync</b>. Payments reconcile automatically. Close the day, books are done.<br>• <b>Connectivity Options</b>. 4G, Wi-Fi, and Bluetooth. Stays connected everywhere, even if Wi-Fi drops.<br>• <b>Accessories</b>. Pairs with cash drawer, barcode scanner, and receipt printer for full retail setup.<br><br><b>Killer Pitch:</b> "Enterprise POS power. dual screens, full inventory, all payment types. without the enterprise price tag or complexity."<br><br><b>Objection Killer:</b> "Their current terminal can\'t split bills, doesn\'t track inventory, and the customer stares at a blank screen. The X800 does all three and syncs to QuickBooks. Ask them: what would it be worth to stop hand-counting inventory every week?"'},
    {h:'💰 RewardPay Choice / ConsumerChoice Cheat Sheet', body:'<b>Who It\'s For:</b> Any merchant who wants to reduce or eliminate credit card processing fees. Works for every industry. retail, restaurants, services, e-commerce.<br><br><b>What They Are:</b> Two compliant pricing programs that let merchants pass processing costs to cardholders. Both are fully compliant with card brand rules and state regulations.<br><br><b>RewardPay Choice (Surcharging):</b><br>• Adds a small, fixed-percentage fee to <b>credit card</b> transactions only. Debit cards are NOT surcharged.<br>• Reduces merchant processing costs by <b>50-70%</b> on average.<br>• The customer sees the surcharge as a separate line item at checkout.<br>• Merchant chooses the fee percentage they want to pass along.<br><br><b>ConsumerChoice (Dual Pricing):</b><br>• Displays <b>two prices</b> side by side. a cash/ACH price and a card price.<br>• Customer <b>chooses</b> their payment method, and the corresponding price applies. No surprise fees.<br>• Can save merchants <b>up to 100%</b> on processing costs when customers pay cash or ACH.<br>• Works in-store (terminal shows both prices) AND online (email invoices show card vs. ACH pricing).<br>• Integrated with PaybyACH for electronic check processing. merchants get cash-equivalent margins on digital payments.<br><br><b>Key Differentiator:</b> Dual Pricing ≠ Surcharging. Surcharging adds a fee line item. Dual pricing shows two upfront prices. Customer picks. No surprise, no friction.<br><br><b>Killer Pitch:</b> "Your processing cost drops to near zero. and your customers already expect it. 80%+ of our merchants use one of these programs, and zero have switched back."<br><br><b>Objection Killer:</b> "\'I don\'t want to surcharge my customers.\'. Great, then ConsumerChoice is your play. It\'s not a surcharge. It\'s two transparent prices. Cash price, card price. Your customers already see this at gas stations. And with ACH integrated, even your online customers can pay at cash pricing."'}
  ]},
  game:{ title:'Feature Factory', gameId:'featureFactory',
    desc:'Sort product features into the right bin. arrow keys to move!' },
  apply:{ title:'Master Your Products', desc:'Deepen your expertise through AI assessment and LMS training.',
    items:[
      {text:'Chat with Product Knowledge Coach', type:'chatbot', icon:'\u{1F916}'},
      {text:'Complete LMS: ROC Giving', type:'link', url:'https://elevate-payroc.talentlms.com/plus/catalog/courses/881', icon:'\u{1F4DA}'},
      {text:'Complete LMS: ROC Services', type:'link', url:'https://elevate-payroc.talentlms.com/plus/catalog/courses/882', icon:'\u{1F4DA}'},
      {text:'Complete LMS: ROC Terminal+', type:'link', url:'https://elevate-payroc.talentlms.com/plus/catalog/courses/923', icon:'\u{1F4DA}'},
      {text:'Complete LMS: RewardPay Choice', type:'link', url:'https://elevate-payroc.talentlms.com/plus/catalog/courses/933', icon:'\u{1F4DA}'}
    ] }
},
{
  id:'m2', phase:1, title:'Know Your Paycheck', icon:'💰',
  desc:'Understand how your compensation works. residuals, margin targets, and why selling value beats discounting.',
  video:{ title:'How Your Comp Plan Actually Works', duration:'6:00',
    url:'',
    desc:'Residual income, the V1 margin target, and why cost-savings programs make you more money.' },
  doc:{ title:'Compensation & Margin Guide', sections:[
    {h:'How Residuals Work', body:'Every merchant you sign generates monthly recurring income (residuals) based on their processing volume and your margin. Unlike one-time commissions, residuals compound. each new merchant adds to your monthly paycheck permanently. After 2-3 years of consistent selling, your residual book can exceed your base salary.'},
    {h:'The +25% V1 Margin Target', body:'V1 = first-year value. The +25% target means every new deal should generate 25% more profit than baseline. Cost-savings programs (RewardPay Choice, ConsumerChoice) naturally boost margin. Unnecessary discounts destroy it. This target directly impacts your comp.'},
    {h:'Why Margin-Weighted Comp Matters', body:'A $3K/month deal on RewardPay Choice can pay you MORE than a $5K/month deal on discounted pricing. Your residual is tied to margin, not just volume. This means selling value (programs, outcomes) always beats chasing volume with rate cuts.'},
    {h:'The Cost of Discounting', body:'10 basis points off an $8K/month merchant = $96/year lost on ONE deal. Multiply across 20 merchants = $2,000/year in lost residuals. The real cost is the precedent. discount once, and the territory expects it.'}
  ]},
  game:{ title:'Comp & Margin IQ', gameId:'compIQ',
    desc:'Test whether you really understand how your paycheck works.' },
  apply:{ title:'Compensation Application', desc:'Calculate real numbers.',
    items:['Calculate your projected residual on a $5K/month merchant at full margin','Calculate the same deal with a 15bp discount. what did you lose annually?','Identify 3 deals in your pipeline where RewardPay Choice would boost your margin','Ask your manager to walk through one real residual statement with you'] }
},
{
  id:'m3', phase:1, title:'Know Your Sales Process', icon:'🎯',
  desc:'Master Payroc\'s 6-stage sales process. from identifying the customer to asking for referrals.',
  video:{ title:'The 6 Stages of a Payroc Sale', duration:'8:00',
    url:'',
    desc:'Walk through the complete sales cycle: Identify, Appointment, Prep, Sell, Close, Referral.' },
  doc:{ title:'Sales Process Playbook', sections:[
    {h:'Stage 1: Identify the Customer', body:'Qualification before contact. Confirm the prospect has both FIT (right industry, sufficient volume) and PAIN (active frustration with current setup). Research their current processor, estimate processing volume, and identify pain signals before picking up the phone.'},
    {h:'Stage 2: Ask for Appointment', body:'Turn brush-offs into meetings. When they say "email me something," pivot with a pain-trigger question. Propose specific micro-commitments: "Give me 12 minutes Thursday. I\'ll show you exactly how to stop chasing invoices." Never accept passive rejection.'},
    {h:'Stage 3: Prep for Appointment', body:'Customize everything. Research their business, build a demo tailored to THEIR workflow, pre-calculate their specific savings, and prepare a cross-sell recommendation. Generic demos close at 15%. Customized demos close at 40%+.'},
    {h:'Stage 4: Make the Sale', body:'Lead with outcomes, not features. "Your tech invoices on-site, customer pays before they leave, it\'s in QuickBooks by dinner" beats "we have mobile invoicing and QuickBooks sync." Address every pain point they told you about. prove you listened.'},
    {h:'Stage 5: Close the Sale', body:'Isolate objections and solve them. "Let me think about it" = unnamed objection. Ask: "What specifically?" Then arm the decision-maker with data. Never leave without scheduling the next concrete step.'},
    {h:'Stage 6: Ask for Referrals', body:'Strike while the iron is hot. The moment a merchant says "this is great" is your referral window. Ask directly and specifically: "Who else do you know dealing with the same problem?" A warm intro from a happy customer converts at 30%+.'}
  ]},
  game:{ title:'The Sales Floor', gameId:'salesFloor',
    desc:'Walk through full 6-stage sales conversations with real prospects.' },
  apply:{ title:'Sales Process Application', desc:'Apply the 6 stages to real prospects.',
    items:['Map one real prospect through all 6 stages. write your plan for each','Prepare a pre-call plan for your next appointment using the Prep framework','After your next closed deal, ask for a referral within 24 hours','Debrief with your manager on which stage you find hardest. build a practice plan'] }
},

// --- PHASE 2: APPLIED SKILL (Days 30-60) ---
{
  id:'m4', phase:2, title:'Handle Objections', icon:'⚡',
  desc:'Master the top objections you\'ll hear in the field and learn how elite closers handle each one.',
  video:{ title:'Top 5 Objections and How Closers Handle Them', duration:'7:00',
    url:'',
    desc:'Real objection recordings with breakdown of what works and why.' },
  doc:{ title:'Objection Battle Cards', sections:[
    {h:'The Objection Framework', body:'Every objection follows a pattern: Surface concern → Hidden fear → Real blocker. "I need to think about it" (surface) → "I\'m not sure this is worth the hassle" (hidden) → "My partner hasn\'t seen this yet" (real). Your job: dig past the surface to the real blocker. Then solve THAT.'},
    {h:'"Square is free" Response', body:'Never compete on free. compete on COST. "Square charges 2.6% + 15¢ on every swipe with no way to reduce it. Pull your last 3 statements. I\'ll show you the real cost of free. RewardPay Choice brings your effective rate to zero." Always do the math on their statements.'},
    {h:'"We\'re locked in a contract" Response', body:'Breakeven math wins: "Most ETFs are $300-$500. With RewardPay Choice saving $800-$1,200/month, that penalty pays for itself in 30-60 days. You\'re LOSING money every month you stay." Frame the ETF as an investment, not a cost.'},
    {h:'"I don\'t want to surcharge customers" Response', body:'ConsumerChoice ≠ surcharging. "It\'s transparent dual pricing. cash price and card price, clear as day. 80% of my merchants use it. I\'ve never had one switch back." Social proof closes this objection every time.'}
  ]},
  game:{ title:'Objection Blitz', gameId:'objectionBlitz',
    desc:'Handle real objections under pressure with a 15-second timer.' },
  apply:{ title:'Objection Handling Application', desc:'Practice handling objections in real conversations.',
    items:['Record yourself handling the "Square is free" objection. review with your manager','Role-play the "locked in a contract" objection with a peer. practice the breakeven math','On your next 3 prospect calls, identify the REAL objection behind the surface objection','Build a personal battle card for the #1 objection you hear most in your territory'] }
},
{
  id:'m5', phase:2, title:'Cross-Sell & Stack Value', icon:'📊',
  desc:'Turn single-product deals into multi-product relationships that increase deal value and retention.',
  video:{ title:'Turning One Product Into Three', duration:'6:00',
    url:'',
    desc:'How to spot cross-sell signals and stack ROC products for maximum deal value.' },
  doc:{ title:'Cross-Sell Playbook', sections:[
    {h:'Reading Buying Signals', body:'Cross-sell opportunities hide in casual comments. "We also have a showroom" = Terminal+ opportunity. "We host events" = second Terminal+ unit. "We do a lot of cash" = ConsumerChoice. Train your ears to hear these signals. every one is incremental revenue.'},
    {h:'The Product Stack', body:'ROC Services (field) + ROC Terminal+ (counter) = full coverage for service businesses with storefronts. ROC Giving (donations) + ROC Terminal+ (events) = full coverage for churches. Every stack sells under one merchant account. one relationship, one statement, more wallet share.'},
    {h:'The Anchor & Expand Technique', body:'Start with the product that solves their PRIMARY pain (the anchor). Once they\'re sold, introduce the second product as a natural add-on: "Since we\'re already setting up your field invoicing, let\'s get your showroom on the same account. one login, one statement, done."'},
    {h:'Cross-Sell Impact on Your Comp', body:'Multi-product deals have higher retention (less churn = longer residual stream), higher margin (more products = more processing volume), and stronger relationships (harder for competitors to displace). A 2-product deal is worth 3x a single-product deal over its lifetime.'}
  ]},
  game:{ title:'Cross-Sell Scenarios', gameId:'salesFloor',
    desc:'Practice spotting and executing cross-sell opportunities in full sales conversations.' },
  apply:{ title:'Cross-Sell Application', desc:'Identify real cross-sell opportunities.',
    items:['Review your current pipeline. flag every deal that could add a second product','For your next 3 appointments, prepare a cross-sell recommendation before the meeting','Practice the Anchor & Expand technique with a peer on a mock scenario','Calculate the residual difference between a single-product vs. dual-product deal'] }
},
{
  id:'m6', phase:2, title:'Own Your Territory', icon:'🧭',
  desc:'Build a territory attack plan, prioritize leads, and master the pipeline math that hits quota.',
  video:{ title:'60-Day Territory Attack Plan', duration:'7:00',
    url:'',
    desc:'How top reps segment their territory, prioritize leads, and build pipeline that converts.' },
  doc:{ title:'Territory Management Guide', sections:[
    {h:'Lead Segmentation Framework', body:'Tier your accounts: A-tier (high volume + active pain signal) get called first. B-tier (good volume, no pain signal yet) get outbound sequences. C-tier (low volume or unknown) get batch outreach. Never spend A-tier time on C-tier accounts.'},
    {h:'Pipeline Math', body:'Know your numbers: If your target is $15K/month in new processing and your close rate is 30%, you need $50K in pipeline. At 2-3 meetings/week with a 60% meeting-to-proposal rate, that\'s 8-10 meetings to generate enough proposals. Work backwards from your target. always.'},
    {h:'Mid-Month Triage', body:'Every month at the midpoint: (Closed deals) + (Pipeline × close rate) = Projected. If projected < target, you need BOTH new pipeline AND deal acceleration. Never rely on over-performing your close rate. that\'s hope, not strategy.'},
    {h:'Daily Cadence', body:'15-20 outbound dials before noon. Afternoon for meetings and follow-ups. End of day: update CRM, prep tomorrow\'s call list. Weekly: pipeline review with manager. This cadence is non-negotiable for the first 90 days.'}
  ]},
  game:{ title:'Territory & Pipeline', gameId:'territory',
    desc:'Make strategic territory and pipeline decisions under real conditions.' },
  apply:{ title:'Territory Application', desc:'Build your territory plan.',
    items:['Segment your territory into A/B/C tiers. present to your manager','Calculate your pipeline math: what pipeline do you need to hit your target?','Do a mid-month triage on your current pipeline. where are you vs. target?','Build a one-week call plan with specific accounts, hooks, and goals for each call'] }
},

// --- PHASE 3: PERFORMANCE VALIDATION (Days 60-90) ---
{
  id:'m7', phase:3, title:'Full Sales Simulation', icon:'🎬',
  desc:'Run complete sales conversations from identify to referral. proving you can execute the full cycle.',
  video:{ title:'Watch a Full Sale: Identify to Referral', duration:'10:00',
    url:'',
    desc:'Ride-along recording of a top rep executing all 6 stages with a real merchant.' },
  doc:{ title:'Full-Cycle Debrief Guide', sections:[
    {h:'What to Watch For', body:'In the sales video, notice: How does the rep qualify BEFORE calling? How do they turn "email me" into a meeting? What does their pre-call prep look like? Do they lead with outcomes or features? How do they isolate the close objection? When do they ask for the referral?'},
    {h:'Common Multi-Stage Mistakes', body:'Skipping stages (jumping from identify straight to demo). Spending too long in discovery when the prospect is ready to buy. Not prepping for cross-sell before the meeting. Accepting "let me think about it" without isolating the objection. Waiting too long to ask for referrals.'},
    {h:'Pacing & Reading the Room', body:'A consultative sale isn\'t a script. it\'s a conversation. Read the prospect\'s energy: if they\'re asking detailed questions, slow down and go deep. If they\'re checking their watch, accelerate to the value prop. Match their pace, don\'t impose yours.'}
  ]},
  game:{ title:'Full Sales Floor Simulation', gameId:'salesFloor',
    desc:'Run through all scenarios. every stage, every prospect type.' },
  apply:{ title:'Simulation Application', desc:'Prove it in the field.',
    items:['Complete a ride-along with your manager. debrief using the observation guide','Record yourself handling a full prospect conversation and self-assess against the 6 stages','Get written feedback from your manager on your strongest and weakest stage','Set a personal development goal for the stage you need to improve most'] }
},
{
  id:'m8', phase:3, title:"Coach's Corner", icon:'🏋️',
  desc:'Learn how to receive coaching, apply feedback, and accelerate your own development.',
  video:{ title:'How to Be Coachable', duration:'5:00',
    url:'',
    desc:'What separates reps who plateau from reps who keep growing. it\'s not talent, it\'s coachability.' },
  doc:{ title:'Coaching & Development Guide', sections:[
    {h:'How to Receive Feedback', body:'When your manager gives feedback, resist the urge to explain or defend. Instead: Listen. Repeat back what you heard. Ask "what would that look like specifically?" Commit to one change. The best reps treat coaching like free consulting. they seek it out, not avoid it.'},
    {h:'Self-Assessment Framework', body:'After every prospect interaction, ask yourself 3 questions: What stage of the sales process was I in? Did I advance to the next stage? If not, what stopped the advance? This self-diagnosis habit is what separates reps who grow from reps who repeat the same mistakes.'},
    {h:'Building Your Development Plan', body:'Identify your weakest sales stage (most lost deals). Set a 2-week sprint to improve it: study the playbook section, practice with peers, ask your manager to observe that specific stage on your next ride-along. Focused improvement beats general practice every time.'}
  ]},
  game:{ title:"Coach's Corner Scenarios", gameId:'coachCorner',
    desc:'Navigate real coaching conversations and prove you can absorb and apply feedback.' },
  apply:{ title:'Coaching Application', desc:'Put coaching into practice.',
    items:["Request a 1:1 coaching session with your manager focused on your weakest stage",'After your next 3 prospect calls, do a 2-minute self-debrief using the 3-question framework','Ask a top-performing peer to shadow one of your calls and give honest feedback','Write down the #1 thing you learned this week and how you\'ll apply it tomorrow'] }
},
{
  id:'m9', phase:3, title:'Final Certification', icon:'🏆',
  desc:'Prove your readiness with a comprehensive assessment across all competency areas.',
  video:{ title:'What Certification Means', duration:'3:00',
    url:'',
    desc:'Certification isn\'t a test. it\'s proof that you\'re ready to represent Payroc independently.' },
  doc:{ title:'Certification Criteria', sections:[
    {h:'What Certification Validates', body:'Product fluency across the ROC suite. Sales process execution through all 6 stages. Objection handling with elite-level responses. Territory management and pipeline discipline. Compensation understanding and margin-conscious selling. Coachability and self-development habits.'},
    {h:'Performance Benchmarks', body:'80%+ on all game modes. Completed all 9 module action items. Manager sign-off on ride-along performance. Pipeline built and first deals in motion. These benchmarks prove you\'re not just trained. you\'re producing.'},
    {h:'Your 90-Day Scorecard', body:'At the end of 90 days, you and your manager review: Time to first appointment. Time to first deal. Pipeline built vs. target. Game scores across all modes. Action items completed. This scorecard becomes your development baseline going forward.'}
  ]},
  game:{ title:'Certification Assessment', gameId:'certification',
    desc:'Comprehensive assessment pulling from all competency areas.' },
  apply:{ title:'Certification Sign-Off', desc:'Complete your ramp.',
    items:['Schedule your 90-day review meeting with your manager','Prepare your 90-day scorecard: first appointment date, first deal date, current pipeline','Print your ROC Academy progress report showing all completed modules','Get manager signature on your certification. you\'re officially ramped'] }
}
];

// Phase metadata with Behavioral Standards (L&D Pillar)
const PHASES = [
  { num:1, title:'Foundation', days:'Days 1-30', color:'blue',
    desc:'Build your product knowledge, understand your compensation, and master the sales process.',
    standards:[
      {level:'Expert',desc:'Articulates all products, comp mechanics, and full 6-stage process from memory. Customizes pitch to prospect type without notes.'},
      {level:'Competent',desc:'Solid product knowledge. Understands 6-stage process and comp math. May reference notes for edge cases.'},
      {level:'Practicing',desc:'Knows products at surface level. Can walk through sales stages with prompting. Needs calculator for margin math.'}
    ]},
  { num:2, title:'Applied Skill', days:'Days 30-60', color:'orange',
    desc:'Handle objections, cross-sell effectively, and own your territory.',
    standards:[
      {level:'Expert',desc:'Handles all objections instinctively with real math. Spots cross-sell signals mid-conversation. Runs a disciplined territory cadence daily.'},
      {level:'Competent',desc:'Handles top objections with prepared responses. Identifies obvious cross-sell opportunities. Maintains a basic territory plan.'},
      {level:'Practicing',desc:'Recognizes common objections but responses lack precision. Cross-sell feels forced. Territory plan is reactive, not proactive.'}
    ]},
  { num:3, title:'Performance Validation', days:'Days 60-90', color:'green',
    desc:'Prove your skills with full simulations, coaching, and final certification.',
    standards:[
      {level:'Expert',desc:'Executes full sales conversations independently. Seeks coaching. Pipeline built and producing. Ready to represent Payroc alone.'},
      {level:'Competent',desc:'Can run most sales conversations with minimal support. Accepts coaching. Pipeline growing but not yet self-sustaining.'},
      {level:'Practicing',desc:'Needs manager support on complex conversations. Beginning to apply coaching. Pipeline is early-stage.'}
    ]}
];
