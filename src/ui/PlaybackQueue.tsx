import { GripVertical, MoreHorizontal } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { PointerEvent } from "react"

import type { AudioPlayerController } from "../audio"
import { getDisplayTitle } from "../media"

type Props = {
  player: AudioPlayerController
}

export function PlaybackQueue({ player }: Props) {
  const {
    history,
    currentItem,
    upNext,
  } = player

  const [openMenuItemId, setOpenMenuItemId] = useState<
    string | number | null
  >(null)

  const currentRowRef = useRef<HTMLDivElement>(null)
  const dragIndexRef = useRef<number | null>(null)
  const [draggingItemId, setDraggingItemId] = useState<
    string | number | null
  >(null)

  useEffect(() => {
    currentRowRef.current?.scrollIntoView({
      block: "nearest",
    })
  }, [currentItem?.id, history.length])

  const handleDragStart = (
    event: PointerEvent<HTMLButtonElement>,
    upNextIndex: number,
    itemId: string | number
  ) => {
    dragIndexRef.current = upNextIndex
    setDraggingItemId(itemId)

    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleDragMove = (event: PointerEvent<HTMLButtonElement>) => {
    const fromIndex = dragIndexRef.current
    if (fromIndex === null) return

    const element = document.elementFromPoint(event.clientX, event.clientY)
    const row = element?.closest<HTMLElement>("[data-up-next-index]")

    if (!row) return

    const targetIndex = Number(row.dataset.upNextIndex)

    if (Number.isNaN(targetIndex) || targetIndex === fromIndex) {
      return
    }

    player.moveUpNextItem(fromIndex, targetIndex)
    dragIndexRef.current = targetIndex
  }

  const handleDragEnd = () => {
    dragIndexRef.current = null
    setDraggingItemId(null)
  }

  if (!currentItem) return null

  return (
    <div className="queue-list">
      {history.map((item, index) => (
        <button
          className="queue-history-row"
          key={`history-${item.id}-${index}`}
          type="button"
          onClick={() => void player.playHistoryItem(index)}
        >
          <span className="queue-title played">
            {getDisplayTitle(item.title)}
          </span>
        </button>
      ))}

      <div
        ref={currentRowRef}
        className={`queue-current-row${history.length > 0 ? " has-history" : ""}`}
      >
        <span className="queue-current-dot" aria-hidden="true" />
        <span className="queue-title current">
          {getDisplayTitle(currentItem.title)}
        </span>
      </div>

      {upNext.map((item, upNextIndex) => {
        const isMenuOpen = openMenuItemId === item.id
        const isDragging = draggingItemId === item.id

        return (
          <div
            className={`queue-row${isDragging ? " dragging" : ""}`}
            key={item.id}
            data-up-next-index={upNextIndex}
          >
            <div className="queue-row-main">
              <button
                className="queue-title-button"
                type="button"
                onClick={() => void player.playUpNextItem(item.id)}
              >
                <span className="queue-title">
                  {getDisplayTitle(item.title)}
                </span>
              </button>

              <div className="queue-row-actions">
                <button
                  className={`queue-icon-button${isMenuOpen ? " active" : ""}`}
                  type="button"
                  aria-label="Queue actions"
                  aria-expanded={isMenuOpen}
                  onClick={() =>
                    setOpenMenuItemId(isMenuOpen ? null : item.id)
                  }
                >
                  <MoreHorizontal size={18} strokeWidth={1.8} />
                </button>

                <button
                  className="queue-drag-handle"
                  type="button"
                  aria-label={`Reorder ${getDisplayTitle(item.title)}`}
                  onPointerDown={(event) =>
                    handleDragStart(event, upNextIndex, item.id)
                  }
                  onPointerMove={handleDragMove}
                  onPointerUp={handleDragEnd}
                  onPointerCancel={handleDragEnd}
                >
                  <GripVertical size={18} strokeWidth={1.7} />
                </button>
              </div>
            </div>

            {isMenuOpen && (
              <div className="queue-inline-actions">
                <button
                  className="queue-play-next"
                  type="button"
                  onClick={() => {
                    player.moveItemToNext(item.id)
                    setOpenMenuItemId(null)
                  }}
                >
                  Play next
                </button>
              </div>
            )}
          </div>
        )
      })}

      {upNext.length === 0 && (
        <div className="queue-end">End of queue</div>
      )}
    </div>
  )
}
