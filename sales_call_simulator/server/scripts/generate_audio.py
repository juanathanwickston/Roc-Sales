import os
import json
from pathlib import Path
from openai import OpenAI
from mutagen.mp3 import MP3
from dotenv import load_dotenv

# Load workspace env
load_dotenv(Path(__file__).parent.parent.parent / '.env')
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SCRIPT_FILE = Path(__file__).parent.parent / 'curriculum' / 'module1_script.json'
OUTPUT_FILE = Path(__file__).parent.parent.parent / 'public' / 'media' / 'module1_audio.mp3'
TEMP_DIR = Path(__file__).parent / 'temp_audio'

def build():
    print("-------- Initiating Audio Orchestrator --------")
    
    # Setup
    with open(SCRIPT_FILE, 'r') as f:
        script_data = json.load(f)
        
    TEMP_DIR.mkdir(exist_ok=True)
    if OUTPUT_FILE.exists():
        OUTPUT_FILE.unlink()

    cumulative_time = 0.0
    timestamps = []
    
    master_file = open(OUTPUT_FILE, 'wb')

    for idx, block in enumerate(script_data):
        print(f"Generating Clip {idx+1}/{len(script_data)} ({block['speaker']})...")
        
        # 1. Ping OpenAI
        response = client.audio.speech.create(
            model="tts-1",
            voice=block["voice"],
            input=block["text"]
        )
        
        temp_file = TEMP_DIR / f"{idx}.mp3"
        response.stream_to_file(temp_file)
        
        # 2. Extract precision frame length
        audio = MP3(temp_file)
        clip_duration = audio.info.length
        cumulative_time += clip_duration
        
        # 3. Concatenate binary frames to master stream
        with open(temp_file, 'rb') as tf:
             master_file.write(tf.read())
             
        # 4. Check array lockout tracker
        if block.get("pauseAfter", False):
             timestamps.append(cumulative_time)

    master_file.close()

    # Cleanup temp
    for file in TEMP_DIR.glob("*.mp3"):
        file.unlink()
    TEMP_DIR.rmdir()

    print("\n-------- SUCCESS: Audio Pipeline Generated --------")
    print(f"Master file created: {OUTPUT_FILE}")
    print("\n> Javascript Injection Output:")
    
    for idx, t in enumerate(timestamps):
        print(f"   id: 'q{idx+1}', time: {round(t, 2)}, // Native Generated Threshold")

if __name__ == "__main__":
    build()
