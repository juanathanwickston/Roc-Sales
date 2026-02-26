// ===== ROC ACADEMY v3 — GAME ENGINE =====
// Module navigation, activity viewers, all game engines, progress tracking
// L&D Pillars: Skill Measurement, Reinforcement Cadence, Visibility Reporting, Behavioral Standards

// ─── STATE ───
// D is loaded from server on init, used as local cache for rendering speed
let D = {xp:0,lvl:1,bst:0,modules:{},skills:{},repName:''};
let curMod = null;
let audioCtx;

// ─── SKILL TRACKING (Pillar: Skill Measurement) ───
// Maps game modes to competency areas
const SKILL_MAP = {
  salesFloor:'salesProcess', objectionBlitz:'objectionHandling',
  territory:'territoryMgmt', compIQ:'compMargin',
  productIQ:'productKnowledge', featureFactory:'productKnowledge',
  coachCorner:'coaching', certification:'certification'
};
const SKILL_LABELS = {
  productKnowledge:'Product Knowledge', salesProcess:'Sales Process',
  objectionHandling:'Objection Handling', territoryMgmt:'Territory Management',
  compMargin:'Comp & Margin IQ', coaching:'Coaching & Coachability'
};
// Weights modeled on Mindtickle Readiness Index — revenue-correlated weighting
const SKILL_WEIGHTS = {
  productKnowledge:0.15, salesProcess:0.25, objectionHandling:0.20,
  territoryMgmt:0.15, compMargin:0.10, coaching:0.15
};
const SKILL_KEYS = Object.keys(SKILL_WEIGHTS);

// --- GAME CONTENT DATA (moved from content.js for self-containment) ---
// ===== ROC ACADEMY v3  CONTENT DATA =====

//  FEATURE FACTORY  Product Knowledge Arcade 
const PRODUCT_BINS = [
 {label:'ROC Giving', icon:'\u2764', color:'#a78bfa'},
 {label:'ROC Services', icon:'\u2699', color:'#60a5fa'},
 {label:'Terminal+', icon:'\u2588', color:'#34d399'},
 {label:'RewardPay', icon:'\u0024', color:'#fbbf24'}
];
const FEATURES = [
 // ROC Giving (product 0)
 {text:'Text-to-Give', product:0},
 {text:'QR Code Giving', product:0},
 {text:'Fee Offset', product:0},
 {text:'Recurring Giving', product:0},
 {text:'Branded Campaigns', product:0},
 {text:'Donor Analytics', product:0},
 {text:'No Platform Fee', product:0},
 // ROC Services (product 1)
 {text:'Mobile Invoicing', product:1},
 {text:'QuickBooks Sync', product:1},
 {text:'EstimateInvoice', product:1},
 {text:'BBPOS Card Reader', product:1},
 {text:'Job Scheduling', product:1},
 {text:'Payment Links', product:1},
 {text:'Item Catalog', product:1},
 // ROC Terminal+ (product 2)
 {text:'Dual Display', product:2},
 {text:'Bill Splitting', product:2},
 {text:'Tip Management', product:2},
 {text:'NFC / Apple Pay', product:2},
 {text:'Inventory Tracking', product:2},
 {text:'Barcode Scanner', product:2},
 {text:'Cash + Cashback', product:2},
 // RewardPay Choice (product 3)
 {text:'Dual Pricing', product:3},
 {text:'Surcharging', product:3},
 {text:'Credit-Only Fee', product:3},
 {text:'50-70% Cost Cut', product:3},
 {text:'ACH Integration', product:3},
 {text:'Cash vs Card Price', product:3}
];
// SALES FLOOR  6-Stage Payroc Sales Process
// 1. Identify the Customer  2. Ask for Appointment  3. Prep for Appointment
// 4. Make the Sale  5. Close the Sale  6. Ask for Referrals
const FLOOR=[
{name:"Mike Reynolds",type:"General Contractor 6 Techs",avi:"",steps:[
 {tag:"1. IDENTIFY",q:"You're researching contractors in your territory. Mike Reynolds has 6 techs, growing revenue, and still invoices on paper. How do you confirm he's a qualified target?",
 opts:[
 {txt:"Check his processing volume potential  6 techs doing $2-5K in jobs weekly = $50-120K/month through field invoicing. He has pain (paper invoicing) AND volume. That's a qualified lead.",ok:2,fb:"You quantified the opportunity AND identified the pain signal before picking up the phone. Identifying the customer means confirming BOTH fit and pain  not just that they exist."},
 {txt:"Look him up on Google and check his reviews to see if his business is legit. If he has good reviews and a real website, he's worth calling because he's a serious business owner.",ok:0,fb:"Reviews tell you he's legit  but you already knew that. Identification means qualifying: Does he have volume? Does he have pain? Can you solve it? Google reviews don't answer any of those."},
 {txt:"Add him to your call list since he's a contractor with multiple techs  that's a solid profile. The more calls you make to businesses like his, the more appointments you'll generate.",ok:1,fb:"He fits the profile, but you didn't validate the pain or estimate the opportunity size. 'Spray and pray' calling is activity without intelligence. Identify means QUALIFY first."}]},
 {tag:"2. APPOINTMENT",q:"You call Mike. He answers: \"Yeah, I've been meaning to figure out our payment situation, but I'm slammed right now. Can you just email me something?\"",
 opts:[
 {txt:"I get it  you're busy running crews. Here's what I'd suggest: give me 12 minutes this Thursday when your guys are on a job. I'll show you exactly how your techs can invoice and collect from the field so you stop chasing payments. Sound fair?",ok:2,fb:"You acknowledged his reality, gave a specific time investment, and framed the meeting around HIS pain  not your pitch. The 12-minute micro-commitment is how you turn 'email me' into a meeting."},
 {txt:"I totally understand, Mike. Let me send over some information about our platform and you can take a look when you have a chance. I'll follow up next week to see if you have any questions.",ok:0,fb:"You just accepted a brush-off. 'Email me' is polite rejection. You had a live prospect with admitted pain and you let him off the hook. An email follow-up converts at under 5%."},
 {txt:"Absolutely, I can send you some info. But before I do  what's the biggest headache with your current payment setup? That way I send you the right stuff instead of a generic brochure.",ok:1,fb:"Better  you're trying to keep the conversation going. But you still accepted the 'email me' frame. The goal is to pivot to a scheduled meeting, not a better email."}]},
 {tag:"3. PREP",q:"Mike agreed to a 15-minute meeting Thursday at his office. How do you prepare?",
 opts:[
 {txt:"Research his business: crew size, job types, service area. Prepare a ROC Services demo tailored to field invoicing. Pre-load a comparison showing paper invoice cost vs. mobile collect-on-site. Have a ROC Terminal+ pitch ready in case he has a storefront.",ok:2,fb:"Full prep: you know his business, you've customized the demo to HIS workflow, you have ROI ready, AND you anticipated a cross-sell. This is how prepared reps close on the first visit."},
 {txt:"Make sure the demo environment is loaded and working on your tablet. Print out a few case studies from similar contractors. Bring a rate card and a contract in case he wants to sign on the spot.",ok:1,fb:"Logistics are handled, but where's the CUSTOMIZATION? You don't know his job sizes, his service area, or his current costs. A generic demo with generic case studies won't feel personal."},
 {txt:"Review the ROC Services feature list so you can answer any technical questions he throws at you. Practice your pitch in the car on the way over so it sounds natural and confident.",ok:0,fb:"Product knowledge is table stakes, not prep. Prep means researching HIS business, customizing YOUR demo, and pre-building the ROI case. Practicing your pitch is what you should have done months ago."}]},
 {tag:"4. MAKE THE SALE",q:"You're in Mike's office. He says: \"Alright, show me what you got. But make it quick  I've got a crew waiting on materials.\"",
 opts:[
 {txt:"Here's the play: your tech finishes a job, pulls out their phone, invoices the customer right there, customer pays before they leave  and it's in your QuickBooks by dinner. No more 2-week invoice chase. Let me show you exactly how it works.",ok:2,fb:"You led with the OUTCOME, not the feature list. Mike doesn't care about 'mobile invoicing and QuickBooks sync'  he cares about getting paid faster. Paint the picture, then demo."},
 {txt:"ROC Services has mobile invoicing, QuickBooks integration, job scheduling, and customer management all in one platform. Let me walk you through each feature so you can see how it compares to your current setup.",ok:0,fb:"Feature tour when he said 'make it quick.' You're reading a brochure to a man with a crew waiting. Lead with the outcome that solves his pain, then demo only the features that matter to HIM."},
 {txt:"Before I show you anything  walk me through exactly what happens when a tech finishes a job right now. I want to make sure what I show you actually matches how your guys work in the field.",ok:1,fb:"Discovery is important, but you already did this in your prep and your first call. He gave you 15 minutes and said 'make it quick.' It's time to deliver the solution, not re-discover."}]},
 {tag:"5. CLOSE",q:"Mike is nodding: \"This looks solid. But let me think about it  I need to run it by my bookkeeper before I commit to anything.\"",
 opts:[
 {txt:"Totally get it. What does your bookkeeper need to see? I'll put together a one-page ROI: what you're losing on delayed invoices vs. same-day field collection. Can we get 10 minutes with them tomorrow to walk through the numbers together?",ok:2,fb:"You isolated the real blocker (bookkeeper), offered to arm them with ROI data, AND scheduled the next step. You didn't let 'let me think about it' turn into a dead deal."},
 {txt:"I understand  it's a big decision. Take the weekend and I'll follow up Monday. Here's my card if any questions come up. I think once your bookkeeper sees the QuickBooks integration, they'll love it.",ok:0,fb:"You let the deal walk. 'Take the weekend' = deal death. Someone else calls Monday first. Always isolate the objection, offer to solve it, and schedule the next action before you leave."},
 {txt:"What if I could hold this pricing for 48 hours so the numbers don't change when you talk to your bookkeeper? That way you're locked into the best rate regardless of when you decide.",ok:0,fb:"Artificial urgency on pricing is pressure selling. The bookkeeper isn't worried about the rate  they want to see the ROI. Address the REAL objection, not a manufactured one."}]},
 {tag:"6. REFERRAL",q:"Mike signed the deal. Installation is scheduled for next week. His exact words: \"This is exactly what we needed.\" What do you do next?",
 opts:[
 {txt:"Mike, I appreciate the trust. You mentioned you know other contractors in the area  who else is still dealing with the same paper invoice headache you had? I'd love to help them the same way, and I'll make sure you're taken care of for the intro.",ok:2,fb:"You asked while the emotional high is fresh, framed it around HIS pain (so it's relatable), and made it easy to say yes. This is when referrals are warmest  never wait."},
 {txt:"I'll make sure your installation goes perfectly, and once your team has been using it for a month or two, I'd love to ask if you know anyone else who might benefit. Happy customers are the best referrals.",ok:0,fb:"A month from now, the emotional high is gone. He's busy, he forgot how bad paper invoicing was. Ask NOW  right after the 'this is exactly what we needed' moment. Timing is everything."},
 {txt:"Before I head out  do you mind if I leave a few business cards? If anyone you know mentions payment headaches, just pass one along and have them give me a call whenever works for them.",ok:1,fb:"Passive referral. Business cards sit in drawers. A direct ask  'who else do you know dealing with this?'  converts 10x higher than 'pass along my card if you think of someone.'"}]}
]},
{name:"Sarah Chen",type:"Caf Owner 200+ Daily Txns",avi:"",steps:[
 {tag:"1. IDENTIFY",q:"Sarah Chen owns a busy caf doing 200+ daily transactions. She's currently on Clover. What signals tell you she's worth pursuing NOW vs. later?",
 opts:[
 {txt:"She's on Clover  known for reseller support problems and proprietary hardware lock-in. At 200+ daily txns, she's paying serious processing fees. If she's had any support issues, she's already frustrated and ready to listen.",ok:2,fb:"You identified two pain signals: platform risk (Clover support) and fee exposure (volume). The 'identify' stage is about finding merchants with ACTIVE pain, not just any merchant who processes cards."},
 {txt:"200+ daily transactions is high volume, which means a good-sized deal for your pipeline. Caf owners are also generally accessible  you can walk in during off-hours and have a real conversation easily.",ok:1,fb:"Volume is good, but that's deal SIZE, not urgency. What makes her worth calling NOW? Active platform pain. Without a pain trigger, she's a future prospect, not a current one."},
 {txt:"She's a caf owner in your territory, so she qualifies as a local small business that could benefit from our services. Add her to your prospect list and schedule a drop-in next week.",ok:0,fb:"'She's a business that takes cards' isn't identification  it's a phone book. The identify stage means qualifying: What's her pain? Why now? What product fits? Go deeper before burning time."}]},
 {tag:"2. APPOINTMENT",q:"You walk into Sarah's caf during a 3pm lull. She's wiping tables. You introduce yourself. She says: \"Another payment sales guy? I already have Clover and I'm not interested in switching right now.\"",
 opts:[
 {txt:"Fair enough  I'm not here to sell you anything today. Quick question though: when your Clover system crashed during a lunch rush, how long did it take support to actually fix it? Because that's the one thing I hear from every caf owner on Clover.",ok:2,fb:"You disarmed the resistance, asked a pain-trigger question, and demonstrated industry knowledge. If she's had a crash (and at 200+ daily, she has), you just opened a real conversation."},
 {txt:"I totally understand  switching is a hassle. But what if I told you I could save you 30-40% on your processing fees without changing anything about your day-to-day operations? Would that be worth a conversation?",ok:1,fb:"Leading with savings is tempting, but '30-40%' is a generic claim she's heard before. The pain-trigger question (crashes, support) creates an emotional response. Savings are logical  pain is emotional."},
 {txt:"No problem at all, Sarah. Here's my card  if you ever get frustrated with Clover or want to explore other options, give me a call. I'm in the area every week and I'd love to earn your business.",ok:0,fb:"You left a card with someone who just told you she's not interested. That card goes in the trash. The appointment stage means creating a reason to meet  not accepting rejection politely."}]},
 {tag:"3. PREP",q:"Sarah agreed to a meeting next Tuesday. She mentioned Clover crashes, long support hold times, and that she's paying around $4K/month in processing fees. How do you prep?",
 opts:[
 {txt:"Build a custom demo: X800 dual-screen handling her specific workflow (bill splitting + tips + Apple Pay). Pre-calculate her ConsumerChoice savings on $4K/month. Prepare a side-by-side: Clover support SLA vs. Payroc dedicated support. Have install timeline ready.",ok:2,fb:"Every element is customized to HER pain: reliability (X800 vs. Clover), support (dedicated vs. reseller), and cost ($4K  near-zero). She should feel like this demo was built specifically for her."},
 {txt:"Load up the standard restaurant demo on the X800. Bring a case study from another high-volume caf that switched from Clover. Print out the ConsumerChoice program sheet so she can see how dual pricing works.",ok:1,fb:"Generic materials for a specific prospect. Where's the $4K savings calculation? Where's the support comparison? She gave you three specific pain points  your prep should address all three with HER numbers."},
 {txt:"Research her caf online  check reviews, menu, hours. Understand her business so you can build rapport and show you've done your homework. Bring the full product portfolio in case she's interested in things beyond the POS.",ok:0,fb:"Knowing her menu items builds rapport but doesn't close deals. Prep means building a customized solution that addresses the pain she already told you about. Rapport is a tool, not the goal."}]},
 {tag:"4. MAKE THE SALE",q:"You're at the meeting. Sarah says: \"Okay, show me why I should go through the headache of switching from Clover.\"",
 opts:[
 {txt:"Three things that change: One  the X800 handles your lunch rush without crashing, and when something does go wrong, you call us directly, not a reseller maze. Two  your $4K in monthly fees drops to near-zero with ConsumerChoice. Three  your staff trains in one shift. Want to see it live?",ok:2,fb:"Three problems, three solutions, zero fluff. Each one maps to a pain she told you about. You demonstrated you listened, you quantified the value, and you offered to prove it. That's making the sale."},
 {txt:"Let me start by showing you the X800 interface  it's really intuitive. You've got bill splitting here, tip management here, and NFC tap right here for Apple Pay. The whole system runs on our cloud platform with 99.9% uptime.",ok:1,fb:"Feature tour. She didn't ask HOW the POS works  she asked WHY she should switch. Lead with the answer to HER question (reliability, savings, support), then demo the features that prove it."},
 {txt:"Before I show you the hardware, let me walk through the economics. At $4K/month in processing, you're spending $48K per year on fees alone. With our ConsumerChoice program, we can bring that to virtually zero.",ok:1,fb:"Good lead on savings, but you only addressed 1 of 3 pain points. She's frustrated about crashes and support too  the money alone might not be enough to overcome switching fear. Address ALL three."}]},
 {tag:"5. CLOSE",q:"Sarah loves the demo: \"I'm impressed. But honestly, switching POS systems mid-season terrifies me. What if my staff can't figure it out and we lose customers during the transition?\"",
 opts:[
 {txt:"Here's how we do it: install on a Monday when you're closed, train your whole team Tuesday morning before open, I personally check in Tuesday and Wednesday lunch rush, and we don't pull Clover until your team says they're ready. You control the timeline.",ok:2,fb:"You de-risked the switch step by step. She imagined chaos  you gave her a choreographed plan. Fear of change is the #1 POS objection. Paint the bridge from old to new in vivid detail."},
 {txt:"The X800 is actually really intuitive  most caf staff pick it up within the first shift. And you have 24/7 support if anything comes up, so you're never stuck without help during the transition.",ok:1,fb:"'Intuitive' and '24/7 support' are generic reassurances. She's picturing lunch rush chaos. She needs a PLAN: install day, training day, go-live day, check-in schedule. Be specific."},
 {txt:"What if we ran both systems side by side for two weeks? Your team uses the new system for practice and Clover stays as backup. That way there's zero risk  you only fully switch when everyone is confident.",ok:0,fb:"Parallel runs sound safe but create chaos: two systems at the register, confused staff, doubled costs. Show confidence in YOUR solution. Guide the transition decisively  don't hedge it."}]},
 {tag:"6. REFERRAL",q:"Sarah's team is live on the X800. She texts you: \"My baristas love this thing. Way better than Clover.\" How do you turn this into referrals?",
 opts:[
 {txt:"That's amazing to hear, Sarah! Quick question  you know other restaurant and caf owners in the area. Who else is dealing with the same Clover headaches you had? I'd love to help them the same way, and you'd be doing them a real favor.",ok:2,fb:"Struck while the iron is hot. The text IS the referral trigger  she's in advocacy mode. Specific ask ('who else has Clover headaches?') is infinitely better than 'know anyone who might be interested?'"},
 {txt:"So glad to hear that! Once you've been on the system for a full month, I'd love to put together a quick case study about your experience. Would you be open to that? Those stories really help other business owners see the value.",ok:1,fb:"Case studies help YOUR marketing, but you missed the referral window. She just told you her team LOVES it  that's the moment to ask 'who else?' A case study doesn't generate leads the same way a warm intro does."},
 {txt:"Thanks, Sarah! I'll pass that feedback along to our team  they'll love hearing it. Keep me posted if you need anything at all. And if any other business owners ask about your new system, feel free to send them my way!",ok:0,fb:"You thanked her, took zero action, and made the referral passive. 'Send them my way' = you'll never hear from those people. Ask directly, ask specifically, ask NOW."}]}
]},
{name:"Pastor Williams",type:"Church 800-Member Congregation",avi:"",steps:[
 {tag:"1. IDENTIFY",q:"A colleague mentions that Faith Community Church (800 members) has been growing but giving has been flat. How do you confirm this is a real opportunity before investing time?",
 opts:[
 {txt:"Research their giving setup  if they're on Tithe.ly or Planning Center at 2.9%+30 cents, and only 15-20% give online, there's a double pain: high fees AND low digital adoption. With 800 members, that's a $100K+ giving potential with significant fee waste.",ok:2,fb:"You quantified BOTH sides of the pain: fee leakage and participation gap. That's a qualified opportunity with a clear value proposition. Now you've earned the right to pick up the phone."},
 {txt:"Check their website and social media to see how active the congregation is. If they're posting regularly and have a modern online presence, they're probably tech-forward enough to adopt a new giving platform.",ok:0,fb:"Social media activity doesn't tell you anything about their GIVING pain. You need to know: what platform are they on, what are they paying, and what's their digital adoption rate. Qualify the pain, not the vibe."},
 {txt:"800 members is a solid-sized congregation  most churches that size process $120K+ in annual giving. That's enough volume to make this worth pursuing. Add them to your pipeline and call the church office.",ok:1,fb:"Volume potential is right, but you didn't identify the PAIN. Why would they switch? What's broken? 'They're big enough' isn't a pain signal  it's a size check. Dig deeper before calling."}]},
 {tag:"2. APPOINTMENT",q:"You call the church office. Pastor Williams answers: \"I appreciate the call, but we're happy with Tithe.ly. We've been using it for three years and it works fine for our congregation.\"",
 opts:[
 {txt:"I hear you  Tithe.ly is solid for basic online giving. Quick question: what percentage of your congregation actually gives digitally right now? Because most churches your size tell me it's under 20%, and that gap usually means there's significant giving you're not capturing.",ok:2,fb:"You validated his choice, then asked a diagnostic question he probably can't answer confidently. If the answer is low (it almost always is), you just created curiosity about a problem he didn't know he had."},
 {txt:"Totally understand, Pastor. A lot of churches are happy with Tithe.ly until they see how much they're paying in processing fees. At 2.9% plus 30per donation, a church your size is losing $3,500-4,000 a year in fees alone.",ok:1,fb:"Fee math is compelling, but you led with money to a pastor. Churches are mission-driven  lead with PARTICIPATION ('are you reaching all your givers?'), then follow with fees as the second reason."},
 {txt:"No problem at all  I don't want to disrupt something that's working. If you ever want a second opinion or if Tithe.ly raises their rates, keep my name handy. I work with a lot of churches in the area and I'm always happy to help.",ok:0,fb:"You accepted 'happy with Tithe.ly' at face value and walked away. 'Works fine' often means 'I haven't seen better.' Your job is to create awareness of a problem  not agree that everything's great."}]},
 {tag:"3. PREP",q:"Pastor Williams agreed to meet after he checked and discovered only 12% of his congregation gives online. He seemed surprised. How do you prep for the meeting?",
 opts:[
 {txt:"Build around his 12% number: model what happens if Text-to-Give lifts online participation to 35-40%. Calculate his current Tithe.ly fee drain on annual giving. Prep a live Text-to-Give demo he can try himself. Have a ROC Terminal+ recommendation ready for events.",ok:2,fb:"Every prep element maps to HIS data point (12%) and HIS pain. You're not pitching generically  you're showing him exactly what his church is leaving on the table with hard numbers."},
 {txt:"Prepare the standard ROC Giving demo with Text-to-Give, QR codes, and campaign pages. Bring testimonials from other churches that switched from Tithe.ly. Have the fee comparison sheet showing ROC Giving vs. Tithe.ly pricing side by side.",ok:1,fb:"Generic materials. He gave you the 12% data point  use it. Show HIM what 12% vs. 40% adoption means in HIS giving numbers. Personalized prep closes; brochure prep educates."},
 {txt:"Study the church's website, understand their ministries and mission, and prepare talking points that connect ROC Giving features to their specific community initiatives. Pastors respond to alignment with their mission.",ok:0,fb:"Mission alignment matters for rapport, but the meeting was set because of the 12% number. Your prep should quantify the gap, show the solution, and calculate the ROI with HIS numbers."}]},
 {tag:"4. MAKE THE SALE",q:"You're meeting with Pastor Williams. He opens with: \"So you think you can do better than Tithe.ly? A lot of companies have told me that.\"",
 opts:[
 {txt:"Let me show you what 12% vs. 40% means for your church. If your average member gives $150/month and you move from 12% to 40% digital adoption with Text-to-Give, that's an additional $33,600 in captured giving per year  plus fee offset keeps that $4,200 you're paying Tithe.ly in your ministry budget.",ok:2,fb:"You used HIS numbers to paint a specific, dollar-denominated picture. He can see two things: more giving captured AND fees recovered. That's not 'better than Tithe.ly'  that's a completely different outcome."},
 {txt:"I don't need to be better than Tithe.ly  I just need to solve the problem Tithe.ly can't: participation. Text-to-Give lets any member give in 10 seconds with no app, no login. That's why our churches see 3x the digital adoption rates.",ok:1,fb:"Good positioning, but 'our churches see 3x' is a generic claim. Use HIS 12% number to make it personal. '12% to 40% means $33K more for your ministry' hits harder than '3x adoption rates.'"},
 {txt:"Absolutely. ROC Giving has Text-to-Give, QR code giving, branded campaign pages, fee offset so donors can cover processing, and a comprehensive admin dashboard that's more powerful than what Tithe.ly offers at a lower cost.",ok:0,fb:"Feature list to a skeptical pastor. He's heard this pitch before. Lead with HIS 12% number and the dollar impact, not with a product comparison. Show him HIS church's future, not your product's resume."}]},
 {tag:"5. CLOSE",q:"Pastor Williams is engaged: \"The numbers are compelling. But I need to present this to our church board next Tuesday. They'll have tough questions about cost, data migration, and disrupting our current giving flow.\"",
 opts:[
 {txt:"Let's build the board presentation together. I'll create a one-pager with your numbers: $33K in captured giving, $4,200 in recovered fees, and a 30-day transition plan. What time Monday works for us to prep so you walk in with answers to every question they'll ask?",ok:2,fb:"You made yourself his partner, not his vendor. You're arming the champion with data for the decision-makers AND staying in the process by scheduling the prep session. This is how you close institutional deals."},
 {txt:"I can send you a comprehensive proposal document with our pricing, implementation timeline, migration plan, and church testimonials. That should give the board everything they need to make an informed decision.",ok:1,fb:"A PDF isn't a partner. Boards ask questions that documents can't answer. Your job is to prep the pastor to CHAMPION this  that means working through the board's likely objections together, not emailing a packet."},
 {txt:"That's great news that it's going to the board. In my experience, church boards usually take a couple of weeks to make these decisions. Let's plan to reconnect after the meeting and I'll be available for any follow-up questions they have.",ok:0,fb:"Passive follow-up on an institutional sale = dead deal. Board members will raise objections the pastor can't answer, and the deal stalls. Stay in the process  help prep the presentation."}]},
 {tag:"6. REFERRAL",q:"The board approved ROC Giving. Pastor Williams is thrilled: \"This is going to transform how our congregation gives.\" The perfect referral moment. What do you say?",
 opts:[
 {txt:"Pastor, that means a lot. You're connected with other church leaders in the area  who else is dealing with the same participation gap you discovered? I'd love to help them see what you saw, and a warm introduction from you would mean the world.",ok:2,fb:"Direct, specific, and framed around the pain he experienced personally. 'The participation gap you discovered' makes it about helping other pastors, not about your sales quota. This generates the warmest intros."},
 {txt:"Thank you, Pastor. Would you be open to me mentioning your church when I talk to other congregations in the area? Having a local reference church makes a huge difference when other pastors are evaluating their giving platforms.",ok:1,fb:"Reference  referral. A reference is passive (someone calls to verify). A referral is active (he introduces you). Ask for introductions, not permission to name-drop."},
 {txt:"I'd love to share your story  once you've been on the platform for a quarter and have real giving data to show, would you be willing to do a short video testimonial? That kind of social proof is incredibly powerful for other churches.",ok:0,fb:"A testimonial in 3 months doesn't help you TODAY. The emotional high is RIGHT NOW. Ask for the referral while he's saying 'this is going to transform our giving'  not after he's forgotten how bad Tithe.ly was."}]}
]}];

