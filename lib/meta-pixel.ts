export function trackMetaEvent(
  eventName: string,
  params?: Record<string, any>,
  eventId?: string,
) {
  if (typeof window === "undefined") return;

  const fbq = (window as any).fbq;

  if (!fbq) return;

  if (eventId) {
    fbq("track", eventName, params || {}, {
      eventID: eventId,
    });
  } else {
    fbq("track", eventName, params || {});
  }
}
