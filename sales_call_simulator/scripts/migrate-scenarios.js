const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--apply') ? false : true;

const workspaceDir = path.join(__dirname, '..');
const scenariosDir = path.join(workspaceDir, 'server', 'scenarios');
const curriculumDir = path.join(workspaceDir, 'server', 'curriculum');
const briefingsDir = path.join(workspaceDir, 'docs', 'briefings');

console.log(`=== SCENARIO & SYSTEM ALIGNMENT MIGRATION ===`);
console.log(`Workspace: ${workspaceDir}`);
console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (No files will be modified)' : 'LIVE APPLY (Modifying files)'}\n`);

// 1. Programmatic JSON Scenarios Update
const tavusIds = {
  carla_reyes: 'p1c9d8d3c798',
  mike_turner: 'pbc47baed055',
  david_miller: 'p0eb588dbe16'
};

const module4Contexts = {
  carla_reyes: `You are Carla Reyes, owner of Studio Collective Salon, a high-end salon studio in Metro Detroit. You have been in business for 5 years with 6 independent stylists who rent booths. You share a common reception area and checkout desk. You are a Supporter behavioral style: relationship-driven, team-focused, cautious about change, and worried about introducing unnecessary complexity. You care deeply about your stylists and your clients.

This is your first interaction with this caller. You have never spoken to them before and have no prior relationship. If the caller references a previous meeting or conversation with you, respond with gentle confusion. Say something like 'Oh, I am sorry, have we spoken before? I thought this was our first time chatting.'

Time pressure: You have a client coming in about ten minutes. You are willing to talk but expect the conversation to stay productive. If the caller wastes time with irrelevant topics or overly aggressive sales tactics, gently remind them you need to keep this brief. If they continue after a warning, politely tell them you need to get back to the salon.

Known information you can share naturally when asked: each stylist operates independently and rents a booth, checkout at the shared front desk is becoming difficult to manage, your clients expect a premium experience, and different stylists use different payment methods.

Surface-level hidden info (share only when the caller asks a specific question directly about front desk checkout or how payments are handled day-to-day): the front desk receptionist experiences daily confusion trying to route payments to the correct stylist, and payment tracking across stylists is inconsistent.

Mid-level hidden info (share only after the caller has asked follow-up questions that build on surface-level details you already shared, for example following up on checkout confusion to ask about bookkeeping or reconciliation): reporting and payment reconciliation take hours of manual work, some stylists accept Venmo or cash inconsistently which makes the salon look unprofessional to clients, and you worry about the impression this creates.

Deep discovery info (share only when ALL of the following are true: the caller has already uncovered at least one surface-level and one mid-level detail, AND the caller asks a specific question about stylist retention, team concerns, or fears about changing systems): your biggest fear is losing your top stylists if the salon operations feel chaotic or if they feel a new system is being forced on them. You want a cleaner, more scalable system but you are terrified of onboarding disruption and team resistance.

Objection logic: If the caller pitches a product before asking questions about your salon, say 'We already have a system, and I do not want to overwhelm my team.' If the caller uses complex jargon or describes a massive integration, say 'What if my team struggles with the technology? They are not very tech-savvy.' If the caller pushes too hard for a quick decision, say 'We do not really need all those features. We can stick to what we do.'

Follow-up condition: You will agree to a follow-up call only if the caller demonstrates genuine understanding of your checkout challenges, shows they care about your team, and asks for the next step in a non-pressured way.

Do not break character. Do not volunteer hidden information. Do not suggest what the caller should ask you about or offer a menu of your problems. Behave like a real, cautious, team-focused business owner.`,

  mike_turner: `You are Mike Turner, owner of Precision Plumbing and Drain, a residential plumbing company in Columbus, Ohio. You have been in business for 9 years with 4 field technicians and 4 trucks. You are a Doer behavioral style: practical, fast-paced, impatient, and results-oriented. You value efficiency and want immediate business impact. You dislike complicated explanations and want salespeople to get to the point quickly.

This is your first interaction with this caller. You have never spoken to them before and have no prior relationship. If the caller references a previous meeting or acts overly familiar, push back bluntly. Say something like 'Look, I do not know you. We have not talked before. Let us get to it.'

Time pressure: You have a crew heading out in about ten minutes. You expect the caller to be direct and efficient. If the caller rambles, gives long explanations, or wastes time with small talk, cut them off and tell them to get to the point. If they continue wasting time after a warning, tell them you have to go.

Known information you can share naturally when asked: business stays busy, cash flow could improve, you use a mix of checks and paper invoices, and the office handles billing manually.

Surface-level hidden info (share only when the caller asks a specific question directly about how techs handle payments or how billing works in the field): technicians collect payments inconsistently and sometimes leave jobs without billing, and paper invoices are sent out days after a job is completed.

Mid-level hidden info (share only after the caller has asked follow-up questions that build on surface-level details you already shared, for example following up on late invoices to ask about payment timelines or office workload): payments often take 2 to 3 weeks to arrive after a job is done, and office staff spend hours manually chasing unpaid invoices every week.

Deep discovery info (share only when ALL of the following are true: the caller has already uncovered at least one surface-level and one mid-level detail, AND the caller asks a specific question about cash flow pressure, slow-season stress, or lost business): cash flow gaps create severe stress during the winter slow season, delayed estimates sometimes result in lost jobs to faster competitors, and you know operations are inefficient but you have delayed changing because you hate dealing with new technology.

Objection logic: If the caller pitches a product before asking questions about your business, say 'We have always done it this way.' If the caller does not address how your crew will use the tool in the field, say 'My guys will not use it. They are plumbers, not computer guys.' If the caller does not differentiate from your existing tools, say 'I already use QuickBooks.' If the caller pushes for a long meeting or demo, say 'It is our busy season right now. I do not have time for this.'

Follow-up condition: You will agree to a follow-up call only if the caller gets to the point quickly, identifies a real operational problem you care about, and demonstrates that the solution is practical and simple enough for your crew.

Do not break character. Do not volunteer hidden information. Do not suggest what the caller should ask you about or offer a menu of your problems. Behave like a real, impatient, no-nonsense business owner.`,

  david_miller: `You are Pastor David Miller of New Hope Community Church, a church and nonprofit in Western Pennsylvania. The church has been established for 27 years with approximately 350 active members. You are a Talker-Supporter Hybrid behavioral style: warm, relational, story-oriented, and deeply mission-focused. You care more about people and community impact than technology. You value trust, sincerity, and long-term relationships.

This is your first interaction with this caller. You have never spoken to them before and have no prior relationship. If the caller references a previous meeting or acts as if you have spoken before, respond with warm confusion. Say something like 'Oh goodness, have we spoken before? My memory must be slipping. I thought this was our first time talking.'

Time pressure: You have a Bible study group coming in about ten minutes. You are happy to talk because you care about your community projects, but you do need to wrap up on time. If the caller goes off-topic or becomes too transactional, gently redirect them. If they continue being pushy or unfocused after a gentle reminder, tell them you need to get ready for your group.

Known information you can share naturally when asked: the church currently accepts checks and cash donations, fundraising efforts for the basketball court are inconsistent, the court project is vital to the local youth and AAU sports program, and the church relies heavily on volunteers.

Surface-level hidden info (share only when the caller asks a specific question directly about donation tracking or giving programs): no recurring giving program exists, and donations are difficult to track manually because volunteers count checks and cash after services.

Mid-level hidden info (share only after the caller has asked follow-up questions that build on surface-level details you already shared, for example following up on donation tracking to ask about younger families or volunteer workload): younger families have expressed a preference for digital or online giving methods, and volunteers spend significant time every week organizing physical checks, counting cash, and generating handwritten receipts.

Deep discovery info (share only when ALL of the following are true: the caller has already uncovered at least one surface-level and one mid-level detail, AND the caller asks a specific question about volunteer burnout, fear of project delays, or long-term donor engagement): you are worried that the basketball court fundraising momentum will stall if you cannot engage donors more consistently, volunteers are increasingly overwhelmed by administrative tasks which threatens other church programs, and you lack the tools to keep donors engaged between services.

Objection logic: If the caller pitches a product before asking questions about your church, say 'We already have ways to collect donations.' If the caller focuses only on transaction rates or terminal hardware, say 'We really care about keeping this personal. We do not want giving to feel transactional.' If the caller pushes heavy technical setup, say 'We are not very tech-savvy here. I do not want to make things complicated for our volunteers.'

Follow-up condition: You will agree to a follow-up call only if the caller shows genuine interest in the church's mission and community programs, demonstrates understanding of your fundraising challenges, and asks for the next step in a warm, partnership-oriented way.

Do not break character. Do not volunteer hidden information. Do not suggest what the caller should ask you about or offer a menu of your problems. Behave like a real, warm, mission-focused community leader.`
};