// OBJECTION BLITZ  All answers are substantial and plausible
const BLITZ=[
{q:"\"Square is free to start. Why would I switch to something that costs money?\"",
 opts:[
 {txt:"Square charges 2.6% + 15on every single swipe with no way to reduce it. Pull your last three statements  I'll show you exactly what 'free' is actually costing you, and how RewardPay Choice brings that to zero.",ok:true},
 {txt:"Square works for very small businesses, but once you're processing more than a few thousand a month, you need a platform that can grow with you and offer real business tools beyond just taking payments.",ok:false},
 {txt:"We offer a similar free hardware setup with no upfront cost, plus our processing rates are lower than Square's flat pricing, especially once you factor in the interchange optimization we provide.",ok:false},
 {txt:"The difference is the level of service. Square is completely self-serve  no dedicated rep, no phone support. With Payroc, you get a named account manager who knows your business personally.",ok:false}],
 bc:"Never compete on 'free.' Compete on COST. Square's 2.6%+15with no offset = expensive. RewardPay Choice = 0% effective. Always do the math on their statements."},
{q:"\"We're locked into a two-year contract with our current processor. There's nothing I can do.\"",
 opts:[
 {txt:"Most processors charge $300-$500 to terminate early. With RewardPay Choice saving you $800-$1,200+ per month, that penalty pays for itself in the first 30-60 days. Let me run the breakeven math for you.",ok:true},
 {txt:"A lot of those contracts actually have a 30-day cancellation window each year around your anniversary date. Let me look at your agreement  there might be an exit you don't know about.",ok:false},
 {txt:"I completely understand  contracts are contracts. Let's get everything set up now and schedule the switch for when your current agreement expires so there's zero downtime or overlap.",ok:false},
 {txt:"We work with a compliance team that's reviewed hundreds of processor contracts. In many cases, the terms aren't as binding as merchants think, especially around rate changes.",ok:false}],
 bc:"Breakeven math always wins: ETF ($300-$500) vs. annual savings ($3K-$12K). Frame the ETF as an investment, not a cost. Show them they're LOSING money by staying."},
{q:"\"I don't want to charge my customers extra. Surcharging will drive people to my competitor down the street.\"",
 opts:[
 {txt:"That's exactly why we do ConsumerChoice, not surcharging. It's dual pricing  customers see a cash price and a card price, clear as day. No surprises. 80% of my merchants use it and I've never had one switch back.",ok:true},
 {txt:"Surcharging is actually becoming the industry standard. Over 60% of merchants nationwide now pass processing fees to cardholders, and consumer studies show it doesn't impact buying behavior.",ok:false},
 {txt:"What if we structured it so the surcharge only applied to credit cards and not debit? That way the majority of your everyday customers paying with debit wouldn't see any difference at all.",ok:false},
 {txt:"Instead of surcharging, we could do a cash discount program where you post the card price as your standard and give a discount for cash. It feels better psychologically to customers.",ok:false}],
 bc:"ConsumerChoice  surcharging. It's transparent dual pricing. Key stat: 80%+ merchant adoption, near-zero reported customer complaints. Social proof closes this objection."},
{q:"\"Your competitor offered us interchange-plus at cost with a $15 monthly fee. Why should I pay more for Payroc?\"",
 opts:[
 {txt:"What's the total? Interchange-plus 'at cost' usually hides statement fees, PCI fees, batch fees, and annual fees that add $50-$100/month. Compare TOTAL cost  and ask them if they offer RewardPay Choice at 0%.",ok:true},
 {txt:"We can absolutely do interchange-plus pricing, and I'm confident our rates will be in the same ballpark. But beyond pricing, you're also getting dedicated support, next-day funding, and a modern POS platform.",ok:false},
 {txt:"That sounds like a loss-leader offer  they're pricing below margin to win your business and then they'll raise rates in 6-12 months once you're locked in. We see it all the time with our competitors.",ok:false},
 {txt:"I'd want to see that quote in writing. A lot of reps quote rates verbally that don't match the actual contract terms. We're always transparent about our pricing from day one  no bait and switch.",ok:false}],
 bc:"Never compete on basis points. Compare TOTAL COST (all fees: PCI, statement, batch, annual). Then pivot: 0% with RewardPay Choice beats any interchange-plus rate."},
{q:"\"I need to think about it and discuss with my business partner before we move forward on anything.\"",
 opts:[
 {txt:"Absolutely  what specifically do you want to talk through with your partner? Let me put together a one-page savings comparison they can review. What questions do you think they'll have so I can address them upfront?",ok:true},
 {txt:"I totally respect that. It's a big decision and you want to get it right. Let me send you a follow-up email with everything we discussed, and I'll check in later this week to see where you landed.",ok:false},
 {txt:"Before you go  let me leave you with this: every month you stay on your current setup, you're paying $X in fees you don't have to pay. The sooner we move, the sooner those savings start.",ok:false},
 {txt:"I find that when both partners are in the room, we can knock out all the questions at once. Would it make sense to schedule a quick 15-minute call with both of you together later this week?",ok:false}],
 bc:"'Think about it' = unnamed objection. Isolate it: 'What specifically?' Then arm the champion with data for the unseen decision-maker. Never just 'follow up later.'"},
{q:"\"We process $3K a month  we're too small for this to matter. The fees are just cost of doing business.\"",
 opts:[
 {txt:"At $3K/month on Square, that's $1,000+ per year going to processing fees. RewardPay Choice takes that to zero regardless of your volume. I had a merchant your exact size save $900 in the first year  and he asked why he didn't switch sooner.",ok:true},
 {txt:"Even small-volume merchants deserve enterprise-level service. We don't have minimums, and you'll get the same dedicated support and technology whether you're processing $3K or $300K per month.",ok:false},
 {txt:"$3K now, but where do you want to be in 12 months? If you're planning to grow, it makes sense to get on a platform now that scales with you instead of switching later when it's more disruptive.",ok:false},
 {txt:"Have you looked at your effective rate recently? A lot of small-volume merchants are actually paying a higher effective percentage than they realize because of monthly minimums and fixed fees.",ok:false}],
 bc:"Do the math at THEIR volume  even $3K/month = $1K+/year in wasted fees. Savings programs work at any size. Use a specific example of a same-size merchant to prove it."},
{q:"\"Tithe.ly is working fine for our church. Why would we go through the hassle of switching giving platforms?\"",
 opts:[
 {txt:"If only 15-20% of your congregation gives online, 'working fine' is leaving money on the table. Tithe.ly's 2.9% + 30cost you thousands per year. Text-to-Give boosts participation and fee offset keeps that money in ministry.",ok:true},
 {txt:"Switching platforms is actually much easier than you'd think  we handle the data migration, set up your campaigns, and train your admin team. Most churches are fully transitioned within a single week.",ok:false},
 {txt:"Tithe.ly is a solid platform for basic online giving, but ROC Giving was purpose-built with features like QR code giving, branded campaign pages, and advanced donor analytics that Tithe.ly can't match.",ok:false},
 {txt:"I'd encourage you to look at your total giving numbers and see if they're actually growing at the same rate as your congregation. If attendance is up but giving isn't, the platform might be the bottleneck.",ok:false}],
 bc:"'Working fine' = settling. Quantify what they're losing: fees ($3,600+/year on $120K giving) + participation gap (only 15-20% online). Text-to-Give + fee offset solve both."},
{q:"\"Your system looks nice, but we just need a simple card reader. We don't need all those extra features  keep it simple.\"",
 opts:[
 {txt:"I hear you  let me ask though: how are you invoicing right now? Tracking appointments? Doing your books? Most merchants who want 'just a reader' are spending 5-10 hours weekly on admin that ROC Services automates.",ok:true},
 {txt:"We can absolutely start simple  our BBPOS reader is portable, affordable, and connects to your phone via Bluetooth. Once you see how it works, you'll probably want to explore the other features at your own pace.",ok:false},
 {txt:"I get it  nobody wants complexity. But the good news is ROC Services looks simple from the outside while automating the backend stuff you're doing manually. Your team won't feel any added complexity.",ok:false},
 {txt:"Simple is great, but the merchants who grow the fastest are usually the ones who adopt tools that scale with them. A reader today works, but what happens when you add employees or a second location?",ok:false}],
 bc:"Never argue with 'keep it simple.' Instead, discover hidden pain: invoicing, scheduling, bookkeeping. 'Just a reader' merchants are sitting on 5-10 hours/week of manual admin."}
];

