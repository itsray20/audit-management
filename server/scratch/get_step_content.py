import json
import os

transcript_path = r"C:\Users\rohan\.gemini\antigravity-ide\brain\21fca985-eefe-4e27-829b-dbdc35d35a7c\.system_generated\logs\transcript_full.jsonl"

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            # Find subagent results or console log captures
            if data.get('type') == 'BROWSER_SUBAGENT':
                content = data.get('content', '')
                if 'inspect_failed_save' in content or 'inspect' in content:
                    print(f"Step {data.get('step_index')}:")
                    print(content)
                    print("=" * 60)
        except Exception as e:
            pass
