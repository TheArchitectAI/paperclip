import urllib.request
import json

issue_id = "75f60cfb-427a-4e6a-a1ff-96aa38905fa4"
company_id = "5c2551e8-cb65-4ab4-9fee-8e0001be2e41"

# Post Comment
comment_data = json.dumps({
    "body": "Pre-build steps completed:\n\n1. Created follow-up sub-issue [ROC-523](/ROC/issues/ROC-523) to confirm the Salesforce read path for Lead-Ops/Mike.\n2. Drafted the GHL query shape for `dpa-*` and `spanish` tags to be ready for the baseline snapshot.\n\nThe first actual report run is scheduled for 2026-06-01. Marking this setup issue as complete; the pipeline report will be handled as a recurring routine thereafter."
}).encode('utf-8')

req1 = urllib.request.Request(
    f'http://127.0.0.1:3100/api/issues/{issue_id}/comments',
    data=comment_data,
    headers={'Content-Type': 'application/json'},
    method='POST'
)

with urllib.request.urlopen(req1) as f:
    print("Comment posted:", f.read().decode('utf-8'))

# Mark as done
patch_data = json.dumps({
    "status": "done"
}).encode('utf-8')

req2 = urllib.request.Request(
    f'http://127.0.0.1:3100/api/issues/{issue_id}',
    data=patch_data,
    headers={'Content-Type': 'application/json'},
    method='PATCH'
)

with urllib.request.urlopen(req2) as f:
    print("Issue marked done:", f.read().decode('utf-8'))
