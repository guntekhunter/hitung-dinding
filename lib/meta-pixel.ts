export function trackMetaEvent(
  eventName: string,
  params?: Record<string, any>,
  eventId?: string,
) {
  if (typeof window === "undefined") return;

  const fbq = (window as any).fbq;

  if (!fbq) return;

  const cleanUrl = window.location.origin + window.location.pathname;
  const eventParams = {
    event_source_url: cleanUrl,
    ...(params || {})
  };

  if (eventId) {
    fbq("track", eventName, eventParams, {
      eventID: eventId,
    });
  } else {
    fbq("track", eventName, eventParams);
  }
}