const module4Greetings = {
  carla_reyes: "Hi there, thanks for calling. I have got a client coming in about ten minutes, but I know we had this time set aside. We have been trying to find ways to make things run smoother here at the salon. What did you want to discuss?",
  mike_turner: "Alright, what have you got for me? I have a crew heading out in about ten minutes so let us make this quick.",
  david_miller: "Well hello there, thanks so much for calling. I have got a Bible study group coming in about ten minutes, but I know we had this time set aside. The basketball court project has been keeping us all busy. What brings you my way today?"
};

const module5Additions = {
  carla_reyes: {
    timePressure: "Time pressure: Even though this is a follow-up call, you still have a busy salon to run. If the conversation stalls or the rep seems disorganized, gently remind them you have clients waiting.",
    ending: "Do not break character. Do not volunteer information unless the rep demonstrates knowledge of your previous conversation. Do not help the rep figure out what to say or suggest what they should pitch you. Behave like a real business owner evaluating whether this change is worth the risk to your team."
  },
  mike_turner: {
    timePressure: "Time pressure: You agreed to this follow-up but you are still a busy contractor. If the rep is slow, disorganized, or repeats basic questions, tell them to get to the point or you are hanging up.",
    ending: "Do not break character. Do not volunteer information unless the rep demonstrates knowledge of your previous conversation. Do not help the rep figure out what to say or suggest what they should pitch you. Behave like a real, impatient business owner who expects results."
  },
  david_miller: {
    timePressure: "Time pressure: Even though you are glad to reconnect, you do have church responsibilities. If the conversation loses focus or the rep sounds unprepared, gently remind them you have limited time.",
    ending: "Do not break character. Do not volunteer information unless the rep demonstrates knowledge of your previous conversation. Do not help the rep figure out what to say or suggest what they should pitch you. Behave like a real community leader evaluating whether this solution truly serves your church's mission."
  }
};

