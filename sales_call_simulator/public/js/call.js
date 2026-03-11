/**
 * Sales Call Simulator - Call Manager
 * Integrates with Tavus CVI via the Daily JS SDK.
 * Handles WebRTC video/audio, call controls, and timer.
 */

// Minimum call duration (seconds) before allowing end without confirmation
const MIN_CALL_DURATION_SECONDS = 30;

// Delay (ms) before Tavus conversation cleanup to give backend time to fetch transcript
const TAVUS_CLEANUP_DELAY_MS = 15000;

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

    try {
      // Step 1: Create a session record to track this call attempt
      this.updateLobbyStatus('Preparing session...');
      this.sessionId = await this.createSession(scenario.id);

      // Step 2: Create conversation via our backend proxy
      this.updateLobbyStatus('Creating conversation...');

      // C2 fix: Only send Tavus-accepted keys - never send rubric/coaching_notes
      const conversationPayload = {
        persona_id: scenario.persona_id,
      };
      // Optionally pass replica_id if scenario defines one (H1)
      if (scenario.replica_id) {
        conversationPayload.replica_id = scenario.replica_id;
      }
      // Pass only valid conversation properties
      if (scenario.conversation_config) {
        const cfg = scenario.conversation_config;
        if (cfg.conversation_name) conversationPayload.conversation_name = cfg.conversation_name;
        if (cfg.conversational_context) conversationPayload.conversational_context = cfg.conversational_context;
        if (cfg.custom_greeting) conversationPayload.custom_greeting = cfg.custom_greeting;
        if (cfg.properties) conversationPayload.properties = cfg.properties;
        if (cfg.require_auth !== undefined) conversationPayload.require_auth = cfg.require_auth;
      }

      const token = localStorage.getItem('roc_token');
      const res = await fetch('/api/tavus/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(conversationPayload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to create conversation: ${res.status}`);
      }

      const data = await res.json();
      this.conversationId = data.conversation_id;
      this.conversationUrl = data.conversation_url;

      if (!this.conversationUrl) {
        throw new Error('No conversation_url returned from Tavus');
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
      setTimeout(() => app.showScreen('scenarios'), 3000);
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
        avoidEval: true, // CSP-safe: eliminates need for 'unsafe-eval'
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
      this.updateLobbyStatus('Waiting for AI buyer to join...');

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
      muteBtn.querySelector('.control-icon').textContent = this.isMuted ? '🔇' : '🎤';
      muteBtn.querySelector('.control-label').textContent = this.isMuted ? 'Unmute' : 'Mute';
    }
    if (cameraBtn) {
      cameraBtn.classList.toggle('muted', this.isCameraOff);
      cameraBtn.querySelector('.control-icon').textContent = this.isCameraOff ? '📷' : '📹';
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
        'The call just started. Are you sure you want to end it?'
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
        <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" style="background:var(--n3,#152240);border:1px solid var(--gb,rgba(59,130,246,.12));border-radius:12px;padding:24px;max-width:400px;width:90%;color:var(--white,#EDF2FF);font-family:var(--font,'Geist',sans-serif);">
          <h3 id="confirm-title" style="margin:0 0 8px;font-size:18px;">${title}</h3>
          <p style="margin:0 0 24px;color:var(--gray,#7B8BA8);font-size:14px;">${message}</p>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button id="confirm-cancel" style="padding:8px 16px;border-radius:8px;border:1px solid var(--gb,rgba(59,130,246,.12));background:var(--n4,#1C2D4E);color:var(--white,#EDF2FF);cursor:pointer;font-size:13px;">Cancel</button>
            <button id="confirm-ok" style="padding:8px 16px;border-radius:8px;border:none;background:var(--red,#FF4466);color:#fff;cursor:pointer;font-size:13px;font-weight:600;">End Call</button>
          </div>
        </div>`;

      document.body.appendChild(overlay);

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
  handleCallEnd() {
    this.stopTimer();

    const callData = {
      conversationId: this.conversationId,
      sessionId: this.sessionId,
      duration: this.getDuration(),
    };

    // Update session status to ended
    this.updateSessionStatus('ended', {
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

    // Schedule Tavus conversation cleanup AFTER backend has had time to fetch transcript
    // The DELETE destroys the conversation and transcript on Tavus' side
    const convId = this.conversationId;
    if (convId) {
      setTimeout(function() {
        const token = localStorage.getItem('roc_token');
        fetch('/api/tavus/conversations/' + convId, {
          method: 'DELETE',
          headers: token ? { 'Authorization': 'Bearer ' + token } : {},
        }).catch(function(err) {
          console.warn('[Call] End conversation cleanup error:', err);
        });
      }, TAVUS_CLEANUP_DELAY_MS);
    }
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
      const token = localStorage.getItem('roc_token');
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ scenarioId }),
      });

      if (!res.ok) {
        console.warn('[Call] Session creation failed:', res.status);
        return null;
      }

      const session = await res.json();
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
      const token = localStorage.getItem('roc_token');
      const body = { status };

      if (extras) {
        if (extras.tavusConversationId) body.tavusConversationId = extras.tavusConversationId;
        if (extras.durationSeconds !== undefined) body.durationSeconds = extras.durationSeconds;
      }

      const res = await fetch(`/api/sessions/${this.sessionId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
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
