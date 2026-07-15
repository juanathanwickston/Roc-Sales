/**
 * Sales Call Simulator - Call Manager
 * Integrates with Tavus CVI via the Daily JS SDK.
 * Handles WebRTC video/audio, call controls, and timer.
 */

// Minimum call duration (seconds) before allowing end without confirmation
const MIN_CALL_DURATION_SECONDS = 120;


const callManager = {
  callObject: null,
  conversationId: null,
  conversationUrl: null,
  sessionId: null,
  timerInterval: null,
  startTime: null,
  isMuted: false,
  isCameraOff: false,
  captionsVisible: true,
  _ending: false,

  /**
   * Start a call: create Tavus conversation via backend, then join via Daily.
   */
  async startCall(scenario) {
    // Always clean up any previous call object before starting
    this.cleanup();

    // Clear any previous continuity notes
    const notesEl = document.getElementById('lobby-continuity-notes');
    if (notesEl) {
      notesEl.style.display = 'none';
      notesEl.innerHTML = '';
    }

    try {
      // Step 1: Create a session record to track this call attempt
      this.updateLobbyStatus('Preparing session...');
      this.sessionId = await this.createSession(scenario.id);

      if (!this.sessionId) {
        throw new Error('Failed to create simulation session. Please try again.');
      }

      // Fetch relationship continuity summary for Module 2 scenarios
      if (scenario.module_id === 'module5' && scenario.persona_id) {
        try {
          const notesRes = await fetchWithAuth('/api/sessions/continuity?personaId=' + scenario.persona_id);
          if (notesRes.ok) {
            const notesEnvelope = await notesRes.json();
            const notesData = notesEnvelope.data;
            if (notesData && notesData.relationship_summary && notesEl) {
              this.renderFormattedNotes(notesEl, notesData.relationship_summary);
              notesEl.style.display = 'block';
            }
          }
        } catch (e) {
          // silently ignore
        }
      }

      // Step 2: Create conversation via our backend proxy
      this.updateLobbyStatus('Creating conversation...');

      const conversationPayload = {
        sessionId: this.sessionId,
      };

      const res = await fetchWithAuth('/api/tavus/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(conversationPayload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || `Failed to create conversation: ${res.status}`);
      }

      const envelope = await res.json();
      const data = envelope.data;
      this.conversationId = data.conversationId;
      this.conversationUrl = data.conversationUrl;

      if (!this.conversationUrl) {
        throw new Error('No conversationUrl returned from server');
      }



      // Link the Tavus conversation ID to the session and mark as active
      await this.updateSessionStatus('active', {
        tavusConversationId: this.conversationId,
      });

      // Step 3: Join via Daily JS SDK
      this.updateLobbyStatus('Connecting to call...');
      await this.joinDaily();
    } catch (err) {
      this.cleanup();
      this.updateLobbyStatus(`Error: ${err.message}`);
      // Keep error visible for 15s so user can read it
      setTimeout(() => app.showScreen('scenarios'), 15000);
    }
  },

  /**
   * Safely render formatted notes into container to avoid XSS.
   */
  renderFormattedNotes(container, text) {
    container.innerHTML = ''; // Clear container

    const header = document.createElement('h4');
    header.style.cssText = 'margin:0 0 8px;font-size:13px;color:var(--payroc-blue);';
    header.textContent = 'Previous Call Notes';
    container.appendChild(header);

    const div = document.createElement('div');
    div.style.cssText = 'font-size:12px;color:var(--text-muted);line-height:1.5;';

    const lines = text.split('\n');
    let ul = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('- ') || line.startsWith('* ')) {
        if (!ul) {
          ul = document.createElement('ul');
          ul.style.cssText = 'margin:4px 0;padding-left:16px;';
          div.appendChild(ul);
        }
        const li = document.createElement('li');
        this.parseAndAppendFormattedText(li, line.substring(2));
        ul.appendChild(li);
      } else {
        ul = null; // Reset list context
        const p = document.createElement('p');
        p.style.margin = '4px 0';
        this.parseAndAppendFormattedText(p, line);
        div.appendChild(p);
      }
    }

    container.appendChild(div);
  },

  parseAndAppendFormattedText(element, text) {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 1) {
        const strong = document.createElement('strong');
        strong.textContent = parts[i];
        element.appendChild(strong);
      } else {
        element.appendChild(document.createTextNode(parts[i]));
      }
    }
  },

  /**
   * Create Daily call object and join the conversation.
   */
  async joinDaily() {

      // Create a new call object
      this.callObject = window.DailyIframe.createCallObject({
        audioSource: true,
        videoSource: true,
      });

      // Set up event listeners
      this.setupDailyEvents();

      // Enable noise cancellation
      try {
        await this.callObject.updateInputSettings({
          audio: { processor: { type: 'noise-cancellation' } },
        });
      } catch (e) {
        // silently ignore
      }

      // Join the meeting
      this.updateLobbyStatus('Joining call...');
      await this.callObject.join({ url: this.conversationUrl });

      // Ensure local audio is explicitly enabled after join
      this.callObject.setLocalAudio(true);
      this.callObject.setLocalVideo(true);


  },

  /**
   * Set up Daily SDK event handlers.
   */
  setupDailyEvents() {
    const call = this.callObject;

    // When a remote participant (Tavus avatar) joins
    call.on('participant-joined', (event) => {
      if (event.participant.local) return;
      this.attachRemoteTracks(event.participant);
      this.transitionToCallScreen(event.participant);
    });

    // When remote tracks update (video/audio becomes playable)
    call.on('participant-updated', (event) => {
      if (event.participant.local) {
        // Update local PiP when local tracks change
        this.attachLocalTracks(event.participant);
        return;
      }
      this.attachRemoteTracks(event.participant);
    });

    // When remote participant leaves - call ended
    call.on('participant-left', (event) => {
      if (event.participant.local) return;
      this.handleCallEnd();
    });

    // Handle errors
    call.on('error', (event) => {

    });

    // When we've joined successfully - attach local video to PiP
    call.on('joined-meeting', () => {
      this.updateLobbyStatus('Waiting for the buyer to join...');

      // Attach local video to PiP self-view
      const localParticipant = call.participants().local;
      if (localParticipant) {
        this.attachLocalTracks(localParticipant);
      }
    });

    // When call is left
    call.on('left-meeting', () => {

    });
  },

  /**
   * Attach local participant's video track to the PiP self-view element.
   */
  attachLocalTracks(participant) {
    const localVideo = document.getElementById('local-video');
    if (
      localVideo &&
      participant.tracks.video &&
      participant.tracks.video.state === 'playable' &&
      participant.tracks.video.persistentTrack
    ) {
      localVideo.srcObject = new MediaStream([participant.tracks.video.persistentTrack]);
    }
  },

  /**
   * Attach remote participant's video and audio tracks to DOM elements.
   */
  attachRemoteTracks(participant) {
    // Video
    const videoEl = document.getElementById('remote-video');
    if (
      videoEl &&
      participant.tracks.video &&
      participant.tracks.video.state === 'playable' &&
      participant.tracks.video.persistentTrack
    ) {
      videoEl.srcObject = new MediaStream([participant.tracks.video.persistentTrack]);
    }

    // Audio
    const audioEl = document.getElementById('remote-audio');
    if (
      audioEl &&
      participant.tracks.audio &&
      participant.tracks.audio.state === 'playable' &&
      participant.tracks.audio.persistentTrack
    ) {
      audioEl.srcObject = new MediaStream([participant.tracks.audio.persistentTrack]);
    }

    // Update name tag
    const nameTag = document.getElementById('remote-name-tag');
    if (nameTag && participant.user_name) {
      nameTag.textContent = participant.user_name;
    }
  },

  /**
   * Transition from lobby to the call screen.
   */
  transitionToCallScreen(participant) {
    // Update call screen info
    const label = app.currentScenario?.name || 'Sales Call';
    document.getElementById('call-scenario-label').textContent = label;
    document.getElementById('call-status-badge').textContent = 'Connected';

    // Populate call guide sidebar with scenario-specific data
    this.renderCallGuide(app.currentScenario);

    // Show call screen
    app.showScreen('call');

    // Start timer
    this.startTimer();

    // Reset controls state
    this.isMuted = false;
    this.isCameraOff = false;
    this.captionsVisible = true;
    this.updateControlStates();
  },

  /**
   * Start call duration timer.
   */
  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.startTime = Date.now();
    const timerEl = document.getElementById('call-timer');
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const secs = String(elapsed % 60).padStart(2, '0');
      timerEl.textContent = `${mins}:${secs}`;
    }, 1000);
  },

  /**
   * Stop call timer.
   */
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },

  /**
   * Get call duration in seconds.
   */
  getDuration() {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  },

  // --- Call Controls ---

  toggleMute() {
    if (!this.callObject) return;
    this.isMuted = !this.isMuted;
    this.callObject.setLocalAudio(!this.isMuted);
    this.updateControlStates();
  },

  toggleCamera() {
    if (!this.callObject) return;
    this.isCameraOff = !this.isCameraOff;
    this.callObject.setLocalVideo(!this.isCameraOff);
    // Update PiP visibility
    const pip = document.getElementById('pip-container');
    if (pip) pip.style.display = this.isCameraOff ? 'none' : '';
    this.updateControlStates();
  },

  updateControlStates() {
    const muteBtn = document.getElementById('btn-mute');
    const cameraBtn = document.getElementById('btn-camera');

    if (muteBtn) {
      muteBtn.classList.toggle('muted', this.isMuted);
      muteBtn.querySelector('.control-icon').innerHTML = this.isMuted ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.12 1.49-.34 2.18"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
      muteBtn.querySelector('.control-label').textContent = this.isMuted ? 'Unmute' : 'Mute';
    }
    if (cameraBtn) {
      cameraBtn.classList.toggle('muted', this.isCameraOff);
      cameraBtn.querySelector('.control-icon').innerHTML = this.isCameraOff ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"/><line x1="1" y1="1" x2="23" y2="23"/></svg>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>';
      cameraBtn.querySelector('.control-label').textContent = this.isCameraOff ? 'Camera On' : 'Camera';
    }
  },

  /**
   * End the call manually.
   */
  async endCall() {
    if (!this.callObject) return;

    // C7 fix: Custom modal instead of window.confirm()
    const duration = this.getDuration();
    if (duration < MIN_CALL_DURATION_SECONDS) {
      const confirmed = await this.showConfirmModal(
        'End call early?',
        'Calls under 2 minutes may not receive a detailed performance score. Are you sure you want to end it?'
      );
      if (!confirmed) return;
    }

    this.handleCallEnd();
  },

  /**
   * Show a custom confirmation modal. Returns a Promise<boolean>.
   */
  showConfirmModal(title, message) {
    return new Promise((resolve) => {
      // Create modal overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:999;display:flex;align-items:center;justify-content:center;';

      overlay.innerHTML = `
        <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" style="background:var(--bg-card,#fff);border:1px solid var(--border-light,#E5E5E5);border-radius:var(--r-lg,12px);padding:24px;max-width:400px;width:90%;color:var(--text-primary,#001D4E);font-family:var(--font,'Open Sans',sans-serif);">
          <h3 id="confirm-title" style="margin:0 0 8px;font-size:18px;"></h3>
          <p id="confirm-message" style="margin:0 0 24px;color:var(--text-muted,#636363);font-size:14px;"></p>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button id="confirm-cancel" style="padding:8px 16px;border-radius:var(--r,8px);border:1px solid var(--border-light,#E5E5E5);background:var(--bg-card,#fff);color:var(--text-primary,#001D4E);cursor:pointer;font-size:13px;font-family:var(--font);">Cancel</button>
            <button id="confirm-ok" style="padding:8px 16px;border-radius:var(--r,8px);border:none;background:var(--color-fail,#D93737);color:#fff;cursor:pointer;font-size:13px;font-weight:600;font-family:var(--font);">End Call</button>
          </div>
        </div>`;

      document.body.appendChild(overlay);

      overlay.querySelector('#confirm-title').textContent = title;
      overlay.querySelector('#confirm-message').textContent = message;

      // Auto-focus Cancel per standard
      overlay.querySelector('#confirm-cancel').focus();

      const cleanup = (result) => {
        overlay.remove();
        resolve(result);
      };

      overlay.querySelector('#confirm-cancel').onclick = () => cleanup(false);
      overlay.querySelector('#confirm-ok').onclick = () => cleanup(true);
      overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') cleanup(false);
      });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup(false);
      });
    });
  },

  /**
   * Handle call ending (triggered by user or remote participant leaving).
   */
  async handleCallEnd() {
    if (this._ending) return;
    this._ending = true;

    this.stopTimer();

    const callData = {
      conversationId: this.conversationId,
      sessionId: this.sessionId,
      duration: this.getDuration(),
    };

    // Update session status to ended - MUST complete before POST /process
    await this.updateSessionStatus('ended', {
      durationSeconds: callData.duration,
    });

    // Leave the Daily room first (stops media)
    if (this.callObject) {
      const co = this.callObject;
      this.callObject = null;
      co.leave().then(() => {
        co.destroy().catch(() => {});
      }).catch(() => {
        co.destroy().catch(() => {});
      });
    }

    // Transition to debrief - backend handles scoring via POST /process
    app.onCallEnded(callData);
  },

  /**
   * Clean up resources on cancel.
   */
  cleanup() {
    this._ending = false;
    this.stopTimer();
    if (this.callObject) {
      const co = this.callObject;
      this.callObject = null;
      co.leave().then(() => {
        co.destroy().catch(() => {});
      }).catch(() => {
        co.destroy().catch(() => {});
      });
    }
    this.conversationId = null;
    this.conversationUrl = null;
    this.sessionId = null;
  },

  /**
   * Create a session record in the database.
   * Returns the session ID, or null if session creation fails.
   * Non-blocking - call flow continues even if this fails.
   */
  async createSession(scenarioId) {
    try {
      const res = await fetchWithAuth('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scenarioId }),
      });

      if (!res.ok) {
        return null;
      }

      const envelope = await res.json();
      const session = envelope.data;
      return session.id;
    } catch (err) {
      return null;
    }
  },

  /**
   * Update the session status in the database.
   * Non-blocking - status update failures do not interrupt the call flow.
   */
  async updateSessionStatus(status, extras) {
    if (!this.sessionId) return;

    try {
      const body = { status };

      if (extras) {
        if (extras.tavusConversationId) body.tavusConversationId = extras.tavusConversationId;
        if (extras.durationSeconds !== undefined) body.durationSeconds = extras.durationSeconds;
      }

      const res = await fetchWithAuth(`/api/sessions/${this.sessionId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        return;
      }

    } catch (err) {

    }
  },

  /**
   * Populate the call guide sidebar from scenario data.
   * Renders coaching key concepts as collapsible sections,
   * common mistakes as an "Areas to Avoid" section,
   * and rubric weights as the scoring footer.
   */
  renderCallGuide(scenario) {
    const bodyEl = document.getElementById('call-guide-body');
    const scoringEl = document.getElementById('call-guide-scoring');
    if (!bodyEl || !scoringEl) return;

    // Update module badge in sidebar header
    const badges = document.querySelectorAll('#call-sidebar .guide-badge');
    if (badges.length > 0 && scenario) {
      badges[0].textContent = scenario.module || 'Module';
    }

    // If scenario has no coaching_notes, show a minimal fallback
    if (!scenario) {
      bodyEl.innerHTML = '<p style="padding:12px;color:var(--text-muted);">Call guide not available for this scenario.</p>';
      scoringEl.innerHTML = '';
      return;
    }

    // Use scenario-specific coaching notes when available, fall back to generic content
    var coachingNotes = scenario && scenario.coaching_notes;

    var keyConcepts = (
      coachingNotes &&
      Array.isArray(coachingNotes.key_concepts) &&
      coachingNotes.key_concepts.length > 0
    )
      ? coachingNotes.key_concepts
      : [
          'This is call number two. The buyer already told you their problems. Prove you were listening.',
          'Start by confirming what they shared last time before you present anything.',
          'Connect every product feature to a specific problem the buyer told you about.',
          'Use their words, not yours. If they said "checkout is a mess," say "checkout" not "point of sale optimization."',
          'Ask questions. The buyer should be talking more than you are.',
          'Earn the next step. Propose a specific follow-up and offer two times.'
        ];

    var commonMistakes = (
      coachingNotes &&
      Array.isArray(coachingNotes.common_mistakes) &&
      coachingNotes.common_mistakes.length > 0
    )
      ? coachingNotes.common_mistakes
      : [
          'Treating this like a cold call or starting with a generic pitch',
          'Talking about features the buyer never mentioned needing',
          'Dropping the price before the buyer understands what they are getting',
          'Ignoring or rushing past objections instead of addressing them directly',
          'Ending the call without asking for a clear next step',
          'Doing the math for the buyer instead of letting them see the numbers themselves'
        ];

    let html = '';

    // Key concepts section (open by default)
    var conceptId = 'guide-concepts';
    html += '<div class="guide-section open">';
    html += '<button class="guide-section-btn" aria-expanded="true" aria-controls="' + conceptId + '">';
    html += '<span class="guide-section-title">Key Concepts</span>';
    html += '<span class="guide-chevron" aria-hidden="true">▶</span>';
    html += '</button>';
    html += '<div class="guide-section-content" id="' + conceptId + '">';
    html += '<div class="guide-section-inner"><ul>';
    for (let i = 0; i < keyConcepts.length; i++) {
      html += '<li>' + esc(keyConcepts[i]) + '</li>';
    }
    html += '</ul></div></div></div>';

    // Common mistakes section
    var mistakesId = 'guide-mistakes';
    html += '<div class="guide-section">';
    html += '<button class="guide-section-btn" aria-expanded="false" aria-controls="' + mistakesId + '">';
    html += '<span class="guide-section-title">Areas to Avoid</span>';
    html += '<span class="guide-chevron" aria-hidden="true">▶</span>';
    html += '</button>';
    html += '<div class="guide-section-content" id="' + mistakesId + '">';
    html += '<div class="guide-section-inner guide-mistake"><ul>';
    for (let j = 0; j < commonMistakes.length; j++) {
      html += '<li>' + esc(commonMistakes[j]) + '</li>';
    }
    html += '</ul></div></div></div>';

    bodyEl.innerHTML = html;

    // Scoring footer from rubric weights
    const rubric = scenario.rubric;
    if (rubric) {
      const dotColors = ['var(--green)', 'var(--blue)', 'var(--purple)', 'var(--orange)', 'var(--payroc-blue)', 'var(--text-muted)', 'var(--color-warning)'];
      let scoringHtml = '<h4>Scoring Criteria</h4>';
      let colorIndex = 0;
      const keys = Object.keys(rubric);
      for (let k = 0; k < keys.length; k++) {
        const entry = rubric[keys[k]];
        const weight = entry.weight || 0;
        if (weight <= 0) continue;
        const displayName = formatCategoryName(keys[k]);
        const color = dotColors[colorIndex % dotColors.length];
        scoringHtml += '<div class="scoring-row">';
        scoringHtml += '<span class="scoring-dot" style="background:' + color + '"></span>';
        scoringHtml += '<span class="scoring-label">' + esc(displayName) + '</span>';
        scoringHtml += '<span class="scoring-weight">' + weight + '%</span>';
        scoringHtml += '</div>';
        colorIndex++;
      }
      scoringEl.innerHTML = scoringHtml;
    } else {
      scoringEl.innerHTML = '';
    }
  },

  /**
   * Update lobby status message.
   */
  updateLobbyStatus(text) {
    const el = document.getElementById('lobby-status');
    if (el) el.textContent = text;
  },
};
