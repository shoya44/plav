import { useRef } from "react"
import type { CSSProperties } from "react"
import { Pause, Play } from "lucide-react"

import type { AudioPlayerController } from "../hooks/useAudioPlayer"
import { getDisplayTitle } from "../media"
import "./MiniPlayer.css"

type Props = {
  player: AudioPlayerController
  onOpen: () => void
}

export function MiniPlayer({ player, onOpen }: Props) {
  const touchStartYRef = useRef<number | null>(null)
  const { currentItem, currentTime, duration, isPlaying } = player

  if (!currentItem) return null

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      className="mini-player"
      onTouchStart={(event) => {
        touchStartYRef.current = event.touches[0].clientY
      }}
      onTouchEnd={(event) => {
        if (touchStartYRef.current === null) return

        const distance =
          touchStartYRef.current - event.changedTouches[0].clientY

        if (distance > 40) onOpen()
        touchStartYRef.current = null
      }}
    >
      <button
        className="mini-player-main"
        type="button"
        aria-label="Open player"
        onClick={onOpen}
      >
        <span className="mini-player-title">
          {getDisplayTitle(currentItem.title)}
        </span>
      </button>

      <button
        className="mini-player-play"
        type="button"
        aria-label={isPlaying ? "Pause" : "Play"}
        onClick={() => void player.togglePlay()}
      >
        {isPlaying ? (
          <Pause size={22} strokeWidth={2} />
        ) : (
          <Play size={22} strokeWidth={2} />
        )}
      </button>

      <input
        className="mini-player-progress"
        type="range"
        min="0"
        max={duration || 0}
        step="0.1"
        value={currentTime}
        aria-label="再生位置"
        style={{ "--progress": progress } as CSSProperties}
        onChange={(event) => player.seekTo(Number(event.currentTarget.value))}
      />
    </div>
  )
}
