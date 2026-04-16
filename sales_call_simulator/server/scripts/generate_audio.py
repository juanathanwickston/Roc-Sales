"""
Gemini TTS Audio Orchestrator (Multi-Speaker Mode)
Generates a full two-person conversation from a JSON script using
a SINGLE API call to Gemini's multi-speaker TTS engine.

Usage: python server/scripts/generate_audio.py
"""
import os
import json
import wave
import time
from pathlib import Path
from google import genai
from google.genai import types
from dotenv import load_dotenv

# ── Configuration ──
load_dotenv(Path(__file__).parent.parent.parent / '.env')
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
MODEL = "gemini-2.5-flash-preview-tts"
SAMPLE_RATE = 24000  # Gemini TTS default

SCRIPT_FILE = Path(__file__).parent.parent / 'curriculum' / 'module1_script.json'
OUTPUT_FILE = Path(__file__).parent.parent.parent / 'public' / 'media' / 'module1_audio.wav'

# Map speakers to Gemini voice profiles
VOICE_MAP = {
    "Jake": "Orus",
    "Mike": "Puck"
}


def build():
    print("=" * 60)
    print("  Gemini Multi-Speaker TTS Orchestrator")
    print("=" * 60)

    if not GEMINI_KEY:
        print("ERROR: GEMINI_API_KEY not found in .env")
        return

    client = genai.Client(api_key=GEMINI_KEY)

    with open(SCRIPT_FILE, 'r') as f:
        script_data = json.load(f)

    print(f"Loaded {len(script_data)} dialogue blocks from script")
    print(f"Model: {MODEL}")

    # ── Build the multi-speaker prompt ──
    # Format: "Speaker1: line\nSpeaker2: line\n..."
    # Insert [PAUSE] markers where we need quiz interruptions
    dialogue_lines = []
    pause_indices = []  # Track which line-breaks are pause points

    for idx, block in enumerate(script_data):
        speaker = block["speaker"]
        dialogue_lines.append(f"{speaker}: {block['text']}")
        if block.get("pauseAfter", False):
            pause_indices.append(idx)

    # Combine into single multi-speaker prompt
    full_script = "\n".join(dialogue_lines)

    # Style direction for the entire conversation
    style_prompt = (
        "Read this sales call conversation between two people. "
        "Jake is a slightly nervous, eager junior sales rep — natural pacing with occasional hesitation and filler words like 'uh' and 'I mean'. "
        "Mike is a skeptical, busy business owner — slightly guarded but polite, sounds distracted. "
        "Make the conversation sound natural and realistic, like a real phone call. "
        "Add natural pauses between speaker turns.\n\n"
    )

    full_prompt = style_prompt + full_script

    print(f"\nGenerating full conversation in ONE API call...")
    print(f"Script length: {len(full_prompt)} characters")
    print(f"Pause points after blocks: {pause_indices}\n")

    # ── Build multi-speaker voice config ──
    speaker_configs = []
    for speaker_name, voice_name in VOICE_MAP.items():
        speaker_configs.append(
            types.SpeakerVoiceConfig(
                speaker=speaker_name,
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=voice_name
                    )
                )
            )
        )

    # Retry logic for rate limits
    max_retries = 5
    response = None
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=full_prompt,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
                            speaker_voice_configs=speaker_configs
                        )
                    )
                )
            )
            break
        except Exception as e:
            if '429' in str(e) and attempt < max_retries - 1:
                import re
                match = re.search(r'retry in (\d+)', str(e))
                wait = int(match.group(1)) + 2 if match else 60
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
            else:
                print(f"FAILED: {e}")
                return

    if not response:
        print("ERROR: No response received")
        return

    audio_data = response.candidates[0].content.parts[0].inline_data.data
    total_duration = len(audio_data) / (SAMPLE_RATE * 2)

    print(f"  Audio received: {total_duration:.1f}s ({len(audio_data)} bytes)")

    # ── Write WAV ──
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUTPUT_FILE), 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(audio_data)

    file_size_mb = OUTPUT_FILE.stat().st_size / (1024 * 1024)

    # ── Estimate timestamps ──
    # With multi-speaker mode, the model generates its own natural pauses.
    # We estimate pause points proportionally based on text distribution.
    total_chars = sum(len(b["text"]) for b in script_data)
    cumulative_chars = 0
    timestamps = []

    for idx, block in enumerate(script_data):
        cumulative_chars += len(block["text"])
        if block.get("pauseAfter", False):
            # Proportional timestamp estimate
            ratio = cumulative_chars / total_chars
            estimated_time = ratio * total_duration
            timestamps.append(estimated_time)

    print(f"\n{'=' * 60}")
    print(f"  SUCCESS")
    print(f"{'=' * 60}")
    print(f"  File: {OUTPUT_FILE}")
    print(f"  Duration: {total_duration:.1f}s")
    print(f"  Size: {file_size_mb:.2f} MB")
    print(f"\n  Javascript Timestamp Array (proportional estimates):")
    print(f"  -----------------------------")
    for i, t in enumerate(timestamps):
        print(f"    id: 'q{i+1}', time: {round(t, 2)},")
    print()
    print("  NOTE: Listen to the audio and fine-tune timestamps")
    print("  to align with actual speaker turn boundaries.")
    print()


if __name__ == "__main__":
    build()
