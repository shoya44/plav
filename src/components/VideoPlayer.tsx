import { useRef } from "react"
import type { CSSProperties } from "react"
import {
  Maximize,
  Pause,
  Play,
} from "lucide-react"

import type { VideoPlayerController } from "../hooks/useVideoPlayer"
import {
  formatTime,
  getDisplayTitle,
} from "../media"
import "./VideoPlayer.css"

type Props = {
  player: VideoPlayerController
}

export function VideoPlayer({
  player,
}: Props) {
  const touchStartYRef =
    useRef<number | null>(null)

  const {
    currentItem,
    currentTime,
    duration,
    isPlaying,
  } = player

  const isOpen =
    Boolean(currentItem)

  const progress =
    duration > 0
      ? (currentTime / duration) * 100
      : 0

  return (
    <>
      {isOpen && (
        <button
          className="sheet-backdrop video-player-backdrop"
          type="button"
          aria-label="Close video player"
          onClick={player.close}
        />
      )}

      <section
        className={`bottom-sheet video-player${
          isOpen ? " open" : ""
        }`}
        aria-hidden={!isOpen}
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

          if (distance > 40) {
            player.close()
          }

          touchStartYRef.current = null
        }}
      >
        <div className="sheet-handle video-player-handle" />

        <div className="video-player-title">
          {currentItem
            ? getDisplayTitle(currentItem.title)
            : ""}
        </div>

        <div className="video-frame">
          <video
            ref={player.videoRef}
            className="video-element"
            playsInline
            preload="metadata"
            onClick={() => {
              if (currentItem) {
                void player.togglePlay()
              }
            }}
            onPlay={player.handlePlay}
            onPause={player.handlePause}
            onTimeUpdate={(event) =>
              player.handleTimeUpdate(
                event.currentTarget.currentTime
              )
            }
            onLoadedMetadata={(event) =>
              player.handleLoadedMetadata(
                event.currentTarget.duration
              )
            }
            onEnded={player.handleEnded}
          />

          {isOpen && !isPlaying && (
            <button
              className="video-center-play"
              type="button"
              aria-label="Play"
              onClick={() =>
                void player.togglePlay()
              }
            >
              <Play size={30} strokeWidth={1.8} />
            </button>
          )}

          <button
            className="video-fullscreen-button"
            type="button"
            aria-label="Fullscreen"
            onClick={() =>
              void player.enterFullscreen()
            }
          >
            <Maximize size={20} strokeWidth={1.8} />
          </button>
        </div>

        <div className="video-progress-area">
          <input
            className="video-progress"
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

          <div className="video-time">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="video-controls">
          <button
            className="video-control"
            type="button"
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={() =>
              void player.togglePlay()
            }
          >
            {isPlaying ? (
              <Pause size={23} strokeWidth={1.9} />
            ) : (
              <Play size={23} strokeWidth={1.9} />
            )}
          </button>
        </div>
      </section>
    </>
  )
}
