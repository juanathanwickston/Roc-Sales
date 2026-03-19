/**
 * Media Capture Module
 * Wraps browser getUserMedia API for mic and camera access.
 * No external dependencies.
 */

let stream = null;
let audioTrack = null;
let videoTrack = null;

/**
 * Request mic and camera permissions, return the MediaStream.
 * Camera is optional (PIP shows avatar placeholder if denied).
 * Mic is required (throws if denied).
 */
export async function init() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: {
                width: { ideal: 180 },
                height: { ideal: 180 },
                facingMode: 'user'
            }
        });
        audioTrack = stream.getAudioTracks()[0] || null;
        videoTrack = stream.getVideoTracks()[0] || null;
        return { stream, hasVideo: videoTrack !== null };
    } catch (err) {
        // Camera denied but mic might still work
        if (err.name === 'NotAllowedError' || err.name === 'NotFoundError') {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioTrack = stream.getAudioTracks()[0] || null;
                videoTrack = null;
                return { stream, hasVideo: false };
            } catch (micErr) {
                throw new Error('mic-denied');
            }
        }
        throw new Error('mic-denied');
    }
}

/**
 * Toggle the audio track mute state.
 * Returns true if now muted, false if unmuted.
 */
export function toggleMic() {
    if (!audioTrack) {
        return true;
    }
    audioTrack.enabled = !audioTrack.enabled;
    return !audioTrack.enabled;
}

/**
 * Get the video track for rendering in PIP.
 * Returns null if camera was denied.
 */
export function getVideoTrack() {
    return videoTrack;
}

/**
 * Get the audio track for future WebSocket streaming.
 */
export function getAudioTrack() {
    return audioTrack;
}

/**
 * Stop all tracks and release camera/mic.
 */
export function destroy() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    stream = null;
    audioTrack = null;
    videoTrack = null;
}
