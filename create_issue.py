import urllib.request
import json

data = json.dumps({
    "title": "Confirm SF read path for Lead-Ops pipeline report",
    "description": "Sub-issue from ROC-317 to confirm whether Lead-Ops has Salesforce API credentials or if Mike should pull the DPA and Spanish cohort data weekly.\n\nRequired fields: SF contacts where status = funded AND tag in (dpa-masshousing-25k) AND tag in (spanish-cohort).",
    "parentId": "75f60cfb-427a-4e6a-a1ff-96aa38905fa4",
    "priority": "high",
    "status": "todo",
    "assigneeAgentId": "279d57c7-c517-4cd6-8c67-d3441e86d6bb"
}).encode('utf-8')

req = urllib.request.Request(
    'http://127.0.0.1:3100/api/companies/5c2551e8-cb65-4ab4-9fee-8e0001be2e41/issues',
    data=data,
    headers={'Content-Type': 'application/json'},
    method='POST'
)

with urllib.request.urlopen(req) as f:
    print(f.read().decode('utf-8'))