// TERRITORY & PIPELINE (answers balanced)
const TERR=[
{q:"You have 5 leads. Which ONE do you call first?",
 context:"A) Referral from existing merchant  restaurant owner, 'interested in switching from Toast'\nB) Website form  small retailer, 'just exploring options for next quarter'\nC) Cold list target  large auto dealership, no prior contact, high processing volume\nD) Existing customer  mentioned opening a second location at their last service call\nE) Trade show lead  got your card 3 weeks ago, owns a salon, seemed interested",
 opts:[
 {txt:"A  Referral from the restaurant. Warm intro, active pain with Toast, and referrals convert 4x higher than any other lead source. This deal is closest to close right now.",ok:2,fb:"Referrals are gold. Warm intro = trust already built. Active competitor pain = urgency. This lead is furthest along the buying journey by a mile."},
 {txt:"D  Existing customer expanding. They already trust you, know the product, and adding a location is a straightforward upsell with near-certain close probability.",ok:1,fb:"Smart instinct  expansions close at 60%+. But the referral has ACTIVE pain AND a warm intro. Expansion is your #2 call, not #1."},
 {txt:"C  The auto dealership. Large processing volume means a bigger deal, higher residuals, and more impact on your monthly target than any of the smaller opportunities.",ok:0,fb:"Volume is tempting, but cold + large = longest sales cycle. No relationship, no pain signal, no urgency. You'll spend weeks on this while the referral closes for someone else."},
 {txt:"E  Trade show lead from 3 weeks ago. She showed interest and if you wait any longer the momentum will be completely gone. Strike while there's still recognition.",ok:0,fb:"3 weeks is already cold. Trade show leads convert at 2-5%. Your referral converts at 30%+. Prioritize probability over recency anxiety."}],
 bc:"Priority: Referrals (30%+ close) > Customer expansion (60%+ close) > Inbound with pain > Inbound browsing > Cold/event (2-5%). Always call your highest-probability lead first."},
{q:"It's Day 1 in a territory with 200 cold accounts and zero pipeline. Your manager expects activity metrics AND closed revenue within 60 days. What's your plan?",
 context:"You need to show measurable progress at your 30-day review.",
 opts:[
 {txt:"Segment the 200 by revenue potential. Attack the top 50 first  15-20 dials per day, each with a specific value hook. Book 2-3 discovery meetings per week. Track everything in CRM daily.",ok:2,fb:"Structured, measurable, and prioritized. You're not spray-and-praying  you're hunting the biggest opportunities first with a repeatable daily cadence."},
 {txt:"Spend the first week driving every street in the territory to identify businesses, then door-knock the highest-traffic areas. Face-to-face builds rapport faster than cold calls ever will.",ok:1,fb:"Boots on the ground has value, but week one should be CALLING, not driving. You need pipeline velocity, not geography lessons. Dial first, drive second."},
 {txt:"Block the first two weeks for product certification and shadowing top reps. You can't sell what you don't know, and rushing into calls unprepared will burn through the account list.",ok:0,fb:"Two weeks of 'preparation' = zero pipeline. You learn faster by selling. Make calls Day 1  you'll absorb product knowledge through real conversations."},
 {txt:"Start by asking your manager and the top reps which accounts in the territory have the most potential, then focus exclusively on those warm recommendations first.",ok:0,fb:"Your manager wants initiative, not dependency. Segment and present YOUR plan, then ask for input. Waiting for direction signals you can't self-start."}],
 bc:"Territory attack playbook: Tier accounts by opportunity  Focus top 50  15-20 daily dials  2-3 meetings/week  Weekly pipeline review. Activity starts Day 1, no exceptions."},
{q:"Friday 2pm. Pipeline review is Monday morning. Four deals need attention. Which one gets your time RIGHT NOW?",
 context:"A) $2K/mo merchant  verbal 'yes' on Thursday, contract not signed yet\nB) $800/mo merchant  demo confirmed for next Wednesday, needs prep\nC) $3K/mo merchant  proposal sent 10 days ago, zero response since\nD) $500/mo merchant  signed deal, install team hasn't scheduled yet",
 opts:[
 {txt:"C  The $3K/mo ghost. Ten days of silence after a proposal is a dying deal. Call right now, resurface the value, and find out what's blocking the decision before the weekend kills it.",ok:2,fb:"Silence after a proposal is the loudest alarm in sales. Every day without follow-up increases the chance a competitor steps in or urgency fades. This was your real fire."},
 {txt:"A  Lock down the verbal yes with a signed contract before the weekend. Verbal commitments evaporate  get the signature now while the momentum is still warm from Thursday.",ok:1,fb:"Smart instinct  verbal yeses do evaporate. But A probably holds 48 hours. C has been silent for 10 DAYS and is 50% bigger. Triage by risk . value."},
 {txt:"B  Use the time to deeply prep the Wednesday demo. A killer demo on an $800 deal could impress your manager, and preparation is what separates top reps from average ones.",ok:0,fb:"You have all weekend and Mon-Tues to prep for Wednesday. Meanwhile, a $3K deal is dying RIGHT NOW. Don't prepare for the future while the present bleeds."},
 {txt:"D  Chase down the install team to make sure the onboarding is smooth. A botched install creates churn, and showing your manager you protect revenue retention makes you look strategic.",ok:0,fb:"D is signed and operational  that's an ops follow-up, not a sales priority. Your job Friday afternoon is saving revenue at risk (C) and locking new revenue (A)."}],
 bc:"Pipeline triage: Silent deals at risk > Unsigned verbal commits > Future demos > Post-sale ops. Time kills ALL deals  silence after a proposal is never 'they're thinking about it.'"},
{q:"Inbound lead: \"Small coffee shop, $4K/month on Square, curious about alternatives.\" You have 30 minutes before your next outbound block. How do you handle this?",
 context:"Your pipeline is light this month and you need every qualified opportunity you can get.",
 opts:[
 {txt:"Five-minute qualify call: Why are they looking NOW? What frustrates them about Square? Are they the decision-maker? If there's real pain and authority, book a 20-minute discovery. If not, send a follow-up email.",ok:2,fb:"Efficient qualification. Test for pain, authority, and urgency without over-investing. The 'why now' question reveals real intent vs. casual browsing."},
 {txt:"Schedule a full 30-minute demo right away  they raised their hand and speed-to-lead wins deals. Pull up the Square comparison deck and walk them through everything we offer vs. what they have.",ok:1,fb:"Speed matters, but you're investing 30 minutes before knowing IF there's real pain or buying authority. Five minutes of qualification protects your most valuable resource: time."},
 {txt:"Since pipeline is light, drop everything and do a comprehensive needs analysis right now. Go deep on their pain points, do a full competitive teardown, and try to close over the phone today.",ok:0,fb:"Desperation selling. You don't know if this person can even make a buying decision. A 5-minute qualify call tells you whether to invest 30 minutes or 30 seconds."},
 {txt:"Send a personalized email with a Square cost comparison calculator, a link to book a call at their convenience, and a customer testimonial. Let them self-select into a meeting.",ok:0,fb:"Email-only on inbound leads gets 2-5% response. A live call within 5 minutes converts 8x higher than a delayed response. Speed to lead = speed to close."}],
 bc:"Qualify FAST: Why now? What's the pain? Who decides? Match your investment to the opportunity. 5-min qualify  20-min discovery  proposal. Don't over-invest on unknowns."},
{q:"Halfway through the month: 4 closed deals at $6K monthly processing. Your target is $15K monthly. Pipeline shows 8 open deals at $22K potential. What do you do?",
 context:"Your historical close rate is 30%. The month ends in 14 business days.",
 opts:[
 {txt:"Do the math: 30% of $22K = $6.6K. Total projected: $12.6K  still $2.4K short. I need 3-4 new qualified opportunities THIS WEEK while accelerating my top 3 pipeline deals simultaneously.",ok:2,fb:"Math-driven urgency. You identified the gap, realized the pipeline alone won't cover it, and committed to both new generation AND acceleration. This is quota-crusher thinking."},
 {txt:"Focus 100% on closing the 8 open deals. $22K in pipeline at 30% close rate gets you to $12.6K  push harder on the best ones and try to close 4-5 instead of the typical 2-3 this cycle.",ok:1,fb:"You did the math but relied on over-performing your close rate to bridge the gap. What if you close at 25% this month? You need a backup: new pipeline generation NOW."},
 {txt:"Offer time-limited pricing incentives on the top 3 pipeline deals to accelerate decision-making. A small rate concession now is worth more than a missed target at month-end.",ok:0,fb:"Discounting to hit volume targets destroys margin AND trains your territory to wait for deals. You'll hit $15K in processing but miss your margin target."},
 {txt:"Stay the course  you're at $6K with half the month left, which means you're roughly on pace. Keep your normal activity cadence and the pipeline will convert naturally by month-end.",ok:0,fb:"$6K at the midpoint  on pace. Sales aren't linear  deals slip, ghost, and die. You're $2.4K short on projected. Urgency and action NOW, not 'it'll work out.'"}],
 bc:"Mid-month math: (Pipeline . close rate) + closed = projected. If projected < target, you need BOTH new pipeline AND deal acceleration. Never rely on over-performing your close rate."}
];

