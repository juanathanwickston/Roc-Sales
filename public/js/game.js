// ===== ROC ACADEMY v3 — GAME ENGINE =====
// Module navigation, activity viewers, all game engines, progress tracking
// L&D Pillars: Skill Measurement, Reinforcement Cadence, Visibility Reporting, Behavioral Standards

// --- FALLBACK GAME DATA ---
// If content.js failed to load/parse, define the data here so games still work
if(typeof PRODUCT_BINS === 'undefined'){
  var PRODUCT_BINS = [
    {label:'ROC Giving', icon:'\u2764', color:'#a78bfa'},
    {label:'ROC Services', icon:'\u2699', color:'#60a5fa'},
    {label:'Terminal+', icon:'\u2588', color:'#34d399'},
    {label:'RewardPay', icon:'\u0024', color:'#fbbf24'}
  ];
}
if(typeof FEATURES === 'undefined'){
  var FEATURES = [
    {text:'Text-to-Give', product:0},
    {text:'QR Code Giving', product:0},
    {text:'Fee Offset', product:0},
    {text:'Recurring Giving', product:0},
    {text:'Branded Campaigns', product:0},
    {text:'Donor Analytics', product:0},
    {text:'No Platform Fee', product:0},
    {text:'Mobile Invoicing', product:1},
    {text:'QuickBooks Sync', product:1},
    {text:'Estimate to Invoice', product:1},
    {text:'BBPOS Card Reader', product:1},
    {text:'Job Scheduling', product:1},
    {text:'Payment Links', product:1},
    {text:'Item Catalog', product:1},
    {text:'Dual Display', product:2},
    {text:'Bill Splitting', product:2},
    {text:'Tip Management', product:2},
    {text:'NFC / Apple Pay', product:2},
    {text:'Inventory Tracking', product:2},
    {text:'Barcode Scanner', product:2},
    {text:'Cash + Cashback', product:2},
    {text:'Dual Pricing', product:3},
    {text:'Surcharging', product:3},
    {text:'Credit-Only Fee', product:3},
    {text:'50-70% Cost Cut', product:3},
    {text:'ACH Integration', product:3},
    {text:'Cash vs Card Price', product:3}
  ];
}

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

