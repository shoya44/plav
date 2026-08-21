import { useRef } from "react"
import type { CSSProperties } from "react"
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
  const touchStartYRef =
    useRef<number | null>(null)

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

  return (
    <>
      <div
        className="sheet-backdrop player-backdrop"
        onClick={onClose}
      />

      <section className="bottom-sheet player-sheet">
        <div
          className="sheet-handle player-handle"
          onTouchStart={(event) => {
            touchStartYRef.current =
              event.touches[0].clientY
          }}
          onTouchEnd={(event) => {
            if (
              touchStartYRef.current === null
            ) {
              return
            }

            const distance =
              event.changedTouches[0].clientY -
              touchStartYRef.current

            if (distance > 32) {
              onClose()
            }

            touchStartYRef.current = null
          }}
        />

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