// COMP & MARGIN IQ (answers balanced)
const COMP=[
{q:"A merchant processes $10,000/month. On Square's flat rate (2.6% + 15 cents), roughly what do they pay annually in processing fees?",
 opts:["About $1,800  around $150 per month","About $3,300  roughly $275 per month","About $4,800  almost $400 per month","About $2,400  around $200 per month"],c:1,
 exp:"$10K . 2.6% = $260/mo + per-transaction fees  $275/mo = ~$3,300/year. This is YOUR number when selling RewardPay Choice: 'I can make that $3,300 disappear.' Always do the math for them."},
{q:"You close a merchant on RewardPay Choice vs. standard processing. What happens to YOUR residual income on that deal?",
 opts:["Same residual  your comp is based on processing volume, not the pricing program the merchant is on",
 "Higher residual  cost-savings programs produce better margin per deal, and your residual is margin-weighted",
 "Lower residual  you're giving away the processing revenue the merchant would have paid, so your cut shrinks",
 "No impact on residual  residuals are calculated on a flat per-deal basis regardless of how the merchant is priced"],c:1,
 exp:"Cost-savings programs = higher margin per deal. Higher margin = higher residual = bigger paycheck. The merchant saves money AND you make more. This is why RewardPay Choice is ALWAYS the right recommendation."},
{q:"What does the +25% V1 New Sales Margin target actually mean for how you sell?",
 opts:["Close 25% more deals than the previous rep who had your territory  it's a volume growth target",
 "Limit discounts to no more than 25% off the published rate card on any individual deal",
 "Every new deal should generate 25% more profit than baseline, which means selling cost-savings programs and avoiding unnecessary discounts",
 "Upsell add-on products on at least 25% of your new deals to increase the average deal value"],c:2,
 exp:"V1 = first-year value. +25% margin means structuring deals to be 25% more profitable. Cost-savings programs boost margin naturally. Discounting destroys it. This target directly impacts your comp."},
{q:"A prospect wants you to drop your rate by 10 basis points on $8K/month processing. What's the annual impact on your residual income?",
 opts:["Negligible  $96/year off the merchant's bill barely affects your residual split at all",
 "Significant  10bp across your portfolio compounds fast; that's $960/year on just this one merchant",
 "The impact is $960/year off the merchant's bill, and your residual share of that loss adds up across every deal you discount",
 "There's no direct impact  your residual is calculated before merchant discounts are applied to the rate"],c:2,
 exp:"10bp = 0.10%. $8K . 0.001 = $8/mo . 12 = $96/year off this ONE merchant. But 10bp across 20 merchants = ~$2,000/year in lost residuals. The real cost is the precedent: discount once, discount forever."},
{q:"Why does margin-weighted comp change how you should approach every deal?",
 opts:["It doesn't  your main focus should be closing volume because more deals = more total comp regardless of margin on individual deals",
 "It means a $3K/month deal on RewardPay Choice can pay you MORE than a $5K/month deal on discounted pricing  so selling value beats chasing volume",
 "It means you should always push the most expensive products since higher price points generate higher margin automatically",
 "It means you should only pursue enterprise-level merchants because the margin on small deals isn't worth your time investment"],c:1,
 exp:"A $3K/month full-margin deal > $5K/month discounted deal in YOUR paycheck. Margin-weighted comp rewards selling VALUE, not just volume. This is why cost-savings programs are your best friend."},
{q:"You closed 3 deals this month. Rank them by actual residual value to YOUR paycheck:",
 opts:["Deal A ($4K/mo, 10bp discount) > C ($6K/mo, full margin) > B ($2K/mo, RewardPay)  because A is mid-size with the least discount",
 "Deal C ($6K/mo, full margin) > B ($2K/mo, RewardPay margin boost) > A ($4K/mo, 10bp discount)  full margin and RewardPay beat discounted volume",
 "Deal C ($6K/mo, full margin) > A ($4K/mo, 10bp discount) > B ($2K/mo, RewardPay)  volume matters most after margin, and B is too small",
 "All three pay roughly the same residual because Payroc standardizes commissions across deal types and pricing programs"],c:1,
 exp:"C (full margin, highest volume) > B (RewardPay margin boost makes small deal valuable) > A (discount erodes margin permanently). Even $2K/month on RewardPay beats $4K/month with a discount."},
{q:"When a merchant demands your lowest possible rate, which response protects both their costs AND your margin?",
 opts:["Offer interchange-plus at cost with a low monthly fee  it's transparent and merchants appreciate knowing exactly what they're paying per transaction",
 "Introduce ConsumerChoice dual pricing  the merchant's effective processing cost drops to near zero, they save more than any rate cut, and you keep full margin",
 "Match whatever their best competing quote is  winning the deal at any margin is better than losing it, because the residual stream grows over time",
 "Propose a tiered pricing model that starts low and steps up gradually over 12 months  the merchant gets an entry price and your margin improves later"],c:1,
 exp:"ConsumerChoice: merchant pays near-zero (better than ANY 'low rate'), you keep full margin. It's the only play that's a true win/win. Rate cuts are permanent  programs are differentiators."},
{q:"Why are residuals more valuable than upfront commission for long-term career earnings?",
 opts:["They aren't  upfront commission is always larger per deal and more predictable since you get paid at closing instead of waiting months",
 "Residuals compound: every new merchant adds monthly recurring income, and after 2-3 years of consistent selling, your residual book can exceed your commission",
 "Residuals are guaranteed income that never churns, so once a merchant is signed you earn from them for the life of the relationship with zero risk",
 "Residuals let you earn while you sleep, which means top reps eventually stop prospecting and live off their book of business once it's large enough"],c:1,
 exp:"Residuals are the wealth engine. Each merchant adds recurring monthly income. BUT they're not guaranteed  churn matters. High-margin deals on cost-savings programs retain better AND pay more."}
];

// COACH'S CORNER (answers balanced)
const COACH=[
{q:"Your manager reviews a lost deal and says: \"You demoed before you discovered.\" What did you do wrong?",
 opts:[
 {txt:"I showed the product before understanding the prospect's specific problems. My demo was a generic features tour instead of a prescriptive solution tailored to their pain.",ok:2,fb:"Exactly. A demo without discovery is a features tour. A demo AFTER discovery is a solution. The prospect should see THEIR problem being solved, not your product being showcased."},
 {txt:"I should have sent a detailed proposal with pricing before the demo so the prospect knew exactly what they were committing to. That way the demo would have felt more purposeful.",ok:0,fb:"That's even more backwards. Discovery  Demo  Proposal. You can't propose a solution you haven't demonstrated, and you can't demo effectively without knowing their needs."},
 {txt:"I probably talked too much during the demo and didn't let the prospect ask enough questions. A good demo should be more of a two-way conversation than a presentation.",ok:1,fb:"Talking too much is a symptom, not the cause. The ROOT issue is you didn't discover their pain first, so you had nothing to anchor on and defaulted to a feature dump."},
 {txt:"I should have spent more time building rapport and establishing trust before jumping into the technical demonstration. Relationships come before product in consultative selling.",ok:0,fb:"Rapport matters, but that's not what 'demo before discovery' means. The problem is you didn't DIAGNOSE their business pain. Rapport without discovery is just a friendly conversation that goes nowhere."}]},
{q:"Before a ride-along meeting, your manager asks: \"What's your pre-call plan for this prospect?\" What's the right answer?",
 opts:[
 {txt:"I researched them  3-location restaurant group, ~$30K/month on Toast. Goal: confirm their pain with proprietary hardware, demo ROC Terminal+ flexibility and ConsumerChoice savings, and leave with a signed agreement.",ok:2,fb:"This is a pre-call plan: research done, pain hypothesized, product matched, cost-savings positioned, and a clear ask. Your manager knows you're prepared and intentional."},
 {txt:"I have the demo environment loaded, our latest case study from a similar restaurant group, and all the pricing sheets ready. I want to make sure we look professional and prepared in front of them.",ok:0,fb:"Materials aren't a plan. What's your opening question? What pain are you testing for? What product fits? What's your close? Those answers make a plan."},
 {txt:"I'm going to lead with discovery  ask open-ended questions about their current pain points, their vision for the business, and what would make them switch. I'll adapt my pitch to whatever they tell me.",ok:1,fb:"Discovery-first is right, but 'see what happens' isn't a plan. A plan has a HYPOTHESIS: 'I think they'll have X pain, I'll lead with Y solution, my close is Z.' Then adapt."},
 {txt:"I want to use this meeting to build a strong relationship first. My goal is to understand their business deeply  not to sell on the first visit. I'll schedule a follow-up for the actual proposal.",ok:0,fb:"Two-call selling on a qualified prospect is undisciplined. Your manager wants you to advance the deal, not schedule another meeting. Research, plan, and be ready to close."}]},
{q:"Your close rate is 15% vs. team average of 28%. Your manager asks you to diagnose the problem. Where do you start?",
 opts:[
 {txt:"My discovery process. If I'm not finding real pain and confirming urgency in the first conversation, I'm building pipeline with prospects who were never serious. Weak discovery = weak pipeline = low close rate.",ok:2,fb:"Correct starting point. Close rate problems almost always start upstream. If you're at 15%, you're either pitching unqualified prospects or not finding real pain."},
 {txt:"My follow-up cadence and timing. I need to look at how quickly I'm following up after demos and proposals, and whether deals are stalling because I'm not maintaining enough contact momentum.",ok:1,fb:"Follow-up matters, but it's a downstream fix. If your discovery was strong and pain was real, deals close with less follow-up. Fix the root cause, not the symptom."},
 {txt:"My competitive positioning. I'm probably losing deals to competitors because I'm not differentiating Payroc strongly enough  I need sharper battle cards and better competitive knowledge.",ok:0,fb:"Competitive knowledge rarely causes a 13-point close rate gap. You could know every competitor perfectly and still lose if you're pitching unqualified prospects with no urgency."},
 {txt:"My pricing strategy. I need to be more aggressive in my initial quotes and offer better upfront economics to get prospects past the decision point faster  the team probably discounts more.",ok:0,fb:"Discounting to improve close rate is a margin trap. And it's rarely the real issue. A 15% close rate means pipeline quality problems, not pricing problems."}]},
{q:"A senior rep tells you: \"Stop selling the product. Start selling the outcome.\" What does that look like for ROC Services?",
 opts:[
 {txt:"Instead of 'mobile invoicing and QuickBooks sync,' I'd say: 'Your tech finishes a job, invoices from their phone, customer pays before they leave, and it's in your books by dinner. No more chasing payments.'",ok:2,fb:"That's outcome selling. The customer sees their life CHANGING  not a list of tools. They don't buy 'mobile invoicing,' they buy 'getting paid immediately and ending the invoice chase.'"},
 {txt:"Instead of listing features, I'd bring a case study from a similar business and let the results speak for themselves  real numbers from real merchants always resonate more than a pitch.",ok:1,fb:"Case studies help, but YOU need to paint the outcome in THEIR specific context. 'A plumber like you cut his payment cycle from 14 days to same-day'  outcome + relevance."},
 {txt:"I'd shift from talking about what the product does to emphasizing Payroc's reputation, our customer satisfaction scores, and the longevity of our company. Outcomes are about trust and credibility.",ok:0,fb:"Company reputation isn't an outcome  it's a credential. Outcome selling means 'here's how your daily life gets better.' They don't care about your satisfaction score."},
 {txt:"I'd focus on the ROI calculation  show them the exact dollar savings per month, the time saved on admin, and the annual financial impact. Hard numbers make the value proposition undeniable.",ok:1,fb:"ROI helps, but outcome selling is MORE than math. It's painting a vivid picture of their new reality. 'Your tech invoices on-site, gets paid instantly, no more chasing'  that's a movie, not a spreadsheet."}]},
{q:"You're hitting activity numbers but not closing. Your manager says: \"You're selling to people who were never going to buy.\" What's the real problem?",
 opts:[
 {txt:"I'm not qualifying hard enough. My pipeline is full of 'maybes' instead of prospects with real pain, budget authority, and urgency. High activity + low close rate = qualification problem, every time.",ok:2,fb:"Exactly. If you're making 50 dials and closing 2 deals, your issue isn't effort  it's aim. Disqualify ruthlessly: real pain, authority to decide, urgency to act. If any is missing, move on."},
 {txt:"I'm probably spending too much time with each prospect instead of moving faster through my pipeline. If I shorten my sales cycle and increase my velocity, more deals will naturally fall into place.",ok:1,fb:"Speed matters, but going FASTER at selling to the wrong people just wastes time more efficiently. Fix WHO you're selling to before you fix HOW FAST you're selling."},
 {txt:"I need to look at my lead sources and push marketing for better quality inbound leads. If the leads I'm getting are low-intent browsers, no amount of sales skill is going to convert them.",ok:0,fb:"Blaming lead quality is a trap. Top closers qualify ruthlessly regardless of source. A cold call to the right prospect beats a warm lead to the wrong one."},
 {txt:"My pitch probably isn't compelling enough  I need to work on my value proposition and make a stronger first impression so prospects stay engaged through the full sales conversation.",ok:0,fb:"Pitch quality rarely causes high-activity-low-close. You could deliver the perfect pitch to someone with no pain or authority and still lose. The problem is who you're pitching TO."}]}
];



function saveSkill(gameId, pct, pts, maxPts){
  const key = SKILL_MAP[gameId]; if(!key||key==='certification') return;
  if(!D.skills[key]) D.skills[key]={best:0,last:0,attempts:0,lastDate:null};
  D.skills[key].last = pct;
  D.skills[key].best = Math.max(D.skills[key].best, pct);
  D.skills[key].attempts++;
  D.skills[key].lastDate = new Date().toISOString().split('T')[0];
  // Submit score to backend
  API.submitScore('game', gameId, pts||Math.round(pct), maxPts||100, {skill:key,pct:pct}).catch(e=>console.warn('[GAME] Score submit failed:',e.message));
}

// Proficiency levels (industry standard 5-tier model)
function getProficiency(score){
  if(score===0) return {level:'Not Started',cls:'ns',num:0};
  if(score<40)  return {level:'Aware',cls:'aw',num:1};
  if(score<65)  return {level:'Practicing',cls:'pr',num:2};
  if(score<85)  return {level:'Competent',cls:'cp',num:3};
  return {level:'Expert',cls:'ex',num:4};
}

// Readiness Score — weighted composite (Mindtickle Readiness Index model)
function getReadiness(){
  let sum=0;
  SKILL_KEYS.forEach(k=>{
    const s=D.skills[k];
    sum += (s?s.best:0) * SKILL_WEIGHTS[k];
  });
  return Math.round(sum);
}

// ─── REINFORCEMENT CADENCE (Pillar: Spaced Repetition) ───
function getDaysSince(dateStr){
  if(!dateStr) return -1;
  const d=new Date(dateStr),now=new Date();
  return Math.floor((now-d)/(1000*60*60*24));
}
function getReinforcementStatus(dateStr){
  const d=getDaysSince(dateStr);
  if(d<0)  return {label:'Not Started',cls:'rf-ns',icon:'⬜'};
  if(d<=2) return {label:'Fresh',cls:'rf-fresh',icon:'✅'};
  if(d<=6) return {label:d+'d ago',cls:'rf-good',icon:'🟡'};
  if(d<=13)return {label:d+'d ago',cls:'rf-soon',icon:'🟠'};
  return {label:d+'d ago — REVIEW',cls:'rf-review',icon:'🔴'};
}

