import urllib.request
import json
import os

API_KEY = "pit-1138def5-390b-4ffb-b8e9-30b2ea6b5990"
GHL_BASE_URL = "https://services.leadconnectorhq.com"
LOCATION_ID = "y5eLFi2NFVoin9FxJiyc"

def ghl_api_call(url_path, method="GET"):
    url = f"{GHL_BASE_URL}{url_path}"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Version": "2021-07-28",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    req = urllib.request.Request(url, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"Error calling {url}: {e}")
        return None

# Attempt to find email settings or domain DNS records directly
# Documentation for GHL API often uses /email/settings or /locations/{id}/email_settings
# I will try a few likely paths
paths = [
    f"/locations/{LOCATION_ID}/email_settings",
    f"/domains/?locationId={LOCATION_ID}",
    "/email/settings"
]

for path in paths:
    print(f"Testing {path}:")
    print(ghl_api_call(path))
