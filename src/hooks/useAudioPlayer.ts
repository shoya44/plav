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
        (item) =>
          item.type === "audio" &&
          Boolean(item.url)
      ),
    [items]
  )

  /*
    queue が「実際の再生順」です。
    Library の並び順とは別に持つことで、
    Shuffle / Play Next / Drag reorder を
    すべて queue の編集として扱います。
  */
  const [queue, setQueue] =
    useState<MediaItem[]>(playableAudioItems)

  const [currentIndex, setCurrentIndex] =
    useState(-1)

  const [isPlaying, setIsPlaying] =
    useState(false)

  const [currentTime, setCurrentTime] =
    useState(0)

  const [duration, setDuration] =
    useState(0)

  const [isRepeat, setIsRepeat] =
    useState(false)

  const currentItem =
    currentIndex >= 0
      ? queue[currentIndex] ?? null
      : null

  const startAudioItem = async (
    item: MediaItem,
    nextIndex: number
  ) => {
    if (item.type !== "audio" || !item.url) {
      console.log(
        "再生できるURLがありません:",
        item.title
      )
      return
    }

    const audio = audioRef.current
    if (!audio) return

    setCurrentIndex(nextIndex)

    const nextUrl =
      new URL(
        item.url,
        window.location.href
      ).href

    if (audio.src !== nextUrl) {
      audio.src = item.url
      setCurrentTime(0)
      setDuration(0)
    }

    try {
      await audio.play()
    } catch (error) {
      console.error(
        "音楽の再生に失敗しました:",
        error
      )
    }
  }

  // Home の Library から再生するときは Library 順で Queue を作り直す。
  const playItem = async (item: MediaItem) => {
    const nextQueue = [...playableAudioItems]

    const nextIndex =
      nextQueue.findIndex(
        (queueItem) =>
          queueItem.id === item.id
      )

    if (nextIndex === -1) {
      console.log(
        "再生Queueに存在しない曲です:",
        item.title
      )
      return
    }

    setQueue(nextQueue)

    await startAudioItem(
      nextQueue[nextIndex],
      nextIndex
    )
  }

  const playQueueIndex = async (
    nextIndex: number
  ) => {
    const nextItem =
      queue[nextIndex]

    if (!nextItem) return

    await startAudioItem(
      nextItem,
      nextIndex
    )
  }

  const togglePlay = async () => {
    const audio = audioRef.current
    if (!audio || !currentItem) return

    if (audio.paused) {
      try {
        await audio.play()
      } catch (error) {
        console.error(
          "音楽の再生に失敗しました:",
          error
        )
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

    const nextIndex =
      currentIndex + 1

    if (queue[nextIndex]) {
      await playQueueIndex(nextIndex)
      return
    }

    if (
      isRepeat &&
      queue.length > 0
    ) {
      await playQueueIndex(0)
      return
    }

    setIsPlaying(false)
  }

  const playPrevious = async () => {
    if (!currentItem) return

    const audio = audioRef.current
    if (!audio) return

    if (audio.currentTime > 3) {
      seekTo(0)
      return
    }

    const previousIndex =
      currentIndex - 1

    if (queue[previousIndex]) {
      await playQueueIndex(
        previousIndex
      )
      return
    }

    seekTo(0)
  }

  // Home の Shuffle All: Queue 全体をランダム化して先頭から再生。
  const shuffleAll = async () => {
    if (
      playableAudioItems.length === 0
    ) {
      return
    }

    const nextQueue =
      shuffleItems(playableAudioItems)

    setQueue(nextQueue)

    await startAudioItem(
      nextQueue[0],
      0
    )
  }

  // Expanded Player の Shuffle: 現在曲までは固定し Up Next だけ並び替える。
  const shuffleUpcoming = () => {
    if (
      currentIndex < 0 ||
      currentIndex >= queue.length - 1
    ) {
      return
    }

    setQueue((currentQueue) => {
      const fixed =
        currentQueue.slice(
          0,
          currentIndex + 1
        )

      const upcoming =
        currentQueue.slice(
          currentIndex + 1
        )

      return [
        ...fixed,
        ...shuffleItems(upcoming),
      ]
    })
  }

  // 選んだ曲を現在曲の直後へ移動する。
  const moveItemToNext = (
    itemId: MediaItem["id"]
  ) => {
    if (currentIndex < 0) return

    setQueue((currentQueue) => {
      const fromIndex =
        currentQueue.findIndex(
          (item) =>
            item.id === itemId
        )

      if (
        fromIndex <= currentIndex
      ) {
        return currentQueue
      }

      const targetIndex =
        currentIndex + 1

      if (
        fromIndex === targetIndex
      ) {
        return currentQueue
      }

      const nextQueue =
        [...currentQueue]

      const [movedItem] =
        nextQueue.splice(
          fromIndex,
          1
        )

      nextQueue.splice(
        targetIndex,
        0,
        movedItem
      )

      return nextQueue
    })
  }

  // Drag reorder。現在曲より下（Up Next）だけを移動可能にする。
  const moveQueueItem = (
    fromIndex: number,
    toIndex: number
  ) => {
    if (
      fromIndex <= currentIndex ||
      toIndex <= currentIndex ||
      fromIndex === toIndex
    ) {
      return
    }

    setQueue((currentQueue) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= currentQueue.length ||
        toIndex >= currentQueue.length
      ) {
        return currentQueue
      }

      const nextQueue =
        [...currentQueue]

      const [movedItem] =
        nextQueue.splice(
          fromIndex,
          1
        )

      nextQueue.splice(
        toIndex,
        0,
        movedItem
      )

      return nextQueue
    })
  }

  const toggleRepeat = () =>
    setIsRepeat(
      (value) => !value
    )

  return {
    audioRef,

    queue,
    currentIndex,
    currentItem,
    isPlaying,
    currentTime,
    duration,
    isRepeat,

    playItem,
    playQueueIndex,
    togglePlay,
    pause,
    seekTo,
    playNext,
    playPrevious,
    shuffleAll,
    shuffleUpcoming,
    moveItemToNext,
    moveQueueItem,
    toggleRepeat,

    handlePlay: () =>
      setIsPlaying(true),

    handlePause: () =>
      setIsPlaying(false),

    handleTimeUpdate: (
      time: number
    ) =>
      setCurrentTime(time),

    handleLoadedMetadata: (
      seconds: number
    ) =>
      setDuration(seconds),

    handleEnded: () =>
      void playNext(),
  }
}

export type AudioPlayerController =
  ReturnType<typeof useAudioPlayer>