// ─── CORE HELPERS ───
function sv(){/* no-op: saves now go through API */}
function show(id, opts){
  const prev = document.querySelector('.screen.active');
  const prevId = prev ? prev.id : null;
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0,0);
  // Push to browser history (skip game engines — they're transient screens)
  const noHistory = new Set(['floor','blitz','terr','quiz','coach']);
  if (!noHistory.has(id) && (!opts || !opts.replace)) {
    history.pushState({screen: id, prev: prevId}, '', '#' + id);
  } else if (opts && opts.replace) {
    history.replaceState({screen: id}, '', '#' + id);
  }
}
// ─── BROWSER HISTORY (back button) ───
window.addEventListener('popstate', (e) => {
  if (e.state && e.state.screen) {
    const id = e.state.screen;
    const el = document.getElementById(id);
    if (el) {
      cleanupGameState();
      document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
      el.classList.add('active');
      window.scrollTo(0,0);
      if (id === 'home') renderHome();
    }
  } else {
    // No state — go home
    cleanupGameState();
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('home').classList.add('active');
    renderHome();
  }
});

// ─── PROGRESS HELPERS ───
function getModProg(id){
  const p = D.modules[id]||{};
  return {video:!!p.video, doc:!!p.doc, game:!!p.game, apply:!!p.apply,
    count: (p.video?1:0)+(p.doc?1:0)+(p.game?1:0)+(p.apply?1:0)};
}
function isModDone(id){return getModProg(id).count===4}
function isPhaseDone(n){return MODULES.filter(m=>m.phase===n).every(m=>isModDone(m.id))}
function isPhaseOpen(n){return n===1||isPhaseDone(n-1)}
function getActStatus(modId, type){
  const p = getModProg(modId);
  if(p[type]) return 'done';
  const order = ['video','doc','game','apply'];
  const idx = order.indexOf(type);
  if(idx===0) return 'avail';
  return p[order[idx-1]] ? 'avail' : 'locked';
}
function completeAct(modId, type){
  if(!D.modules[modId]) D.modules[modId]={};
  D.modules[modId][type]=true;
  // Sync to backend
  API.saveProgress(modId, type, 'done').catch(e=>{
    console.warn('[PROGRESS] Save failed:',e.message);
    toast('Progress save failed — will retry on next load','error');
  });
}

// ─── XP & LEVEL (Power Score is computed server-side) ───
function addXP(n){/* no-op: Power Score is server-side */}
function streak(n){D.bst=Math.max(D.bst,n);}
function sfx(f,t){try{if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.frequency.value=f;o.type='sine';g.gain.setValueAtTime(.08,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+t);o.start();o.stop(audioCtx.currentTime+t)}catch(e){}}
function popup(txt,good,x,y){const d=document.createElement('div');d.className=`popup ${good?'good':'bad'}`;d.textContent=txt;d.style.left=x+'px';d.style.top=y+'px';document.body.appendChild(d);setTimeout(()=>d.remove(),900)}

// ─── HOME SCREEN ───
function home(){curMod=null;cleanupGameState();show('home');renderHome()}
function renderHome(){
  // Stats — modules done count
  const doneMods = MODULES.filter(m=>isModDone(m.id)).length;
  document.getElementById('hSk').textContent=doneMods;

  // ─── READINESS INDEX (Pillar: Skill Measurement) ───
  const readiness = getReadiness();
  const rProf = getProficiency(readiness);
  let rh = '<div class="ready-section">';
  rh += `<div class="ready-head"><div><div class="ready-label">READINESS INDEX</div><div class="ready-sub">${rProf.level}</div></div><div class="ready-score rs-${rProf.cls}">${readiness}</div></div>`;
  // Competency bars
  rh += '<div class="comp-bars">';
  SKILL_KEYS.forEach(k=>{
    const s = D.skills[k];
    const best = s?s.best:0;
    const prof = getProficiency(best);
    const reinf = getReinforcementStatus(s?s.lastDate:null);
    rh += `<div class="comp-row"><div class="comp-info"><span class="comp-name">${SKILL_LABELS[k]}</span><span class="comp-meta">${best>0?best+'% &middot; '+prof.level:''} ${reinf.icon}</span></div>`;
    rh += `<div class="comp-track"><div class="comp-fill cf-${prof.cls}" style="width:${best}%"></div></div></div>`;
  });
  rh += '</div></div>';
  document.getElementById('readinessPanel').innerHTML = rh;

  // Phase map
  let h='';
  PHASES.forEach(ph=>{
    const mods=MODULES.filter(m=>m.phase===ph.num);
    const done=mods.filter(m=>isModDone(m.id)).length;
    const pct=Math.round(done/mods.length*100);
    const open=isPhaseOpen(ph.num);
    h+=`<div class="phase"><div class="ph p${ph.num}"><div class="ph-l">
      <div class="ph-n">Phase ${ph.num} &middot; ${ph.days}</div>
      <div class="ph-t">${ph.title}</div>
      <div class="ph-d">${open?ph.desc:'Complete Phase '+(ph.num-1)+' to unlock'}</div>
    </div><div class="ph-p">${pct}%</div></div>`;
    if(open){
      h+='<div class="ph-mods">';
      mods.forEach(m=>{
        const pr=getModProg(m.id);
        const st=isModDone(m.id)?'done':(pr.count>0?'prog':'');
        // Reinforcement indicator
        const skillKey = SKILL_MAP[m.game.gameId];
        const sk = skillKey?D.skills[skillKey]:null;
        const reinf = getReinforcementStatus(sk?sk.lastDate:null);
        h+=`<div class="mc" onclick="showModule('${m.id}')">
          <div class="mc-i">${m.icon}</div>
          <div class="mc-info"><div class="mc-t">${m.title} <span class="mc-reinf ${reinf.cls}">${reinf.icon}</span></div><div class="mc-d">${m.desc}</div>
          <div class="mc-dots">
            <div class="mc-dot ${pr.video?'done':(!pr.video&&getActStatus(m.id,'video')==='avail'?'cur':'')}"></div>
            <div class="mc-dot ${pr.doc?'done':(!pr.doc&&getActStatus(m.id,'doc')==='avail'?'cur':'')}"></div>
            <div class="mc-dot ${pr.game?'done':(!pr.game&&getActStatus(m.id,'game')==='avail'?'cur':'')}"></div>
            <div class="mc-dot ${pr.apply?'done':(!pr.apply&&getActStatus(m.id,'apply')==='avail'?'cur':'')}"></div>
          </div></div>
          <span class="mc-st ${st}">${isModDone(m.id)?'✅':(pr.count>0?pr.count+'/4':'')}</span></div>`;
      });
      h+='</div>';
    } else {
      h+='<div class="ph-mods">';
      mods.forEach(m=>{h+=`<div class="mc locked"><div class="mc-i">${m.icon}</div><div class="mc-info"><div class="mc-t">${m.title}</div><div class="mc-d">Locked</div></div><span class="mc-st lock">🔒</span></div>`});
      h+='</div>';
    }
    h+='</div>';
  });
  document.getElementById('phaseMap').innerHTML=h;
  // Certification
  const total=MODULES.length*4;
  const done2=MODULES.reduce((s,m)=>s+getModProg(m.id).count,0);
  const cpct=Math.round(done2/total*100);
  document.getElementById('hC').textContent=cpct+'%';
  document.getElementById('hCF').style.width=cpct+'%';
  let bhtml='';
  PHASES.forEach(ph=>{bhtml+=`<div class="badge ${isPhaseDone(ph.num)?'on':''}">${isPhaseDone(ph.num)?'⭐':'🔒'} Phase ${ph.num}</div>`});
  document.getElementById('hB').innerHTML=bhtml;
}

// ─── MODULE INTERIOR ───
function showModule(id){
  curMod=id;
  const mod=MODULES.find(m=>m.id===id);
  const ph=PHASES.find(p=>p.num===mod.phase);
  document.getElementById('modPhase').textContent='Phase '+mod.phase+' · '+ph.title;
  const acts=[
    {type:'video',icon:'📺',label:'WATCH',data:mod.video},
    {type:'doc',icon:'📖',label:'READ',data:mod.doc},
    {type:'game',icon:'🎮',label:'PLAY',data:mod.game},
    {type:'apply',icon:'🎓',label:'MASTER',data:mod.apply}
  ];
  let h=`<div class="mod-head"><div class="mod-icon">${mod.icon}</div><div class="mod-title">${mod.title}</div><div class="mod-desc">${mod.desc}</div></div>`;

  // Behavioral Standards (Pillar: Behavioral Standards)
  const phStandards = PHASES.find(p=>p.num===mod.phase);
  if(phStandards && phStandards.standards){
    h+='<div class="beh-standards"><div class="beh-title">📋 Behavioral Standard — Phase '+mod.phase+'</div>';
    phStandards.standards.forEach(s=>{
      h+=`<div class="beh-item"><span class="beh-level beh-${s.level.toLowerCase()}">${s.level}</span><span class="beh-desc">${s.desc}</span></div>`;
    });
    h+='</div>';
  }

  // Skill score for this module's game
  const skillKey = SKILL_MAP[mod.game.gameId];
  const sk = skillKey?D.skills[skillKey]:null;
  if(sk && sk.best > 0){
    const prof = getProficiency(sk.best);
    const reinf = getReinforcementStatus(sk.lastDate);
    h+=`<div class="mod-skill"><div class="mod-skill-row"><span class="comp-name">Skill Score</span><span class="rs-${prof.cls}">${sk.best}% &middot; ${prof.level}</span></div>`;
    h+=`<div class="mod-skill-row"><span class="comp-name">Attempts</span><span>${sk.attempts}</span></div>`;
    h+=`<div class="mod-skill-row"><span class="comp-name">Last Practiced</span><span>${reinf.icon} ${reinf.label}</span></div></div>`;
  }

  acts.forEach(a=>{
    const st=getActStatus(id,a.type);
    const stIcon=st==='done'?'✅':(st==='avail'?'→':'🔒');
    const click=st==='locked'?`toast('Complete the previous activity to unlock this one','info')`:(`launchAct('${a.type}')`);
    h+=`<div class="act ${st}" onclick="${click}">
      <div class="act-i ${a.type}">${a.icon}</div>
      <div class="act-info"><div class="act-type">${a.label}</div><div class="act-t">${a.data.title}</div></div>
      <span class="act-st">${stIcon}</span></div>`;
  });
  document.getElementById('modBody').innerHTML=h;
  show('module');
}

// ─── ACTIVITY LAUNCHER ───
function launchAct(type){
  const mod=MODULES.find(m=>m.id===curMod);
  if(type==='video') showVideo(mod);
  else if(type==='doc') showDoc(mod);
  else if(type==='game') launchGame(mod.game.gameId);
  else if(type==='apply') showApply(mod);
}

function backToModule(){
  // Pause and destroy all iframes to prevent memory leaks
  document.querySelectorAll('#actBody iframe').forEach(iframe => {
    try { iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}','*'); } catch(e) {}
    iframe.src = '';
    iframe.remove();
  });
  plExpanded = null;
  if(curMod)showModule(curMod);else home();
}
function backFromGame(){cleanupGameState();if(curMod)showModule(curMod);else home()}

// ─── GAME STATE CLEANUP ───
// Clears any running timers, intervals, or event listeners from game engines
function cleanupGameState(){
  if(typeof bz!=='undefined' && bz.tid){clearInterval(bz.tid);bz.tid=null;}
}

// ─── ESCAPE KEY HANDLER ───
document.addEventListener('keydown', function(e){
  if(e.key==='Escape'){
    const pwModal=document.getElementById('pwChangeModal');
    if(pwModal && pwModal.style.display!=='none') { pwModal.style.display='none'; return; }
    const profileModal=document.getElementById('profileCard');
    if(profileModal && profileModal.classList.contains('show')) { profileModal.classList.remove('show'); return; }
  }
});

// ─── VIDEO VIEWER (supports single video + playlist) ───
let plWatched = {}; // track which playlist items have been viewed this session and expanded state
let plExpanded = null; // currently expanded item index
function showVideo(mod){
  const v=mod.video;
  document.getElementById('actBack').onclick=backToModule;
  document.getElementById('actLabel').textContent='📺 Watch';
  let h='';

  if(v.playlist){
    // Playlist mode — accordion UI
    plWatched = {};
    plExpanded = null;
    h+=`<div class="vid-title">${v.title}</div>`;
    h+=`<div class="pl-list" id="plList">`;
    v.playlist.forEach((p,i)=>{
      h+=`<div class="pl-item" id="plI${i}" data-idx="${i}" tabindex="0">
        <div class="pl-header" onclick="togglePlaylistItem(${i})">
          <span class="pl-icon">${p.icon||'📺'}</span>
          <div class="pl-info"><div class="pl-name">${p.title}</div><div class="pl-desc">${p.desc}</div></div>
          <span class="pl-chevron" id="plChev${i}">›</span>
        </div>
        <div class="pl-video-wrap" id="plVid${i}" style="height:0;overflow:hidden"></div>
      </div>`;
    });
    h+=`</div>`;
    const done=getActStatus(curMod,'video')==='done';
    h+=`<button class="nb pr show" id="vidDoneBtn" onclick="markVideoComplete()" ${done?'disabled style="opacity:.5"':''}>${done?'✅ Completed':'Mark as Watched'}</button>`;
    document.getElementById('actBody').innerHTML=h;
    show('activity');
    
    // Keyboard nav
    document.querySelectorAll('.pl-item').forEach((el,idx)=>{
      el.addEventListener('keydown',e=>{
        if(e.key==='Enter'||e.key===' '){e.preventDefault();togglePlaylistItem(idx)}
        if(e.key==='Escape'){if(plExpanded!==null)togglePlaylistItem(plExpanded)}
        if(e.key==='ArrowDown'){e.preventDefault();const next=document.getElementById(`plI${idx+1}`);if(next)next.focus()}
        if(e.key==='ArrowUp'){e.preventDefault();const prev=document.getElementById(`plI${idx-1}`);if(prev)prev.focus()}
      });
    });
  } else {
    // Single video mode (backward compat)
    if(v.url){
      h+=`<div class="vid-wrap"><iframe src="${v.url}" frameborder="0" allowfullscreen></iframe></div>`;
    } else {
      h+=`<div class="vid-wrap"><div class="vid-mock"><div class="vid-mock-icon">▶</div><div class="vid-mock-text">Video Coming Soon</div><div style="font-size:.65rem;color:var(--dg)">Add URL in modules.js</div></div></div>`;
    }
    h+=`<div class="vid-title">${v.title}</div><div class="vid-desc">${v.desc||''}</div>`;
    const done=getActStatus(curMod,'video')==='done';
    h+=`<button class="nb pr show" onclick="markVideoComplete()" ${done?'disabled style="opacity:.5"':''}>${done?'✅ Completed':'Mark as Watched'}</button>`;
    document.getElementById('actBody').innerHTML=h;
    show('activity');
  }
}

