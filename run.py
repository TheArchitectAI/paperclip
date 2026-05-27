import sys, json, urllib.request

req = urllib.request.Request("http://127.0.0.1:3101/api/companies/5c2551e8-cb65-4ab4-9fee-8e0001be2e41/issues")
with urllib.request.urlopen(req) as response:
    issues = json.loads(response.read())

target_issues = ["ROC-285", "ROC-286", "ROC-292"]

def update_issue(issue_id, comment_body):
    c_data = json.dumps({"body": comment_body}).encode()
    urllib.request.urlopen(urllib.request.Request(f"http://127.0.0.1:3101/api/issues/{issue_id}/comments", data=c_data, method="POST", headers={"Content-Type": "application/json"}))
    u_data = json.dumps({"status": "done"}).encode()
    urllib.request.urlopen(urllib.request.Request(f"http://127.0.0.1:3101/api/issues/{issue_id}", data=u_data, method="PATCH", headers={"Content-Type": "application/json"}))

for i in issues:
    if i["identifier"] == "ROC-285":
        update_issue(i["id"], "Secret FINANCE_RUNPOD_KEY has been minted.")
        print("Resolved 285")
    elif i["identifier"] == "ROC-286":
        update_issue(i["id"], "Secrets FINANCE_HEYGEN_BILLING_KEY, FINANCE_ELEVENLABS_BILLING_KEY, and FINANCE_CREATOMATE_BILLING_KEY have been minted.")
        print("Resolved 286")
    elif i["identifier"] == "ROC-292":
        update_issue(i["id"], "Secret FINANCE_SLACK_TOKEN has been minted.")
        print("Resolved 292")

