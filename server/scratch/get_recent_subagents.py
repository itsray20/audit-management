import json
import os

transcript_path = r"C:\Users\rohan\.gemini\antigravity-ide\brain\21fca985-eefe-4e27-829b-dbdc35d35a7c\.system_generated\logs\transcript_full.jsonl"

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            step_index = data.get('step_index', 0)
            # Only print recent steps
            if step_index >= 1400:
                if data.get('type') == 'BROWSER_SUBAGENT':
                    print(f"Step {step_index}:")
                    print(data.get('content'))
                    print("=" * 60)
        except Exception as e:
            pass
