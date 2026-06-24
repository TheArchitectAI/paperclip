import { FacebookAdsApi, ServerEvent, UserData, CustomData } from 'facebook-nodejs-business-sdk';
import { createHash } from 'crypto';

function sha256(data: string) {
  return createHash('sha256').update(data.toLowerCase().trim()).digest('hex');
}

export async function handleWebhook(payload: any, deps: any) {
  console.log("Received GHL webhook:", payload);
  
  const access_token = process.env.FB_CAPI_ACCESS_TOKEN;
  const pixel_id = process.env.FB_PIXEL_ID;
  
  if (!access_token || !pixel_id) {
    console.error("Missing Facebook CAPI configuration.");
    return;
  }

  const api = FacebookAdsApi.init(access_token);
  
  const userData = new UserData();
  
  if (payload.contact?.email) {
    userData.setEmails([sha256(payload.contact.email)]);
  }
  if (payload.contact?.phone) {
    userData.setPhones([sha256(payload.contact.phone)]);
  }

  // Map GHL event types to CAPI standard events
  // Payload events: Lead, QualifiedLead, ApplicationStarted, PreApproved
  const eventName = payload.event_type || 'Lead';
  
  const customData = new CustomData()
    .setCurrency('usd')
    .setValue(0);

  const serverEvent = new ServerEvent()
    .setEventName(eventName)
    .setEventTime(Math.floor(Date.now() / 1000))
    .setUserData(userData)
    .setCustomData(customData)
    .setEventSourceUrl(payload.source_url || 'https://mortgagearchitect.net')
    .setActionSource('website');

  try {
    const response = await api.execute('POST', `/${pixel_id}/events`, {
      data: [serverEvent],
    });
    console.log("Successfully sent event to CAPI:", response);
  } catch (error) {
    console.error("Failed to send event to CAPI:", error);
  }
}
