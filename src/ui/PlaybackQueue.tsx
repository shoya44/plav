import { GripVertical } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { MouseEvent, PointerEvent } from "react"
import { createPortal } from "react-dom"

import type { AudioPlayerController } from "../audio"
import { getDisplayTitle } from "../media"

type Props = {
  player: AudioPlayerController
}

type PendingReorder = {
  pointerId: number
  itemId: string | number
  title: string
  startX: number
  startY: number
  active: boolean
  row: HTMLDivElement
}

type DragPreview = {
  title: string
  left: number
  top: number
  width: number
  height: number
}

const HOLD_TO_REORDER_MS = 220
const HOLD_CANCEL_DISTANCE = 10

export function PlaybackQueue({ player }: Props) {
  const {
    history,
    currentItem,
    upNext,
  } = player

  const currentRowRef = useRef<HTMLDivElement>(null)
  const dragIndexRef = useRef<number | null>(null)
  const holdTimerRef = useRef<number | null>(null)
  const pendingReorderRef = useRef<PendingReorder | null>(null)
  const suppressClickItemIdRef = useRef<string | number | null>(null)
  const dragPreviewRef = useRef<HTMLDivElement | null>(null)

  const [draggingItemId, setDraggingItemId] = useState<
    string | number | null
  >(null)
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null)

  useEffect(() => {
    currentRowRef.current?.scrollIntoView({
      block: "nearest",
    })
  }, [currentItem?.id, history.length])

  useEffect(() => {
    return () => {
      if (holdTimerRef.current !== null) {
        window.clearTimeout(holdTimerRef.current)
      }
    }
  }, [])

  const clearHoldTimer = () => {
    if (holdTimerRef.current === null) return

    window.clearTimeout(holdTimerRef.current)
    holdTimerRef.current = null
  }

  const resetReorderTracking = () => {
    clearHoldTimer()
    pendingReorderRef.current = null
    dragIndexRef.current = null
    setDraggingItemId(null)
    setDragPreview(null)
  }

  const startLongPressReorder = (
    event: PointerEvent<HTMLDivElement>,
    upNextIndex: number,
    itemId: string | number,
    itemTitle: string,
  ) => {
    if (
      pendingReorderRef.current ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return
    }

    const row = event.currentTarget
    const pending: PendingReorder = {
      pointerId: event.pointerId,
      itemId,
      title: itemTitle,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      row,
    }

    pendingReorderRef.current = pending

    holdTimerRef.current = window.setTimeout(() => {
      const current = pendingReorderRef.current

      if (
        !current ||
        current.pointerId !== pending.pointerId ||
        current.itemId !== pending.itemId
      ) {
        return
      }

      current.active = true
      dragIndexRef.current = upNextIndex
      suppressClickItemIdRef.current = itemId
      setDraggingItemId(itemId)

      const rect = current.row.getBoundingClientRect()
      setDragPreview({
        title: current.title,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      })

      try {
        current.row.setPointerCapture(current.pointerId)
      } catch {
        // iOSで既にPointerが解放されていた場合は何もしない。
      }
    }, HOLD_TO_REORDER_MS)
  }

  const handleReorderMove = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    const pending = pendingReorderRef.current

    if (!pending || pending.pointerId !== event.pointerId) {
      return
    }

    const deltaX = event.clientX - pending.startX
    const deltaY = event.clientY - pending.startY

    if (!pending.active) {
      if (Math.hypot(deltaX, deltaY) >= HOLD_CANCEL_DISTANCE) {
        // 長押し成立前に動いた場合は通常のSheet swipe / Queue scrollへ戻す。
        resetReorderTracking()
      }

      return
    }

    // Reorder中はSheet swipeや文字選択へイベントを渡さない。
    if (event.cancelable) event.preventDefault()
    event.stopPropagation()

    if (dragPreviewRef.current) {
      dragPreviewRef.current.style.transform =
        `translate3d(0, ${deltaY}px, 0) scale(1.015)`
    }

    const scrollArea = event.currentTarget.closest<HTMLElement>(
      ".player-sheet-queue-scroll",
    )

    if (scrollArea) {
      const rect = scrollArea.getBoundingClientRect()
      const edge = 38

      if (event.clientY < rect.top + edge) {
        scrollArea.scrollTop -= 10
      } else if (event.clientY > rect.bottom - edge) {
        scrollArea.scrollTop += 10
      }
    }

    const fromIndex = dragIndexRef.current
    if (fromIndex === null) return

    const element = document.elementFromPoint(
      event.clientX,
      event.clientY,
    )
    const row = element?.closest<HTMLElement>(
      "[data-up-next-index]",
    )

    if (!row) return

    const targetIndex = Number(row.dataset.upNextIndex)

    if (
      Number.isNaN(targetIndex) ||
      targetIndex === fromIndex
    ) {
      return
    }

    player.moveUpNextItem(fromIndex, targetIndex)
    dragIndexRef.current = targetIndex
  }

  const finishReorder = (
    event: PointerEvent<HTMLDivElement>,
    cancelled = false,
  ) => {
    const pending = pendingReorderRef.current

    if (!pending || pending.pointerId !== event.pointerId) {
      return
    }

    const wasActive = pending.active

    clearHoldTimer()

    if (
      wasActive &&
      pending.row.hasPointerCapture(event.pointerId)
    ) {
      pending.row.releasePointerCapture(event.pointerId)
    }

    pendingReorderRef.current = null
    dragIndexRef.current = null
    setDraggingItemId(null)
    setDragPreview(null)

    if (wasActive) {
      // pointerup直後に生成されるclickで曲が再生されるのを防ぐ。
      window.setTimeout(() => {
        suppressClickItemIdRef.current = null
      }, cancelled ? 0 : 350)
    }
  }

  const handleRowClickCapture = (
    event: MouseEvent<HTMLDivElement>,
    itemId: string | number,
  ) => {
    if (suppressClickItemIdRef.current !== itemId) return

    suppressClickItemIdRef.current = null
    event.preventDefault()
    event.stopPropagation()
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
        const isDragging = draggingItemId === item.id

        return (
          <div
            className={`queue-row${isDragging ? " dragging" : ""}`}
            key={item.id}
            data-up-next-index={upNextIndex}
            aria-grabbed={isDragging}
            onPointerDown={(event) =>
              startLongPressReorder(
                event,
                upNextIndex,
                item.id,
                getDisplayTitle(item.title),
              )
            }
            onPointerMove={handleReorderMove}
            onPointerUp={(event) => finishReorder(event)}
            onPointerCancel={(event) =>
              finishReorder(event, true)
            }
            onLostPointerCapture={(event) =>
              finishReorder(event, true)
            }
            onClickCapture={(event) =>
              handleRowClickCapture(event, item.id)
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

      {dragPreview &&
        createPortal(
          <div
            ref={dragPreviewRef}
            className="queue-drag-preview"
            style={{
              left: dragPreview.left,
              top: dragPreview.top,
              width: dragPreview.width,
              height: dragPreview.height,
            }}
            aria-hidden="true"
          >
            <span className="queue-drag-preview-title">
              {dragPreview.title}
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
