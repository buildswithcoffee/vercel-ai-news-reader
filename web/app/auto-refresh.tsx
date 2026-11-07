"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-fetches the feed every 5 seconds so stories appear as the scorer writes them.
export function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [router]);

  return null;
}
