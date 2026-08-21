import { useRef } from "react"
import type { CSSProperties } from "react"
import { Pause, Play, SkipForward } from "lucide-react"

import type { AudioPlayerController } from "../hooks/useAudioPlayer"
import { getDisplayTitle } from "../media"
import "./CollapsedPlayer.css"

type Props = {
  player: AudioPlayerController
  onOpen: () => void
}

export function CollapsedPlayer({ player, onOpen }: Props) {
  const touchStartYRef = useRef<number | null>(null)

  const {
    currentItem,
    currentTime,
    duration,
    isPlaying,
  } = player

  if (!currentItem) return null

  const progress =
    duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      className="collapsed-player"
      onTouchStart={(event) => {
        touchStartYRef.current = event.touches[0].clientY
      }}
      onTouchEnd={(event) => {
        if (touchStartYRef.current === null) return

        const distance =
          touchStartYRef.current - event.changedTouches[0].clientY

        if (distance > 36) onOpen()
        touchStartYRef.current = null
      }}
    >
      <button
        className="collapsed-player-main"
        type="button"
        aria-label="Open player"
        onClick={onOpen}
      >
        <span className="collapsed-player-title">
          {getDisplayTitle(currentItem.title)}
        </span>
      </button>

      <div className="collapsed-player-actions">
        <button
          className="collapsed-player-control main"
          type="button"
          aria-label={isPlaying ? "Pause" : "Play"}
          onClick={() => void player.togglePlay()}
        >
          {isPlaying ? (
            <Pause size={21} strokeWidth={1.9} />
          ) : (
            <Play size={21} strokeWidth={1.9} />
          )}
        </button>

        <button
          className="collapsed-player-control"
          type="button"
          aria-label="Next"
          onClick={() => void player.playNext()}
        >
          <SkipForward size={19} strokeWidth={1.8} />
        </button>
      </div>

      <input
        className="collapsed-player-progress"
        type="range"
        min="0"
        max={duration || 0}
        step="0.1"
        value={currentTime}
        aria-label="再生位置"
        style={{ "--progress": progress } as CSSProperties}
        onChange={(event) =>
          player.seekTo(Number(event.currentTarget.value))
        }
      />
    </div>
  )
}
