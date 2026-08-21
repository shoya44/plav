import { useLayoutEffect, useRef, useState } from "react"
import type { CSSProperties, PointerEvent } from "react"

import {
  getDisplayTitle,
  getFileExtension,
  type MediaItem,
} from "../media"

type Props = {
  items: MediaItem[]
  currentAudioId?: string
  currentVideoId?: string
  onPlay: (item: MediaItem) => void
}

const LONG_PRESS_MS = 450
const MOVE_CANCEL_PX = 10

export function Library({
  items,
  currentAudioId,
  currentVideoId,
  onPlay,
}: Props) {
  const [detailItem, setDetailItem] = useState<MediaItem | null>(null)

  return (
    <>
      <div className="media-list">
        {items.map((item) => (
          <MediaRow
            key={item.id}
            item={item}
            isPlaying={
              item.type === "audio"
                ? currentAudioId === item.id
                : currentVideoId === item.id
            }
            onPlay={() => onPlay(item)}
            onShowDetail={() => setDetailItem(item)}
          />
        ))}
      </div>

      {detailItem && (
        <DetailSheet
          item={detailItem}
          onClose={() => setDetailItem(null)}
        />
      )}
    </>
  )
}

function MediaRow({
  item,
  isPlaying,
  onPlay,
  onShowDetail,
}: {
  item: MediaItem
  isPlaying: boolean
  onPlay: () => void
  onShowDetail: () => void
}) {
  const timerRef = useRef<number | null>(null)
  const startPointRef = useRef<{ x: number; y: number } | null>(null)
  const didLongPressRef = useRef(false)

  const clearPress = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    startPointRef.current = null
  }

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    didLongPressRef.current = false
    startPointRef.current = { x: event.clientX, y: event.clientY }

    timerRef.current = window.setTimeout(() => {
      didLongPressRef.current = true
      onShowDetail()
    }, LONG_PRESS_MS)
  }

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const start = startPointRef.current
    if (!start) return

    if (
      Math.abs(event.clientX - start.x) > MOVE_CANCEL_PX ||
      Math.abs(event.clientY - start.y) > MOVE_CANCEL_PX
    ) {
      clearPress()
    }
  }

  return (
    <button
      className={`media-row${isPlaying ? " playing" : ""}`}
      type="button"
      aria-label={item.title}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearPress}
      onPointerCancel={clearPress}
      onClick={() => {
        if (didLongPressRef.current) {
          didLongPressRef.current = false
          return
        }
        onPlay()
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span className="media-title">{getDisplayTitle(item.title)}</span>
    </button>
  )
}

function DetailSheet({
  item,
  onClose,
}: {
  item: MediaItem
  onClose: () => void
}) {
  const touchStartYRef = useRef<number | null>(null)
  const titleViewportRef = useRef<HTMLDivElement>(null)
  const titleTextRef = useRef<HTMLSpanElement>(null)
  const [titleOverflow, setTitleOverflow] = useState(0)

  useLayoutEffect(() => {
    const measure = () => {
      const viewport = titleViewportRef.current
      const text = titleTextRef.current
      if (!viewport || !text) return
      setTitleOverflow(Math.max(0, text.scrollWidth - viewport.clientWidth))
    }

    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [item.title])

  const extension = getFileExtension(item.title).toUpperCase()

  return (
    <>
      <button
        className="sheet-backdrop detail-backdrop"
        type="button"
        aria-label="Close details"
        onClick={onClose}
      />

      <section
        className="bottom-sheet detail-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Media details"
        onTouchStart={(event) => {
          touchStartYRef.current = event.touches[0].clientY
        }}
        onTouchEnd={(event) => {
          if (touchStartYRef.current === null) return
          if (event.changedTouches[0].clientY - touchStartYRef.current > 40) {
            onClose()
          }
          touchStartYRef.current = null
        }}
      >
        <div className="sheet-handle detail-handle" />

        <div className="detail-title-viewport" ref={titleViewportRef}>
          <span
            ref={titleTextRef}
            className={`detail-title${titleOverflow > 0 ? " scrolling" : ""}`}
            style={{ "--title-overflow": `${titleOverflow}px` } as CSSProperties}
          >
            {getDisplayTitle(item.title)}
          </span>
        </div>

        <div className="detail-meta">
          <span>{item.type === "audio" ? "Audio" : "Video"}</span>
          {extension && <span>{extension}</span>}
        </div>
      </section>
    </>
  )
}
