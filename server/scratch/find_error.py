import json
import os

transcript_path = r"C:\Users\rohan\.gemini\antigravity-ide\brain\21fca985-eefe-4e27-829b-dbdc35d35a7c\.system_generated\logs\transcript_full.jsonl"

with open(transcript_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if "Failed to save count." in line:
        print(f"Match found at line {idx}:")
        # Print the surrounding lines
        start = max(0, idx - 5)
        end = min(len(lines), idx + 5)
        for i in range(start, end):
            try:
                data = json.loads(lines[i])
                print(f"Step {data.get('step_index')} ({data.get('type')}):")
                content = str(data.get('content', ''))
                print(content[:500])
                print("-" * 30)
            except:
                print(f"Error parsing line {i}")
        print("=" * 60)
