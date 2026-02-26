// ===== ROC ACADEMY . PRODUCT KNOWLEDGE COACH =====
// AI-powered chatbot that tests sales rep product knowledge
// Uses OpenAI API (key stored in localStorage for dev, Railway env var for prod)

// ─── API KEY MANAGEMENT ───
function getChatbotApiKey(){
  let key = localStorage.getItem('roc_openai_key');
  if(!key){
    key = prompt('Enter your OpenAI API key to use the Product Knowledge Coach.\n\nThis is stored locally in your browser and never sent anywhere except OpenAI.');
    if(key && key.trim()){
      localStorage.setItem('roc_openai_key', key.trim());
    }
  }
  return key ? key.trim() : null;
}

// ─── SYSTEM PROMPT ───
const COACH_SYSTEM_PROMPT = `You are the ROC Academy Product Knowledge Coach. Your job is to test a sales rep's understanding of the Payroc ROC product suite through a conversational assessment.

PRODUCTS TO TEST:
1. ROC Giving - Digital giving platform for churches and nonprofits. Text-to-Give, QR code giving, fee offset, branded campaigns, recurring giving, donor analytics.
2. ROC Services - Field service management for contractors. Mobile invoicing, on-site payments, QuickBooks sync, job scheduling, estimate-to-invoice.
3. ROC Terminal+ (X800) - Dual-screen POS for restaurants and retail. Bill splitting, tip management, NFC/Apple Pay, inventory tracking, barcode scanner.
4. RewardPay Choice / ConsumerChoice - Cost-savings programs. Surcharging (credit only) and dual pricing (cash vs card price). Reduces merchant processing fees 50-100%.

ASSESSMENT RULES:
- Ask ONE scenario-based question at a time
- Questions should be realistic sales situations (e.g., "A plumber with 4 techs needs...")
- Evaluate the rep's answer for accuracy, depth, and sales instinct
- Give brief, specific feedback on each answer (1-2 sentences)
- Track coverage: aim to test at least 3 of the 4 products
- Track quality: count strong answers vs weak/incorrect ones

MASTERY CRITERIA:
- The rep must demonstrate understanding of which product fits which situation
- They must show they understand KEY differentiators (not just product names)
- After 4-5 STRONG answers across multiple products, declare mastery

CONVERSATION FLOW:
1. Start with a brief intro (1 sentence) and your first question
2. After each answer: give feedback, then ask next question (or declare mastery)
3. When mastery is achieved, respond with EXACTLY this format:
   "MASTERY_ACHIEVED: [your congratulatory message here]"
   The "MASTERY_ACHIEVED:" prefix is required for the system to detect completion.

TONE: Professional but encouraging. Like a supportive sales manager, not a test proctor.
Keep responses concise - 2-3 sentences of feedback, then the next question.`;

// ─── CHAT STATE ───
let chatMessages = [];
let chatOpen = false;
let masteryAchieved = false;