const jsonFiles = fs.readdirSync(scenariosDir).filter(f => f.endsWith('.json'));

jsonFiles.forEach(filename => {
  const filePath = path.join(scenariosDir, filename);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let modified = false;

  console.log(`Processing JSON: ${filename}...`);

  // WS1: Module 4 modifications
  if (data.id.startsWith('module4_')) {
    const pid = data.persona_id;
    
    // Name
    const oldName = data.name;
    const newName = oldName.replace("Module 1: Discovery & Make the Sale - ", "Module 4: Make the Sale - ");
    if (oldName !== newName) {
      data.name = newName;
      modified = true;
      console.log(`  Name: "${oldName}" -> "${newName}"`);
    }

    // Module
    if (data.module === "Module 1 - Discovery & Make the Sale") {
      data.module = "Module 4 - Make the Sale";
      modified = true;
      console.log(`  Module: -> "Module 4 - Make the Sale"`);
    }

    // Duration
    if (data.duration_minutes === 15) {
      data.duration_minutes = 10;
      modified = true;
      console.log(`  Duration: 15 -> 10`);
    }

    // Persona Tavus ID
    if (tavusIds[pid] && data.persona_id_tavus !== tavusIds[pid]) {
      const oldTavus = data.persona_id_tavus;
      data.persona_id_tavus = tavusIds[pid];
      modified = true;
      console.log(`  Tavus Persona ID: "${oldTavus}" -> "${tavusIds[pid]}"`);
    }

    // Conversation Config
    if (data.conversation_config) {
      const oldConvName = data.conversation_config.conversation_name;
      const newConvName = oldConvName.replace("Module 1: Discovery & Make the Sale - ", "Module 4: Make the Sale - ");
      if (oldConvName !== newConvName) {
        data.conversation_config.conversation_name = newConvName;
        modified = true;
        console.log(`  Conv Name: "${oldConvName}" -> "${newConvName}"`);
      }

      if (data.conversation_config.properties && data.conversation_config.properties.max_call_duration === 900) {
        data.conversation_config.properties.max_call_duration = 600;
        modified = true;
        console.log(`  Max Call Duration: 900 -> 600`);
      }

      // WS2: Context & Greeting rewrites
      if (module4Contexts[pid]) {
        data.conversation_config.conversational_context = module4Contexts[pid];
        modified = true;
        console.log(`  Context: Rewritten programmatically`);
      }
      if (module4Greetings[pid]) {
        data.conversation_config.custom_greeting = module4Greetings[pid];
        modified = true;
        console.log(`  Greeting: Rewritten programmatically`);
      }
    }
  }

  // WS1: Module 5 modifications
  if (data.id.startsWith('module5_')) {
    const pid = data.persona_id;

    // Name
    const oldName = data.name;
    const newName = oldName.replace("Module 2: Close the Sale - ", "Module 5: Close the Sale - ");
    if (oldName !== newName) {
      data.name = newName;
      modified = true;
      console.log(`  Name: "${oldName}" -> "${newName}"`);
    }

    // Description
    if (data.description.includes("Module 1 discovery session")) {
      data.description = data.description.replace("Module 1 discovery session", "Module 4 discovery session");
      modified = true;
      console.log(`  Description: "Module 1" -> "Module 4"`);
    }

    // Module
    if (data.module === "Module 2 - Close the Sale") {
      data.module = "Module 5 - Close the Sale";
      modified = true;
      console.log(`  Module: -> "Module 5 - Close the Sale"`);
    }

    // Duration
    if (data.duration_minutes === 15) {
      data.duration_minutes = 10;
      modified = true;
      console.log(`  Duration: 15 -> 10`);
    }

    // Conversation Config
    if (data.conversation_config) {
      const oldConvName = data.conversation_config.conversation_name;
      const newConvName = oldConvName.replace("Module 2: Close the Sale - ", "Module 5: Close the Sale - ");
      if (oldConvName !== newConvName) {
        data.conversation_config.conversation_name = newConvName;
        modified = true;
        console.log(`  Conv Name: "${oldConvName}" -> "${newConvName}"`);
      }

      if (data.conversation_config.properties && data.conversation_config.properties.max_call_duration === 900) {
        data.conversation_config.properties.max_call_duration = 600;
        modified = true;
        console.log(`  Max Call Duration: 900 -> 600`);
      }

      // WS2: Module 5 Context Additions
      if (module5Additions[pid]) {
        let ctx = data.conversation_config.conversational_context;
        // Clean up any old additions first to make it idempotent
        ctx = ctx.replace(/Time pressure: Even though[\s\S]*$/, '').trim();
        ctx = ctx.replace(/Time pressure: You agreed[\s\S]*$/, '').trim();
        ctx = ctx.replace(/Time pressure: Even though you are[\s\S]*$/, '').trim();
        ctx = ctx.replace(/Do not break character\. Do not volunteer information unless[\s\S]*$/, '').trim();

        // Build new context
        const newCtx = `${ctx}\n\n${module5Additions[pid].timePressure}\n\n${module5Additions[pid].ending}`;
        if (data.conversation_config.conversational_context !== newCtx) {
          data.conversation_config.conversational_context = newCtx;
          modified = true;
          console.log(`  Context: Appended time pressure & updated anti-coaching instructions`);
        }
      }
    }

    // Rubric edits
    if (data.rubric && data.rubric.discovery_and_questioning && data.rubric.discovery_and_questioning.behaviors) {
      data.rubric.discovery_and_questioning.behaviors.forEach(behavior => {
        if (behavior.id === 'DQ2' && behavior.description.includes('from Module 1')) {
          behavior.description = behavior.description.replace('from Module 1', 'from Module 4');
          modified = true;
          console.log(`  Rubric DQ2 description: "from Module 1" -> "from Module 4"`);
        }
      });
    }

    // Coaching notes edits
    if (data.coaching_notes) {
      if (data.coaching_notes.key_concepts) {
        data.coaching_notes.key_concepts = data.coaching_notes.key_concepts.map(concept => {
          if (concept.includes('Module 1 discoveries')) {
            modified = true;
            console.log(`  Coaching Notes key concept: "Module 1" -> "Module 4"`);
            return concept.replace('Module 1 discoveries', 'Module 4 discoveries');
          }
          return concept;
        });
      }
      if (data.coaching_notes.common_mistakes) {
        data.coaching_notes.common_mistakes = data.coaching_notes.common_mistakes.map(mistake => {
          if (mistake.includes('Module 1 discovery')) {
            modified = true;
            console.log(`  Coaching Notes common mistake: "Module 1" -> "Module 4"`);
            return mistake.replace('Module 1 discovery', 'Module 4 discovery');
          }
          return mistake;
        });
      }
    }
  }

  if (modified) {
    if (!DRY_RUN) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`  -> File updated successfully.`);
    } else {
      console.log(`  -> [Dry-Run] Changes would be written.`);
    }
  } else {
    console.log(`  -> No changes needed.`);
  }
  console.log();
});


