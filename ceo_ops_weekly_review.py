import json
import urllib.request
from datetime import datetime

# Mocked data fetcher for Salesforce/Jungo
def fetch_funded_counts():
    # In a real environment, query the CRM API
    # Returning mocked baseline and current week data
    return {
        "Ivan": {"current_week": 2, "prior_year": 1, "prior_quarter": 2},
        "Yauvan": {"current_week": 0, "prior_year": 2, "prior_quarter": 1},
        "Michael": {"current_week": 3, "prior_year": 2, "prior_quarter": 2},
        "Zunaira": {"current_week": 1, "prior_year": 1, "prior_quarter": 1}
    }

def run_review():
    data = fetch_funded_counts()
    
    # Calculate median for the current week
    current_counts = [d["current_week"] for d in data.values()]
    current_counts.sort()
    mid = len(current_counts) // 2
    median = (current_counts[mid] + current_counts[~mid]) / 2.0
    
    print(f"Weekly Funded Loan Review - {datetime.now().strftime('%Y-%m-%d')}")
    print(f"Median funded count this week: {median}")
    
    flagged_aes = []
    for ae, stats in data.items():
        if stats["current_week"] < median:
            flagged_aes.append(ae)
            print(f"FLAGGED: {ae} is running below median ({stats['current_week']} < {median})")
        
        # Compare to prior year / prior quarter
        if stats["current_week"] < stats["prior_year"]:
            print(f"WARNING: {ae} current week ({stats['current_week']}) < prior year ({stats['prior_year']})")
        if stats["current_week"] < stats["prior_quarter"]:
            print(f"WARNING: {ae} current week ({stats['current_week']}) < prior quarter ({stats['prior_quarter']})")

    if flagged_aes:
        print(f"\nCoordinating with Lead Operations (279d57c7) for interventions for: {', '.join(flagged_aes)}")
        # In a real setup, we would create a Paperclip issue here assigned to Lead Operations.
        
if __name__ == "__main__":
    run_review()
