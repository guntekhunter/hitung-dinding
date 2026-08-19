import crypto from "crypto";

export async function sendMetaCAPIEvent(
  eventName: string,
  userData: {
    email?: string;
    phone?: string;
    firstName?: string;
    clientIp?: string;
    userAgent?: string;
  },
  customData: {
    currency?: string;
    value?: number;
    content_name?: string;
  },
  eventId?: string
) {
  const pixelId = process.env.PIXEL_ID;
  const capiToken = process.env.META_CAPI_TOKEN;
  const testEventCode = process.env.TEST_EVENT_CODE;

  if (!pixelId || !capiToken) {
    console.warn("[Meta CAPI] PIXEL_ID or META_CAPI_TOKEN is missing.");
    return;
  }

  const hash = (val?: string) => {
    if (!val) return undefined;
    return crypto.createHash("sha256").update(val.trim().toLowerCase()).digest("hex");
  };

  const payload: any = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        user_data: {
          em: userData.email ? [hash(userData.email)] : undefined,
          ph: userData.phone ? [hash(userData.phone)] : undefined,
          fn: userData.firstName ? [hash(userData.firstName)] : undefined,
          client_ip_address: userData.clientIp,
          client_user_agent: userData.userAgent,
        },
        custom_data: customData,
      },
    ],
  };

  if (eventId) {
    payload.data[0].event_id = eventId;
  }

  if (testEventCode) {
    payload.test_event_code = testEventCode;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${pixelId}/events`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${capiToken}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();
    if (!response.ok) {
      console.error("[Meta CAPI] Error response:", result);
    } else {
      console.log(`[Meta CAPI] Event ${eventName} sent successfully.`);
    }
  } catch (error) {
    console.error("[Meta CAPI] Error sending event:", error);
  }
}
