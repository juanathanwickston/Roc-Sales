/**
 * Sales Call Simulator - Call Manager
 * Integrates with Tavus CVI via the Daily JS SDK.
 * Handles WebRTC video/audio, call controls, and timer.
 */

// Minimum call duration (seconds) before allowing end without confirmation
const MIN_CALL_DURATION_SECONDS = 120;

// Delay (ms) before Tavus conversation cleanup to give backend time to fetch transcript


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

  /**
   * Start a call: create Tavus conversation via backend, then join via Daily.
   */
  async startCall(scenario) {
    // Always clean up any previous call object before starting
    this.cleanup();

    // Clear any previous continuity notes
    var notesEl = document.getElementById('lobby-continuity-notes');
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
      if (scenario.module_id === 'module2' && scenario.persona_id) {
        try {
          var notesRes = await fetchWithAuth('/api/sessions/continuity?personaId=' + scenario.persona_id);
          if (notesRes.ok) {
            const notesEnvelope = await notesRes.json();
            var notesData = notesEnvelope.data;
            if (notesData && notesData.relationship_summary && notesEl) {
              this.renderFormattedNotes(notesEl, notesData.relationship_summary);
              notesEl.style.display = 'block';
            }
          }
        } catch (e) {
          console.warn('[Call] Failed to fetch continuity notes:', e.message);
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

      console.log(`[Call] Conversation created: ${this.conversationId}`);
      console.log(`[Call] URL: ${this.conversationUrl}`);

      // Link the Tavus conversation ID to the session and mark as active
      await this.updateSessionStatus('active', {
        tavusConversationId: this.conversationId,
      });

      // Step 3: Join via Daily JS SDK
      this.updateLobbyStatus('Connecting to call...');
      await this.joinDaily();
    } catch (err) {
      console.error('[Call] Start error:', err);
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

    var header = document.createElement('h4');
    header.style.cssText = 'margin:0 0 8px;font-size:13px;color:var(--payroc-blue);';
    header.textContent = 'Previous Call Notes';
    container.appendChild(header);

    var div = document.createElement('div');
    div.style.cssText = 'font-size:12px;color:var(--text-muted);line-height:1.5;';

    var lines = text.split('\n');
    var ul = null;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('- ') || line.startsWith('* ')) {
        if (!ul) {
          ul = document.createElement('ul');
          ul.style.cssText = 'margin:4px 0;padding-left:16px;';
          div.appendChild(ul);
        }
        var li = document.createElement('li');
        this.parseAndAppendFormattedText(li, line.substring(2));
        ul.appendChild(li);
      } else {
        ul = null; // Reset list context
        var p = document.createElement('p');
        p.style.margin = '4px 0';
        this.parseAndAppendFormattedText(p, line);
        div.appendChild(p);
      }
    }

    container.appendChild(div);
  },

  parseAndAppendFormattedText(element, text) {
    var parts = text.split(/\*\*(.*?)\*\*/g);
    for (var i = 0; i < parts.length; i++) {
      if (i % 2 === 1) {
        var strong = document.createElement('strong');
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
    try {
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
        console.warn('[Call] Noise cancellation not available:', e.message);
      }

      // Join the meeting
      this.updateLobbyStatus('Joining call...');
      await this.callObject.join({ url: this.conversationUrl });

      // Ensure local audio is explicitly enabled after join
      this.callObject.setLocalAudio(true);
      this.callObject.setLocalVideo(true);

      console.log('[Call] Joined successfully');
    } catch (err) {
      console.error('[Call] Daily join error:', err);
      throw err;
    }
  },

  /**
   * Set up Daily SDK event handlers.
   */
  setupDailyEvents() {
    const call = this.callObject;

    // When a remote participant (Tavus avatar) joins
    call.on('participant-joined', (event) => {
      if (event.participant.local) return;
      console.log('[Call] Remote participant joined:', event.participant.user_name || 'AI Buyer');
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
      console.log('[Call] Remote participant left - call ending');
      this.handleCallEnd();
    });

    // Handle errors
    call.on('error', (event) => {
      console.error('[Call] Daily error:', event);
    });

    // When we've joined successfully - attach local video to PiP
    call.on('joined-meeting', () => {
      console.log('[Call] Local user joined meeting');
      this.updateLobbyStatus('Waiting for the buyer to join...');

      // Attach local video to PiP self-view
      const localParticipant = call.participants().local;
      if (localParticipant) {
        this.attachLocalTracks(localParticipant);
      }
    });

    // When call is left
    call.on('left-meeting', () => {
      console.log('[Call] Left meeting');
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
      this.callObject.leave().catch(console.error);
      this.callObject.destroy().catch(console.error);
      this.callObject = null;
    }

    // Transition to debrief - backend handles scoring via POST /process
    app.onCallEnded(callData);
  },

  /**
   * Clean up resources on cancel.
   */
  cleanup() {
    this.stopTimer();
    if (this.callObject) {
      this.callObject.leave().catch(() => {});
      this.callObject.destroy().catch(() => {});
      this.callObject = null;
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
        console.warn('[Call] Session creation failed:', res.status);
        return null;
      }

      const envelope = await res.json();
      const session = envelope.data;
      console.log(`[Call] Session created: ${session.id}`);
      return session.id;
    } catch (err) {
      console.warn('[Call] Session creation error:', err.message);
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
        console.warn(`[Call] Session status update failed: ${res.status}`);
        return;
      }

      console.log(`[Call] Session ${this.sessionId} -> ${status}`);
    } catch (err) {
      console.warn('[Call] Session status update error:', err.message);
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
