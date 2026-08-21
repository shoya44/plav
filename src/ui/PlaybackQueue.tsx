import { GripVertical } from "lucide-react"
import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"

import type { AudioPlayerController } from "../audio"
import { useQueueReorder } from "../hooks/useQueueReorder"
import { getDisplayTitle } from "../media"

type Props = {
  player: AudioPlayerController
}

export function PlaybackQueue({ player }: Props) {
  const {
    history,
    currentItem,
    upNext,
    moveUpNextItem,
  } = player

  const currentRowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    currentRowRef.current?.scrollIntoView({
      block: "nearest",
    })
  }, [currentItem?.id, history.length])

  const reorder = useQueueReorder(moveUpNextItem)

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
        const isDragging = reorder.draggingItemId === item.id

        return (
          <div
            className={`queue-row${isDragging ? " dragging" : ""}`}
            key={item.id}
            data-up-next-index={upNextIndex}
            aria-grabbed={isDragging}
            onPointerDown={(event) =>
              reorder.startLongPressReorder(
                event,
                upNextIndex,
                item.id,
                getDisplayTitle(item.title),
              )
            }
            onPointerMove={reorder.handleReorderMove}
            onPointerUp={(event) => reorder.finishReorder(event)}
            onPointerCancel={(event) =>
              reorder.finishReorder(event, true)
            }
            onLostPointerCapture={(event) =>
              reorder.finishReorder(event, true)
            }
            onClickCapture={(event) =>
              reorder.handleRowClickCapture(event, item.id)
            }
            onContextMenu={(event) => event.preventDefault()}
            onDragStart={(event) => event.preventDefault()}
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

              <span
                className="queue-drag-handle"
                aria-hidden="true"
              >
                <GripVertical size={18} strokeWidth={1.7} />
              </span>
            </div>
          </div>
        )
      })}

      {upNext.length === 0 && (
        <div className="queue-end">End of queue</div>
      )}

      {reorder.dragPreview &&
        createPortal(
          <div
            ref={reorder.dragPreviewRef}
            className="queue-drag-preview"
            style={{
              left: reorder.dragPreview.left,
              top: reorder.dragPreview.top,
              width: reorder.dragPreview.width,
              height: reorder.dragPreview.height,
            }}
            aria-hidden="true"
          >
            <span className="queue-drag-preview-title">
              {reorder.dragPreview.title}
            </span>

            <span className="queue-drag-preview-grip">
              <GripVertical size={18} strokeWidth={1.7} />
            </span>
          </div>,
          document.body,
        )}
    </div>
  )
}
