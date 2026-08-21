export type MediaType = "audio" | "video"

export type MediaItem = {
  id: number
  title: string
  type: MediaType
  url?: string
}

export const mediaItems: MediaItem[] = [
  {
    id: 1,
    title: "夜に駆ける.mp3",
    type: "audio",
    url: "/media/test.mp3",
  },
  {
    id: 2,
    title: "Pretender.mp3",
    type: "audio",
    url: "/media/test2.mp3",
  },
  {
    id: 3,
    title: "これは非常に長いタイトルの音楽ファイルです.mp3",
    type: "audio",
    url: "/media/test3.mp3",
  },
  {
    id: 4,
    title: "Lemon.mp3",
    type: "audio",
  },
  {
    id: 5,
    title: "Subtitle.mp3",
    type: "audio",
  },
  {
    id: 6,
    title: "sample_movie_01.mp4",
    type: "video",
    url: "/media/test-video.mp4",
  },
  {
    id: 7,
    title: "vacation_2026.mp4",
    type: "video",
    url: "/media/test-video2.mp4",
  },
]

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
