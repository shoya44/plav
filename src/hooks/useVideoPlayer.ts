import { useRef, useState } from "react"

import type { MediaItem } from "../media"

type WebkitVideoElement = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void
}

export function useVideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null)

  const [currentItem, setCurrentItem] =
    useState<MediaItem | null>(null)

  const [isPlaying, setIsPlaying] =
    useState(false)

  const [currentTime, setCurrentTime] =
    useState(0)

  const [duration, setDuration] =
    useState(0)

  const playItem = async (item: MediaItem) => {
    if (item.type !== "video" || !item.url) {
      console.log("再生できる動画URLがありません:", item.title)
      return
    }

    const video = videoRef.current
    if (!video) return

    setCurrentItem(item)

    const nextUrl =
      new URL(item.url, window.location.href).href

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
  }

  const togglePlay = async () => {
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
  }

  const seekTo = (time: number) => {
    const video = videoRef.current
    if (!video) return

    video.currentTime = time
    setCurrentTime(time)
  }

  const close = () => {
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
  }

  const enterFullscreen = async () => {
    const video = videoRef.current
    if (!video) return

    if (video.requestFullscreen) {
      try {
        await video.requestFullscreen()
        return
      } catch {
        // iPhone Safariでは下のwebkitEnterFullscreenを試す。
      }
    }

    const webkitVideo = video as WebkitVideoElement
    webkitVideo.webkitEnterFullscreen?.()
  }

  return {
    videoRef,
    currentItem,
    isPlaying,
    currentTime,
    duration,

    playItem,
    togglePlay,
    seekTo,
    close,
    enterFullscreen,

    handlePlay: () => setIsPlaying(true),
    handlePause: () => setIsPlaying(false),
    handleTimeUpdate: (time: number) =>
      setCurrentTime(time),
    handleLoadedMetadata: (seconds: number) =>
      setDuration(seconds),
    handleEnded: () => setIsPlaying(false),
  }
}

export type VideoPlayerController =
  ReturnType<typeof useVideoPlayer>
