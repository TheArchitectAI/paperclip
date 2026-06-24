import subprocess
import json

def get_issue(issue_id):
    cmd = ["curl", "-s", f"http://127.0.0.1:3101/api/issues/{issue_id}"]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return json.loads(res.stdout)

# Audit existing commands in server/ or cli/
# Based on the plan (ROC-2829), I need to add funnel metrics to these.
# They might be routines, not just CLI commands.
