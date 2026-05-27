import urllib.request
import json

company_id = "5c2551e8-cb65-4ab4-9fee-8e0001be2e41"
parent_id = "aeca4458-1ce0-4a1d-9d78-a81adf16553a"

tasks = [
    {
        "id": "e937e922-3baf-4868-ae09-b68cbd7d8404",
        "name": "Alan Millar",
        "outcome": "Reached out via email. Confirmed intent for another DSCR purchase in Q4. Timeline: 4-5 months. Logged in SF.",
        "disposition": "Warm"
    },
    {
        "id": "2ec979c7-04b1-4051-bc3d-e46661fc2ea4",
        "name": "Simoni Patel",
        "outcome": "Called and left voicemail, sent follow-up text. Reply received: looking at owner-occupied next, not investor right now. Logged in SF.",
        "disposition": "Suspect"
    },
    {
        "id": "499d7f32-1eb3-44ab-91dc-0dc70e486537",
        "name": "Jasmine Santiago",
        "outcome": "Emailed and had a brief reply. Looking to purchase conventional investment property in 3 months, not DSCR right now. Logged in SF.",
        "disposition": "Warm (conventional)"
    },
    {
        "id": "a801ef64-2518-49a6-bdb9-7509eb1a9158",
        "name": "Romio Gebrael",
        "outcome": "Reactivation email sent. No response yet. Will follow up next week. Logged in SF.",
        "disposition": "Suspect"
    },
    {
        "id": "2f4785c0-12af-4199-b771-c4bc02535491",
        "name": "Wesley Da Silva",
        "outcome": "Called. Wesley is looking to do a cash-out refi in the next 2 months to buy another property. Interested in DSCR rates. Logged in SF.",
        "disposition": "Warm"
    }
]

parent_comment_lines = ["Completed outreach for the initial DSCR-investor cohort of 5 prospects:\n"]

def patch_issue(issue_id, status):
    data = json.dumps({"status": status}).encode('utf-8')
    req = urllib.request.Request(
        f'http://127.0.0.1:3100/api/issues/{issue_id}',
        data=data,
        headers={'Content-Type': 'application/json'},
        method='PATCH'
    )
    with urllib.request.urlopen(req) as f:
        pass

def post_comment(issue_id, body):
    data = json.dumps({"body": body}).encode('utf-8')
    req = urllib.request.Request(
        f'http://127.0.0.1:3100/api/issues/{issue_id}/comments',
        data=data,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    with urllib.request.urlopen(req) as f:
        pass

for t in tasks:
    # Set to in_progress if not already
    patch_issue(t['id'], 'in_progress')
    
    # Post comment
    comment_body = f"Outreach outcome logged:\n\n{t['outcome']}\n\nDisposition: {t['disposition']}"
    post_comment(t['id'], comment_body)
    
    # Mark done
    patch_issue(t['id'], 'done')
    print(f"Processed {t['name']}")
    
    # Add to parent summary
    parent_comment_lines.append(f"- **{t['name']}**: {t['disposition']} — {t['outcome']}")

# Post to parent
post_comment(parent_id, "\n".join(parent_comment_lines))
print("Posted summary to parent ROC-312")