function togglePlaylistItem(idx){
  const mod=MODULES.find(m=>m.id===curMod);
  const p=mod.video.playlist[idx];
  const vidWrap=document.getElementById('plVid'+idx);
  const chevron=document.getElementById('plChev'+idx);
  const item=document.getElementById('plI'+idx);

  if(plExpanded===idx){
    // COLLAPSE
    item.classList.remove('expanded');
    plExpanded=null;
    // Pause video FIRST
    const iframe=vidWrap.querySelector('iframe');
    if(iframe) iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}','*');
    
    // Then animate collapse
    if(typeof gsap!=='undefined'){
      gsap.to(vidWrap,{height:0,duration:0.4,ease:'power2.in'});
      gsap.to(chevron,{rotation:0,duration:0.4,ease:'power1.inOut'});
    } else {
      vidWrap.style.height='0';
    }
  } else {
    // Helper to expand the new item
    const doExpand=()=>{
      // Lazy-load iframe if not already loaded
      if(!vidWrap.innerHTML){
        vidWrap.innerHTML=p.url?`<div class="vid-wrap"><iframe src="${p.url}" frameborder="0" allowfullscreen allow="autoplay; encrypted-media"></iframe></div>`:`<div class="vid-wrap"><div class="vid-mock"><div class="vid-mock-icon">▶</div><div class="vid-mock-text">${p.title}</div><div style="font-size:.65rem;color:var(--dg)">Video Coming Soon</div></div></div>`;
      }
      
      // Mark as watched
      if(p.url) plWatched[idx]=true;
      
      // Expand
      item.classList.add('expanded');
      plExpanded=idx;
      if(typeof gsap!=='undefined'){
        gsap.to(vidWrap,{height:'auto',duration:0.6,ease:'power2.out',onComplete:()=>{
          // Auto-scroll into view
          const header=document.querySelector('#activity .gh');
          const hdrH=header?header.getBoundingClientRect().height:0;
          gsap.to(window,{scrollTo:{y:item,offsetY:hdrH+20},duration:0.6,ease:'power2.inOut'});
        }});
        gsap.to(chevron,{rotation:90,duration:0.4,ease:'power1.inOut'});
      } else {
        vidWrap.style.height='auto';
      }
    };

    // COLLAPSE PREVIOUS (if any), THEN EXPAND
    if(plExpanded!==null){
      const prevWrap=document.getElementById('plVid'+plExpanded);
      const prevChev=document.getElementById('plChev'+plExpanded);
      const prevItem=document.getElementById('plI'+plExpanded);
      prevItem.classList.remove('expanded');
      // Pause previous video FIRST
      const prevIframe=prevWrap.querySelector('iframe');
      if(prevIframe) prevIframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}','*');
      
      if(typeof gsap!=='undefined'){
        // Collapse previous, THEN expand new in onComplete
        gsap.to(prevWrap,{height:0,duration:0.4,ease:'power2.in',onComplete:doExpand});
        gsap.to(prevChev,{rotation:0,duration:0.4,ease:'power1.inOut'});
      } else {
        prevWrap.style.height='0';
        doExpand();
      }
    } else {
      // No previous — expand immediately
      doExpand();
    }
  }
}
function markVideoComplete(){completeAct(curMod,'video');sfx(600,.15);setTimeout(()=>sfx(900,.15),120);toast('Video marked complete');backToModule()}

// ─── DOC VIEWER ───
function showDoc(mod){
  const d=mod.doc;
  document.getElementById('actBack').onclick=backToModule;
  document.getElementById('actLabel').textContent='📖 Read';
  let h=`<div class="vid-title">${d.title}</div>`;
  d.sections.forEach((s,i)=>{
    h+=`<div class="doc-sec" onclick="this.classList.toggle('open')">
      <div class="doc-h"><span>${esc(s.h)}</span><span class="arr">▼</span></div>
      <div class="doc-b">${sanitizeHTML(s.body)}</div></div>`;
  });
  const done=getActStatus(curMod,'doc')==='done';
  h+=`<button class="nb pr show" style="margin-top:16px" onclick="markDocComplete()" ${done?'disabled style="opacity:.5;margin-top:16px"':''}>${done?'✅ Completed':'Mark as Read'}</button>`;
  document.getElementById('actBody').innerHTML=h;
  show('activity');
}
function markDocComplete(){completeAct(curMod,'doc');sfx(600,.15);setTimeout(()=>sfx(900,.15),120);toast('Doc marked as read');backToModule()}

// ─── MASTER / CHECKLIST ───
function showApply(mod){
  const a=mod.apply;
  document.getElementById('actBack').onclick=backToModule;
  document.getElementById('actLabel').textContent='🎓 Master';
  const saved=D.modules[curMod]||{};
  const checks=saved.applyItems||{};
  let h=`<div class="vid-title">${a.title}</div><div class="vid-desc">${a.desc}</div>`;
  a.items.forEach((item,i)=>{
    const ck=checks[i]?'checked':'';
    // Support both new object format and legacy string format
    const isObj = typeof item === 'object';
    const txt = isObj ? item.text : item;
    const icon = isObj && item.icon ? item.icon+' ' : '';
    if(isObj && item.type==='chatbot'){
      h+=`<div class="chk ${ck}" onclick="toggleCheck(${i},this)"><div class="chk-box">${checks[i]?'✓':''}</div><div class="chk-txt">${icon}${txt}</div><button class="chk-action" onclick="event.stopPropagation();openChatbot()">Launch Coach</button></div>`;
    } else if(isObj && item.type==='link'){
      const url=item.url||'#';
      h+=`<div class="chk ${ck}" onclick="toggleCheck(${i},this)"><div class="chk-box">${checks[i]?'✓':''}</div><div class="chk-txt">${icon}${txt}</div>${url!=='#'?`<a class="chk-action" href="${url}" target="_blank" onclick="event.stopPropagation()">Open LMS</a>`:''}</div>`;
    } else {
      h+=`<div class="chk ${ck}" onclick="toggleCheck(${i},this)"><div class="chk-box">${checks[i]?'✓':''}</div><div class="chk-txt">${txt}</div></div>`;
    }
  });
  const allDone=a.items.every((_,i)=>checks[i]);
  h+=`<button class="nb pr show" style="margin-top:16px" id="applyBtn" onclick="markApplyComplete()" ${allDone&&getActStatus(curMod,'apply')==='done'?'disabled style="opacity:.5;margin-top:16px"':''}>`;
  h+=getActStatus(curMod,'apply')==='done'?'✅ Completed':'Complete All Items to Finish';
  h+='</button>';
  document.getElementById('actBody').innerHTML=h;
  show('activity');
}
function toggleCheck(i,el){
  if(!D.modules[curMod])D.modules[curMod]={};
  if(!D.modules[curMod].applyItems)D.modules[curMod].applyItems={};
  D.modules[curMod].applyItems[i]=!D.modules[curMod].applyItems[i];
  el.classList.toggle('checked');
  el.querySelector('.chk-box').textContent=D.modules[curMod].applyItems[i]?'✓':'';
  // Sync checklist to backend
  API.saveChecklist(curMod, i, D.modules[curMod].applyItems[i]).catch(e=>console.warn('[CHECK] Save failed:',e.message));
  sfx(D.modules[curMod].applyItems[i]?800:400,.1);
  const mod=MODULES.find(m=>m.id===curMod);
  const allDone=mod.apply.items.every((_,j)=>D.modules[curMod].applyItems[j]);
  const btn=document.getElementById('applyBtn');
  if(allDone&&getActStatus(curMod,'apply')!=='done'){
    btn.textContent='Complete Module Activity';btn.disabled=false;btn.style.opacity='1';
  }
}
function markApplyComplete(){
  const mod=MODULES.find(m=>m.id===curMod);
  const allDone=mod.apply.items.every((_,j)=>(D.modules[curMod]||{}).applyItems&&D.modules[curMod].applyItems[j]);
  if(!allDone)return;
  completeAct(curMod,'apply');sfx(600,.15);setTimeout(()=>sfx(900,.2),120);setTimeout(()=>sfx(1200,.15),240);
  toast('Module activity completed! 🎉');
  backToModule();
}

// ─── GAME LAUNCHER ───
function launchGame(gameId){
  if(gameId==='salesFloor') startFloor();
  else if(gameId==='objectionBlitz') startBlitz();
  else if(gameId==='territory') startTerr();
  else if(gameId==='compIQ') startQuiz('compIQ');
  else if(gameId==='productIQ') startQuiz('productIQ');
  else if(gameId==='featureFactory') startFactory();
  else if(gameId==='coachCorner') startCoach();
  else if(gameId==='certification') startQuiz('certification');
}

// ═══════════════════════════════════
// SALES FLOOR ENGINE
// ═══════════════════════════════════
let fl={i:0,si:0,pts:0,str:0};
const FTAGS={'1. IDENTIFY':['1. IDENTIFY','s1'],'2. APPOINTMENT':['2. APPOINTMENT','s2'],'3. PREP':['3. PREP','s3'],'4. MAKE THE SALE':['4. MAKE THE SALE','s4'],'5. CLOSE':['5. CLOSE','s5'],'6. REFERRAL':['6. REFERRAL','s6']};

function startFloor(){fl={i:0,si:0,pts:0,str:0};show('floor');renderFloor()}
function renderFloor(){
  const sc=FLOOR[fl.i],st=sc.steps[fl.si];
  document.getElementById('fI').textContent=`${sc.name} · Step ${fl.si+1}/${sc.steps.length}`;
  document.getElementById('fP').textContent=fl.pts+' pts';
  let sh='';sc.steps.forEach((_,j)=>{sh+=`<div class="step ${j<fl.si?'done':(j===fl.si?'cur':'')}"></div>`});
  document.getElementById('fSteps').innerHTML=sh;
  const tg=FTAGS[st.tag]||[st.tag,'s1'];
  let h=`<div class="scard"><div class="stag ${tg[1]}">${tg[0]}</div><div class="swho">
    <div class="sav">${sc.avi}</div><div><div class="sn">${sc.name}</div><div class="sty">${sc.type}</div></div></div>
    <div class="stxt">${st.q}</div></div><div class="opts" id="fOpts">`;
  const labels='ABC';
  st.opts.forEach((o,k)=>{h+=`<button class="opt" onclick="pickFloor(${k},event)"><span class="ol">${labels[k]}</span>${o.txt}</button>`});
  h+='</div><div class="fb" id="fFb"></div><button class="nb pr" id="fNext" onclick="nextFloor()">Continue →</button>';
  document.getElementById('fBody').innerHTML=h;
}
function pickFloor(k,e){
  const st=FLOOR[fl.i].steps[fl.si],o=st.opts[k];
  const pts=[0,40,100][o.ok];fl.pts+=pts;
  if(o.ok===2)fl.str++;else fl.str=0;streak(fl.str);
  document.querySelectorAll('#fOpts .opt').forEach((b,j)=>{b.classList.add('locked');if(j===k)b.classList.add(o.ok===2?'correct':'wrong');if(st.opts[j].ok===2&&j!==k)b.classList.add('wr')});
  const fb=document.getElementById('fFb');
  fb.className='fb show '+(o.ok===2?'fg':(o.ok===1?'fo':'fr'));
  fb.innerHTML=`<div class="fbt">${o.ok===2?'ELITE MOVE':(o.ok===1?'DECENT — BUT NOT ELITE':'ROOKIE MISTAKE')}</div>${o.fb}`;
  document.getElementById('fNext').classList.add('show');
  popup(o.ok===2?'+100':'+'+pts,o.ok>0,e.clientX,e.clientY);
  sfx(o.ok===2?880:330,o.ok===2?.2:.15);addXP(pts);
}
function nextFloor(){
  fl.si++;
  if(fl.si>=FLOOR[fl.i].steps.length){fl.i++;fl.si=0}
  if(fl.i>=FLOOR.length){finishFloor();return}renderFloor();
}
function finishFloor(){
  if(curMod)completeAct(curMod,'game');
  const mx=FLOOR.reduce((s,c)=>s+c.steps.length*100,0);
  const pct=Math.round(fl.pts/mx*100);
  saveSkill('salesFloor',pct,fl.pts,mx);
  showRes('The Sales Floor',fl.pts,mx,fl.str);
}

// ═══════════════════════════════════
// OBJECTION BLITZ ENGINE
// ═══════════════════════════════════
let bz={i:0,pts:0,str:0,pool:[],tid:null,tl:15};
function startBlitz(){
  bz={i:0,pts:0,str:0,pool:[...BLITZ].sort(()=>Math.random()-.5).slice(0,8),tid:null,tl:15};
  show('blitz');renderBlitz();
}
function renderBlitz(){
  if(bz.i>=bz.pool.length){finishBlitz();return}
  const q=bz.pool[bz.i];bz.tl=15;
  document.getElementById('bI').textContent=`${bz.i+1} / ${bz.pool.length}`;
  document.getElementById('bP').textContent=bz.pts+' pts';
  let h=`<div class="bzt"><svg viewBox="0 0 80 80"><circle class="trk" cx="40" cy="40" r="36"/><circle class="arc" id="bArc" cx="40" cy="40" r="36" stroke-dasharray="226" stroke-dashoffset="0"/></svg><div class="btv" id="bTv">15</div></div>`;
  h+=`<div class="bzs" id="bSt">${bz.str>=3?'🔥 '+bz.str+' STREAK!':(bz.str>0?bz.str+' in a row':'')}</div>`;
  h+=`<div class="bzq">"${q.obj}"</div><div class="opts" id="bOpts">`;
  const labels='ABC';
  q.opts.forEach((o,k)=>{h+=`<button class="opt" onclick="pickBlitz(${k},event)"><span class="ol">${labels[k]}</span>${o.txt}</button>`});
  h+='</div><div class="bc" id="bC"></div><button class="nb pr" id="bNext" onclick="nextBlitz()">Next →</button>';
  document.getElementById('bBody').innerHTML=h;
  startBlitzTimer();
}
function startBlitzTimer(){
  clearInterval(bz.tid);
  bz.tid=setInterval(()=>{
    bz.tl-=.1;if(bz.tl<=0){clearInterval(bz.tid);blitzTimeout();return}
    const pct=((15-bz.tl)/15)*226;
    const arc=document.getElementById('bArc');const tv=document.getElementById('bTv');
    if(arc){arc.style.strokeDashoffset=pct;if(bz.tl<=5){arc.classList.add('warn');tv.classList.add('warn')}
    tv.textContent=Math.ceil(bz.tl)}
  },100);
}
function blitzTimeout(){
  bz.str=0;
  document.querySelectorAll('#bOpts .opt').forEach((b,j)=>{b.classList.add('locked');if(bz.pool[bz.i].opts[j].ok===2)b.classList.add('wr')});
  const c=document.getElementById('bC');c.className='bc show';
  c.innerHTML=`<div class="bctl">⏰ TIME'S UP</div>${bz.pool[bz.i].opts.find(o=>o.ok===2).fb}`;
  document.getElementById('bNext').classList.add('show');
}
function pickBlitz(k,e){
  clearInterval(bz.tid);
  const q=bz.pool[bz.i],o=q.opts[k];
  const tb=Math.max(0,bz.tl);const pts=o.ok===2?Math.round(100+tb*10):(o.ok===1?30:0);
  bz.pts+=pts;if(o.ok===2)bz.str++;else bz.str=0;streak(bz.str);
  document.querySelectorAll('#bOpts .opt').forEach((b,j)=>{b.classList.add('locked');if(j===k)b.classList.add(o.ok===2?'correct':'wrong');if(q.opts[j].ok===2&&j!==k)b.classList.add('wr')});
  const c=document.getElementById('bC');c.className='bc show';
  c.innerHTML=`<div class="bctl">${o.ok===2?'🔥 ELITE RESPONSE':(o.ok===1?'⚠️ DECENT':'❌ ROOKIE')}</div>${o.fb}`;
  document.getElementById('bNext').classList.add('show');
  popup(pts>0?'+'+pts:'Miss',o.ok>0,e.clientX,e.clientY);
  sfx(o.ok===2?880:330,o.ok===2?.2:.15);addXP(pts);
}
function nextBlitz(){bz.i++;renderBlitz()}
function finishBlitz(){
  clearInterval(bz.tid);
  if(curMod)completeAct(curMod,'game');
  const mx=bz.pool.length*250;
  const pct=Math.round(bz.pts/mx*100);
  saveSkill('objectionBlitz',pct,bz.pts,mx);
  showRes('Objection Blitz',bz.pts,mx,bz.str);
}

