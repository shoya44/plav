export type MediaType = "audio" | "video"

export type MediaItem = {
  id: string
  title: string
  type: MediaType
  url?: string
  durationSeconds?: number
}

export function getDisplayTitle(title: string) {
  return title.replace(/\.[^/.]+$/, "")
}

export function getFileExtension(title: string) {
  const match = title.match(/\.([^/.]+)$/)
  return match?.[1] ?? ""
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00"

  const minutes = Math.floor(seconds / 60)
  const secondsPart = Math.floor(seconds % 60)

  return `${minutes}:${secondsPart.toString().padStart(2, "0")}`
}