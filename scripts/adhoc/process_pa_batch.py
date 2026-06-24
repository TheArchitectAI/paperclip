import json
import subprocess
import sys

# List of the 32 loan IDs identified
loan_ids = [
    "a03PX00000UT0CEYA1", "a03PX00000SeL4VYAV", "a03PX00000nE30YYAS", "a03PX00000nP6gVYAS",
    "a03PX00000rMvvvYAC", "a03PX00000rQNAIYA4", "a03PX00000sm96jYAA", "a03PX00000tOZGQYA4",
    "a03PX00001158tYYAQ", "a03PX000015UAJbYAO", "a03PX00000oLGFqYAO", "a03PX00000oor9cYAA",
    "a03PX000010jVXQYA2", "a03PX000011YhWPYA0", "a03PX000013emo7YAA", "a03PX00000ukIenYAE",
    "a03PX00000vi12oYAA", "a03PX000013JieEYAS", "a03PX00000vzV2xYAE", "a03PX00000xj7tZYAQ",
    "a03PX00000yBIQgYAO", "a03PX00000yD7OIYA0", "a03PX00000yulpiYAA", "a03PX00001301XAYAY",
    "a03PX000012YGGQYA4", "a03PX00000z8b5hYAA", "a03PX00000zOq7wYAC", "a03PX00000zOtnNYAS",
    "a03PX00000zkjgbYAA", "a03PX000010Eoz1YAC", "a03PX000010LtoHYAS", "a03PX000010LzFNYA0"
]

def update_sf_status(loan_id, new_status):
    # Updating MtgPlanner_CRM__Status__c
    cmd = [
        "sf", "data", "update", "record",
        "--target-org", "prod_pipeline",
        "--sobject", "MtgPlanner_CRM__Transaction_Property__c",
        "--record-id", loan_id,
        "--values", f"MtgPlanner_CRM__Status__c='{new_status}'"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode == 0, result.stderr

def process_batch():
    results = {}
    for lid in loan_ids:
        # Assuming unresponsive track for emergency batch if no consult
        # For this script, we'll set to 'Expired' as per the emergency recovery procedure
        success, err = update_sf_status(lid, "Expired")
        results[lid] = "Success" if success else f"Failed: {err}"
        print(f"Processed {lid}: {'Success' if success else 'Failed'}")
    
    with open("processing_results.json", "w") as f:
        json.dump(results, f, indent=2)

if __name__ == "__main__":
    process_batch()