// ═══════════════════════════════════
// TERRITORY ENGINE
// ═══════════════════════════════════
let tr={i:0,pts:0,pool:[]};
function startTerr(){tr={i:0,pts:0,pool:[...TERR].sort(()=>Math.random()-.5).slice(0,5)};show('terr');renderTerr()}
function renderTerr(){
  if(tr.i>=tr.pool.length){finishTerr();return}
  const q=tr.pool[tr.i];
  document.getElementById('tI').textContent=`${tr.i+1} / ${tr.pool.length}`;
  document.getElementById('tP').textContent=tr.pts+' pts';
  let h=`<div class="qc">${q.q}</div><div class="opts" id="tOpts">`;
  const labels='ABCD';
  q.opts.forEach((o,k)=>{h+=`<button class="opt" onclick="pickTerr(${k},event)"><span class="ol">${labels[k]}</span>${o.txt}</button>`});
  h+='</div><div class="qe" id="tE"></div><button class="nb pr" id="tNext" onclick="nextTerr()">Next →</button>';
  document.getElementById('tBody').innerHTML=h;
}
function pickTerr(k,e){
  const q=tr.pool[tr.i],o=q.opts[k];
  const pts=[0,40,100][o.ok];tr.pts+=pts;
  document.querySelectorAll('#tOpts .opt').forEach((b,j)=>{b.classList.add('locked');if(j===k)b.classList.add(o.ok===2?'correct':'wrong');if(q.opts[j].ok===2&&j!==k)b.classList.add('wr')});
  const ex=document.getElementById('tE');ex.className='qe show';ex.innerHTML=o.fb;
  document.getElementById('tNext').classList.add('show');
  popup(o.ok===2?'+100':'+'+pts,o.ok>0,e.clientX,e.clientY);
  sfx(o.ok===2?880:330,.15);addXP(pts);
}
function nextTerr(){tr.i++;renderTerr()}
function finishTerr(){
  if(curMod)completeAct(curMod,'game');
  const mx=tr.pool.length*100;
  const pct=Math.round(tr.pts/mx*100);
  saveSkill('territory',pct,tr.pts,mx);
  showRes('Territory & Pipeline',tr.pts,mx,0);
}

// ═══════════════════════════════════
// GENERIC QUIZ ENGINE (productIQ, compIQ, certification)
// ═══════════════════════════════════
let qz={i:0,pts:0,cor:0,pool:[],mode:''};
function startQuiz(mode){
  const data=mode==='productIQ'?PRODUCT:mode==='certification'?CERT:COMP;
  const title=mode==='productIQ'?'Product IQ':mode==='certification'?'Certification':'Comp & Margin IQ';
  qz={i:0,pts:0,cor:0,pool:[...data].sort(()=>Math.random()-.5).slice(0,8),mode,title};
  show('quiz');renderQuiz();
}
function renderQuiz(){
  if(qz.i>=qz.pool.length){finishQuiz();return}
  const q=qz.pool[qz.i];
  document.getElementById('qI').textContent=`${qz.i+1} / ${qz.pool.length}`;
  document.getElementById('qP').textContent=qz.pts+' pts';
  const pct=Math.round(qz.i/qz.pool.length*100);
  let h=`<div class="qp"><span class="qpt">${qz.title}</span><div class="qt"><div class="qf" style="width:${pct}%"></div></div></div>`;
  h+=`<div class="qc">${q.q}</div><div class="opts" id="qOpts">`;
  const labels='ABCD';
  q.opts.forEach((o,k)=>{h+=`<button class="opt" onclick="pickQuiz(${k},event)"><span class="ol">${labels[k]}</span>${o}</button>`});
  h+='</div><div class="qe" id="qE"></div><button class="nb pr" id="qNext" onclick="nextQuiz()">Next →</button>';
  document.getElementById('qBody').innerHTML=h;
}
function pickQuiz(k,e){
  const q=qz.pool[qz.i];
  const correct=k===q.c;const pts=correct?100:0;qz.pts+=pts;if(correct)qz.cor++;
  document.querySelectorAll('#qOpts .opt').forEach((b,j)=>{b.classList.add('locked');if(j===k)b.classList.add(correct?'correct':'wrong');if(j===q.c&&j!==k)b.classList.add('wr')});
  const ex=document.getElementById('qE');ex.className='qe show';ex.innerHTML=q.exp;
  document.getElementById('qNext').classList.add('show');
  popup(correct?'+100':'✗',correct,e.clientX,e.clientY);
  sfx(correct?880:330,.15);addXP(pts);
}
function nextQuiz(){qz.i++;renderQuiz()}
function finishQuiz(){
  if(curMod)completeAct(curMod,'game');
  const mx=qz.pool.length*100;
  const pct=Math.round(qz.pts/mx*100);
  // Submit quiz score to backend
  API.submitScore('quiz', 'quiz_'+curMod, qz.pts, mx, {correct:qz.cor,total:qz.pool.length}).catch(e=>console.warn('[QUIZ] Score submit failed:',e.message));
  saveSkill(qz.mode,pct,qz.pts,mx);
  showRes(qz.title,qz.pts,mx,0);
}

// ═══════════════════════════════════
// COACH'S CORNER ENGINE
// ═══════════════════════════════════
let co={i:0,pts:0,pool:[]};
function startCoach(){co={i:0,pts:0,pool:[...COACH].sort(()=>Math.random()-.5).slice(0,5)};show('coach');renderCoach()}
function renderCoach(){
  if(co.i>=co.pool.length){finishCoach();return}
  const q=co.pool[co.i];
  document.getElementById('coI').textContent=`${co.i+1} / ${co.pool.length}`;
  document.getElementById('coP').textContent=co.pts+' pts';
  let h=`<div class="scard"><div class="swho"><div class="sav">🎙️</div><div><div class="sn">${q.mgr}</div><div class="sty">Manager Feedback</div></div></div>
    <div class="stxt">${q.scenario}</div></div><div class="opts" id="coOpts">`;
  const labels='ABC';
  q.opts.forEach((o,k)=>{h+=`<button class="opt" onclick="pickCoach(${k},event)"><span class="ol">${labels[k]}</span>${o.txt}</button>`});
  h+='</div><div class="qe" id="coE"></div><button class="nb pr" id="coNext" onclick="nextCoach()">Next →</button>';
  document.getElementById('coBody').innerHTML=h;
}
function pickCoach(k,e){
  const q=co.pool[co.i],o=q.opts[k];
  const pts=[0,40,100][o.ok];co.pts+=pts;
  document.querySelectorAll('#coOpts .opt').forEach((b,j)=>{b.classList.add('locked');if(j===k)b.classList.add(o.ok===2?'correct':'wrong');if(q.opts[j].ok===2&&j!==k)b.classList.add('wr')});
  const ex=document.getElementById('coE');ex.className='qe show';ex.innerHTML=o.fb;
  document.getElementById('coNext').classList.add('show');
  popup(o.ok===2?'+100':'+'+pts,o.ok>0,e.clientX,e.clientY);
  sfx(o.ok===2?880:330,.15);addXP(pts);
}
function nextCoach(){co.i++;renderCoach()}
function finishCoach(){
  if(curMod)completeAct(curMod,'game');
  const mx=co.pool.length*100;
  const pct=Math.round(co.pts/mx*100);
  saveSkill('coachCorner',pct,co.pts,mx);
  showRes("Coach's Corner",co.pts,mx,0);
}

// ═══════════════════════════════════
// RESULTS SCREEN
// ═══════════════════════════════════
function showRes(title,pts,mx,str){
  const pct=Math.min(100,Math.round(pts/mx*100));
  const prof=getProficiency(pct);
  const grade=pct>=90?'S':pct>=80?'A':pct>=70?'B':pct>=60?'C':'D';
  const stars=pct>=90?'⭐⭐⭐':pct>=70?'⭐⭐':pct>=50?'⭐':'';
  let h=`<div class="res"><div class="rt">${title}</div><div class="rstr">${stars||'—'}</div>
    <div class="rsc">${pct}%</div>
    <div class="rprof rs-${prof.cls}">${prof.level}</div>
    <div class="rd">Score: ${pts} / ${mx}${str>2?' · Best Streak: '+str+' 🔥':''}</div>
    <div class="rxp">+${pts} XP Earned</div>`;
  // Badge
  if(pct>=80){
    const badges={90:'🏆',80:'🥇',70:'🥈'};
    const bicon=badges[Math.floor(pct/10)*10]||'🥈';
    h+=`<div class="rb"><div class="rbi">${bicon}</div><div class="rbn">${title} — Grade ${grade}</div><div class="rbd">Top ${100-pct}% performance</div></div>`;
  }
  h+=`<button class="nb pr show" onclick="${curMod?'backToModule()':'home()'}">← ${curMod?'Back to Module':'Mission Hub'}</button>`;
  h+=`<button class="nb gh2 show" onclick="home()">🏠 Home</button></div>`;
  document.getElementById('resBody').innerHTML=h;
  show('results');
}

// ─── PARTICLES ───
(function(){const c=document.getElementById('particles'),x=c.getContext('2d');let ps=[];
function resize(){c.width=innerWidth;c.height=innerHeight}
function init(){ps=[];for(let i=0;i<60;i++)ps.push({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*1.5+.5,dx:Math.random()*.3-.15,dy:Math.random()*.3-.15,a:Math.random()*.3+.1})}
function draw(){x.clearRect(0,0,c.width,c.height);ps.forEach(p=>{p.x+=p.dx;p.y+=p.dy;if(p.x<0)p.x=c.width;if(p.x>c.width)p.x=0;if(p.y<0)p.y=c.height;if(p.y>c.height)p.y=0;
x.beginPath();x.arc(p.x,p.y,p.r,0,Math.PI*2);x.fillStyle=`rgba(0,180,255,${p.a})`;x.fill()});requestAnimationFrame(draw)}
resize();init();draw();addEventListener('resize',()=>{resize();init()})})();

// Manager report removed — replaced by admin panel (Admin.showUserProgress)

// ═══════════════════════════════════
// FEATURE FACTORY ENGINE (Tetris-Style)
// ═══════════════════════════════════
let ff = null;
let ffRAF = null;
let ffKeys = {};

function startFactory(){
  document.getElementById('ffStart').style.display='flex';
  document.getElementById('ffP').textContent='0 pts';
  document.getElementById('ffStreak').textContent='';
  document.getElementById('ffNext').textContent='';
  document.getElementById('ffLives').textContent='❤️❤️❤️❤️❤️';
  // clean up any leftover GSAP popups
  document.querySelectorAll('.ff-pop').forEach(el=>el.remove());
  show('factory');
  // GSAP entrance
  if(typeof gsap!=='undefined'){
    gsap.fromTo('#factory',{scale:.92,opacity:0},{scale:1,opacity:1,duration:.45,ease:'back.out(1.4)'});
  }
  // Defer canvas sizing until layout is stable
  requestAnimationFrame(()=>requestAnimationFrame(()=>resizeFFCanvas()));
  // Resize on window change (rotation, etc.)
  window.removeEventListener('resize', resizeFFCanvas);
  window.addEventListener('resize', resizeFFCanvas);
}

function stopFactory(){
  if(ffRAF) cancelAnimationFrame(ffRAF);
  ffRAF=null; ff=null;
  window.removeEventListener('keydown',ffKeyDown);
  window.removeEventListener('keyup',ffKeyUp);
  window.removeEventListener('resize', resizeFFCanvas);
  document.querySelectorAll('.ff-pop').forEach(el=>el.remove());
  backFromGame();
}

// GSAP score popup — floats a DOM element over the canvas
function ffGsapPop(text,color,x,y){
  if(typeof gsap==='undefined') return;
  const el=document.createElement('div');
  el.className='ff-pop';
  el.textContent=text;
  el.style.cssText=`position:absolute;left:${x}px;top:${y}px;color:${color};font-weight:800;font-size:1.1rem;pointer-events:none;z-index:110;text-shadow:0 0 8px ${color};font-family:var(--font)`;
  document.getElementById('factory').appendChild(el);
  gsap.fromTo(el,{y:0,opacity:1,scale:1.3},{y:-60,opacity:0,scale:.8,duration:1,ease:'power2.out',onComplete:()=>el.remove()});
}

function resizeFFCanvas(){
  const c=document.getElementById('ffCanvas');
  if(!c) return;
  const par=c.parentElement;
  if(!par) return;
  const ghEl=par.querySelector('.gh');
  const hudEl=document.getElementById('ffHud');
  const touchEl=document.getElementById('ffTouch');
  if(!ghEl||!hudEl||!touchEl) return;
  const rect=par.getBoundingClientRect();
  const ghH=ghEl.getBoundingClientRect().height;
  const hudH=hudEl.getBoundingClientRect().height;
  const touchH=touchEl.getBoundingClientRect().height;
  const w=Math.floor(rect.width);
  const h=Math.floor(rect.height - ghH - hudH - touchH);
  if(w>0 && h>0){
    c.width=w;
    c.height=h;
  } else {
    // Layout not ready — retry
    setTimeout(resizeFFCanvas, 100);
  }
  // Update running game state if active
  if(ff && !ff.gameOver){
    ff.W=c.width;
    ff.H=c.height;
    ff.colW=c.width/4;
    for(let i=0;i<4;i++) ff.bins[i].x=i*ff.colW;
  }
}

