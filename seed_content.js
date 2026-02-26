/**
 * seed_content.js — Hydrate CMS tables from existing JS content.
 *
 * Run ONCE after migration 002. Idempotent (ON CONFLICT DO NOTHING).
 * Usage: node seed_content.js
 *
 * This copies data from modules.js and quizzes.js into the cms_ tables
 * so the CMS becomes the single source of truth.
 */

require('dotenv').config();
const db = require('./server/db');

// ── Module data (copied from modules.js) ──
const MODULES_DATA = [
  {
    id:'m1', phase:1, title:'Know Your Products', icon:'📦',
    desc:'Master the ROC product suite. what each product does and who it serves.',
    game_id:'featureFactory', game_title:'Feature Factory', game_desc:'Sort product features into the right bin. arrow keys to move!',
    videos: [
      { title:'ROC Giving', icon:'💒', url:'https://www.youtube.com/embed/PentTG35MTQ?rel=0&modestbranding=1&enablejsapi=1', desc:'Digital giving platform for churches and nonprofits. Accept donations via text, QR code, or branded campaign pages with optional donor fee offset.' },
      { title:'ROC Services', icon:'🔧', url:'https://www.youtube.com/embed/SdA6m6cHPx0?rel=0&modestbranding=1&enablejsapi=1', desc:'Field service management software for contractors and mobile businesses. Schedule jobs, invoice on-site, and accept payments in the field.' },
      { title:'ROC Terminal+', icon:'💳', url:'https://www.youtube.com/embed/35p2qYhW6Rs?rel=0&modestbranding=1&enablejsapi=1', desc:'Full-featured POS terminal for restaurants and retail. X800 dual-screen system with inventory management, tableside ordering, and integrated payments.' },
      { title:'RewardPay Choice', icon:'💰', url:'https://www.youtube.com/embed/grIvvSTlGk4?rel=0&modestbranding=1&enablejsapi=1', desc:'Cost-savings program that reduces or eliminates processing fees. Merchants offer transparent dual pricing so customers choose their payment method.' }
    ],
    docs: [
      {h:'💒 ROC Giving Cheat Sheet', body:'<b>Who It\'s For:</b> Churches, nonprofits, charities, schools, booster clubs. any org taking donations.<br><br><b>What It Does:</b> All-in-one digital giving platform. Donors give online, via text, or by scanning a QR code. Orgs create branded campaign pages in minutes. Supports one-time, recurring, and pledge donations via credit card, debit, or ACH.<br><br><b>Key Selling Points:</b><br>• <b>Fee Offset</b>. Donors can choose to cover processing fees (most do), so the org keeps 100% of the gift.<br>• <b>Text-to-Give</b>. Members text a keyword to give instantly. No app download required.<br>• <b>QR Code Giving</b>. Print on bulletins, posters, or event signage. Scan → Give → Done.<br>• <b>Branded Campaign Pages</b>. Fully customizable to match the org\'s brand. Set up in minutes, not days.<br>• <b>Recurring Giving</b>. Members set it and forget it. Predictable revenue for the org, every month.<br>• <b>Real-Time Analytics</b>. Track campaign performance, donor engagement, and giving trends in one dashboard.<br>• <b>Human Support</b>. Dedicated support from real people, not chatbots.<br><br><b>Killer Pitch:</b> "More members giving, more often, with zero platform fees. Every dollar goes to the mission."<br><br><b>Objection Killer:</b> "Other platforms charge monthly fees AND take a cut. ROC Giving has no platform fee. and with fee offset, donors cover the processing cost. Net cost to the church? Zero."'},
      {h:'🔧 ROC Services Cheat Sheet', body:'<b>Who It\'s For:</b> Field service businesses. contractors, plumbers, electricians, HVAC, landscapers, any mobile workforce that invoices on-site.<br><br><b>What It Does:</b> Mobile invoicing + payment collection + scheduling + QuickBooks sync. all from one app on the tech\'s phone.<br><br><b>Key Selling Points:</b><br>• <b>Invoice On-Site</b>. Tech finishes the job, creates the invoice on their phone, customer pays before they leave. No more chasing payments.<br>• <b>Send Payment Links</b>. Text or email an invoice with a pay link. Customer clicks, pays, done.<br>• <b>Estimate → Invoice</b>. Create estimates in the field, convert to invoices with one tap when the job\'s done.<br>• <b>Mobile Card Reader</b>. BBPOS Chipper 3X accepts EMV chip, contactless, and digital wallet payments anywhere.<br>• <b>QuickBooks Online Sync</b>. Every invoice and payment syncs to QuickBooks automatically, in real time.<br>• <b>Scheduling & Job Tracking</b>. Book appointments, assign techs, track job progress, and send automated reminders.<br>• <b>Recurring Payments</b>. Set up monthly service contracts that bill automatically.<br>• <b>Item Catalog</b>. Pre-load your services and parts. Techs pick from the catalog instead of typing manually.<br><br><b>Killer Pitch:</b> "Your tech finishes the job, invoices from their phone, customer pays before they leave, and it\'s in QuickBooks by dinner."<br><br><b>Objection Killer:</b> "How much time does your office staff spend chasing invoices and matching payments to QuickBooks? ROC Services eliminates that entirely."'},
      {h:'💳 ROC Terminal+ (X800) Cheat Sheet', body:'<b>Who It\'s For:</b> Restaurants, retail, any countertop business that needs a full POS at the register.<br><br><b>What It Does:</b> All-in-one dual-display POS terminal. 8-inch merchant screen + 5-inch customer-facing display.<br><br><b>Key Selling Points:</b><br>• <b>Dual Display</b>. 8" merchant screen for operations, 5" customer screen for order confirmation.<br>• <b>All Payment Types</b>. NFC/Apple Pay, chip, swipe, contactless, plus cash with cashback.<br>• <b>Itemization</b>. Build a full product/menu catalog. Faster checkout, fewer errors.<br>• <b>Bill Splitting & Tips</b>. Restaurants can split checks and adjust tips directly on the terminal.<br>• <b>Inventory Management</b>. Track stock levels, get low-stock alerts, manage availability in real time.<br>• <b>QuickBooks Online Sync</b>. Payments reconcile automatically. Close the day, books are done.<br>• <b>Connectivity</b>. 4G, Wi-Fi, and Bluetooth. Stays connected everywhere.<br>• <b>Accessories</b>. Pairs with cash drawer, barcode scanner, and receipt printer.<br><br><b>Killer Pitch:</b> "Enterprise POS power. dual screens, full inventory, all payment types. without the enterprise price tag."<br><br><b>Objection Killer:</b> "Their current terminal can\'t split bills, doesn\'t track inventory, and the customer stares at a blank screen. The X800 does all three and syncs to QuickBooks."'},
      {h:'💰 RewardPay Choice / ConsumerChoice Cheat Sheet', body:'<b>Who It\'s For:</b> Any merchant who wants to reduce or eliminate credit card processing fees.<br><br><b>What They Are:</b> Two compliant pricing programs that let merchants pass processing costs to cardholders.<br><br><b>RewardPay Choice (Surcharging):</b><br>• Adds a small, fixed-percentage fee to <b>credit card</b> transactions only. Debit cards are NOT surcharged.<br>• Reduces merchant processing costs by <b>50-70%</b> on average.<br><br><b>ConsumerChoice (Dual Pricing):</b><br>• Displays <b>two prices</b> side by side. a cash/ACH price and a card price.<br>• Can save merchants <b>up to 100%</b> on processing costs when customers pay cash or ACH.<br>• Integrated with PaybyACH for electronic check processing.<br><br><b>Key Differentiator:</b> Dual Pricing ≠ Surcharging. Surcharging adds a fee line item. Dual pricing shows two upfront prices.<br><br><b>Killer Pitch:</b> "Your processing cost drops to near zero. and your customers already expect it."<br><br><b>Objection Killer:</b> "\'I don\'t want to surcharge my customers.\' Great, then ConsumerChoice is your play. It\'s not a surcharge. It\'s two transparent prices."'}
    ],
    apply_items: [
      {text:'Chat with Product Knowledge Coach', type:'chatbot', icon:'🤖'},
      {text:'Complete LMS: ROC Giving', type:'link', url:'https://elevate-payroc.talentlms.com/plus/catalog/courses/881', icon:'📚'},
      {text:'Complete LMS: ROC Services', type:'link', url:'https://elevate-payroc.talentlms.com/plus/catalog/courses/882', icon:'📚'},
      {text:'Complete LMS: ROC Terminal+', type:'link', url:'https://elevate-payroc.talentlms.com/plus/catalog/courses/923', icon:'📚'},
      {text:'Complete LMS: RewardPay Choice', type:'link', url:'https://elevate-payroc.talentlms.com/plus/catalog/courses/933', icon:'📚'}
    ]
  },
  {
    id:'m2', phase:1, title:'Know Your Paycheck', icon:'💰',
    desc:'Understand how your compensation works. residuals, margin targets, and why selling value beats discounting.',
    game_id:'compIQ', game_title:'Comp & Margin IQ', game_desc:'Test whether you really understand how your paycheck works.',
    videos: [
      { title:'How Your Comp Plan Actually Works', icon:'📺', url:'', desc:'Residual income, the V1 margin target, and why cost-savings programs make you more money.' }
    ],
    docs: [
      {h:'How Residuals Work', body:'Every merchant you sign generates monthly recurring income (residuals) based on their processing volume and your margin. Unlike one-time commissions, residuals compound. each new merchant adds to your monthly paycheck permanently. After 2-3 years of consistent selling, your residual book can exceed your base salary.'},
      {h:'The +25% V1 Margin Target', body:'V1 = first-year value. The +25% target means every new deal should generate 25% more profit than baseline. Cost-savings programs (RewardPay Choice, ConsumerChoice) naturally boost margin. Unnecessary discounts destroy it. This target directly impacts your comp.'},
      {h:'Why Margin-Weighted Comp Matters', body:'A $3K/month deal on RewardPay Choice can pay you MORE than a $5K/month deal on discounted pricing. Your residual is tied to margin, not just volume. This means selling value (programs, outcomes) always beats chasing volume with rate cuts.'},
      {h:'The Cost of Discounting', body:'10 basis points off an $8K/month merchant = $96/year lost on ONE deal. Multiply across 20 merchants = $2,000/year in lost residuals. The real cost is the precedent. discount once, and the territory expects it.'}
    ],
    apply_items: [
      {text:'Calculate your projected residual on a $5K/month merchant at full margin'},
      {text:'Calculate the same deal with a 15bp discount. what did you lose annually?'},
      {text:'Identify 3 deals in your pipeline where RewardPay Choice would boost your margin'},
      {text:'Ask your manager to walk through one real residual statement with you'}
    ]
  },
  {
    id:'m3', phase:1, title:'Know Your Sales Process', icon:'🎯',
    desc:'Master Payroc\'s 6-stage sales process. from identifying the customer to asking for referrals.',
    game_id:'salesFloor', game_title:'The Sales Floor', game_desc:'Walk through full 6-stage sales conversations with real prospects.',
    videos: [
      { title:'The 6 Stages of a Payroc Sale', icon:'📺', url:'', desc:'Walk through the complete sales cycle: Identify, Appointment, Prep, Sell, Close, Referral.' }
    ],
    docs: [
      {h:'Stage 1: Identify the Customer', body:'Qualification before contact. Confirm the prospect has both FIT (right industry, sufficient volume) and PAIN (active frustration with current setup). Research their current processor, estimate processing volume, and identify pain signals before picking up the phone.'},
      {h:'Stage 2: Ask for Appointment', body:'Turn brush-offs into meetings. When they say "email me something," pivot with a pain-trigger question. Propose specific micro-commitments: "Give me 12 minutes Thursday. I\'ll show you exactly how to stop chasing invoices." Never accept passive rejection.'},
      {h:'Stage 3: Prep for Appointment', body:'Customize everything. Research their business, build a demo tailored to THEIR workflow, pre-calculate their specific savings, and prepare a cross-sell recommendation. Generic demos close at 15%. Customized demos close at 40%+.'},
      {h:'Stage 4: Make the Sale', body:'Lead with outcomes, not features. "Your tech invoices on-site, customer pays before they leave, it\'s in QuickBooks by dinner" beats "we have mobile invoicing and QuickBooks sync." Address every pain point they told you about.'},
      {h:'Stage 5: Close the Sale', body:'Isolate objections and solve them. "Let me think about it" = unnamed objection. Ask: "What specifically?" Then arm the decision-maker with data. Never leave without scheduling the next concrete step.'},
      {h:'Stage 6: Ask for Referrals', body:'Strike while the iron is hot. The moment a merchant says "this is great" is your referral window. Ask directly: "Who else do you know dealing with the same problem?" A warm intro converts at 30%+.'}
    ],
    apply_items: [
      {text:'Map one real prospect through all 6 stages. write your plan for each'},
      {text:'Prepare a pre-call plan for your next appointment using the Prep framework'},
      {text:'After your next closed deal, ask for a referral within 24 hours'},
      {text:'Debrief with your manager on which stage you find hardest. build a practice plan'}
    ]
  },
  {
    id:'m4', phase:2, title:'Handle Objections', icon:'⚡',
    desc:'Master the top objections you\'ll hear in the field and learn how elite closers handle each one.',
    game_id:'objectionBlitz', game_title:'Objection Blitz', game_desc:'Handle real objections under pressure with a 15-second timer.',
    videos: [
      { title:'Top 5 Objections and How Closers Handle Them', icon:'📺', url:'', desc:'Real objection recordings with breakdown of what works and why.' }
    ],
    docs: [
      {h:'The Objection Framework', body:'Every objection follows a pattern: Surface concern → Hidden fear → Real blocker. "I need to think about it" (surface) → "I\'m not sure this is worth the hassle" (hidden) → "My partner hasn\'t seen this yet" (real). Your job: dig past the surface to the real blocker. Then solve THAT.'},
      {h:'"Square is free" Response', body:'Never compete on free. compete on COST. "Square charges 2.6% + 15¢ on every swipe with no way to reduce it. Pull your last 3 statements. I\'ll show you the real cost of free. RewardPay Choice brings your effective rate to zero." Always do the math on their statements.'},
      {h:'"We\'re locked in a contract" Response', body:'Breakeven math wins: "Most ETFs are $300-$500. With RewardPay Choice saving $800-$1,200/month, that penalty pays for itself in 30-60 days. You\'re LOSING money every month you stay." Frame the ETF as an investment, not a cost.'},
      {h:'"I don\'t want to surcharge customers" Response', body:'ConsumerChoice ≠ surcharging. "It\'s transparent dual pricing. cash price and card price, clear as day. 80% of my merchants use it. I\'ve never had one switch back." Social proof closes this objection every time.'}
    ],
    apply_items: [
      {text:'Record yourself handling the "Square is free" objection. review with your manager'},
      {text:'Role-play the "locked in a contract" objection with a peer. practice the breakeven math'},
      {text:'On your next 3 prospect calls, identify the REAL objection behind the surface objection'},
      {text:'Build a personal battle card for the #1 objection you hear most in your territory'}
    ]
  },
  {
    id:'m5', phase:2, title:'Cross-Sell & Stack Value', icon:'📊',
    desc:'Turn single-product deals into multi-product relationships that increase deal value and retention.',
    game_id:'salesFloor', game_title:'Cross-Sell Scenarios', game_desc:'Practice spotting and executing cross-sell opportunities in full sales conversations.',
    videos: [
      { title:'Turning One Product Into Three', icon:'📺', url:'', desc:'How to spot cross-sell signals and stack ROC products for maximum deal value.' }
    ],
    docs: [
      {h:'Reading Buying Signals', body:'Cross-sell opportunities hide in casual comments. "We also have a showroom" = Terminal+ opportunity. "We host events" = second Terminal+ unit. "We do a lot of cash" = ConsumerChoice. Train your ears to hear these signals.'},
      {h:'The Product Stack', body:'ROC Services (field) + ROC Terminal+ (counter) = full coverage for service businesses with storefronts. ROC Giving (donations) + ROC Terminal+ (events) = full coverage for churches. Every stack sells under one merchant account.'},
      {h:'The Anchor & Expand Technique', body:'Start with the product that solves their PRIMARY pain (the anchor). Once they\'re sold, introduce the second product as a natural add-on: "Since we\'re already setting up your field invoicing, let\'s get your showroom on the same account."'},
      {h:'Cross-Sell Impact on Your Comp', body:'Multi-product deals have higher retention, higher margin, and stronger relationships. A 2-product deal is worth 3x a single-product deal over its lifetime.'}
    ],
    apply_items: [
      {text:'Review your current pipeline. flag every deal that could add a second product'},
      {text:'For your next 3 appointments, prepare a cross-sell recommendation before the meeting'},
      {text:'Practice the Anchor & Expand technique with a peer on a mock scenario'},
      {text:'Calculate the residual difference between a single-product vs. dual-product deal'}
    ]
  },
  {
    id:'m6', phase:2, title:'Own Your Territory', icon:'🧭',
    desc:'Build a territory attack plan, prioritize leads, and master the pipeline math that hits quota.',
    game_id:'territory', game_title:'Territory & Pipeline', game_desc:'Make strategic territory and pipeline decisions under real conditions.',
    videos: [
      { title:'60-Day Territory Attack Plan', icon:'📺', url:'', desc:'How top reps segment their territory, prioritize leads, and build pipeline that converts.' }
    ],
    docs: [
      {h:'Lead Segmentation Framework', body:'Tier your accounts: A-tier (high volume + active pain signal) get called first. B-tier (good volume, no pain signal yet) get outbound sequences. C-tier (low volume or unknown) get batch outreach.'},
      {h:'Pipeline Math', body:'Know your numbers: If your target is $15K/month and your close rate is 30%, you need $50K in pipeline. Work backwards from your target. always.'},
      {h:'Mid-Month Triage', body:'Every month at the midpoint: (Closed deals) + (Pipeline × close rate) = Projected. If projected < target, you need BOTH new pipeline AND deal acceleration.'},
      {h:'Daily Cadence', body:'15-20 outbound dials before noon. Afternoon for meetings and follow-ups. End of day: update CRM, prep tomorrow\'s call list. This cadence is non-negotiable for the first 90 days.'}
    ],
    apply_items: [
      {text:'Segment your territory into A/B/C tiers. present to your manager'},
      {text:'Calculate your pipeline math: what pipeline do you need to hit your target?'},
      {text:'Do a mid-month triage on your current pipeline. where are you vs. target?'},
      {text:'Build a one-week call plan with specific accounts, hooks, and goals for each call'}
    ]
  },
  {
    id:'m7', phase:3, title:'Full Sales Simulation', icon:'🎬',
    desc:'Run complete sales conversations from identify to referral.',
    game_id:'salesFloor', game_title:'Full Sales Floor Simulation', game_desc:'Run through all scenarios. every stage, every prospect type.',
    videos: [
      { title:'Watch a Full Sale: Identify to Referral', icon:'📺', url:'', desc:'Ride-along recording of a top rep executing all 6 stages with a real merchant.' }
    ],
    docs: [
      {h:'What to Watch For', body:'In the sales video, notice: How does the rep qualify BEFORE calling? How do they turn "email me" into a meeting? What does their pre-call prep look like? Do they lead with outcomes or features?'},
      {h:'Common Multi-Stage Mistakes', body:'Skipping stages (jumping from identify straight to demo). Spending too long in discovery when the prospect is ready to buy. Not prepping for cross-sell before the meeting.'},
      {h:'Pacing & Reading the Room', body:'A consultative sale isn\'t a script. it\'s a conversation. Read the prospect\'s energy: if they\'re asking detailed questions, slow down. If they\'re checking their watch, accelerate to the value prop.'}
    ],
    apply_items: [
      {text:'Complete a ride-along with your manager. debrief using the observation guide'},
      {text:'Record yourself handling a full prospect conversation and self-assess against the 6 stages'},
      {text:'Get written feedback from your manager on your strongest and weakest stage'},
      {text:'Set a personal development goal for the stage you need to improve most'}
    ]
  },
  {
    id:'m8', phase:3, title:"Coach's Corner", icon:'🏋️',
    desc:'Learn how to receive coaching, apply feedback, and accelerate your own development.',
    game_id:'coachCorner', game_title:"Coach's Corner Scenarios", game_desc:'Navigate real coaching conversations and prove you can absorb and apply feedback.',
    videos: [
      { title:'How to Be Coachable', icon:'📺', url:'', desc:'What separates reps who plateau from reps who keep growing.' }
    ],
    docs: [
      {h:'How to Receive Feedback', body:'When your manager gives feedback, resist the urge to explain or defend. Instead: Listen. Repeat back what you heard. Ask "what would that look like specifically?" Commit to one change.'},
      {h:'Self-Assessment Framework', body:'After every prospect interaction, ask yourself 3 questions: What stage was I in? Did I advance to the next stage? If not, what stopped the advance?'},
      {h:'Building Your Development Plan', body:'Identify your weakest sales stage. Set a 2-week sprint to improve it. Focused improvement beats general practice every time.'}
    ],
    apply_items: [
      {text:'Request a 1:1 coaching session with your manager focused on your weakest stage'},
      {text:'After your next 3 prospect calls, do a 2-minute self-debrief using the 3-question framework'},
      {text:'Ask a top-performing peer to shadow one of your calls and give honest feedback'},
      {text:'Write down the #1 thing you learned this week and how you\'ll apply it tomorrow'}
    ]
  },
  {
    id:'m9', phase:3, title:'Final Certification', icon:'🏆',
    desc:'Prove your readiness with a comprehensive assessment across all competency areas.',
    game_id:'certification', game_title:'Certification Assessment', game_desc:'Comprehensive assessment pulling from all competency areas.',
    videos: [
      { title:'What Certification Means', icon:'📺', url:'', desc:'Certification isn\'t a test. it\'s proof that you\'re ready to represent Payroc independently.' }
    ],
    docs: [
      {h:'What Certification Validates', body:'Product fluency across the ROC suite. Sales process execution through all 6 stages. Objection handling with elite-level responses. Territory management and pipeline discipline.'},
      {h:'Performance Benchmarks', body:'80%+ on all game modes. Completed all 9 module action items. Manager sign-off on ride-along performance. Pipeline built and first deals in motion.'},
      {h:'Your 90-Day Scorecard', body:'At the end of 90 days, you and your manager review: Time to first appointment. Time to first deal. Pipeline built vs. target. Game scores across all modes. Action items completed.'}
    ],
    apply_items: [
      {text:'Schedule your 90-day review meeting with your manager'},
      {text:'Prepare your 90-day scorecard: first appointment date, first deal date, current pipeline'},
      {text:'Print your ROC Academy progress report showing all completed modules'},
      {text:'Get manager signature on your certification. you\'re officially ramped'}
    ]
  }
];

