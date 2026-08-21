import {
  Pause,
  Play,
  Repeat2,
  Shuffle,
  SkipBack,
  SkipForward,
} from "lucide-react"

import type { AudioPlayerController } from "../audio"
import { useDraggableSheet } from "../hooks/useDraggableSheet"
import { formatTime, getDisplayTitle } from "../media"
import { PlaybackQueue } from "./PlaybackQueue"
import { SeekBar } from "./SeekBar"

type Props = {
  player: AudioPlayerController
  onClose: () => void
}

export function PlayerSheet({ player, onClose }: Props) {
  const {
    currentItem,
    displayTime,
    duration,
    isPlaying,
    isRepeat,
  } = player

  const sheet = useDraggableSheet({
    contentKey: currentItem?.id,
    onClose,
  })

  if (!currentItem) return null

  return (
    <>
      <div
        ref={sheet.backdropRef}
        className={`sheet-backdrop player-backdrop${
          sheet.isDragging ? " is-dragging" : ""
        }${sheet.isClosing ? " is-closing" : ""}`}
        onClick={sheet.closeWithAnimation}
      />

      <section
        ref={sheet.sheetRef}
        className={`bottom-sheet player-sheet snap-${sheet.snap}${
          sheet.isDragging ? " is-dragging" : ""
        }${sheet.isClosing ? " is-closing" : ""}`}
        {...sheet.handlers}
      >
        <div
          className="player-sheet-drag-area"
          role="button"
          tabIndex={0}
          aria-label={sheet.snap === "half" ? "プレイヤーを拡大" : "プレイヤーを縮小"}
          aria-expanded={sheet.snap === "expanded"}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              sheet.snapTo(sheet.snap === "half" ? "expanded" : "half")
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
            <SeekBar
              className="player-sheet-progress"
              value={displayTime}
              max={duration || 0}
              onPreview={player.previewSeek}
              onCommit={player.commitSeek}
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