function saveSkill(gameId, pct, pts, maxPts){
  const key = SKILL_MAP[gameId]; if(!key||key==='certification') return;
  if(!D.skills[key]) D.skills[key]={best:0,last:0,attempts:0,lastDate:null};
  D.skills[key].last = pct;
  D.skills[key].best = Math.max(D.skills[key].best, pct);
  D.skills[key].attempts++;
  D.skills[key].lastDate = new Date().toISOString().split('T')[0];
  // Submit score to backend
  API.submitScore('game', gameId, pts||Math.round(pct), maxPts||100, {skill:key,pct:pct})
    .then(() => {
      // Refresh Power Score on dashboard after scoring
      API.getLeaderboard().then(lb => {
        if (lb.myRank) {
          document.getElementById('hXP').textContent = lb.myScore || 0;
          document.getElementById('hLv').textContent = '#' + lb.myRank;
        }
      }).catch(() => {});
    })
    .catch(e=>console.warn('[GAME] Score submit failed:',e.message));
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
// Returns array of activity types that actually exist for a module
function getModActivities(mod){
  const acts=[];
  if(mod.video&&(mod.video.url||mod.video.playlist)) acts.push('video');
  if(mod.doc&&mod.doc.sections&&mod.doc.sections.length>0) acts.push('doc');
  if(mod.game&&mod.game.gameId) acts.push('game');
  if(mod.apply&&mod.apply.items&&mod.apply.items.length>0) acts.push('apply');
  return acts;
}
function getModProg(id){
  const p = D.modules[id]||{};
  const mod = MODULES.find(m=>m.id===id);
  const acts = mod ? getModActivities(mod) : ['video','doc','game','apply'];
  return {video:!!p.video, doc:!!p.doc, game:!!p.game, apply:!!p.apply,
    count: acts.reduce((s,a)=>s+(p[a]?1:0),0), total: acts.length, acts};
}
function isModDone(id){const pr=getModProg(id);return pr.total>0&&pr.count===pr.total}
function isPhaseDone(n){return MODULES.filter(m=>m.phase===n).every(m=>isModDone(m.id))}
function isPhaseOpen(n){return n===1||isPhaseDone(n-1)}
function getActStatus(modId, type){
  const pr = getModProg(modId);
  if(pr[type]) return 'done';
  const acts = pr.acts;
  const idx = acts.indexOf(type);
  if(idx<0) return 'locked'; // activity not in this module
  if(idx===0) return 'avail';
  return pr[acts[idx-1]] ? 'avail' : 'locked';
}
function completeAct(modId, type){
  if(!D.modules[modId]) D.modules[modId]={};
  D.modules[modId][type]=true;
  // Sync to backend — check for pathway completion
  API.saveProgress(modId, type, 'done').then(res=>{
    if(res && res.pathwayCompleted){
      // Pathway complete! Toast + confetti
      toast('🎉 Pathway Complete! You finished all required modules!','success');
      if(typeof launchConfetti==='function') launchConfetti();
    }
  }).catch(e=>{
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
let _selectedPathway = null;
function home(){curMod=null;cleanupGameState();show('home');renderHome()}
async function switchPathway(pathwayId){
  _selectedPathway = pathwayId || null;
  await loadModules(_selectedPathway);
  renderHome();
}
function renderHome(){
  // Stats — modules done count (X/Y format)
  const doneMods = MODULES.filter(m=>isModDone(m.id)).length;
  document.getElementById('hSk').textContent=doneMods+'/'+MODULES.length;

  // Refresh Power Score + Rank from leaderboard API (always fresh per performance.md L102)
  API.getLeaderboard().then(lb => {
    if (lb.myRank) {
      document.getElementById('hXP').textContent = lb.myScore || 0;
      document.getElementById('hLv').textContent = '#' + lb.myRank;
    }
  }).catch(e => console.warn('[DASHBOARD] Power Score refresh failed:', e.message));

  // ─── PATHWAY TABS (multi-pathway users) ───
  const userPathways = (Auth.user && Auth.user.pathways) ? Auth.user.pathways : [];
  let tabsHtml = '';
  if (userPathways.length > 1) {
    tabsHtml = '<div class="pathway-tabs">';
    tabsHtml += `<button class="pathway-tab${!_selectedPathway?' active':''}" onclick="switchPathway(null)">All Pathways</button>`;
    userPathways.forEach(p => {
      const active = _selectedPathway == p.id ? ' active' : '';
      tabsHtml += `<button class="pathway-tab${active}" onclick="switchPathway(${p.id})">${esc(p.name)}</button>`;
    });
    tabsHtml += '</div>';
  }

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

  // ─── PATHWAY TIMELINE ───
  // Use courses if available, fall back to phase-based rendering
  let h = tabsHtml;

  if (COURSES && COURSES.length > 0) {
    // ─── Course-based timeline ───
    // Overall pathway progress
    const totalReqMods = COURSES.reduce((sum, c) => sum + c.modules.filter(m => m.isRequired !== false).length, 0);
    const doneReqMods = COURSES.reduce((sum, c) => sum + c.modules.filter(m => m.isRequired !== false && isModDone(m.id)).length, 0);
    const progPct = totalReqMods > 0 ? Math.round(doneReqMods / totalReqMods * 100) : 0;
    h += `<div class="pw-progress"><div class="pw-prog-label">${doneReqMods} of ${totalReqMods} modules complete (${progPct}%)</div><div class="pw-prog-bar"><div class="pw-prog-fill" style="width:${progPct}%"></div></div></div>`;
    h += '<div class="pathway-timeline">';

    COURSES.forEach(course => {
      const courseMods = course.modules || [];
      const courseReq = courseMods.filter(m => m.isRequired !== false);
      const courseDone = courseReq.filter(m => isModDone(m.id)).length;
      const courseTotal = courseReq.length;
      const coursePct = courseTotal > 0 ? Math.round(courseDone / courseTotal * 100) : 0;
      const courseComplete = coursePct >= 100;

      // Course section header
      h += `<div class="tl-course ${courseComplete ? 'tl-course-done' : ''}">`;
      h += `<div class="tl-course-header">`;
      h += `<span class="tl-course-icon">${course.icon || '📘'}</span>`;
      h += `<div class="tl-course-info">`;
      h += `<div class="tl-course-title">${course.title} ${courseComplete ? '✅' : ''}</div>`;
      h += `<div class="tl-course-progress">${courseDone}/${courseTotal} modules · ${coursePct}%</div>`;
      h += `</div>`;
      h += `<div class="tl-course-bar"><div class="tl-course-bar-fill" style="width:${coursePct}%"></div></div>`;
      h += `</div>`;

      // Sequential unlock within this course
      const courseUnlocked = new Set();
      let prevDone = true;
      const courseReqMods = courseMods.filter(m => m.isRequired !== false);
      const prevReqTitleMap = {};
      for (let i = 0; i < courseReqMods.length; i++) {
        if (prevDone) courseUnlocked.add(courseReqMods[i].id);
        prevDone = isModDone(courseReqMods[i].id);
        if (i > 0) prevReqTitleMap[courseReqMods[i].id] = courseReqMods[i-1].title;
      }
      // Optional modules always unlocked
      courseMods.filter(m => m.isRequired === false).forEach(m => courseUnlocked.add(m.id));

      // Render modules within course
      courseMods.forEach(m => {
        const pr = getModProg(m.id);
        const done = isModDone(m.id);
        const open = courseUnlocked.has(m.id);
        let statusCls = 'tl-lock';
        let statusText = '🔒';
        const prevTitle = prevReqTitleMap[m.id];
        let descText = prevTitle ? 'Complete '+prevTitle+' to unlock' : 'Complete previous to unlock';

        if(done){
          statusCls = 'tl-done';
          statusText = '✅';
          descText = m.desc;
        } else if(open && pr.count > 0){
          statusCls = 'tl-prog';
          statusText = pr.count+'/'+pr.total;
          descText = pr.count+' of '+pr.total+' activities';
        } else if(open){
          statusCls = 'tl-prog';
          statusText = '';
          descText = m.desc;
        }

        const skillKey = (m.game && m.game.gameId) ? SKILL_MAP[m.game.gameId] : null;
        const sk = skillKey ? D.skills[skillKey] : null;
        const reinf = getReinforcementStatus(sk ? sk.lastDate : null);

        if(open || done){
          h += `<div class="tl-mod ${statusCls}" onclick="showModule('${m.id}')">`;
          h += `<div class="mc-i">${m.icon}</div>`;
          h += `<div class="mc-info"><div class="mc-t">${m.title} <span class="mc-reinf ${reinf.cls}">${reinf.icon}</span></div>`;
          h += `<div class="mc-d">${descText}</div>`;
          h += `<div class="mc-dots">${pr.acts.map(a=>`<div class="mc-dot ${pr[a]?'done':(!pr[a]&&getActStatus(m.id,a)==='avail'?'cur':'')}"></div>`).join('')}</div>`;
          h += `</div><span class="mc-st ${done?'done':(pr.count>0?'prog':'')}">${statusText}</span></div>`;
        } else {
          h += `<div class="tl-mod tl-lock">`;
          h += `<div class="mc-i">${m.icon}</div>`;
          h += `<div class="mc-info"><div class="mc-t">${m.title}</div><div class="mc-d">${descText}</div></div>`;
          h += `<span class="mc-st lock">${statusText}</span></div>`;
        }
      });

      h += `</div>`; // close tl-course
    });
    h += '</div>';
  } else {
    // ─── Legacy phase-based timeline (no courses) ───
    const trackOrder = {onboarding:0, upskilling:1};
    const sorted = [...MODULES].sort((a,b)=>{
      if(a.sort_order != null && b.sort_order != null) return a.sort_order - b.sort_order;
      const ta = trackOrder[a.track||'onboarding'] || 0;
      const tb = trackOrder[b.track||'onboarding'] || 0;
      if(ta !== tb) return ta - tb;
      if((a.phase||1) !== (b.phase||1)) return (a.phase||1) - (b.phase||1);
      return (a.sort_order||0) - (b.sort_order||0);
    });

    const unlocked = new Set();
    let prevRequiredDone = true;
    const requiredMods = sorted.filter(m => m.isRequired !== false);
    for (const m of requiredMods) {
      if (prevRequiredDone) unlocked.add(m.id);
      prevRequiredDone = isModDone(m.id);
    }
    sorted.filter(m => m.isRequired === false).forEach(m => unlocked.add(m.id));

    const prevReqTitleMap = {};
    for (let i = 1; i < requiredMods.length; i++) {
      prevReqTitleMap[requiredMods[i].id] = requiredMods[i-1].title;
    }

    const doneModCount = sorted.filter(m => m.isRequired !== false && isModDone(m.id)).length;
    const totalModCount = requiredMods.length;
    const progPct = totalModCount > 0 ? Math.round(doneModCount / totalModCount * 100) : 0;

    h += `<div class="pw-progress"><div class="pw-prog-label">${doneModCount} of ${totalModCount} modules complete (${progPct}%)</div><div class="pw-prog-bar"><div class="pw-prog-fill" style="width:${progPct}%"></div></div></div>`;
    h += '<div class="pathway-timeline">';

    let lastTrack = null;
    let lastPhase = null;
    sorted.forEach(m=>{
      const track = m.track || 'onboarding';
      const phase = m.phase || 1;
      const phaseData = PHASES.find(p=>p.num===phase);

      if(track !== lastTrack || phase !== lastPhase){
        const trackLabel = track === 'upskilling' ? 'Upskilling' : 'Onboarding';
        const phaseLabel = phaseData ? phaseData.title : 'Phase '+phase;
        h += `<div class="tl-phase"><span class="track-pill track-${track}">${trackLabel}</span> <span class="phase-pill">Phase ${phase} · ${phaseLabel}</span></div>`;
        lastTrack = track;
        lastPhase = phase;
      }

      const pr = getModProg(m.id);
      const done = isModDone(m.id);
      const open = unlocked.has(m.id);
      let statusCls = 'tl-lock';
      let statusText = '🔒';
      const prevTitle = prevReqTitleMap[m.id];
      let descText = prevTitle ? 'Complete '+prevTitle+' to unlock' : 'Complete previous to unlock';

      if(done){
        statusCls = 'tl-done';
        statusText = '✅';
        descText = m.desc;
      } else if(open && pr.count > 0){
        statusCls = 'tl-prog';
        statusText = pr.count+'/'+pr.total;
        descText = pr.count+' of '+pr.total+' activities';
      } else if(open){
        statusCls = 'tl-prog';
        statusText = '';
        descText = m.desc;
      }

      const skillKey = (m.game && m.game.gameId) ? SKILL_MAP[m.game.gameId] : null;
      const sk = skillKey ? D.skills[skillKey] : null;
      const reinf = getReinforcementStatus(sk ? sk.lastDate : null);

      if(open || done){
        h += `<div class="tl-mod ${statusCls}" onclick="showModule('${m.id}')">`;
        h += `<div class="mc-i">${m.icon}</div>`;
        h += `<div class="mc-info"><div class="mc-t">${m.title} <span class="mc-reinf ${reinf.cls}">${reinf.icon}</span></div>`;
        h += `<div class="mc-d">${descText}</div>`;
        h += `<div class="mc-dots">${pr.acts.map(a=>`<div class="mc-dot ${pr[a]?'done':(!pr[a]&&getActStatus(m.id,a)==='avail'?'cur':'')}"></div>`).join('')}</div>`;
        h += `</div><span class="mc-st ${done?'done':(pr.count>0?'prog':'')}">${statusText}</span></div>`;
      } else {
        h += `<div class="tl-mod tl-lock">`;
        h += `<div class="mc-i">${m.icon}</div>`;
        h += `<div class="mc-info"><div class="mc-t">${m.title}</div><div class="mc-d">${descText}</div></div>`;
        h += `<span class="mc-st lock">${statusText}</span></div>`;
      }
    });
    h += '</div>';
  }
  document.getElementById('phaseMap').innerHTML=h;

  // Certification
  const total=MODULES.reduce((s,m)=>s+getModProg(m.id).total,0);
  const done2=MODULES.reduce((s,m)=>s+getModProg(m.id).count,0);
  const cpct=total>0?Math.round(done2/total*100):0;
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
  const allActs=[
    {type:'video',icon:'📺',label:'WATCH',data:mod.video},
    {type:'doc',icon:'📖',label:'READ',data:mod.doc},
    {type:'game',icon:'🎮',label:'PLAY',data:mod.game},
    {type:'apply',icon:'🎓',label:'MASTER',data:mod.apply}
  ];
  const modActs=getModActivities(mod);
  const acts=allActs.filter(a=>modActs.includes(a.type));
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
function showRes(title,pts,mx,str,correct,total){
  // Use accuracy (correct/total) when available, otherwise fall back to pts/mx
  const pct = (correct != null && total > 0) ? Math.round(correct/total*100) : Math.min(100,Math.round(pts/mx*100));
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
    const topPct = Math.max(1, 100-pct);
    h+=`<div class="rb"><div class="rbi">${bicon}</div><div class="rbn">${title} — Grade ${grade}</div><div class="rbd">Top ${topPct}% performance</div></div>`;
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
x.beginPath();x.arc(p.x,p.y,p.r,0,Math.PI*2);x.fillStyle=`rgba(59,130,246,${p.a})`;x.fill()});requestAnimationFrame(draw)}
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
  resizeFFCanvas();
}

function stopFactory(){
  if(ffRAF) cancelAnimationFrame(ffRAF);
  ffRAF=null; ff=null;
  window.removeEventListener('keydown',ffKeyDown);
  window.removeEventListener('keyup',ffKeyUp);
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
  const par=c.parentElement;
  const gh=par.querySelector('.gh').getBoundingClientRect();
  const hud=document.getElementById('ffHud').getBoundingClientRect();
  const touch=document.getElementById('ffTouch').getBoundingClientRect();
  const rect=par.getBoundingClientRect();
  c.width=rect.width;
  c.height=rect.height - gh.height - hud.height - touch.height;
}

function beginFactory(){
  try{
    document.getElementById('ffStart').style.display='none';
    resizeFFCanvas();
    const c=document.getElementById('ffCanvas');
    console.log('[FF] Canvas:', c.width, 'x', c.height, 'FEATURES:', typeof FEATURES !== 'undefined' ? FEATURES.length : 'UNDEF', 'BINS:', typeof PRODUCT_BINS !== 'undefined' ? PRODUCT_BINS.length : 'UNDEF');
    const pool=[...FEATURES].sort(()=>Math.random()-.5);
    const colW=c.width/4;

    ff={
      canvas:c, ctx:c.getContext('2d'),
      W:c.width, H:c.height,
      colW:colW,
      pool:pool, poolIdx:0,
      active:null,      // the one piece currently falling
      bins:[],
      pts:0, correct:0, streak:0, bestStreak:0,
      lives:5, maxLives:5,
      baseSpeed:1.2, speedMult:1,
      particles:[],
      flashes:[],
      totalFeatures:pool.length,
      sorted:0,
      gameOver:false,
      dropPressed:false,
      hdrH:0, hudH:0  // cached heights for GSAP popup positioning
    };

    // build bins
    for(let i=0;i<4;i++){
      ff.bins.push({x:i*colW, w:colW, label:PRODUCT_BINS[i].label, icon:PRODUCT_BINS[i].icon, color:PRODUCT_BINS[i].color});
    }

    // cache header/HUD heights for GSAP popup positioning
    ff.hdrH=document.querySelector('#factory .gh').getBoundingClientRect().height;
    ff.hudH=document.getElementById('ffHud').getBoundingClientRect().height;

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
  } catch(err) {
    console.error('[FF] beginFactory error:', err);
    var c = document.getElementById('ffCanvas');
    if(c){
      var ctx = c.getContext('2d');
      ctx.fillStyle='#0a1628';
      ctx.fillRect(0,0,c.width||800,c.height||600);
      ctx.fillStyle='#ef4444';
      ctx.font='bold 18px system-ui,sans-serif';
      ctx.textAlign='center';
      ctx.fillText('Game Error', (c.width||800)/2, 60);
      ctx.fillStyle='#ccc';
      ctx.font='14px system-ui,sans-serif';
      ctx.fillText(err.message, (c.width||800)/2, 90);
      ctx.fillText(err.stack ? err.stack.split('\n')[1] : '', (c.width||800)/2, 115);
    }
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
  const binH=50;
  const landY=f.H-binH-a.h;
  if(a.y>=landY){
    a.y=landY;
    // determine which column
    const col=ffGetCol(a.x,a.w);
    const cx=a.x+a.w/2;

    if(col===a.product){
      // CORRECT
      f.correct++;
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
  const binH=50, binY=f.H-binH;
  for(let i=0;i<4;i++){
    const b=f.bins[i];
    ctx.fillStyle=b.color+'22';
    ctx.fillRect(b.x,binY,b.w,binH);
    ctx.strokeStyle=b.color+'66';
    ctx.lineWidth=1;
    ctx.strokeRect(b.x,binY,b.w,binH);
    // label
    ctx.fillStyle=b.color;
    ctx.font='bold 11px "Segoe UI",system-ui,sans-serif';
    ctx.textAlign='center';
    ctx.fillText(b.icon+' '+b.label, b.x+b.w/2, binY+20);
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
  const accuracyPct=ff.totalFeatures>0?Math.round(ff.correct/ff.totalFeatures*100):0;
  saveSkill('featureFactory',accuracyPct,ff.pts,mx);
  if(curMod) completeAct(curMod,'game');
  showRes('Feature Factory',ff.pts,mx,ff.bestStreak,ff.correct,ff.totalFeatures);
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
