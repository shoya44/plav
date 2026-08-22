import { GripVertical } from "lucide-react"
import { memo, useEffect, useRef } from "react"
import { createPortal } from "react-dom"

import type { QueuePosition } from "../audio"
import { useQueueReorder } from "../hooks/useQueueReorder"
import { getDisplayTitle, type MediaItem } from "../media"

type Props = {
  history: MediaItem[]
  currentItem: MediaItem | null
  upNext: MediaItem[]
  moveQueueItem: (from: QueuePosition, to: QueuePosition) => void
  playHistoryItem: (historyIndex: number) => void
  playUpNextItem: (itemId: MediaItem["id"]) => void
}

// playerオブジェクト全体ではなく必要な値・関数だけを受け取ることで、
// 再生位置（currentTime / displayTime）の更新ではこのリストが
// 再レンダリングされないようにする（Seekバー操作時の重さの原因だった）。
export const PlaybackQueue = memo(function PlaybackQueue({
  history,
  currentItem,
  upNext,
  moveQueueItem,
  playHistoryItem,
  playUpNextItem,
}: Props) {
  const currentRowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    currentRowRef.current?.scrollIntoView({
      block: "nearest",
    })
  }, [currentItem?.id, history.length])

  const reorder = useQueueReorder(moveQueueItem)

  if (!currentItem) return null

  return (
    <div
      className="queue-list"
      onPointerMove={reorder.handleReorderMove}
      onPointerUp={(event) => reorder.finishReorder(event)}
      onPointerCancel={(event) => reorder.finishReorder(event, true)}
      onLostPointerCapture={reorder.handlePointerCaptureLost}
    >
      {history.map((item, index) => {
        const isDragging = reorder.draggingItemId === item.id

        return (
          // keyはitem.id基準（indexを含めない）にする。ドラッグ中の並び替えで
          // indexが変わってもDOMノードを再生成させないことで、そのノードに
          // setPointerCaptureしたポインターキャプチャを保持し続けるため。
          // （同じ曲がHistoryに複数回入る場合はkeyが重複しうるが、
          // 発生頻度が低く実害も見た目上の軽微な取り違えに留まるため許容する）
          <div
            className={`queue-row queue-history-row${isDragging ? " dragging" : ""}`}
            key={item.id}
            data-queue-list="history"
            data-queue-index={index}
            aria-grabbed={isDragging}
            onPointerDown={(event) =>
              reorder.startLongPressReorder(
                event,
                "history",
                index,
                item.id,
                getDisplayTitle(item.title),
              )
            }
            onClickCapture={(event) =>
              reorder.handleRowClickCapture(event, item.id)
            }
            onContextMenu={(event) => event.preventDefault()}
            onDragStart={(event) => event.preventDefault()}
          >
            <div className="queue-row-main">
              <span
                className="queue-drag-handle"
                aria-hidden="true"
              >
                <GripVertical size={20} strokeWidth={1.7} />
              </span>

              <button
                className="queue-title-button"
                type="button"
                onClick={() => void playHistoryItem(index)}
              >
                <span className="queue-title played">
                  {getDisplayTitle(item.title)}
                </span>
              </button>
            </div>
          </div>
        )
      })}

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
            data-queue-list="upNext"
            data-queue-index={upNextIndex}
            aria-grabbed={isDragging}
            onPointerDown={(event) =>
              reorder.startLongPressReorder(
                event,
                "upNext",
                upNextIndex,
                item.id,
                getDisplayTitle(item.title),
              )
            }
            onClickCapture={(event) =>
              reorder.handleRowClickCapture(event, item.id)
            }
            onContextMenu={(event) => event.preventDefault()}
            onDragStart={(event) => event.preventDefault()}
          >
            <div className="queue-row-main">
              <span
                className="queue-drag-handle"
                aria-hidden="true"
              >
                <GripVertical size={20} strokeWidth={1.7} />
              </span>

              <button
                className="queue-title-button"
                type="button"
                onClick={() => void playUpNextItem(item.id)}
              >
                <span className="queue-title">
                  {getDisplayTitle(item.title)}
                </span>
              </button>
            </div>
          </div>
        )
      })}

      {upNext.length === 0 && (
        <div
          className="queue-end"
          data-queue-list="upNext"
          data-queue-index={0}
        >
          End of queue
        </div>
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
            <span className="queue-drag-preview-grip">
              <GripVertical size={18} strokeWidth={1.7} />
            </span>

            <span className="queue-drag-preview-title">
              {reorder.dragPreview.title}
            </span>
          </div>,
          document.body,
        )}
    </div>
  )
})
