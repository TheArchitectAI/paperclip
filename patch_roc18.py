import urllib.request
import json

issue_id = "dbf25a4c-e380-4b47-9e5d-4aad760cd00e" # ROC-18
company_id = "5c2551e8-cb65-4ab4-9fee-8e0001be2e41"

comment_data = json.dumps({
    "body": "Deployment completed.\n\n- Global value set `Cancellation_Reason__c` deployed to production via unlocked package.\n- Picklists and companion `Cancellation_Reason_Notes__c` deployed to Contact and TxProp.\n- Validation rules active and tested successfully in prod (negative tests passed).\n- Page layouts updated.\n- Fields added to relevant pipeline reports.\n\nRollback plan: If issues arise, we will deactivate the validation rules and remove the fields from the page layouts as an immediate rollback, before deprecating the custom fields."
}).encode('utf-8')

req1 = urllib.request.Request(
    f'http://127.0.0.1:3100/api/issues/{issue_id}/comments',
    data=comment_data,
    headers={'Content-Type': 'application/json'},
    method='POST'
)

try:
    with urllib.request.urlopen(req1) as f:
        print("Comment posted:", f.read().decode('utf-8'))
except Exception as e:
    print("Failed to post comment:", e)

patch_data = json.dumps({
    "status": "done"
}).encode('utf-8')

req2 = urllib.request.Request(
    f'http://127.0.0.1:3100/api/issues/{issue_id}',
    data=patch_data,
    headers={'Content-Type': 'application/json'},
    method='PATCH'
)

try:
    with urllib.request.urlopen(req2) as f:
        print("Issue marked done:", f.read().decode('utf-8'))
except Exception as e:
    print("Failed to mark done:", e)
