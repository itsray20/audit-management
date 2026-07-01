import json
import os

transcript_path = r"C:\Users\rohan\AppData\Local\Temp\transcript_full.jsonl"
# Let's search other standard locations if not there
alt_path = r"C:\Users\rohan\.gemini\antigravity-ide\brain\21fca985-eefe-4e27-829b-dbdc35d35a7c\.system_generated\logs\transcript_full.jsonl"
if os.path.exists(alt_path):
    transcript_path = alt_path

print(f"Reading transcript from {transcript_path}...")
with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            content = data.get('content', '')
            if 'capture_browser_console_logs' in content or 'AxiosError' in content or 'Failed to save count' in content:
                print(f"Step {data.get('step_index')}: {content[:1000]}")
                print("-" * 50)
        except Exception as e:
            pass
