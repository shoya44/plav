import { useRef } from "react"
import type { CSSProperties } from "react"
import {
  Maximize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
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
    volume,
    isMuted,
    canAdjustVolume,
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
          if (
            touchStartYRef.current === null
          ) {
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
        <div className="video-player-top">
          <div className="sheet-handle video-player-handle" />

          <div className="video-player-title">
            {currentItem
              ? getDisplayTitle(
                  currentItem.title
                )
              : ""}
          </div>
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
            onVolumeChange={
              player.handleVolumeChange
            }
            onEnded={player.handleEnded}
          />

          <button
            className="video-fullscreen-button"
            type="button"
            aria-label="Fullscreen"
            onClick={() =>
              void player.enterFullscreen()
            }
          >
            <Maximize
              size={22}
              strokeWidth={1.8}
            />
          </button>
        </div>

        <div className="video-lower">
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
                  Number(
                    event.currentTarget.value
                  )
                )
              }
            />

            <div className="video-time">
              <span>
                {formatTime(currentTime)}
              </span>

              <span>
                {formatTime(duration)}
              </span>
            </div>
          </div>

          <div className="video-volume">
            <button
              className="video-volume-button"
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
                  className="video-volume-slider"
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
                  className="video-volume-end"
                  size={15}
                  strokeWidth={1.6}
                  aria-hidden="true"
                />
              </>
            ) : (
              <div className="video-volume-system">
                Device volume
              </div>
            )}
          </div>

          <div className="video-controls">
            <button
              className="video-skip-control"
              type="button"
              aria-label="10秒戻る"
              onClick={() =>
                player.skipBy(-10)
              }
            >
              <RotateCcw
                size={19}
                strokeWidth={1.7}
              />
              <span>10</span>
            </button>

            <button
              className="video-play-control"
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
                  size={24}
                  strokeWidth={1.9}
                />
              ) : (
                <Play
                  size={24}
                  strokeWidth={1.9}
                />
              )}
            </button>

            <button
              className="video-skip-control"
              type="button"
              aria-label="10秒進む"
              onClick={() =>
                player.skipBy(10)
              }
            >
              <RotateCw
                size={19}
                strokeWidth={1.7}
              />
              <span>10</span>
            </button>
          </div>
        </div>
      </section>
    </>
  )
}
