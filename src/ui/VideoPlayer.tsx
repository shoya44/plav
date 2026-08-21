import type { CSSProperties } from "react"
import {
  Maximize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
} from "lucide-react"

import { useSwipeToClose } from "../hooks/useSwipeToClose"
import type { VideoPlayerController } from "../video"
import {
  formatTime,
  getDisplayTitle,
} from "../media"

type Props = {
  player: VideoPlayerController
}

export function VideoPlayer({
  player,
}: Props) {
  const swipeToClose = useSwipeToClose(player.close)

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
        onTouchStart={swipeToClose.onTouchStart}
        onTouchEnd={swipeToClose.onTouchEnd}
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