function beginFactory(){
  try{
  document.getElementById('ffStart').style.display='none';

  const c=document.getElementById('ffCanvas');
  const par=c.parentElement;
  const ghEl=par.querySelector('.gh');
  const hudEl=document.getElementById('ffHud');
  const touchEl=document.getElementById('ffTouch');

  // Measure directly — don't rely on deferred resizeFFCanvas
  const rect=par.getBoundingClientRect();
  const ghH=ghEl?ghEl.getBoundingClientRect().height:40;
  const hudH=hudEl?hudEl.getBoundingClientRect().height:28;
  const touchH=touchEl?touchEl.getBoundingClientRect().height:50;
  const w=Math.floor(rect.width)||800;
  const h=Math.floor(rect.height - ghH - hudH - touchH)||400;
  c.width=w;
  c.height=h;

  console.log('[FF] Canvas:', w, 'x', h, '| Container:', rect.width, 'x', rect.height, '| gh:', ghH, 'hud:', hudH, 'touch:', touchH);

  const pool=[...FEATURES].sort(()=>Math.random()-.5);
  const colW=w/4;

  ff={
    canvas:c, ctx:c.getContext('2d'),
    W:w, H:h,
    colW:colW,
    pool:pool, poolIdx:0,
    active:null,
    bins:[],
    pts:0, streak:0, bestStreak:0,
    lives:5, maxLives:5,
    baseSpeed:1.2, speedMult:1,
    particles:[],
    flashes:[],
    totalFeatures:pool.length,
    sorted:0,
    gameOver:false,
    dropPressed:false,
    hdrH:ghH, hudH:hudH
  };

  // build bins
  for(let i=0;i<4;i++){
    ff.bins.push({x:i*colW, w:colW, label:PRODUCT_BINS[i].label, icon:PRODUCT_BINS[i].icon, color:PRODUCT_BINS[i].color});
  }

  console.log('[FF] Bins:', ff.bins.length, '| Pool:', ff.pool.length, '| colW:', colW);

  // spawn first piece
  ffSpawnPiece();
  ffUpdateNextPreview();

  // keys
  ffKeys={};
  window.addEventListener('keydown',ffKeyDown);
  window.addEventListener('keyup',ffKeyUp);

  // touch swipe
  c.addEventListener('touchstart',ffTouchStart,{passive:false});
  c.addEventListener('touchmove',ffTouchMove,{passive:false});
  c.addEventListener('touchend',ffTouchEnd,{passive:false});

  ffLoop();
  }catch(err){
    console.error('[FF] beginFactory ERROR:', err);
    const overlay=document.getElementById('ffStart');
    overlay.style.display='flex';
    overlay.innerHTML=`<div style="color:#ff4466;font-size:1.2rem;font-weight:700">Game Error</div><div style="color:#94a3b8;font-size:.85rem;max-width:400px;word-break:break-all">${err.message}<br><br>${err.stack||''}</div><button class="nb pr show" onclick="stopFactory()">← Back</button>`;
  }
}

function ffSpawnPiece(){
  if(ff.poolIdx>=ff.pool.length){ff.active=null;return;}
  const feat=ff.pool[ff.poolIdx++];
  const pw=Math.min(140, ff.colW-10);
  // start centered in a random column
  const startCol=Math.floor(Math.random()*4);
  const x=ff.bins[startCol].x + (ff.colW-pw)/2;
  ff.active={
    x:x, y:-40, w:pw, h:34,
    text:feat.text, product:feat.product,
    speed:ff.baseSpeed*ff.speedMult
  };
  ff.dropPressed=false;
}

function ffUpdateNextPreview(){
  const el=document.getElementById('ffNext');
  if(ff.poolIdx<ff.pool.length){
    el.textContent='Next: '+ff.pool[ff.poolIdx].text;
  } else {
    el.textContent='Last one!';
  }
}

// snap x to nearest column center
function ffSnapToCol(x,w){
  const col=Math.round(x/ff.colW);
  const clamped=Math.max(0,Math.min(3,col));
  return ff.bins[clamped].x + (ff.colW-w)/2;
}

function ffGetCol(x,w){
  return Math.max(0,Math.min(3, Math.round((x+(w/2)-ff.colW/2)/ff.colW) ));
}

// keyboard
function ffKeyDown(e){
  if(!ff||ff.gameOver) return;
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'||e.key==='ArrowDown'){
    e.preventDefault(); ffKeys[e.key]=true;
  }
}
function ffKeyUp(e){
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'||e.key==='ArrowDown') ffKeys[e.key]=false;
}

// touch buttons
function ffTouchBtn(dir){
  if(!ff||!ff.active||ff.gameOver) return;
  const a=ff.active;
  if(dir==='left'){
    const col=ffGetCol(a.x,a.w);
    if(col>0) a.x=ffSnapToCol(ff.bins[col-1].x,a.w);
  } else if(dir==='right'){
    const col=ffGetCol(a.x,a.w);
    if(col<3) a.x=ffSnapToCol(ff.bins[col+1].x,a.w);
  } else if(dir==='drop'){
    ff.dropPressed=true;
  }
}

// touch swipe
let ffTX=0,ffTY=0;
function ffTouchStart(e){e.preventDefault();const t=e.touches[0];ffTX=t.clientX;ffTY=t.clientY;}
function ffTouchMove(e){e.preventDefault();}
function ffTouchEnd(e){
  if(!ff||!ff.active) return;
  const t=e.changedTouches[0];
  const dx=t.clientX-ffTX, dy=t.clientY-ffTY;
  if(Math.abs(dx)>30 && Math.abs(dx)>Math.abs(dy)){
    ffTouchBtn(dx>0?'right':'left');
  } else if(dy>30){
    ffTouchBtn('drop');
  }
}

// game loop
function ffLoop(){
  if(!ff||ff.gameOver) return;
  ffUpdate();
  ffDraw();
  ffRAF=requestAnimationFrame(ffLoop);
}

function ffUpdate(){
  const f=ff, a=f.active;
  if(!a){
    // check if game done
    if(f.sorted>=f.totalFeatures){f.gameOver=true;ffEndGame();}
    return;
  }

  // keyboard movement — snap to columns
  if(ffKeys['ArrowLeft']){
    const col=ffGetCol(a.x,a.w);
    if(col>0) a.x=ffSnapToCol(f.bins[col-1].x,a.w);
    ffKeys['ArrowLeft']=false; // one press = one column move
  }
  if(ffKeys['ArrowRight']){
    const col=ffGetCol(a.x,a.w);
    if(col<3) a.x=ffSnapToCol(f.bins[col+1].x,a.w);
    ffKeys['ArrowRight']=false;
  }
  if(ffKeys['ArrowDown']){
    f.dropPressed=true;
    ffKeys['ArrowDown']=false;
  }

  // fall speed
  const fallSpeed=f.dropPressed ? 18 : a.speed;
  a.y+=fallSpeed;

  // check landing
  const binH=60;
  const landY=f.H-binH-a.h;
  if(a.y>=landY){
    a.y=landY;
    // determine which column
    const col=ffGetCol(a.x,a.w);
    const cx=a.x+a.w/2;

    if(col===a.product){
      // CORRECT
      f.pts+=100+(f.streak*10);
      f.streak++;
      if(f.streak>f.bestStreak) f.bestStreak=f.streak;
      sfx(660+f.streak*40,.15);
      ffSpawnParticles(cx,landY,PRODUCT_BINS[col].color,14);
      ffGsapPop('✅ +'+(100+((f.streak-1)*10)),'#34d399',cx-30,f.hdrH+f.hudH+landY-10);
    } else {
      // WRONG — show correct answer
      f.lives--;
      f.streak=0;
      sfx(220,.2);
      const correctName=PRODUCT_BINS[a.product].icon+' '+PRODUCT_BINS[a.product].label;
      ffGsapPop('❌ '+correctName,'#ef4444',cx-50,f.hdrH+f.hudH+landY-10);
      if(typeof gsap!=='undefined') gsap.to('#factory',{x:-6,duration:.06,repeat:5,yoyo:true,ease:'power1.inOut',onComplete:()=>gsap.set('#factory',{x:0})});
    }

    f.sorted++;
    document.getElementById('ffI').textContent=`${f.sorted}/${f.totalFeatures}`;

    // ramp difficulty every 5
    if(f.sorted%5===0){
      f.speedMult+=0.15;
    }

    // check game over
    if(f.lives<=0){
      f.gameOver=true;
      f.active=null;
      ffEndGame();
      return;
    }

    // spawn next
    ffSpawnPiece();
    ffUpdateNextPreview();
  }

  // update particles
  for(let i=f.particles.length-1;i>=0;i--){
    const p=f.particles[i];
    p.x+=p.vx; p.y+=p.vy; p.vy+=0.15; p.life--;
    if(p.life<=0) f.particles.splice(i,1);
  }
  for(let i=f.flashes.length-1;i>=0;i--){
    f.flashes[i].y-=0.7; f.flashes[i].life--;
    if(f.flashes[i].life<=0) f.flashes.splice(i,1);
  }

  // HUD
  document.getElementById('ffP').textContent=f.pts+' pts';
  document.getElementById('ffStreak').textContent=f.streak>1?'🔥 '+f.streak+'x':'';
  let hearts='';
  for(let i=0;i<f.maxLives;i++) hearts+=i<f.lives?'❤️':'🖤';
  document.getElementById('ffLives').textContent=hearts;
}

function ffSpawnParticles(x,y,color,count){
  for(let i=0;i<count;i++){
    ff.particles.push({x,y,vx:(Math.random()-.5)*6,vy:-(Math.random()*4+1),life:20+Math.random()*15,color});
  }
}

function ffDraw(){
  const f=ff, ctx=f.ctx;
  ctx.save();
  ctx.clearRect(0,0,f.W,f.H);

  // bins
  const binH=60, binY=f.H-binH;
  for(let i=0;i<4;i++){
    const b=f.bins[i];
    ctx.fillStyle=b.color+'22';
    ctx.fillRect(b.x,binY,b.w,binH);
    ctx.strokeStyle=b.color+'66';
    ctx.lineWidth=1;
    ctx.strokeRect(b.x,binY,b.w,binH);
    // label
    ctx.fillStyle=b.color;
    ctx.font='bold 12px "Segoe UI",system-ui,sans-serif';
    ctx.textAlign='center';
    ctx.fillText(b.icon+' '+b.label, b.x+b.w/2, binY+22);
    // subtle column shading
    ctx.fillStyle=b.color+'08';
    ctx.fillRect(b.x,0,b.w,binY);
  }

  // column separators
  for(let i=1;i<4;i++){
    ctx.strokeStyle='rgba(255,255,255,.06)';
    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(i*f.colW,0);
    ctx.lineTo(i*f.colW,f.H);
    ctx.stroke();
  }

  // draw active piece + ghost
  const a=f.active;
  if(a){
    const landY=f.H-binH-a.h;
    // ghost shadow
    ctx.fillStyle='rgba(255,255,255,.04)';
    ctx.strokeStyle='rgba(255,255,255,.1)';
    ctx.lineWidth=1;
    ffRoundRect(ctx, a.x, landY, a.w, a.h, 8);
    ctx.fill();
    ctx.stroke();

    // active piece
    const prodColor=PRODUCT_BINS[a.product].color;
    ctx.fillStyle='rgba(15,20,40,.9)';
    ctx.strokeStyle=prodColor+'66';
    ctx.lineWidth=2;
    ffRoundRect(ctx, a.x, a.y, a.w, a.h, 8);
    ctx.fill();
    ctx.stroke();
    // glow
    ctx.shadowColor=prodColor;
    ctx.shadowBlur=8;
    ctx.strokeStyle=prodColor+'44';
    ffRoundRect(ctx, a.x, a.y, a.w, a.h, 8);
    ctx.stroke();
    ctx.shadowBlur=0;
    // text
    ctx.fillStyle='#edf2ff';
    ctx.font='bold 12px "Segoe UI",system-ui,sans-serif';
    ctx.textAlign='center';
    ctx.fillText(a.text, a.x+a.w/2, a.y+a.h/2+4);
  }

  // particles
  for(const p of f.particles){
    ctx.globalAlpha=p.life/35;
    ctx.fillStyle=p.color;
    ctx.fillRect(p.x-2,p.y-2,4,4);
  }
  ctx.globalAlpha=1;

  // flashes
  for(const fl of f.flashes){
    ctx.globalAlpha=Math.min(1,fl.life/20);
    ctx.fillStyle=fl.color;
    ctx.font='bold 13px "Segoe UI",system-ui,sans-serif';
    ctx.textAlign='center';
    ctx.fillText(fl.text, fl.x, fl.y);
  }
  ctx.globalAlpha=1;

  ctx.restore();
}

function ffRoundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

function ffEndGame(){
  window.removeEventListener('keydown',ffKeyDown);
  window.removeEventListener('keyup',ffKeyUp);
  // remove touch listeners
  const c=document.getElementById('ffCanvas');
  c.removeEventListener('touchstart',ffTouchStart);
  c.removeEventListener('touchmove',ffTouchMove);
  c.removeEventListener('touchend',ffTouchEnd);
  if(ffRAF) cancelAnimationFrame(ffRAF);
  const mx=ff.totalFeatures*100;
  const pct=Math.min(100,Math.round(ff.pts/mx*100));
  saveSkill('featureFactory',pct,ff.pts,mx);
  if(curMod) completeAct(curMod,'game');
  showRes('Feature Factory',ff.pts,mx,ff.bestStreak);
}

// ─── INIT ───
// Load content + progress from server, then render home
(async function loadAndInit(){
  // Show loading state
  const homeEl = document.getElementById('home');
  if (homeEl) {
    const loader = document.createElement('div');
    loader.id = 'appLoader';
    loader.style.cssText = 'display:flex;align-items:center;justify-content:center;min-height:60vh;color:var(--text-secondary);font-size:1.1rem;';
    loader.textContent = 'Loading ROC Academy...';
    homeEl.prepend(loader);
  }

  // Load everything in parallel
  const [progressData, , , scoresData] = await Promise.allSettled([
    API.getProgress().catch(e => { console.warn('[GAME] Progress load failed:', e.message); return null; }),
    loadModules(),
    loadQuizzes(),
    API.getMyScores().catch(e => { console.warn('[GAME] Scores load failed:', e.message); return null; })
  ]);

  // Apply progress data
  if (progressData.status === 'fulfilled' && progressData.value && progressData.value.modules) {
    D.modules = progressData.value.modules;
  }

  // Rebuild skills from backend scores (fixes skills lost on refresh)
  if (scoresData.status === 'fulfilled' && scoresData.value && scoresData.value.scores) {
    scoresData.value.scores.forEach(s => {
      const skillKey = SKILL_MAP[s.activity_id];
      if (!skillKey || skillKey === 'certification') return;
      const pct = s.max_score > 0 ? Math.round((s.best_score / s.max_score) * 100) : 0;
      D.skills[skillKey] = {
        best: pct,
        last: pct,
        attempts: parseInt(s.attempts) || 0,
        lastDate: s.last_date ? new Date(s.last_date).toISOString().split('T')[0] : null
      };
    });
  }

  // Remove loader
  const loader = document.getElementById('appLoader');
  if (loader) loader.remove();

  // Render
  if (MODULES.length === 0) {
    if (homeEl) homeEl.innerHTML = '<div style="text-align:center;padding:4rem 1rem;color:var(--text-secondary)"><h2>⚠️ Content Unavailable</h2><p>Could not load training modules. Please try refreshing the page.</p><button onclick="location.reload()" style="margin-top:1rem;padding:.5rem 1.5rem;border-radius:8px;border:none;background:var(--accent);color:#fff;cursor:pointer">Refresh</button></div>';
  } else {
    home();
  }
})();
