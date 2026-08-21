import { useRef } from "react"
import type { PointerEvent } from "react"

import type { MediaItem } from "../media"
import { getDisplayTitle } from "../media"
import "./MediaRow.css"

type Props = {
  item: MediaItem
  isPlaying: boolean
  onPlay: () => void
  onShowDetail: () => void
}

const LONG_PRESS_MS = 450
const MOVE_CANCEL_PX = 10

export function MediaRow({
  item,
  isPlaying,
  onPlay,
  onShowDetail,
}: Props) {
  const timerRef = useRef<number | null>(null)
  const startPointRef = useRef<{ x: number; y: number } | null>(null)
  const didLongPressRef = useRef(false)

  const clearPressTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }

    startPointRef.current = null
  }

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    didLongPressRef.current = false
    startPointRef.current = {
      x: event.clientX,
      y: event.clientY,
    }

    timerRef.current = window.setTimeout(() => {
      didLongPressRef.current = true
      onShowDetail()
    }, LONG_PRESS_MS)
  }

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const startPoint = startPointRef.current
    if (!startPoint) return

    const moveX = Math.abs(event.clientX - startPoint.x)
    const moveY = Math.abs(event.clientY - startPoint.y)

    if (moveX > MOVE_CANCEL_PX || moveY > MOVE_CANCEL_PX) {
      clearPressTimer()
    }
  }

  const handleClick = () => {
    if (didLongPressRef.current) {
      didLongPressRef.current = false
      return
    }

    onPlay()
  }

  return (
    <button
      className={`media-row${isPlaying ? " playing" : ""}`}
      type="button"
      aria-label={item.title}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearPressTimer}
      onPointerCancel={clearPressTimer}
      onClick={handleClick}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span className="media-title">
        {getDisplayTitle(item.title)}
      </span>
    </button>
  )
}
