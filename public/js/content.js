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