// ── Quiz data (copied from quizzes.js) ──
const QUIZ_POOLS = {
  productIQ: [
    {q:"A plumbing company with 4 techs wants to invoice customers on-site and sync everything to QuickBooks. Which ROC product fits?", opts:["ROC Terminal+. it's our main POS system with invoicing and accounting integrations built in","ROC Services. field service management with mobile invoicing, on-site payments, and QuickBooks sync","ROC Giving. it handles all types of payment collection including invoicing for service businesses","RewardPay Choice. it reduces their processing costs which is the main concern for field service companies"], c:1, exp:"ROC Services is purpose-built for field service businesses. Mobile invoicing, on-site payment collection, scheduling, and QuickBooks sync."},
    {q:"A cafe owner wants bill splitting, tip management, Apple Pay, and a dual-screen display. Which product?", opts:["ROC Services. it supports all payment types including mobile wallets and has tip management built in","ROC Giving. it has a customer-facing display option and supports all contactless payment methods","ROC Terminal+ with X800. dual-screen POS with bill splitting, tips, NFC contactless, and inventory tracking","ConsumerChoice. it's our restaurant-focused solution with full POS features and cost savings built in"], c:2, exp:"ROC Terminal+ with the X800 dual-screen terminal. Built for restaurants and retail."},
    {q:"A church with 800 members wants to increase digital giving and reduce the 2.9% + 30 cents per donation they pay on Tithe.ly. Best solution?", opts:["ROC Terminal+. they can use a POS terminal in the lobby for congregants to tap their cards during services","ROC Services. they can send digital invoices to members with scheduled recurring payment options","ConsumerChoice. dual pricing lets donors see the fee impact and choose to cover it themselves automatically","ROC Giving. Text-to-Give for instant mobile donations plus fee offset so donors cover processing costs"], c:3, exp:"ROC Giving solves both problems: Text-to-Give increases participation, and fee offset lets donors cover the processing cost."},
    {q:"What is the key difference between ConsumerChoice and surcharging?", opts:["ConsumerChoice is transparent dual pricing. customers see a cash price and a card price upfront with no surprises","There is no real difference. ConsumerChoice is just Payroc's branded name for a standard surcharging program","ConsumerChoice only applies to credit cards while surcharging applies to both credit and debit card transactions","Surcharging is illegal in most states while ConsumerChoice is compliant everywhere because it uses a different fee structure"], c:0, exp:"ConsumerChoice is dual pricing, NOT surcharging. Customers see two prices clearly posted."},
    {q:"A contractor has both a field crew AND a small showroom. What's the optimal product combination?", opts:["Two ROC Terminal+ units. one mobile unit for the field and one countertop unit for the showroom","ROC Services for field invoicing + ROC Terminal+ for the showroom. both under one merchant account","ROC Services covers both. the mobile invoicing works for field AND the showroom can use the same app on a tablet","ROC Terminal+ for the showroom only. the field crew can use any generic card reader since volume is lower"], c:1, exp:"ROC Services for the field + ROC Terminal+ for the showroom. One merchant account, two revenue streams."},
    {q:"What makes RewardPay Choice different from standard interchange-plus pricing for the MERCHANT?", opts:["RewardPay Choice has lower monthly fees and no annual contract requirements compared to interchange-plus plans","RewardPay Choice gives merchants access to premium support and faster funding times than interchange-plus accounts","RewardPay Choice brings the merchant's effective processing cost to near zero. far better savings than any rate reduction","RewardPay Choice locks in a fixed rate that never changes while interchange-plus rates fluctuate with card network changes"], c:2, exp:"On interchange-plus, the merchant still pays fees. With RewardPay Choice, their effective cost drops to near zero."},
    {q:"When should you recommend ROC Giving's Text-to-Give feature over their existing online giving portal?", opts:["Only when the church doesn't currently have any online giving. Text-to-Give replaces the need for a web portal entirely","When digital giving adoption is low. Text-to-Give removes friction (no app, no login, 10 seconds) and captures impulse giving moments","When the church wants to reduce costs. Text-to-Give has lower processing fees than web-based giving portals","Only for large congregations over 500 members. smaller churches don't have enough volume to justify the feature"], c:1, exp:"Text-to-Give shines when adoption is low. No app download, no login, no account creation. Give in 10 seconds."},
    {q:"A prospect says: 'We just need a simple card reader, nothing fancy.' What should you explore BEFORE recommending a product?", opts:["Ask about their processing volume to make sure they qualify for our programs and determine which pricing tier fits best","Ask how they handle invoicing, scheduling, and bookkeeping. merchants who want 'just a reader' often spend 5-10 hours weekly on admin that ROC automates","Recommend the BBPOS mobile reader immediately since that's exactly what they asked for. don't overcomplicate the sale","Show them the full ROC Services demo so they can see all the features they'd be missing with just a basic card reader"], c:1, exp:"'Just a reader' merchants are often sitting on hidden pain: manual invoicing, paper scheduling, separate bookkeeping."}
  ],
  compIQ: [
    {q:"A merchant processes $10,000/month. On Square's flat rate (2.6% + 15 cents), roughly what do they pay annually in processing fees?", opts:["About $1,800 — around $150 per month","About $3,300 — roughly $275 per month","About $4,800 — almost $400 per month","About $2,400 — around $200 per month"], c:1, exp:"$10K × 2.6% = $260/mo + per-transaction fees ≈ $275/mo = ~$3,300/year."},
    {q:"You close a merchant on RewardPay Choice vs. standard processing. What happens to YOUR residual income on that deal?", opts:["Same residual — your comp is based on processing volume, not the pricing program","Higher residual — cost-savings programs produce better margin per deal, and your residual is margin-weighted","Lower residual — you're giving away the processing revenue the merchant would have paid","No impact on residual — residuals are calculated on a flat per-deal basis regardless of pricing"], c:1, exp:"Cost-savings programs = higher margin = higher residual = bigger paycheck."},
    {q:"What does the +25% V1 New Sales Margin target actually mean for how you sell?", opts:["Close 25% more deals than the previous rep who had your territory","Limit discounts to no more than 25% off the published rate card","Every new deal should generate 25% more profit than baseline, which means selling cost-savings programs and avoiding unnecessary discounts","Upsell add-on products on at least 25% of your new deals"], c:2, exp:"V1 = first-year value. +25% margin means structuring deals to be 25% more profitable."},
    {q:"A prospect wants you to drop your rate by 10 basis points on $8K/month processing. What's the annual impact on your residual income?", opts:["Negligible — $96/year barely affects your residual","Significant — 10bp across your portfolio compounds fast; that's $960/year on just this one merchant","The impact is $960/year off the merchant's bill, and your residual share of that loss adds up across every deal","There's no direct impact — your residual is calculated before merchant discounts are applied"], c:2, exp:"10bp = 0.10%. $8K × 0.001 = $8/mo × 12 = $96/year off ONE merchant. Across 20 merchants = ~$2,000/year."},
    {q:"Why does margin-weighted comp change how you should approach every deal?", opts:["It doesn't — close volume because more deals = more total comp","A $3K/month deal on RewardPay Choice can pay you MORE than a $5K/month deal on discounted pricing","Always push the most expensive products since higher price = higher margin automatically","Only pursue enterprise-level merchants because margin on small deals isn't worth it"], c:1, exp:"A $3K/month full-margin deal > $5K/month discounted deal in YOUR paycheck."},
    {q:"You closed 3 deals this month. Rank them by actual residual value to YOUR paycheck:", opts:["Deal A ($4K/mo, 10bp discount) > C ($6K/mo, full margin) > B ($2K/mo, RewardPay)","Deal C ($6K/mo, full margin) > B ($2K/mo, RewardPay margin boost) > A ($4K/mo, 10bp discount)","Deal C ($6K/mo, full margin) > A ($4K/mo, 10bp discount) > B ($2K/mo, RewardPay)","All three pay roughly the same residual because Payroc standardizes commissions"], c:1, exp:"C (full margin, highest volume) > B (RewardPay margin boost) > A (discount erodes margin permanently)."},
    {q:"When a merchant demands your lowest possible rate, which response protects both their costs AND your margin?", opts:["Offer interchange-plus at cost with a low monthly fee","Introduce ConsumerChoice dual pricing — merchant's effective cost drops to near zero, and you keep full margin","Match whatever their best competing quote is","Propose tiered pricing that starts low and steps up gradually"], c:1, exp:"ConsumerChoice: merchant pays near-zero (better than ANY rate cut), you keep full margin."},
    {q:"Why are residuals more valuable than upfront commission for long-term career earnings?", opts:["They aren't — upfront commission is always larger per deal and more predictable","Residuals compound: every new merchant adds monthly recurring income, and after 2-3 years your book can exceed your commission","Residuals are guaranteed income that never churns, zero risk","Residuals let you stop prospecting and live off your book once it's large enough"], c:1, exp:"Residuals are the wealth engine. Each merchant adds recurring income. But they're not guaranteed — churn matters."}
  ],
  certification: [
    {q:"A prospect processes $8K/month on Square and is 'happy enough.' Which stage are you in and what's your next move?", opts:["Stage 1: Identify. qualify by calculating their annual fee waste","Stage 2: Appointment. create urgency by showing cost of 'happy enough'","Stage 4: Make the Sale. show side-by-side comparison immediately","Stage 5: Close. present the contract and ask for the switch"], c:0, exp:"Stage 1: Identify. 'Happy enough' = no active pain yet. Calculate exposure first."},
    {q:"Your pipeline has $30K in potential deals. Close rate 25%. Target $10K. What's your situation?", opts:["On track. $30K × 25% = $7.5K, plus extra effort","Short. $30K × 25% = $7.5K projected, $2.5K under target. Need new pipeline NOW","Fine. 3x your target in pipeline","Impossible to tell"], c:1, exp:"$30K × 25% = $7.5K projected. Target: $10K. Gap: $2.5K."},
    {q:"You just closed a deal. The merchant says 'This is exactly what we needed.' What do you do in the next 60 seconds?", opts:["Thank them and check in next week","Ask for a Google review","Ask directly: 'Who else do you know dealing with the same problem?'","Send a thank-you email with your referral link"], c:2, exp:"Stage 6: Referrals. The emotional high is RIGHT NOW. Ask directly."},
    {q:"A merchant wants you to drop your rate by 20bp. What's the right play?", opts:["Match the rate. winning at any margin > losing","Split the difference. offer 10bp off","Introduce ConsumerChoice. effective rate drops to near zero, you keep full margin","Walk away. price-sensitive customers always churn"], c:2, exp:"ConsumerChoice: merchant saves more than any rate cut, you keep full margin."},
    {q:"Your manager says: 'You demoed before you discovered.' What mistake were you making?", opts:["Showed product before understanding specific problems — generic feature tour","Didn't build enough rapport before the demo","Should have sent a proposal with pricing before the demo","Talked too much instead of asking questions"], c:0, exp:"Discovery before demo. Always."},
    {q:"Prepping for a ride-along with a 3-location restaurant group on Toast. What's a proper pre-call plan?", opts:["Loading demo environment, printing case studies, having pricing sheets ready","Research done, pain hypothesized (Toast proprietary hardware), product matched (Terminal+), ConsumerChoice positioned, clear close ask defined","Planning open-ended discovery questions and adapting","Reviewing Toast competitive battle card and feature comparison slides"], c:1, exp:"A pre-call plan has: research, pain HYPOTHESIZED, product matched, savings calculated, and clear ask."},
    {q:"A $3K/month deal on RewardPay Choice vs. $5K/month with 15bp discount. Which is worth more to YOUR paycheck?", opts:["$5K deal. higher volume = higher residuals","Roughly equal. volume offsets margin","$3K RewardPay deal. margin-weighted comp makes this more valuable","Impossible to compare without interchange rates"], c:2, exp:"Margin-weighted comp: $3K full-margin > $5K discounted."},
    {q:"Halfway through month at $6K closed. Target $15K. Pipeline $22K at 30%. Diagnosis?", opts:["On pace. 40% at midpoint with strong pipeline","Projected $12.6K. $2.4K short. Need new opps this week while accelerating","Focus on closing pipeline. push close rate to 40%","Offer incentive pricing to accelerate closes"], c:1, exp:"$6K + ($22K × 30%) = $12.6K. Gap: $2.4K. Need new pipeline AND acceleration."}
  ]
};