// ─── OPEN CHATBOT ───
function openChatbot(){
  const key = getChatbotApiKey();
  if(!key) return;

  chatMessages = [];
  masteryAchieved = false;
  chatOpen = true;

  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.id = 'chatbotOverlay';
  overlay.innerHTML = `
    <div class="chatbot-modal">
      <div class="chatbot-header">
        <div class="chatbot-title">\u{1F916} Product Knowledge Coach</div>
        <button class="chatbot-close" id="chatbotClose" onclick="closeChatbot()" title="Close">\u2715</button>
      </div>
      <div class="chatbot-messages" id="chatbotMessages">
        <div class="chat-loading" id="chatLoading">
          <div class="chat-dots"><span></span><span></span><span></span></div>
        </div>
      </div>
      <div class="chatbot-input-area">
        <input type="text" id="chatbotInput" class="chatbot-input" placeholder="Type your answer..." onkeydown="if(event.key==='Enter')sendChatMessage()" disabled>
        <button class="chatbot-send" id="chatbotSend" onclick="sendChatMessage()" disabled>\u27A4</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Prevent body scroll
  document.body.style.overflow = 'hidden';

  // Start the conversation with the AI
  startCoachConversation(key);
}

// ─── CLOSE CHATBOT ───
function closeChatbot(){
  const overlay = document.getElementById('chatbotOverlay');
  if(overlay){
    overlay.classList.add('closing');
    setTimeout(()=>{
      overlay.remove();
      document.body.style.overflow = '';
    }, 200);
  }
  chatOpen = false;
}

// ─── START CONVERSATION ───
async function startCoachConversation(apiKey){
  chatMessages = [
    {role:'system', content: COACH_SYSTEM_PROMPT},
    {role:'user', content:'I\'m ready to be tested on my product knowledge. Let\'s go.'}
  ];

  try {
    const response = await callOpenAI(apiKey, chatMessages);
    chatMessages.push({role:'assistant', content: response});
    appendMessage('assistant', response);
    enableInput();
  } catch(err) {
    appendMessage('system', 'Error connecting to AI: ' + err.message + '. Check your API key.');
    enableInput();
  }
}

// ─── SEND MESSAGE ───
async function sendChatMessage(){
  const input = document.getElementById('chatbotInput');
  const msg = input.value.trim();
  if(!msg || masteryAchieved) return;

  const apiKey = localStorage.getItem('roc_openai_key');
  if(!apiKey) return;

  // Show user message
  appendMessage('user', msg);
  input.value = '';
  disableInput();
  showLoading();

  // Add to history and call API
  chatMessages.push({role:'user', content: msg});

  try {
    const response = await callOpenAI(apiKey, chatMessages);
    chatMessages.push({role:'assistant', content: response});
    hideLoading();
    
    // Check for mastery
    if(response.includes('MASTERY_ACHIEVED:')){
      masteryAchieved = true;
      const cleanResponse = response.replace('MASTERY_ACHIEVED:', '').trim();
      appendMessage('assistant', cleanResponse);
      appendMessage('system', '\u{1F3C6} Mastery confirmed! You can close this chat and check off the box.');
      // Disable input, change close button style
      const closeBtn = document.getElementById('chatbotClose');
      if(closeBtn) closeBtn.classList.add('mastery');
    } else {
      appendMessage('assistant', response);
      enableInput();
    }
  } catch(err) {
    hideLoading();
    appendMessage('system', 'Error: ' + err.message);
    enableInput();
  }
}

// ─── OPENAI API CALL ───
async function callOpenAI(apiKey, messages){
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7,
      max_tokens: 500
    })
  });
  
  if(!res.ok){
    const err = await res.json().catch(()=>({}));
    throw new Error(err.error?.message || 'API request failed ('+res.status+')');
  }
  
  const data = await res.json();
  return data.choices[0].message.content;
}

// ─── UI HELPERS ───
function appendMessage(role, content){
  const container = document.getElementById('chatbotMessages');
  if(!container) return;
  const div = document.createElement('div');
  div.className = 'chat-msg chat-' + role;
  
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.textContent = content;
  
  if(role === 'assistant'){
    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.textContent = '\u{1F916}';
    div.appendChild(avatar);
  }
  
  div.appendChild(bubble);
  
  if(role === 'user'){
    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.textContent = '\u{1F464}';
    div.appendChild(avatar);
  }
  
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function showLoading(){
  const el = document.getElementById('chatLoading');
  if(el) el.style.display = 'flex';
  const container = document.getElementById('chatbotMessages');
  if(container) container.scrollTop = container.scrollHeight;
}

function hideLoading(){
  const el = document.getElementById('chatLoading');
  if(el) el.style.display = 'none';
}

function enableInput(){
  const input = document.getElementById('chatbotInput');
  const btn = document.getElementById('chatbotSend');
  if(input){ input.disabled = false; input.focus(); }
  if(btn) btn.disabled = false;
  hideLoading();
}

function disableInput(){
  const input = document.getElementById('chatbotInput');
  const btn = document.getElementById('chatbotSend');
  if(input) input.disabled = true;
  if(btn) btn.disabled = true;
}