// 2. Programmatic String Replacements in Code Files
const codeReplacements = [
  {
    filePath: path.join(workspaceDir, 'public', 'js', 'progress.js'),
    replacements: [
      {
        target: 'number: 1,\n    name: \'Discovery & Qualification\',',
        replace: 'number: 4,\n    name: \'Make the Sale\','
      },
      {
        target: 'description: \'Build rapport, ask the right discovery questions, qualify using BANT/CHAMP, and close for a next step.\'',
        replace: 'description: \'Conduct effective discovery, identify business pain points, align the correct Payroc solution, and earn a next step.\''
      },
      {
        target: 'number: 2,\n    name: \'Objection Handling & Close\',',
        replace: 'number: 5,\n    name: \'Close the Sale\','
      },
      {
        target: 'description: \'Handle real-world objections, present tailored solutions, and guide the prospect toward a buying decision.\'',
        replace: 'description: \'Handle objections, reinforce value, and close with confidence using relationship context from Module 4.\''
      },
      {
        target: 'Complete Module 1 to unlock this module.',
        replace: 'Complete Module 4 to unlock this module.'
      },
      {
        target: 'Master at least one persona in Module 1 to unlock.',
        replace: 'Master at least one persona in Module 4 to unlock.'
      },
      {
        target: 'Master this persona in Module 1 first',
        replace: 'Master this persona in Module 4 first'
      },
      {
        target: 'Module 1</div>',
        replace: 'Module 4</div>'
      },
      {
        target: 'Module 2</div>',
        replace: 'Module 5</div>'
      },
      {
        target: '// For Module 2, check Module 1 mastery',
        replace: '// For Module 5, check Module 4 mastery'
      },
      {
        target: '// Check lock for Module 2',
        replace: '// Check lock for Module 5'
      }
    ]
  },
  {
    filePath: path.join(workspaceDir, 'public', 'index.html'),
    replacements: [
      {
        target: '<span class="guide-badge guide-badge-green">Module 1</span>',
        replace: '<span class="guide-badge guide-badge-green">Module 4</span>'
      }
    ]
  },
  {
    filePath: path.join(workspaceDir, 'server', 'routes', 'sessionRoutes.js'),
    replacements: [
      {
        target: 'For Module 2 sessions, validates Module 1 mastery',
        replace: 'For Module 5 sessions, validates Module 4 mastery'
      },
      {
        target: '// Module 2 prerequisite checks',
        replace: '// Module 5 prerequisite checks'
      },
      {
        target: '// Check mastery of Module 1 for this persona',
        replace: '// Check mastery of Module 4 for this persona'
      },
      {
        target: '// Attach relationship context for Module 2 sessions',
        replace: '// Attach relationship context for Module 5 sessions'
      }
    ]
  },
  {
    filePath: path.join(workspaceDir, 'server', 'routes', 'tavusRoutes.js'),
    replacements: [
      {
        target: '// Handle Module 2 continuity',
        replace: '// Handle Module 5 continuity'
      }
    ]
  },
  {
    filePath: path.join(workspaceDir, 'scripts', 'test-security-audit.js'),
    replacements: [
      {
        target: 'scenario_id: \'module1_sam_patel\', module_id: \'module1\'',
        replace: 'scenario_id: \'module4_sam_patel\', module_id: \'module4\'',
        all: true
      },
      {
        target: 'scenario_id: \'module2_sam_patel\', module_id: \'module2\'',
        replace: 'scenario_id: \'module5_sam_patel\', module_id: \'module5\''
      },
      {
        target: '(Module 2 prerequisite summary lookup)',
        replace: '(Module 5 prerequisite summary lookup)'
      },
      {
        target: 'module_id = \\\'module1\\\'',
        replace: 'module_id = \\\'module4\\\''
      },
      {
        target: 's.module_id === \'module1\'',
        replace: 's.module_id === \'module4\''
      },
      {
        target: 'Module 2 gating block (no mastery for carla_reyes)',
        replace: 'Module 5 gating block (no mastery for carla_reyes)'
      },
      {
        target: 'Module 2 launch without Module 1 mastery rejected (403)',
        replace: 'Module 5 launch without Module 4 mastery rejected (403)'
      },
      {
        target: 'scenarioId: \'module2_carla_reyes\'',
        replace: 'scenarioId: \'module5_carla_reyes\'',
        all: true
      },
      {
        target: 'Module 1 mastery required',
        replace: 'Module 4 mastery required'
      },
      {
        target: 'Module 2 launch with mastery, but missing relationship summary',
        replace: 'Module 5 launch with mastery, but missing relationship summary'
      },
      {
        target: 'Module 2 launch with mastery but missing summary rejected (422)',
        replace: 'Module 5 launch with mastery but missing summary rejected (422)'
      }
    ]
  }
];

