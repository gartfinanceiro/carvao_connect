"use client"

import { Feed } from "@/components/feed"

export function FeedWrapper({ userName }: { userName: string }) {
  return <Feed userName={userName} />
}
