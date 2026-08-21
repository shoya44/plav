import { useLayoutEffect, useRef, useState } from "react"
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react"
import {
  Pause,
  Play,
  Repeat2,
  Shuffle,
  SkipBack,
  SkipForward,
} from "lucide-react"

import type { AudioPlayerController } from "../audio"
import { formatTime, getDisplayTitle } from "../media"
import { PlaybackQueue } from "./PlaybackQueue"

type Props = {
  player: AudioPlayerController
  onClose: () => void
}

type SheetSnap = "half" | "expanded"

type SnapHeights = {
  half: number
  expanded: number
}

export function PlayerSheet({ player, onClose }: Props) {
  const sheetRef = useRef<HTMLElement | null>(null)
  const backdropRef = useRef<HTMLDivElement | null>(null)
  const snapHeightsRef = useRef<SnapHeights>({ half: 320, expanded: 620 })
  const currentHeightRef = useRef(320)

  const activePointerIdRef = useRef<number | null>(null)
  const dragStartXRef = useRef(0)
  const dragStartYRef = useRef(0)
  const dragStartHeightRef = useRef(0)
  const dragStartTimeRef = useRef(0)
  const dragStartedRef = useRef(false)
  const dragOriginQueueRef = useRef<HTMLElement | null>(null)
  const suppressClickRef = useRef(false)
  const closingRef = useRef(false)
  const startSnapRef = useRef<SheetSnap>("half")

  const [snap, setSnap] = useState<SheetSnap>("half")
  const [isDragging, setIsDragging] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  const {
    currentItem,
    displayTime,
    duration,
    isPlaying,
    isRepeat,
  } = player

  const measureSnapHeights = (): SnapHeights => {
    const viewportHeight =
      window.visualViewport?.height ?? window.innerHeight

    // Navigation + safe-area分を残しつつ、Expandedは画面上端近くまで使う。
    const expanded = Math.max(360, viewportHeight - 96)
    const half = Math.min(
      Math.max(300, viewportHeight * 0.5),
      Math.max(240, expanded - 72),
    )

    return { half, expanded }
  }

  const setVisualHeight = (height: number) => {
    currentHeightRef.current = height
    sheetRef.current?.style.setProperty(
      "--player-sheet-height",
      `${height}px`,
    )

    const { half, expanded } = snapHeightsRef.current
    const span = Math.max(expanded - half, 1)
    const ratio = Math.min(Math.max((height - half) / span, 0), 1)

    if (backdropRef.current) {
      backdropRef.current.style.opacity = String(0.58 + ratio * 0.16)
    }
  }

  const snapTo = (nextSnap: SheetSnap) => {
    setSnap(nextSnap)
    setVisualHeight(snapHeightsRef.current[nextSnap])
  }

  useLayoutEffect(() => {
    if (!currentItem) return

    const syncSize = () => {
      if (closingRef.current || dragStartedRef.current) return

      snapHeightsRef.current = measureSnapHeights()
      setVisualHeight(snapHeightsRef.current[snap])
    }

    syncSize()
    window.addEventListener("resize", syncSize)
    window.visualViewport?.addEventListener("resize", syncSize)

    return () => {
      window.removeEventListener("resize", syncSize)
      window.visualViewport?.removeEventListener("resize", syncSize)
    }
  }, [currentItem?.id, snap])

  if (!currentItem) return null

  const progress =
    duration > 0 ? (displayTime / duration) * 100 : 0

  const closeWithAnimation = () => {
    if (closingRef.current) return

    closingRef.current = true
    setIsDragging(false)
    setIsClosing(true)

    const reduceMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false

    window.setTimeout(onClose, reduceMotion ? 0 : 180)
  }

  const resetPointerTracking = () => {
    activePointerIdRef.current = null
    dragStartedRef.current = false
    dragOriginQueueRef.current = null
    setIsDragging(false)
  }

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (
      closingRef.current ||
      activePointerIdRef.current !== null ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return
    }

    const target =
      event.target instanceof Element ? event.target : null

    // Seek / VolumeはSheet gestureから完全に除外する。
    if (target?.closest('input[type="range"]')) return

    activePointerIdRef.current = event.pointerId
    dragStartXRef.current = event.clientX
    dragStartYRef.current = event.clientY
    dragStartHeightRef.current = currentHeightRef.current
    dragStartTimeRef.current = performance.now()
    dragStartedRef.current = false
    startSnapRef.current = snap
    dragOriginQueueRef.current =
      (target?.closest(".player-sheet-queue-scroll") as HTMLElement | null) ?? null
  }

  const handlePointerMove = (
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (activePointerIdRef.current !== event.pointerId) return

    const deltaX = event.clientX - dragStartXRef.current
    const deltaY = event.clientY - dragStartYRef.current

    if (!dragStartedRef.current) {
      const vertical = Math.abs(deltaY)
      const horizontal = Math.abs(deltaX)

      if (vertical < 6) return

      if (horizontal > vertical * 0.95) {
        resetPointerTracking()
        return
      }

      const queue = dragOriginQueueRef.current

      if (queue && startSnapRef.current === "expanded") {
        if (deltaY < 0 || queue.scrollTop > 0) {
          resetPointerTracking()
          return
        }
      }

      dragStartedRef.current = true
      suppressClickRef.current = true
      setIsDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    }

    if (event.cancelable) event.preventDefault()

    // Half状態では「上へ少しスワイプ」で即Expandedへ。
    // 指を離すまで待たないので、iPhoneでも1回の操作で確実に拡大する。
    if (startSnapRef.current === "half" && deltaY <= -24) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      resetPointerTracking()
      snapTo("expanded")

      window.setTimeout(() => {
        suppressClickRef.current = false
      }, 0)
      return
    }

    const heights = snapHeightsRef.current
    const nextHeight = dragStartHeightRef.current - deltaY
    const minimum = Math.min(220, heights.half * 0.65)

    // React stateを毎frame更新せず、DOMのCSS変数だけ変更する。
    // Queue全体の再renderを避けるため、iPhoneでのdragが軽くなる。
    setVisualHeight(
      Math.min(Math.max(nextHeight, minimum), heights.expanded),
    )
  }

  const finishPointerDrag = (
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (activePointerIdRef.current !== event.pointerId) return

    if (!dragStartedRef.current) {
      resetPointerTracking()
      return
    }

    const deltaY = event.clientY - dragStartYRef.current
    const elapsed = Math.max(performance.now() - dragStartTimeRef.current, 1)
    const velocityY = deltaY / elapsed

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const startSnap = startSnapRef.current
    resetPointerTracking()

    if (startSnap === "half") {
      const shouldExpand =
        deltaY <= -46 ||
        (deltaY <= -16 && velocityY <= -0.34)

      const shouldClose =
        deltaY >= 78 ||
        (deltaY >= 24 && velocityY >= 0.5)

      if (shouldExpand) snapTo("expanded")
      else if (shouldClose) closeWithAnimation()
      else snapTo("half")
    } else {
      const shouldCollapse =
        deltaY >= 58 ||
        (deltaY >= 18 && velocityY >= 0.4)

      snapTo(shouldCollapse ? "half" : "expanded")
    }

    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 0)
  }

  const cancelPointerDrag = (
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (activePointerIdRef.current !== event.pointerId) return

    const startSnap = startSnapRef.current
    resetPointerTracking()
    snapTo(startSnap)
    suppressClickRef.current = false
  }

  const handleClickCapture = (
    event: ReactMouseEvent<HTMLElement>,
  ) => {
    if (!suppressClickRef.current) return

    suppressClickRef.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  const commitSeek = (value: string) => {
    player.commitSeek(Number(value))
  }

  return (
    <>
      <div
        ref={backdropRef}
        className={`sheet-backdrop player-backdrop${
          isDragging ? " is-dragging" : ""
        }${isClosing ? " is-closing" : ""}`}
        onClick={closeWithAnimation}
      />

      <section
        ref={sheetRef}
        className={`bottom-sheet player-sheet snap-${snap}${
          isDragging ? " is-dragging" : ""
        }${isClosing ? " is-closing" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerDrag}
        onPointerCancel={cancelPointerDrag}
        onClickCapture={handleClickCapture}
      >
        <div
          className="player-sheet-drag-area"
          role="button"
          tabIndex={0}
          aria-label={snap === "half" ? "プレイヤーを拡大" : "プレイヤーを縮小"}
          aria-expanded={snap === "expanded"}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              snapTo(snap === "half" ? "expanded" : "half")
            }
          }}
        >
          <div className="sheet-handle player-handle" />
        </div>

        <div className="player-sheet-title">
          {getDisplayTitle(currentItem.title)}
        </div>

        <div className="player-sheet-queue">
          <div className="player-sheet-section-title">PLAYBACK</div>
          <div className="player-sheet-queue-scroll">
            <PlaybackQueue player={player} />
          </div>
        </div>

        <div className="player-sheet-lower">
          <div className="player-sheet-progress-area">
            <input
              className="player-sheet-progress"
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={displayTime}
              aria-label="再生位置"
              style={{ "--progress": progress } as CSSProperties}
              onInput={(event) =>
                player.previewSeek(Number(event.currentTarget.value))
              }
              onPointerUp={(event) =>
                commitSeek(event.currentTarget.value)
              }
              onPointerCancel={(event) =>
                commitSeek(event.currentTarget.value)
              }
              onTouchEnd={(event) =>
                commitSeek(event.currentTarget.value)
              }
              onKeyUp={(event) =>
                commitSeek(event.currentTarget.value)
              }
              onBlur={(event) =>
                commitSeek(event.currentTarget.value)
              }
            />

            <div className="player-sheet-time">
              <span>{formatTime(displayTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="player-sheet-controls">
            <button
              className="player-sheet-secondary-control"
              type="button"
              aria-label="Shuffle upcoming"
              onClick={player.shuffleUpcoming}
            >
              <Shuffle size={20} strokeWidth={1.8} />
            </button>

            <div className="player-sheet-main-controls">
              <button
                className="player-sheet-control"
                type="button"
                aria-label="Previous"
                onClick={() => void player.playPrevious()}
              >
                <SkipBack size={26} strokeWidth={1.8} />
              </button>

              <button
                className="player-sheet-control main"
                type="button"
                aria-label={isPlaying ? "Pause" : "Play"}
                onClick={() => void player.togglePlay()}
              >
                {isPlaying ? (
                  <Pause size={31} strokeWidth={1.8} />
                ) : (
                  <Play size={31} strokeWidth={1.8} />
                )}
              </button>

              <button
                className="player-sheet-control"
                type="button"
                aria-label="Next"
                onClick={() => void player.playNext()}
              >
                <SkipForward size={26} strokeWidth={1.8} />
              </button>
            </div>

            <button
              className={`player-sheet-secondary-control${isRepeat ? " active" : ""}`}
              type="button"
              aria-label="Repeat"
              onClick={player.toggleRepeat}
            >
              <Repeat2 size={20} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </section>
    </>
  )
}
