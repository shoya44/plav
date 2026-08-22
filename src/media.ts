export type MediaType = "audio" | "video"

export type MediaItem = {
  id: string
  title: string
  type: MediaType
  url?: string
  durationSeconds?: number
  createdAt?: string
}

export type SortMode = "dateAddedDesc" | "dateAddedAsc" | "titleAsc"

type ApiTrack = {
  id: string
  title: string
  durationSeconds: number
  mediaUrl: string
  createdAt: string
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
    createdAt: track.createdAt,
  }))
}

export function sortItems(
  items: MediaItem[],
  sortMode: SortMode,
): MediaItem[] {
  const sorted = [...items]

  switch (sortMode) {
    case "titleAsc":
      sorted.sort((a, b) =>
        getDisplayTitle(a.title).localeCompare(getDisplayTitle(b.title)),
      )
      break
    case "dateAddedAsc":
      sorted.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""))
      break
    case "dateAddedDesc":
      sorted.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
      break
  }

  return sorted
}

export async function updateTrackTitle(
  id: string,
  title: string,
): Promise<void> {
  const response = await fetch(`/api/tracks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  })

  if (!response.ok) {
    throw new Error(`タイトルの更新に失敗しました。(${response.status})`)
  }
}

export async function deleteTrack(id: string): Promise<void> {
  const response = await fetch(`/api/tracks/${id}`, {
    method: "DELETE",
  })

  if (!response.ok) {
    throw new Error(`曲の削除に失敗しました。(${response.status})`)
  }
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
