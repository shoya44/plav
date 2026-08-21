import { useEffect, useMemo, useRef, useState } from "react"

import { getDisplayTitle, type MediaItem } from "./media"

function shuffleItems(items: MediaItem[]) {
  const shuffled = [...items]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))

    ;[shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ]
  }

  return shuffled
}

function hasMediaSession() {
  return (
    typeof navigator !== "undefined" &&
    "mediaSession" in navigator
  )
}


export function useAudioPlayer(items: MediaItem[]) {
  const audioRef = useRef<HTMLAudioElement>(null)

  const playableAudioItems = useMemo(
    () =>
      items.filter(
        (item) => item.type === "audio" && Boolean(item.url)
      ),
    [items]
  )

  // Playback session = history / current / upNext.
  const [history, setHistory] = useState<MediaItem[]>([])
  const [currentItem, setCurrentItem] = useState<MediaItem | null>(null)
  const [upNext, setUpNext] = useState<MediaItem[]>([])

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [seekPreviewTime, setSeekPreviewTime] = useState<number | null>(null)
  const [duration, setDuration] = useState(0)
  const [isRepeat, setIsRepeat] = useState(false)

  const updateMediaSessionPosition = () => {
    if (!hasMediaSession()) return

    const audio = audioRef.current
    if (!audio) return

    if (
      typeof navigator.mediaSession.setPositionState !== "function" ||
      !Number.isFinite(audio.duration) ||
      audio.duration <= 0
    ) {
      return
    }

    const position = Math.min(
      Math.max(audio.currentTime, 0),
      audio.duration,
    )

    try {
      navigator.mediaSession.setPositionState({
        duration: audio.duration,
        playbackRate: audio.playbackRate || 1,
        position,
      })
    } catch {
      // Safari等で一時的にposition stateを受け付けない場合は無視する。
    }
  }

  const startAudioItem = async (item: MediaItem) => {
    if (item.type !== "audio" || !item.url) {
      console.log("再生できるURLがありません:", item.title)
      return
    }

    const audio = audioRef.current
    if (!audio) return

    setCurrentItem(item)

    const nextUrl = new URL(item.url, window.location.href).href

    if (audio.src !== nextUrl) {
      audio.src = item.url
      setCurrentTime(0)
      setDuration(0)
    }

    try {
      await audio.play()
    } catch (error) {
      console.error("音楽の再生に失敗しました:", error)
    }
  }

  // Libraryから選んだ時点で、新しいPlayback sessionを開始する。
  const playItem = async (item: MediaItem) => {
    const startIndex = playableAudioItems.findIndex(
      (audioItem) => audioItem.id === item.id
    )

    if (startIndex === -1) {
      console.log("再生可能なLibraryに存在しない曲です:", item.title)
      return
    }

    setHistory([])
    setUpNext(playableAudioItems.slice(startIndex + 1))

    await startAudioItem(playableAudioItems[startIndex])
  }

  const togglePlay = async () => {
    const audio = audioRef.current
    if (!audio || !currentItem) return

    if (audio.paused) {
      try {
        await audio.play()
      } catch (error) {
        console.error("音楽の再生に失敗しました:", error)
      }
      return
    }

    audio.pause()
  }

  const pause = () => {
    audioRef.current?.pause()
  }

  const normalizeSeekTime = (time: number) => {
    if (!Number.isFinite(time)) return 0

    const max = duration > 0 ? duration : Number.POSITIVE_INFINITY
    return Math.min(Math.max(time, 0), max)
  }

  // Rangeをドラッグ中は表示だけ動かし、R2への実Seekは指を離した時に1回だけ行う。
  // iPhoneでドラッグ中に大量のRange requestを発生させないため。
  const previewSeek = (time: number) => {
    setSeekPreviewTime(normalizeSeekTime(time))
  }

  const commitSeek = (time?: number) => {
    const audio = audioRef.current
    if (!audio) return

    const target = normalizeSeekTime(
      time ?? seekPreviewTime ?? audio.currentTime,
    )

    audio.currentTime = target
    setCurrentTime(target)
    setSeekPreviewTime(null)
    updateMediaSessionPosition()
  }

  const cancelSeek = () => {
    setSeekPreviewTime(null)
  }

  const seekTo = (time: number) => {
    commitSeek(time)
  }

  const playNext = async () => {
    if (!currentItem) return

    const nextItem = upNext[0]

    if (nextItem) {
      setHistory((currentHistory) => [
        ...currentHistory,
        currentItem,
      ])
      setUpNext((currentUpNext) => currentUpNext.slice(1))

      await startAudioItem(nextItem)
      return
    }

    // Repeatは現在のPlayback Sessionを同じ順番でもう一度再生する。
    if (isRepeat) {
      const sessionItems = [...history, currentItem]
      const firstItem = sessionItems[0]

      if (firstItem) {
        setHistory([])
        setUpNext(sessionItems.slice(1))
        await startAudioItem(firstItem)
      }
      return
    }

    setIsPlaying(false)
  }

  // Lock ScreenのPreviousは3秒ルールを使わず、必ず前の曲へ移動する。
  const playPreviousTrack = async () => {
    if (!currentItem) return

    const previousItem = history.at(-1)

    if (!previousItem) {
      seekTo(0)
      return
    }

    setHistory((currentHistory) => currentHistory.slice(0, -1))
    setUpNext((currentUpNext) => [currentItem, ...currentUpNext])

    await startAudioItem(previousItem)
  }

  const playPrevious = async () => {
    if (!currentItem) return

    const audio = audioRef.current
    if (!audio) return

    // アプリUIでは一般的なPlayerと同様、3秒以上なら曲頭へ戻す。
    if (audio.currentTime > 3) {
      seekTo(0)
      return
    }

    await playPreviousTrack()
  }

  // 再生済みの曲をTapしたとき、その時点までPlaybackを巻き戻す。
  const playHistoryItem = async (historyIndex: number) => {
    if (!currentItem) return

    const targetItem = history[historyIndex]
    if (!targetItem) return

    const itemsAfterTarget = history.slice(historyIndex + 1)

    setHistory(history.slice(0, historyIndex))
    setUpNext([
      ...itemsAfterTarget,
      currentItem,
      ...upNext,
    ])

    await startAudioItem(targetItem)
  }

  // Up Nextの曲をTapすると、その曲を今すぐ再生する。
  const playUpNextItem = async (itemId: MediaItem["id"]) => {
    if (!currentItem) return

    const targetIndex = upNext.findIndex((item) => item.id === itemId)
    const targetItem = upNext[targetIndex]

    if (!targetItem) return

    setHistory((currentHistory) => [
      ...currentHistory,
      currentItem,
    ])

    setUpNext([
      ...upNext.slice(0, targetIndex),
      ...upNext.slice(targetIndex + 1),
    ])

    await startAudioItem(targetItem)
  }

  // HomeのShuffle AllはLibrary全体をランダム化し、先頭から再生する。
  const shuffleAll = async () => {
    if (playableAudioItems.length === 0) return

    const shuffledItems = shuffleItems(playableAudioItems)
    const firstItem = shuffledItems[0]

    if (!firstItem) return

    setHistory([])
    setUpNext(shuffledItems.slice(1))

    await startAudioItem(firstItem)
  }

  // Player SheetのShuffleは、再生済みと現在曲を変えずUp Nextだけ並び替える。
  const shuffleUpcoming = () => {
    setUpNext((currentUpNext) => shuffleItems(currentUpNext))
  }

  const moveItemToNext = (itemId: MediaItem["id"]) => {
    setUpNext((currentUpNext) => {
      const fromIndex = currentUpNext.findIndex(
        (item) => item.id === itemId
      )

      if (fromIndex <= 0) return currentUpNext

      const nextUpNext = [...currentUpNext]
      const [movedItem] = nextUpNext.splice(fromIndex, 1)

      nextUpNext.unshift(movedItem)
      return nextUpNext
    })
  }

  // Drag reorderはUp Next内だけで完結する。
  const moveUpNextItem = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return

    setUpNext((currentUpNext) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= currentUpNext.length ||
        toIndex >= currentUpNext.length
      ) {
        return currentUpNext
      }

      const nextUpNext = [...currentUpNext]
      const [movedItem] = nextUpNext.splice(fromIndex, 1)

      nextUpNext.splice(toIndex, 0, movedItem)
      return nextUpNext
    })
  }

  const handleLoadedMetadata = (seconds: number) => {
    setDuration(seconds)
    updateMediaSessionPosition()
  }

  const toggleRepeat = () => {
    setIsRepeat((value) => !value)
  }

  // iOS Safari / PWA のLock Screen / Control Center。
  useEffect(() => {
    if (!currentItem || !hasMediaSession()) {
      return
    }

    const title = getDisplayTitle(currentItem.title)

    document.title = title

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: "Plav",
        artwork: [
          {
            src: "/icons/plav-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/plav-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      })
    } catch {
      // MediaMetadata非対応環境ではページタイトルだけ利用する。
    }

    const setHandler = (
      action: MediaSessionAction,
      handler: MediaSessionActionHandler | null,
    ) => {
      try {
        navigator.mediaSession.setActionHandler(
          action,
          handler,
        )
      } catch {
        // Safariのバージョン差で未対応Actionの場合は無視する。
      }
    }

    setHandler("play", () => {
      void audioRef.current?.play()
    })

    setHandler("pause", () => {
      audioRef.current?.pause()
    })

    setHandler("previoustrack", () => {
      void playPreviousTrack()
    })

    setHandler("nexttrack", () => {
      void playNext()
    })

    setHandler("seekto", (details) => {
      if (typeof details.seekTime === "number") {
        seekTo(details.seekTime)
      }
    })

    // ±10秒SkipのActionは明示的に解除する。
    setHandler("seekbackward", null)
    setHandler("seekforward", null)

    updateMediaSessionPosition()

    return () => {
      setHandler("play", null)
      setHandler("pause", null)
      setHandler("previoustrack", null)
      setHandler("nexttrack", null)
      setHandler("seekto", null)
    }
  }, [currentItem, history, upNext, isRepeat])

  const handlePlay = () => {
    setIsPlaying(true)

    if (hasMediaSession()) {
      navigator.mediaSession.playbackState = "playing"
    }
  }

  const handlePause = () => {
    setIsPlaying(false)

    if (hasMediaSession()) {
      navigator.mediaSession.playbackState = "paused"
    }
  }

  const handleTimeUpdate = (time: number) => {
    // ドラッグ中はRangeのつまみをaudio timeupdateで引き戻さない。
    if (seekPreviewTime === null) {
      setCurrentTime(time)
    }
    updateMediaSessionPosition()
  }

  const displayTime = seekPreviewTime ?? currentTime

  return {
    audioRef,

    history,
    currentItem,
    upNext,
    isPlaying,
    currentTime,
    displayTime,
    duration,
    isRepeat,

    playItem,
    togglePlay,
    pause,
    seekTo,
    previewSeek,
    commitSeek,
    cancelSeek,
    playNext,
    playPrevious,
    playPreviousTrack,
    playHistoryItem,
    playUpNextItem,
    shuffleAll,
    shuffleUpcoming,
    moveItemToNext,
    moveUpNextItem,
    toggleRepeat,

    handlePlay,
    handlePause,
    handleTimeUpdate,
    handleLoadedMetadata,
    handleEnded: () => void playNext(),
  }
}

export type AudioPlayerController = ReturnType<typeof useAudioPlayer>
