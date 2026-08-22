import { useCallback, useMemo, useRef, useState } from "react"

import type { MediaItem } from "./media"

type WebkitVideoElement = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void
}

export function useVideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null)

  const [currentItem, setCurrentItem] = useState<MediaItem | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const playItem = useCallback(async (item: MediaItem) => {
    if (item.type !== "video" || !item.url) {
      console.log("再生できる動画URLがありません:", item.title)
      return
    }

    const video = videoRef.current
    if (!video) return

    setCurrentItem(item)

    const nextUrl = new URL(item.url, window.location.href).href

    if (video.src !== nextUrl) {
      video.src = item.url
      setCurrentTime(0)
      setDuration(0)
    }

    try {
      await video.play()
    } catch (error) {
      console.error("動画の再生に失敗しました:", error)
    }
  }, [])

  const togglePlay = useCallback(async () => {
    const video = videoRef.current
    if (!video || !currentItem) return

    if (video.paused) {
      try {
        await video.play()
      } catch (error) {
        console.error("動画の再生に失敗しました:", error)
      }
      return
    }

    video.pause()
  }, [currentItem])

  const seekTo = useCallback((time: number) => {
    const video = videoRef.current
    if (!video) return

    video.currentTime = time
    setCurrentTime(time)
  }, [])

  const skipBy = useCallback((seconds: number) => {
    const video = videoRef.current
    if (!video) return

    const maxTime = Number.isFinite(video.duration)
      ? video.duration
      : Number.POSITIVE_INFINITY

    const nextTime = Math.min(
      Math.max(video.currentTime + seconds, 0),
      maxTime,
    )

    video.currentTime = nextTime
    setCurrentTime(nextTime)
  }, [])

  const close = useCallback(() => {
    const video = videoRef.current

    if (video) {
      video.pause()
      video.removeAttribute("src")
      video.load()
    }

    setCurrentItem(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [])

  const enterFullscreen = useCallback(async () => {
    const video = videoRef.current
    if (!video) return

    if (video.requestFullscreen) {
      try {
        await video.requestFullscreen()
        return
      } catch {
        // iPhone SafariではwebkitEnterFullscreenを試す。
      }
    }

    const webkitVideo = video as WebkitVideoElement
    webkitVideo.webkitEnterFullscreen?.()
  }, [])

  const handleLoadedMetadata = useCallback((seconds: number) => {
    setDuration(seconds)
  }, [])

  const handlePlay = useCallback(() => {
    setIsPlaying(true)
  }, [])

  const handlePause = useCallback(() => {
    setIsPlaying(false)
  }, [])

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time)
  }, [])

  const handleEnded = useCallback(() => {
    setIsPlaying(false)
  }, [])

  // 戻り値オブジェクトの参照を安定させ、再生位置以外を利用する
  // 呼び出し側が不要に再レンダリングされないようにする。
  return useMemo(
    () => ({
      videoRef,

      currentItem,
      isPlaying,
      currentTime,
      duration,

      playItem,
      togglePlay,
      seekTo,
      skipBy,

      close,
      enterFullscreen,

      handlePlay,
      handlePause,
      handleTimeUpdate,
      handleLoadedMetadata,
      handleEnded,
    }),
    [
      currentItem,
      isPlaying,
      currentTime,
      duration,
      playItem,
      togglePlay,
      seekTo,
      skipBy,
      close,
      enterFullscreen,
      handlePlay,
      handlePause,
      handleTimeUpdate,
      handleLoadedMetadata,
      handleEnded,
    ],
  )
}

export type VideoPlayerController = ReturnType<typeof useVideoPlayer>
