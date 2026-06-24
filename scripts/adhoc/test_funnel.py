from datetime import datetime, timezone, timedelta

def main():
    # Simulate funnel metrics calculation
    now = datetime.now(timezone.utc)
    print(f"Current UTC: {now}")
    
    # Simple test for funnel reporting logic
    leads_mtd = 150
    apps_mtd = 12
    conversion = (apps_mtd / leads_mtd * 100) if leads_mtd > 0 else 0
    print(f"MTD Leads: {leads_mtd}")
    print(f"MTD Apps: {apps_mtd}")
    print(f"Conversion: {conversion:.2f}%")

if __name__ == "__main__":
    main()
