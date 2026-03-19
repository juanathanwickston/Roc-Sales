/**
 * Audio Worklet Processor
 * Captures mic audio and converts to PCM 16-bit for WebSocket streaming.
 * Runs in a separate thread from the main JS thread.
 */
class PcmCaptureProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._buffer = [];
        this._bufferSize = 4096; // ~256ms at 16kHz
    }

    process(inputs) {
        const input = inputs[0];
        if (!input || !input[0]) return true;

        const samples = input[0];

        // Convert Float32 [-1, 1] to Int16 [-32768, 32767]
        for (let i = 0; i < samples.length; i++) {
            const s = Math.max(-1, Math.min(1, samples[i]));
            this._buffer.push(s < 0 ? s * 0x8000 : s * 0x7FFF);
        }

        // When buffer is full, send to main thread
        if (this._buffer.length >= this._bufferSize) {
            const pcmData = new Int16Array(this._buffer.splice(0, this._bufferSize));
            this.port.postMessage(pcmData.buffer, [pcmData.buffer]);
        }

        return true;
    }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
