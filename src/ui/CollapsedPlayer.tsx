import { useRef } from "react"
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react"
import { Pause, Play, SkipForward } from "lucide-react"

import type { AudioPlayerController } from "../audio"
import { getDisplayTitle } from "../media"

type Props = {
  player: AudioPlayerController
  onOpen: () => void
}

type SwipeStart = {
  pointerId: number
  x: number
  y: number
}

export function CollapsedPlayer({ player, onOpen }: Props) {
  const swipeStartRef = useRef<SwipeStart | null>(null)

  const {
    currentItem,
    displayTime,
    duration,
    isPlaying,
  } = player

  if (!currentItem) return null

  const progress =
    duration > 0 ? (displayTime / duration) * 100 : 0

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const target =
      event.target instanceof Element ? event.target : null

    // 再生ボタン / Next / Seekはそれぞれの操作を優先する。
    if (
      target?.closest(".collapsed-player-control") ||
      target?.closest('input[type="range"]')
    ) {
      swipeStartRef.current = null
      return
    }

    swipeStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    }
  }

  const handlePointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const start = swipeStartRef.current
    if (!start || start.pointerId !== event.pointerId) return

    const deltaX = event.clientX - start.x
    const upward = start.y - event.clientY

    // PointerUpを待たず、明確な上スワイプを検出した時点で開く。
    if (upward >= 14 && upward > Math.abs(deltaX) * 0.9) {
      swipeStartRef.current = null
      onOpen()
    }
  }

  const clearSwipe = () => {
    swipeStartRef.current = null
  }

  const commitSeek = (value: string) => {
    player.commitSeek(Number(value))
  }

  return (
    <div
      className="collapsed-player"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearSwipe}
      onPointerCancel={clearSwipe}
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
        value={displayTime}
        aria-label="再生位置"
        style={{ "--progress": progress } as CSSProperties}
        onInput={(event) =>
          player.previewSeek(Number(event.currentTarget.value))
        }
        onPointerUp={(event) =>
          commitSeek(event.currentTarget.value)
        }
        onPointerCancel={(event) =>
          commitSeek(event.currentTarget.value)
        }
        onTouchEnd={(event) =>
          commitSeek(event.currentTarget.value)
        }
        onKeyUp={(event) =>
          commitSeek(event.currentTarget.value)
        }
        onBlur={(event) =>
          commitSeek(event.currentTarget.value)
        }
      />
    </div>
  )
}
