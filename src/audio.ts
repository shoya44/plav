import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"

import { getDisplayTitle, type MediaItem } from "./media"
import { getCachedMediaObjectUrl } from "./offline"

export type QueueList = "history" | "upNext"

export type QueuePosition = {
  list: QueueList
  index: number
}

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
  const cachedObjectUrlRef = useRef<string | null>(null)
  const sourceItemIdRef = useRef<string | null>(null)
  const sourceRequestIdRef = useRef(0)
  // Play/Pause操作やTrack切り替えなどPlav自身が起こすPauseかどうかを判別する。
  // これがfalseのままaudioが一時停止した場合、iOS PWAで他アプリ終了時のAudio
  // Session割り込みなど外部要因によるものとみなし、再生を継続させる。
  const intentionalPauseRef = useRef(false)

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

  const updateMediaSessionPosition = useCallback(() => {
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
  }, [])

  const startAudioItem = useCallback(async (item: MediaItem) => {
    if (item.type !== "audio" || !item.url) {
      console.log("再生できるURLがありません:", item.title)
      return
    }

    const audio = audioRef.current
    if (!audio) return

    setCurrentItem(item)

    // 同じ曲を再生中なら、Blob URLを作り直さずそのまま再生する。
    if (sourceItemIdRef.current === item.id && audio.src) {
      try {
        await audio.play()
      } catch (error) {
        console.error("音楽の再生に失敗しました:", error)
      }
      return
    }

    const requestId = sourceRequestIdRef.current + 1
    sourceRequestIdRef.current = requestId

    let cachedObjectUrl: string | null = null

    try {
      cachedObjectUrl = await getCachedMediaObjectUrl(item.id)
    } catch (error) {
      console.error("ローカル保存曲の読み込みに失敗しました:", error)
    }

    // 別の曲が先に選ばれていた場合は、この結果を捨てる。
    if (sourceRequestIdRef.current !== requestId) {
      if (cachedObjectUrl) URL.revokeObjectURL(cachedObjectUrl)
      return
    }

    if (cachedObjectUrlRef.current) {
      URL.revokeObjectURL(cachedObjectUrlRef.current)
      cachedObjectUrlRef.current = null
    }

    // srcの差し替えは再生中なら暗黙的にpauseイベントを発生させるため、
    // 外部要因によるPauseと誤認しないようここでも意図したPauseとして記録する。
    if (!audio.paused) {
      intentionalPauseRef.current = true
    }

    if (cachedObjectUrl) {
      cachedObjectUrlRef.current = cachedObjectUrl
      audio.src = cachedObjectUrl
    } else {
      audio.src = item.url
    }

    sourceItemIdRef.current = item.id
    setCurrentTime(0)
    setDuration(0)

    try {
      await audio.play()
    } catch (error) {
      console.error("音楽の再生に失敗しました:", error)
    }
  }, [])

  // Libraryから選んだ時点で、新しいPlayback sessionを開始する。
  const playItem = useCallback(async (item: MediaItem) => {
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
  }, [playableAudioItems, startAudioItem])

  const togglePlay = useCallback(async () => {
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

    intentionalPauseRef.current = true
    audio.pause()
  }, [currentItem])

  const pause = useCallback(() => {
    const audio = audioRef.current
    if (!audio || audio.paused) return

    intentionalPauseRef.current = true
    audio.pause()
  }, [])

  const normalizeSeekTime = useCallback((time: number) => {
    if (!Number.isFinite(time)) return 0

    const max = duration > 0 ? duration : Number.POSITIVE_INFINITY
    return Math.min(Math.max(time, 0), max)
  }, [duration])

  // Rangeをドラッグ中は表示だけ動かし、R2への実Seekは指を離した時に1回だけ行う。
  // iPhoneでドラッグ中に大量のRange requestを発生させないため。
  const previewSeek = useCallback((time: number) => {
    setSeekPreviewTime(normalizeSeekTime(time))
  }, [normalizeSeekTime])

  const commitSeek = useCallback((time?: number) => {
    const audio = audioRef.current
    if (!audio) return

    const target = normalizeSeekTime(
      time ?? seekPreviewTime ?? audio.currentTime,
    )

    audio.currentTime = target
    setCurrentTime(target)
    setSeekPreviewTime(null)
    updateMediaSessionPosition()
  }, [normalizeSeekTime, seekPreviewTime, updateMediaSessionPosition])

  const cancelSeek = useCallback(() => {
    setSeekPreviewTime(null)
  }, [])

  const seekTo = useCallback((time: number) => {
    commitSeek(time)
  }, [commitSeek])

  const playNext = useCallback(async () => {
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
  }, [currentItem, upNext, isRepeat, history, startAudioItem])

  // Lock ScreenのPreviousは3秒ルールを使わず、必ず前の曲へ移動する。
  const playPreviousTrack = useCallback(async () => {
    if (!currentItem) return

    const previousItem = history.at(-1)

    if (!previousItem) {
      commitSeek(0)
      return
    }

    setHistory((currentHistory) => currentHistory.slice(0, -1))
    setUpNext((currentUpNext) => [currentItem, ...currentUpNext])

    await startAudioItem(previousItem)
  }, [currentItem, history, commitSeek, startAudioItem])

  const playPrevious = useCallback(async () => {
    if (!currentItem) return

    const audio = audioRef.current
    if (!audio) return

    // アプリUIでは一般的なPlayerと同様、3秒以上なら曲頭へ戻す。
    if (audio.currentTime > 3) {
      commitSeek(0)
      return
    }

    await playPreviousTrack()
  }, [currentItem, commitSeek, playPreviousTrack])

  // 再生済みの曲をTapしたとき、その時点までPlaybackを巻き戻す。
  const playHistoryItem = useCallback(async (historyIndex: number) => {
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
  }, [currentItem, history, upNext, startAudioItem])

  // Up Nextの曲をTapすると、その曲を今すぐ再生する。
  const playUpNextItem = useCallback(async (itemId: MediaItem["id"]) => {
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
  }, [currentItem, upNext, startAudioItem])

  // HomeのShuffle AllはLibrary全体をランダム化し、先頭から再生する。
  const shuffleAll = useCallback(async () => {
    if (playableAudioItems.length === 0) return

    const shuffledItems = shuffleItems(playableAudioItems)
    const firstItem = shuffledItems[0]

    if (!firstItem) return

    setHistory([])
    setUpNext(shuffledItems.slice(1))

    await startAudioItem(firstItem)
  }, [playableAudioItems, startAudioItem])

  // Player SheetのShuffleは、再生済みと現在曲を変えずUp Nextだけ並び替える。
  const shuffleUpcoming = useCallback(() => {
    setUpNext((currentUpNext) => shuffleItems(currentUpNext))
  }, [])

  // Homeの長押しメニューから、任意のAudioを次の1曲へ設定する。
  // 現在曲も指定でき、その場合は現在曲をもう1回だけ次に再生する。
  // 既にUp Nextにある場合も一度取り除いて先頭へ移す。
  const queueItemNext = useCallback((item: MediaItem) => {
    if (
      !currentItem ||
      item.type !== "audio" ||
      !item.url
    ) {
      return
    }

    setUpNext((currentUpNext) => [
      item,
      ...currentUpNext.filter(
        (upNextItem) => upNextItem.id !== item.id
      ),
    ])
  }, [currentItem])

  // Drag reorderはUp Next内の並び替えに加え、History⇔Up Next間の
  // 移動にも対応する。moveQueueItemはhistory/upNextを直接参照するため、
  // 呼び出しのたびに必ず最新状態を読めるよう、setState群は毎回
  // flushSyncで即座に確定させる（ドラッグ中に短時間で連続呼び出しされ、
  // 複数回分がまとめてレンダリングされると、historyとupNextが別々の
  // stateであることに起因して処理順序がずれ、内容が壊れることがあった）。
  const moveQueueItem = useCallback((from: QueuePosition, to: QueuePosition) => {
    if (from.list === to.list) {
      if (from.index === to.index) return

      const setList = from.list === "history" ? setHistory : setUpNext

      flushSync(() => {
        setList((current) => {
          if (from.index < 0 || from.index >= current.length) return current

          const next = [...current]
          const [movedItem] = next.splice(from.index, 1)
          const insertAt = Math.min(Math.max(to.index, 0), next.length)

          next.splice(insertAt, 0, movedItem)
          return next
        })
      })
      return
    }

    const sourceList = from.list === "history" ? history : upNext
    const movedItem = sourceList[from.index]
    if (!movedItem) return

    const setSource = from.list === "history" ? setHistory : setUpNext
    const setDestination = to.list === "history" ? setHistory : setUpNext

    flushSync(() => {
      setSource((current) => current.filter((_, index) => index !== from.index))

      setDestination((current) => {
        const insertAt = Math.min(Math.max(to.index, 0), current.length)
        const next = [...current]
        next.splice(insertAt, 0, movedItem)
        return next
      })
    })
  }, [history, upNext])

  const handleLoadedMetadata = useCallback((seconds: number) => {
    setDuration(seconds)
    updateMediaSessionPosition()
  }, [updateMediaSessionPosition])

  const toggleRepeat = useCallback(() => {
    setIsRepeat((value) => !value)
  }, [])

  useEffect(() => {
    return () => {
      if (cachedObjectUrlRef.current) {
        URL.revokeObjectURL(cachedObjectUrlRef.current)
      }
    }
  }, [])

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
      const audio = audioRef.current
      if (!audio || audio.paused) return

      intentionalPauseRef.current = true
      audio.pause()
    })

    setHandler("previoustrack", () => {
      void playPreviousTrack()
    })

    setHandler("nexttrack", () => {
      void playNext()
    })

    setHandler("seekto", (details) => {
      if (typeof details.seekTime === "number") {
        commitSeek(details.seekTime)
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
  }, [currentItem, playPreviousTrack, playNext, commitSeek, updateMediaSessionPosition])

  const handlePlay = useCallback(() => {
    setIsPlaying(true)

    if (hasMediaSession()) {
      navigator.mediaSession.playbackState = "playing"
    }
  }, [])

  const handlePause = useCallback(() => {
    const audio = audioRef.current

    if (intentionalPauseRef.current) {
      intentionalPauseRef.current = false
    } else if (audio && !audio.ended) {
      // iOS PWAで同時起動していた別アプリの終了などによるAudio Session割り込みで
      // 発生した、Plav自身が意図していないPause。曲の自然な終了（ended）では
      // なくここに来た場合のみ、そのまま再生を継続させる。
      void audio.play().catch(() => {
        setIsPlaying(false)

        if (hasMediaSession()) {
          navigator.mediaSession.playbackState = "paused"
        }
      })
      return
    }

    setIsPlaying(false)

    if (hasMediaSession()) {
      navigator.mediaSession.playbackState = "paused"
    }
  }, [])

  const handleTimeUpdate = useCallback((time: number) => {
    // ドラッグ中はRangeのつまみをaudio timeupdateで引き戻さない。
    if (seekPreviewTime === null) {
      setCurrentTime(time)
    }
    updateMediaSessionPosition()
  }, [seekPreviewTime, updateMediaSessionPosition])

  const handleEnded = useCallback(() => {
    void playNext()
  }, [playNext])

  const displayTime = seekPreviewTime ?? currentTime

  // 戻り値オブジェクトの参照を安定させ、Player Sheet等の子コンポーネントが
  // 再生位置の更新以外で不要に再レンダリングされないようにする。
  return useMemo(
    () => ({
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
      queueItemNext,
      moveQueueItem,
      toggleRepeat,

      handlePlay,
      handlePause,
      handleTimeUpdate,
      handleLoadedMetadata,
      handleEnded,
    }),
    [
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
      queueItemNext,
      moveQueueItem,
      toggleRepeat,
      handlePlay,
      handlePause,
      handleTimeUpdate,
      handleLoadedMetadata,
      handleEnded,
    ],
  )
}

export type AudioPlayerController = ReturnType<typeof useAudioPlayer>
