import { useRef, useState } from "react"
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react"
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

import type { AudioPlayerController } from "../hooks/useAudioPlayer"
import { formatTime, getDisplayTitle } from "../media"
import { PlaybackQueue } from "./PlaybackQueue"
import "./PlayerSheet.css"

type Props = {
  player: AudioPlayerController
  onClose: () => void
}

export function PlayerSheet({
  player,
  onClose,
}: Props) {
  const sheetRef = useRef<HTMLElement | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const dragStartYRef = useRef(0)
  const dragStartTimeRef = useRef(0)
  const closingRef = useRef(false)

  const [dragY, setDragY] = useState(0)
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

  if (!currentItem) {
    return null
  }

  const progress =
    duration > 0
      ? (currentTime / duration) * 100
      : 0

  const closeWithAnimation = () => {
    if (closingRef.current) {
      return
    }

    closingRef.current = true
    setIsDragging(false)
    setIsClosing(true)

    const sheetHeight =
      sheetRef.current?.getBoundingClientRect().height ?? 420

    setDragY(sheetHeight + 32)

    const reduceMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false

    window.setTimeout(
      onClose,
      reduceMotion ? 0 : 180,
    )
  }

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (
      closingRef.current ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return
    }

    activePointerIdRef.current = event.pointerId
    dragStartYRef.current = event.clientY
    dragStartTimeRef.current = performance.now()
    setDragY(0)
    setIsDragging(true)

    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return
    }

    const distance = Math.max(
      0,
      event.clientY - dragStartYRef.current,
    )

    setDragY(distance)
  }

  const finishPointerDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return
    }

    const distance = Math.max(
      0,
      event.clientY - dragStartYRef.current,
    )

    const elapsed = Math.max(
      performance.now() - dragStartTimeRef.current,
      1,
    )

    const velocity = distance / elapsed

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    activePointerIdRef.current = null
    setIsDragging(false)

    const shouldClose =
      distance >= 72 ||
      (distance >= 24 && velocity >= 0.55)

    if (shouldClose) {
      closeWithAnimation()
      return
    }

    setDragY(0)
  }

  const cancelPointerDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return
    }

    activePointerIdRef.current = null
    setIsDragging(false)
    setDragY(0)
  }

  const backdropOpacity = Math.max(
    0,
    1 - dragY / 240,
  )

  const sheetStyle = {
    "--player-sheet-drag-y": `${dragY}px`,
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
        className={`bottom-sheet player-sheet${
          isDragging ? " is-dragging" : ""
        }${isClosing ? " is-closing" : ""}`}
        style={sheetStyle}
      >
        <div
          className="player-sheet-drag-area"
          role="button"
          tabIndex={0}
          aria-label="プレイヤーを閉じる"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerDrag}
          onPointerCancel={cancelPointerDrag}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              closeWithAnimation()
            }
          }}
        >
          <div className="sheet-handle player-handle" />
        </div>

        <div className="player-sheet-title">
          {getDisplayTitle(
            currentItem.title
          )}
        </div>

        <div className="player-sheet-queue">
          <div className="player-sheet-section-title">
            PLAYBACK
          </div>

          <div className="player-sheet-queue-scroll">
            <PlaybackQueue
              player={player}
            />
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
                  Number(
                    event.currentTarget.value
                  )
                )
              }
            />

            <div className="player-sheet-time">
              <span>
                {formatTime(currentTime)}
              </span>

              <span>
                {formatTime(duration)}
              </span>
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
                <VolumeX
                  size={16}
                  strokeWidth={1.8}
                />
              ) : (
                <Volume2
                  size={16}
                  strokeWidth={1.8}
                />
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
                  value={
                    isMuted
                      ? 0
                      : volume
                  }
                  aria-label="音量"
                  onChange={(event) =>
                    player.setVolumeLevel(
                      Number(
                        event.currentTarget.value
                      )
                    )
                  }
                />

                <Volume2
                  className="player-sheet-volume-end"
                  size={15}
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
              <Shuffle
                size={18}
                strokeWidth={1.8}
              />
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
                <SkipBack
                  size={23}
                  strokeWidth={1.8}
                />
              </button>

              <button
                className="player-sheet-control main"
                type="button"
                aria-label={
                  isPlaying
                    ? "Pause"
                    : "Play"
                }
                onClick={() =>
                  void player.togglePlay()
                }
              >
                {isPlaying ? (
                  <Pause
                    size={27}
                    strokeWidth={1.8}
                  />
                ) : (
                  <Play
                    size={27}
                    strokeWidth={1.8}
                  />
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
                <SkipForward
                  size={23}
                  strokeWidth={1.8}
                />
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
              <Repeat2
                size={18}
                strokeWidth={1.8}
              />
            </button>
          </div>
        </div>
      </section>
    </>
  )
}
