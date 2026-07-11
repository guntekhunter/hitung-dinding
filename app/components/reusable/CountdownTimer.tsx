"use client";

import { useEffect, useState } from "react";

function parseTime(s: string): number {
  const parts = s.split(":").map(Number);

  if (parts.length === 3)
    return parts[0] * 3600 + parts[1] * 60 + parts[2];

  if (parts.length === 2)
    return parts[0] * 60 + parts[1];

  return 0;
}

function formatTime(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  return [h, m, s]
    .map((v) => String(v).padStart(2, "0"))
    .join(":");
}

interface Props {
  initialTime: string;
}

export default function CountdownTimer({ initialTime }: Props) {
  const initialSeconds = parseTime(initialTime);
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    setSeconds(initialSeconds);

    const id = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 0) {
          // restart countdown
          return initialSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [initialSeconds]);

  return (
    <strong suppressHydrationWarning>
      {formatTime(seconds)}
    </strong>
  );
}