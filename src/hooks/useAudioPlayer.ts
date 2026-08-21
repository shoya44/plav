import { useMemo, useRef, useState } from "react"

import type { MediaItem } from "../media"

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

export function useAudioPlayer(items: MediaItem[]) {
  const audioRef = useRef<HTMLAudioElement>(null)

  const playableAudioItems = useMemo(
    () =>
      items.filter(
        (item) => item.type === "audio" && Boolean(item.url)
      ),
    [items]
  )

  /*
    Playback は3つだけで管理する。

    history     = 実際に再生した曲
    currentItem = 現在の曲
    upNext      = これから再生する曲

    Library の並び順とは分離しているため、
    Shuffle / Play next / Drag reorder が分かりやすい。
  */
  const [history, setHistory] = useState<MediaItem[]>([])
  const [currentItem, setCurrentItem] = useState<MediaItem | null>(null)
  const [upNext, setUpNext] = useState<MediaItem[]>([])

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isRepeat, setIsRepeat] = useState(false)

  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [canAdjustVolume, setCanAdjustVolume] = useState(false)

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

  /*
    HistoryはPlayback Session内だけ保持する。
    - アプリを閉じる / Reloadする -> React stateなので自動的に初期化
    - HomeのLibraryから曲をTap -> ここで明示的に初期化
  */
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

  const seekTo = (time: number) => {
    const audio = audioRef.current
    if (!audio) return

    audio.currentTime = time
    setCurrentTime(time)
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

  const playPrevious = async () => {
    if (!currentItem) return

    const audio = audioRef.current
    if (!audio) return

    // 一般的なPlayerと同様、3秒以上進んでいたら曲頭へ戻す。
    if (audio.currentTime > 3) {
      seekTo(0)
      return
    }

    const previousItem = history.at(-1)

    if (!previousItem) {
      seekTo(0)
      return
    }

    setHistory((currentHistory) => currentHistory.slice(0, -1))
    setUpNext((currentUpNext) => [currentItem, ...currentUpNext])

    await startAudioItem(previousItem)
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

  const detectVolumeSupport = () => {
    const audio = audioRef.current
    if (!audio) return

    const originalVolume = audio.volume
    const testVolume = originalVolume === 0.5 ? 0.35 : 0.5

    try {
      audio.volume = testVolume

      const supported =
        Math.abs(audio.volume - testVolume) < 0.01

      audio.volume = originalVolume
      setCanAdjustVolume(supported)
    } catch {
      setCanAdjustVolume(false)
    }
  }

  const setVolumeLevel = (nextVolume: number) => {
    const audio = audioRef.current
    if (!audio) return

    const normalized = Math.min(
      Math.max(nextVolume, 0),
      1
    )

    try {
      audio.volume = normalized
      setVolume(audio.volume)

      if (normalized > 0 && audio.muted) {
        audio.muted = false
        setIsMuted(false)
      }
    } catch {
      setCanAdjustVolume(false)
    }
  }

  const toggleMute = () => {
    const audio = audioRef.current
    if (!audio) return

    audio.muted = !audio.muted
    setIsMuted(audio.muted)
  }

  const handleLoadedMetadata = (seconds: number) => {
    setDuration(seconds)

    const audio = audioRef.current

    if (audio) {
      setVolume(audio.volume)
      setIsMuted(audio.muted)
    }

    detectVolumeSupport()
  }

  const handleVolumeChange = () => {
    const audio = audioRef.current
    if (!audio) return

    setVolume(audio.volume)
    setIsMuted(audio.muted)
  }

  const toggleRepeat = () => {
    setIsRepeat((value) => !value)
  }

  return {
    audioRef,

    history,
    currentItem,
    upNext,
    isPlaying,
    currentTime,
    duration,
    isRepeat,

    volume,
    isMuted,
    canAdjustVolume,

    playItem,
    togglePlay,
    pause,
    seekTo,
    playNext,
    playPrevious,
    playHistoryItem,
    playUpNextItem,
    shuffleAll,
    shuffleUpcoming,
    moveItemToNext,
    moveUpNextItem,
    toggleRepeat,

    setVolumeLevel,
    toggleMute,

    handlePlay: () => setIsPlaying(true),
    handlePause: () => setIsPlaying(false),
    handleTimeUpdate: (time: number) => setCurrentTime(time),
    handleLoadedMetadata,
    handleVolumeChange,
    handleEnded: () => void playNext(),
  }
}

export type AudioPlayerController = ReturnType<typeof useAudioPlayer>
