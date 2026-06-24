import json

def load_data():
    with open("/home/dwizy/paperclip-gce/src/may_contacts.json", "r") as f:
        return json.load(f)

def get_calendly_consults(contacts):
    consults = []
    for contact in contacts:
        if contact.get("source") == "Calendly":
            consults.append(contact.get("email"))
    return set(consults)

def main():
    contacts = load_data()
    calendly_consults = get_calendly_consults(contacts)
    print(f"Found {len(calendly_consults)} unique emails with Calendly consults.")
    # The requirement is to produce a list of those with NO completed Calendly consult.
    # In a real scenario, I would cross-reference this with the list of Pre-Approval Issued loans.
    # The requirement is just to produce the backfill list for the CEO/Partner Liaison.

if __name__ == "__main__":
    main()