codeReplacements.forEach(fileSpec => {
  const filename = path.basename(fileSpec.filePath);
  if (!fs.existsSync(fileSpec.filePath)) {
    console.log(`File not found: ${filename}`);
    return;
  }

  let content = fs.readFileSync(fileSpec.filePath, 'utf8');
  let modified = false;

  console.log(`Processing Code File: ${filename}...`);

  fileSpec.replacements.forEach(rep => {
    if (rep.all) {
      // Global regex replace
      const escapedTarget = rep.target.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(escapedTarget, 'g');
      if (content.match(regex)) {
        content = content.replace(regex, rep.replace);
        modified = true;
        console.log(`  Replaced occurrences of: "${rep.target.replace(/\n/g, '\\n')}"`);
      }
    } else {
      if (content.includes(rep.target)) {
        content = content.replace(rep.target, rep.replace);
        modified = true;
        console.log(`  Replaced: "${rep.target.replace(/\n/g, '\\n')}" -> "${rep.replace.replace(/\n/g, '\\n')}"`);
      }
    }
  });

  if (modified) {
    if (!DRY_RUN) {
      fs.writeFileSync(fileSpec.filePath, content, 'utf8');
      console.log(`  -> File updated successfully.`);
    } else {
      console.log(`  -> [Dry-Run] Changes would be written.`);
    }
  } else {
    console.log(`  -> No changes needed.`);
  }
  console.log();
});


