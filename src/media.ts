export type MediaType = "audio" | "video"

export type MediaItem = {
  id: string
  title: string
  type: MediaType
  url?: string
  durationSeconds?: number
}

type ApiTrack = {
  id: string
  title: string
  durationSeconds: number
  mediaUrl: string
}

type TracksResponse = {
  tracks: ApiTrack[]
}

export async function fetchTracks(): Promise<MediaItem[]> {
  const response = await fetch("/api/tracks")

  if (!response.ok) {
    throw new Error(`曲一覧の取得に失敗しました。(${response.status})`)
  }

  const data = (await response.json()) as TracksResponse

  return data.tracks.map((track) => ({
    id: track.id,
    title: track.title,
    type: "audio",
    url: track.mediaUrl,
    durationSeconds: track.durationSeconds,
  }))
}

export function getDisplayTitle(title: string) {
  return title.replace(/\.[^/.]+$/, "")
}

export function getFileExtension(title: string) {
  return title.match(/\.([^/.]+)$/)?.[1] ?? ""
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00"

  const minutes = Math.floor(seconds / 60)
  const secondsPart = Math.floor(seconds % 60)

  return `${minutes}:${secondsPart.toString().padStart(2, "0")}`
}
