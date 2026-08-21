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
  Volume2,
  VolumeX,
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

export function PlayerSheet({
  player,
  onClose,
}: Props) {
  const sheetRef = useRef<HTMLElement | null>(null)
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
  const [sheetHeight, setSheetHeight] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  const {
    currentItem,
    currentTime,
    duration,
    isPlaying,
    isRepeat,
    volume,
    isMuted,
    canAdjustVolume,
  } = player

  const getSnapHeights = (): SnapHeights => {
    const sheet = sheetRef.current
    const viewportHeight =
      window.visualViewport?.height ?? window.innerHeight

    let expandedHeight = Math.max(
      360,
      viewportHeight - 96,
    )

    if (sheet) {
      const maxHeight = Number.parseFloat(
        window.getComputedStyle(sheet).maxHeight,
      )

      if (Number.isFinite(maxHeight) && maxHeight > 0) {
        expandedHeight = maxHeight
      }
    }

    const preferredHalfHeight = Math.max(
      300,
      viewportHeight * 0.5,
    )

    const halfHeight = Math.min(
      preferredHalfHeight,
      Math.max(220, expandedHeight - 72),
    )

    return {
      half: halfHeight,
      expanded: expandedHeight,
    }
  }

  useLayoutEffect(() => {
    if (!currentItem) {
      return
    }

    const syncHeight = () => {
      if (closingRef.current || isDragging) {
        return
      }

      const heights = getSnapHeights()
      setSheetHeight(heights[snap])
    }

    syncHeight()

    window.addEventListener("resize", syncHeight)
    window.visualViewport?.addEventListener(
      "resize",
      syncHeight,
    )

    return () => {
      window.removeEventListener("resize", syncHeight)
      window.visualViewport?.removeEventListener(
        "resize",
        syncHeight,
      )
    }
  }, [currentItem?.id, snap, isDragging])

  if (!currentItem) {
    return null
  }

  const progress =
    duration > 0
      ? (currentTime / duration) * 100
      : 0

  const snapTo = (nextSnap: SheetSnap) => {
    const heights = getSnapHeights()

    setSnap(nextSnap)
    setSheetHeight(heights[nextSnap])
  }

  const closeWithAnimation = () => {
    if (closingRef.current) {
      return
    }

    closingRef.current = true
    setIsDragging(false)
    setIsClosing(true)

    const reduceMotion =
      window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches ?? false

    window.setTimeout(
      onClose,
      reduceMotion ? 0 : 200,
    )
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
      event.target instanceof Element
        ? event.target
        : null

    // Seek / Volumeは横操作を最優先する。
    if (target?.closest('input[type="range"]')) {
      return
    }

    activePointerIdRef.current = event.pointerId
    dragStartXRef.current = event.clientX
    dragStartYRef.current = event.clientY
    dragStartHeightRef.current = sheetHeight
    dragStartTimeRef.current = performance.now()
    dragStartedRef.current = false
    startSnapRef.current = snap
    dragOriginQueueRef.current =
      (target?.closest(
        ".player-sheet-queue-scroll",
      ) as HTMLElement | null) ?? null
  }

  const handlePointerMove = (
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return
    }

    const deltaX =
      event.clientX - dragStartXRef.current
    const deltaY =
      event.clientY - dragStartYRef.current

    if (!dragStartedRef.current) {
      const verticalDistance = Math.abs(deltaY)
      const horizontalDistance = Math.abs(deltaX)

      if (verticalDistance < 8) {
        return
      }

      // 横方向の操作はSheetが奪わない。
      if (
        horizontalDistance >
        verticalDistance * 0.85
      ) {
        resetPointerTracking()
        return
      }

      const queue = dragOriginQueueRef.current

      if (queue && startSnapRef.current === "expanded") {
        // Expanded中の上スワイプはQueueスクロールへ譲る。
        if (deltaY < 0) {
          resetPointerTracking()
          return
        }

        // Queueが途中なら、下スワイプもQueueを先に戻す。
        if (queue.scrollTop > 0) {
          resetPointerTracking()
          return
        }
      }

      dragStartedRef.current = true
      suppressClickRef.current = true
      setIsDragging(true)

      event.currentTarget.setPointerCapture(
        event.pointerId,
      )
    }

    if (event.cancelable) {
      event.preventDefault()
    }

    const heights = getSnapHeights()
    const minimumDragHeight = Math.min(
      220,
      heights.half * 0.65,
    )

    // 指を上へ動かすほどSheetが大きくなる。
    const nextHeight =
      dragStartHeightRef.current - deltaY

    setSheetHeight(
      Math.min(
        Math.max(nextHeight, minimumDragHeight),
        heights.expanded,
      ),
    )
  }

  const finishPointerDrag = (
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return
    }

    if (!dragStartedRef.current) {
      resetPointerTracking()
      return
    }

    const deltaY =
      event.clientY - dragStartYRef.current

    const elapsed = Math.max(
      performance.now() - dragStartTimeRef.current,
      1,
    )

    const velocityY = deltaY / elapsed

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId,
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      )
    }

    const startSnap = startSnapRef.current
    resetPointerTracking()

    if (startSnap === "half") {
      const shouldExpand =
        deltaY <= -72 ||
        (deltaY <= -24 && velocityY <= -0.5)

      const shouldClose =
        deltaY >= 88 ||
        (deltaY >= 28 && velocityY >= 0.58)

      if (shouldExpand) {
        snapTo("expanded")
      } else if (shouldClose) {
        closeWithAnimation()
      } else {
        snapTo("half")
      }
    } else {
      const shouldCollapse =
        deltaY >= 76 ||
        (deltaY >= 24 && velocityY >= 0.52)

      if (shouldCollapse) {
        snapTo("half")
      } else {
        snapTo("expanded")
      }
    }

    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 0)
  }

  const cancelPointerDrag = (
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return
    }

    const startSnap = startSnapRef.current

    resetPointerTracking()
    snapTo(startSnap)
    suppressClickRef.current = false
  }

  const handleClickCapture = (
    event: ReactMouseEvent<HTMLElement>,
  ) => {
    if (!suppressClickRef.current) {
      return
    }

    suppressClickRef.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  const heights = getSnapHeights()
  const backdropOpacity = Math.min(
    1,
    Math.max(
      0.35,
      sheetHeight / Math.max(heights.half, 1),
    ),
  )

  const sheetStyle = {
    "--player-sheet-height": `${sheetHeight}px`,
  } as CSSProperties

  return (
    <>
      <div
        className={`sheet-backdrop player-backdrop${
          isDragging ? " is-dragging" : ""
        }${isClosing ? " is-closing" : ""}`}
        style={{ opacity: backdropOpacity }}
        onClick={closeWithAnimation}
      />

      <section
        ref={sheetRef}
        className={`bottom-sheet player-sheet snap-${snap}${
          isDragging ? " is-dragging" : ""
        }${isClosing ? " is-closing" : ""}`}
        style={sheetStyle}
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
          aria-label={
            snap === "half"
              ? "プレイヤーを拡大"
              : "プレイヤーを縮小"
          }
          aria-expanded={snap === "expanded"}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              snapTo(
                snap === "half"
                  ? "expanded"
                  : "half",
              )
            }
          }}
        >
          <div className="sheet-handle player-handle" />
        </div>

        <div className="player-sheet-title">
          {getDisplayTitle(currentItem.title)}
        </div>

        <div className="player-sheet-queue">
          <div className="player-sheet-section-title">
            PLAYBACK
          </div>

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
              value={currentTime}
              aria-label="再生位置"
              style={{
                "--progress": progress,
              } as CSSProperties}
              onChange={(event) =>
                player.seekTo(
                  Number(event.currentTarget.value),
                )
              }
            />

            <div className="player-sheet-time">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="player-sheet-volume">
            <button
              className="player-sheet-volume-button"
              type="button"
              aria-label={
                isMuted
                  ? "ミュート解除"
                  : "ミュート"
              }
              onClick={player.toggleMute}
            >
              {isMuted ? (
                <VolumeX size={18} strokeWidth={1.8} />
              ) : (
                <Volume2 size={18} strokeWidth={1.8} />
              )}
            </button>

            {canAdjustVolume ? (
              <>
                <input
                  className="player-sheet-volume-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  aria-label="音量"
                  onChange={(event) =>
                    player.setVolumeLevel(
                      Number(event.currentTarget.value),
                    )
                  }
                />

                <Volume2
                  className="player-sheet-volume-end"
                  size={17}
                  strokeWidth={1.6}
                  aria-hidden="true"
                />
              </>
            ) : (
              <div className="player-sheet-volume-system">
                Device volume
              </div>
            )}
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
                onClick={() =>
                  void player.playPrevious()
                }
              >
                <SkipBack size={26} strokeWidth={1.8} />
              </button>

              <button
                className="player-sheet-control main"
                type="button"
                aria-label={isPlaying ? "Pause" : "Play"}
                onClick={() =>
                  void player.togglePlay()
                }
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
                onClick={() =>
                  void player.playNext()
                }
              >
                <SkipForward size={26} strokeWidth={1.8} />
              </button>
            </div>

            <button
              className={`player-sheet-secondary-control${
                isRepeat ? " active" : ""
              }`}
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