async function seedContent() {
  try {
    console.log('[SEED] Running migrations...');
    await db.migrate();

    console.log('[SEED] Seeding CMS modules...');
    for (let i = 0; i < MODULES_DATA.length; i++) {
      const m = MODULES_DATA[i];
      
      // Insert module
      await db.query(
        `INSERT INTO cms_modules (id, phase, title, description, icon, game_id, game_title, game_desc, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [m.id, m.phase, m.title, m.desc, m.icon, m.game_id, m.game_title, m.game_desc, i]
      );

      // Insert videos
      if (m.videos) {
        for (let j = 0; j < m.videos.length; j++) {
          const v = m.videos[j];
          await db.query(
            `INSERT INTO cms_videos (module_id, title, url, description, icon, sort_order)
             SELECT $1, $2, $3, $4, $5, $6
             WHERE NOT EXISTS (SELECT 1 FROM cms_videos WHERE module_id = $1 AND title = $2)`,
            [m.id, v.title, v.url || null, v.desc, v.icon, j]
          );
        }
      }

      // Insert doc sections
      if (m.docs) {
        for (let j = 0; j < m.docs.length; j++) {
          const d = m.docs[j];
          await db.query(
            `INSERT INTO cms_doc_sections (module_id, heading, body, sort_order)
             SELECT $1, $2, $3, $4
             WHERE NOT EXISTS (SELECT 1 FROM cms_doc_sections WHERE module_id = $1 AND heading = $2)`,
            [m.id, d.h, d.body, j]
          );
        }
      }

      // Insert apply items
      if (m.apply_items) {
        for (let j = 0; j < m.apply_items.length; j++) {
          const a = m.apply_items[j];
          const text = typeof a === 'string' ? a : a.text;
          const type = (typeof a === 'object' && a.type) ? a.type : 'text';
          const url = (typeof a === 'object' && a.url) ? a.url : null;
          const icon = (typeof a === 'object' && a.icon) ? a.icon : null;
          await db.query(
            `INSERT INTO cms_apply_items (module_id, text, item_type, url, icon, sort_order)
             SELECT $1, $2, $3, $4, $5, $6
             WHERE NOT EXISTS (SELECT 1 FROM cms_apply_items WHERE module_id = $1 AND text = $2)`,
            [m.id, text, type, url, icon, j]
          );
        }
      }

      console.log(`  ✓ ${m.id}: ${m.title}`);
    }

    // Seed quiz questions
    console.log('[SEED] Seeding quiz questions...');
    for (const [pool, questions] of Object.entries(QUIZ_POOLS)) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await db.query(
          `INSERT INTO cms_quiz_questions (pool, question, options, correct_index, explanation, sort_order)
           SELECT $1, $2, $3::jsonb, $4, $5, $6
           WHERE NOT EXISTS (SELECT 1 FROM cms_quiz_questions WHERE pool = $1 AND question = $2)`,
          [pool, q.q, JSON.stringify(q.opts), q.c, q.exp, i]
        );
      }
      console.log(`  ✓ ${pool}: ${questions.length} questions`);
    }

    console.log('[SEED] Content seeding complete.');
    process.exit(0);
  } catch (err) {
    console.error('[SEED] Error:', err.message);
    process.exit(1);
  }
}

seedContent();
