import { useRef } from "react"
import type { CSSProperties } from "react"
import {
  Pause,
  Play,
  Repeat2,
  Shuffle,
  SkipBack,
  SkipForward,
} from "lucide-react"

import type { AudioPlayerController } from "../hooks/useAudioPlayer"
import {
  formatTime,
  getDisplayTitle,
} from "../media"
import { PlaybackQueue } from "./PlaybackQueue"
import "./ExpandedPlayer.css"

type Props = {
  player: AudioPlayerController
  onClose: () => void
}

export function ExpandedPlayer({
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

      <section className="bottom-sheet expanded-player">
        <div
          className="sheet-handle player-handle"
          onTouchStart={(event) => {
            touchStartYRef.current =
              event.touches[0].clientY
          }}
          onTouchEnd={(event) => {
            if (touchStartYRef.current === null) {
              return
            }

            const distance =
              event.changedTouches[0].clientY -
              touchStartYRef.current

            if (distance > 36) {
              onClose()
            }

            touchStartYRef.current = null
          }}
        />

        <div className="expanded-now-playing">
          <div className="expanded-player-title">
            {getDisplayTitle(currentItem.title)}
          </div>

          <div className="expanded-progress-area">
            <input
              className="expanded-progress"
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
                  Number(event.currentTarget.value)
                )
              }
            />

            <div className="expanded-time">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="expanded-controls-row">
            <button
              className="secondary-control"
              type="button"
              aria-label="Shuffle upcoming"
              onClick={player.shuffleUpcoming}
            >
              <Shuffle size={18} strokeWidth={1.8} />
            </button>

            <div className="expanded-main-controls">
              <button
                className="player-control"
                type="button"
                aria-label="Previous"
                onClick={() => void player.playPrevious()}
              >
                <SkipBack size={24} strokeWidth={1.8} />
              </button>

              <button
                className="player-control main"
                type="button"
                aria-label={isPlaying ? "Pause" : "Play"}
                onClick={() => void player.togglePlay()}
              >
                {isPlaying ? (
                  <Pause size={28} strokeWidth={1.8} />
                ) : (
                  <Play size={28} strokeWidth={1.8} />
                )}
              </button>

              <button
                className="player-control"
                type="button"
                aria-label="Next"
                onClick={() => void player.playNext()}
              >
                <SkipForward size={24} strokeWidth={1.8} />
              </button>
            </div>

            <button
              className={`secondary-control${isRepeat ? " active" : ""}`}
              type="button"
              aria-label="Repeat"
              onClick={player.toggleRepeat}
            >
              <Repeat2 size={18} strokeWidth={1.8} />
            </button>
          </div>
        </div>

        <div className="queue-section">
          <div className="queue-section-header">
            <span>UP NEXT</span>
          </div>

          <div className="queue-scroll-area">
            <PlaybackQueue player={player} />
          </div>
        </div>
      </section>
    </>
  )
}
