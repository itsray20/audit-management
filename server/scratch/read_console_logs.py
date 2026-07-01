import json
import os

transcript_path = r"C:\Users\rohan\.gemini\antigravity-ide\brain\21fca985-eefe-4e27-829b-dbdc35d35a7c\.system_generated\logs\transcript_full.jsonl"

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            content = data.get('content', '')
            if 'capture_browser_console_logs' in content or 'console' in line.lower() or 'logs' in line.lower():
                # Print the step index and the content
                print(f"Step {data.get('step_index')}:")
                print(content[:1500])
                print("=" * 60)
        except Exception as e:
            pass
