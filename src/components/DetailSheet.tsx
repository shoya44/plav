import { useLayoutEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"

import type { MediaItem } from "../media"
import { getDisplayTitle, getFileExtension } from "../media"
import "./DetailSheet.css"

type Props = {
  item: MediaItem
  onClose: () => void
}

export function DetailSheet({ item, onClose }: Props) {
  const touchStartYRef = useRef<number | null>(null)
  const titleViewportRef = useRef<HTMLDivElement>(null)
  const titleTextRef = useRef<HTMLSpanElement>(null)
  const [titleOverflow, setTitleOverflow] = useState(0)

  useLayoutEffect(() => {
    const measureTitle = () => {
      const viewport = titleViewportRef.current
      const text = titleTextRef.current
      if (!viewport || !text) return

      setTitleOverflow(
        Math.max(0, text.scrollWidth - viewport.clientWidth)
      )
    }

    measureTitle()
    window.addEventListener("resize", measureTitle)

    return () => {
      window.removeEventListener("resize", measureTitle)
    }
  }, [item.title])

  const extension = getFileExtension(item.title).toUpperCase()
  const typeLabel = item.type === "audio" ? "Audio" : "Video"

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

          const distance =
            event.changedTouches[0].clientY - touchStartYRef.current

          if (distance > 40) onClose()
          touchStartYRef.current = null
        }}
      >
        <div className="sheet-handle detail-handle" />

        <div className="detail-title-viewport" ref={titleViewportRef}>
          <span
            ref={titleTextRef}
            className={`detail-title${titleOverflow > 0 ? " scrolling" : ""}`}
            style={
              {
                "--title-overflow": `${titleOverflow}px`,
              } as CSSProperties
            }
          >
            {getDisplayTitle(item.title)}
          </span>
        </div>

        <div className="detail-meta">
          <span>{typeLabel}</span>
          {extension && <span>{extension}</span>}
        </div>
      </section>
    </>
  )
}