// 3. Programmatic Curriculum File Generation
const personas = ['sam_patel', 'carla_reyes', 'mike_turner', 'david_miller'];

if (!fs.existsSync(curriculumDir)) {
  if (!DRY_RUN) {
    fs.mkdirSync(curriculumDir, { recursive: true });
    console.log(`Created curriculum directory: ${curriculumDir}`);
  } else {
    console.log(`[Dry-Run] Would create curriculum directory: ${curriculumDir}`);
  }
}

personas.forEach(pid => {
  const salesRepBriefingFile = path.join(briefingsDir, `${pid}_sales_rep.md`);
  const buyerBriefingFile = path.join(briefingsDir, `${pid}_buyer.md`);

  if (!fs.existsSync(salesRepBriefingFile)) {
    console.warn(`Sales rep briefing not found for ${pid}: ${salesRepBriefingFile}`);
    return;
  }
  if (!fs.existsSync(buyerBriefingFile)) {
    console.warn(`Buyer briefing not found for ${pid}: ${buyerBriefingFile}`);
    return;
  }

  const repContent = fs.readFileSync(salesRepBriefingFile, 'utf8');
  const buyerContent = fs.readFileSync(buyerBriefingFile, 'utf8');

  // Split Sales Rep Briefing on Stage 5 heading
  const parts = repContent.split(/## Stage 5 - Close the Sale/i);
  const m4Curriculum = parts[0].trim();
  const m5RepCurriculum = parts[1] ? `## Stage 5 - Close the Sale` + parts[1].trim() : '';

  // Extract Section 3 from Buyer Briefing
  const buyerParts = buyerContent.split(/## 3. Stage 5: Close the Sale/i);
  const m5BuyerCurriculum = buyerParts[1] ? `## 3. Stage 5: Close the Sale` + buyerParts[1].trim() : '';

  // 3.1 Write Module 4 Curriculum
  const m4FilePath = path.join(curriculumDir, `module4_${pid}.md`);
  const m4CurriculumText = `# Module 4 Curriculum: Make the Sale - ${pid.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}\n\n${m4Curriculum}`;

  console.log(`Writing curriculum: module4_${pid}.md...`);
  if (!DRY_RUN) {
    fs.writeFileSync(m4FilePath, m4CurriculumText, 'utf8');
    console.log(`  -> Written successfully.`);
  } else {
    console.log(`  -> [Dry-Run] Would write ${m4FilePath}`);
  }

  // 3.2 Write Module 5 Curriculum
  const m5FilePath = path.join(curriculumDir, `module5_${pid}.md`);
  const m5CurriculumText = `# Module 5 Curriculum: Close the Sale - ${pid.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}\n\n${m5RepCurriculum}\n\n---\n\n${m5BuyerCurriculum}`;

  console.log(`Writing curriculum: module5_${pid}.md...`);
  if (!DRY_RUN) {
    fs.writeFileSync(m5FilePath, m5CurriculumText, 'utf8');
    console.log(`  -> Written successfully.`);
  } else {
    console.log(`  -> [Dry-Run] Would write ${m5FilePath}`);
  }
  console.log();
});

console.log(`Migration script processing completed.`);
