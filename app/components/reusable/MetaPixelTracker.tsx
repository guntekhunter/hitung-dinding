"use client";

import { useEffect } from "react";
import { trackMetaEvent } from "@/lib/meta-pixel";

export default function MetaPixelTracker({
  eventName,
  params = {},
}: {
  eventName: string;
  params?: Record<string, any>;
}) {
  useEffect(() => {
    trackMetaEvent(eventName, params);
  }, [eventName, JSON.stringify(params)]);

  return null;
}
