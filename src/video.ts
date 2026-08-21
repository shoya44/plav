import { useRef, useState } from "react"

import type { MediaItem } from "./media"

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

  const [volume, setVolume] =
    useState(1)

  const [isMuted, setIsMuted] =
    useState(false)

  const [
    canAdjustVolume,
    setCanAdjustVolume,
  ] = useState(false)

  const playItem = async (
    item: MediaItem
  ) => {
    if (
      item.type !== "video" ||
      !item.url
    ) {
      console.log(
        "再生できる動画URLがありません:",
        item.title
      )
      return
    }

    const video =
      videoRef.current

    if (!video) return

    setCurrentItem(item)

    const nextUrl =
      new URL(
        item.url,
        window.location.href
      ).href

    if (
      video.src !== nextUrl
    ) {
      video.src = item.url
      setCurrentTime(0)
      setDuration(0)
    }

    try {
      await video.play()
    } catch (error) {
      console.error(
        "動画の再生に失敗しました:",
        error
      )
    }
  }

  const togglePlay = async () => {
    const video =
      videoRef.current

    if (
      !video ||
      !currentItem
    ) {
      return
    }

    if (video.paused) {
      try {
        await video.play()
      } catch (error) {
        console.error(
          "動画の再生に失敗しました:",
          error
        )
      }

      return
    }

    video.pause()
  }

  const seekTo = (
    time: number
  ) => {
    const video =
      videoRef.current

    if (!video) return

    video.currentTime = time
    setCurrentTime(time)
  }

  const skipBy = (
    seconds: number
  ) => {
    const video =
      videoRef.current

    if (!video) return

    const maxTime =
      Number.isFinite(
        video.duration
      )
        ? video.duration
        : Number.POSITIVE_INFINITY

    const nextTime =
      Math.min(
        Math.max(
          video.currentTime +
            seconds,
          0
        ),
        maxTime
      )

    video.currentTime =
      nextTime

    setCurrentTime(
      nextTime
    )
  }

  /*
    iPhone SafariではWeb側から音量を細かく変更できない場合がある。
    実際にvolumeを書き換えて反映されるかを確認し、
    対応ブラウザだけSliderを表示する。
  */
  const detectVolumeSupport = () => {
    const video =
      videoRef.current

    if (!video) return

    const originalVolume =
      video.volume

    const testVolume =
      originalVolume === 0.5
        ? 0.35
        : 0.5

    try {
      video.volume =
        testVolume

      const supported =
        Math.abs(
          video.volume -
            testVolume
        ) < 0.01

      video.volume =
        originalVolume

      setCanAdjustVolume(
        supported
      )
    } catch {
      setCanAdjustVolume(
        false
      )
    }
  }

  const setVolumeLevel = (
    nextVolume: number
  ) => {
    const video =
      videoRef.current

    if (!video) return

    const normalized =
      Math.min(
        Math.max(
          nextVolume,
          0
        ),
        1
      )

    try {
      video.volume =
        normalized

      setVolume(
        video.volume
      )

      if (
        normalized > 0 &&
        video.muted
      ) {
        video.muted = false
        setIsMuted(false)
      }
    } catch {
      setCanAdjustVolume(
        false
      )
    }
  }

  const toggleMute = () => {
    const video =
      videoRef.current

    if (!video) return

    video.muted =
      !video.muted

    setIsMuted(
      video.muted
    )
  }

  const close = () => {
    const video =
      videoRef.current

    if (video) {
      video.pause()

      video.removeAttribute(
        "src"
      )

      video.load()
    }

    setCurrentItem(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }

  const enterFullscreen =
    async () => {
      const video =
        videoRef.current

      if (!video) return

      if (
        video.requestFullscreen
      ) {
        try {
          await video
            .requestFullscreen()

          return
        } catch {
          // iPhone Safariでは
          // webkitEnterFullscreenを試す。
        }
      }

      const webkitVideo =
        video as WebkitVideoElement

      webkitVideo
        .webkitEnterFullscreen?.()
    }

  const handleLoadedMetadata = (
    seconds: number
  ) => {
    setDuration(seconds)

    const video =
      videoRef.current

    if (video) {
      setVolume(
        video.volume
      )

      setIsMuted(
        video.muted
      )
    }

    detectVolumeSupport()
  }

  const handleVolumeChange =
    () => {
      const video =
        videoRef.current

      if (!video) return

      setVolume(
        video.volume
      )

      setIsMuted(
        video.muted
      )
    }

  return {
    videoRef,

    currentItem,
    isPlaying,
    currentTime,
    duration,

    volume,
    isMuted,
    canAdjustVolume,

    playItem,
    togglePlay,
    seekTo,
    skipBy,

    setVolumeLevel,
    toggleMute,

    close,
    enterFullscreen,

    handlePlay: () =>
      setIsPlaying(true),

    handlePause: () =>
      setIsPlaying(false),

    handleTimeUpdate: (
      time: number
    ) =>
      setCurrentTime(time),

    handleLoadedMetadata,
    handleVolumeChange,

    handleEnded: () =>
      setIsPlaying(false),
  }
}

export type VideoPlayerController =
  ReturnType<
    typeof useVideoPlayer
  >
