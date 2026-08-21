import {
  GripVertical,
  MoreHorizontal,
} from "lucide-react"
import {
  useRef,
  useState,
} from "react"
import type {
  PointerEvent,
} from "react"

import type { AudioPlayerController } from "../hooks/useAudioPlayer"
import {
  getDisplayTitle,
} from "../media"
import "./PlaybackQueue.css"

type Props = {
  player: AudioPlayerController
}

export function PlaybackQueue({
  player,
}: Props) {
  const {
    queue,
    currentIndex,
  } = player

  const [
    openMenuItemId,
    setOpenMenuItemId,
  ] = useState<
    string | number | null
  >(null)

  const dragIndexRef =
    useRef<number | null>(null)

  const [
    draggingItemId,
    setDraggingItemId,
  ] = useState<
    string | number | null
  >(null)

  const upcomingItems =
    queue.slice(
      currentIndex + 1
    )

  const handleDragStart = (
    event:
      PointerEvent<HTMLButtonElement>,
    queueIndex: number,
    itemId: string | number
  ) => {
    dragIndexRef.current =
      queueIndex

    setDraggingItemId(itemId)

    event.currentTarget
      .setPointerCapture(
        event.pointerId
      )
  }

  const handleDragMove = (
    event:
      PointerEvent<HTMLButtonElement>
  ) => {
    const fromIndex =
      dragIndexRef.current

    if (fromIndex === null) {
      return
    }

    const element =
      document.elementFromPoint(
        event.clientX,
        event.clientY
      )

    const row =
      element?.closest<HTMLElement>(
        "[data-queue-index]"
      )

    if (!row) {
      return
    }

    const targetIndex =
      Number(
        row.dataset.queueIndex
      )

    if (
      Number.isNaN(
        targetIndex
      ) ||
      targetIndex === fromIndex
    ) {
      return
    }

    player.moveQueueItem(
      fromIndex,
      targetIndex
    )

    dragIndexRef.current =
      targetIndex
  }

  const handleDragEnd = () => {
    dragIndexRef.current = null

    setDraggingItemId(
      null
    )
  }

  if (
    currentIndex < 0 ||
    upcomingItems.length === 0
  ) {
    return (
      <div className="queue-empty">
        Queue complete
      </div>
    )
  }

  return (
    <div className="queue-list">
      {upcomingItems.map(
        (item, offset) => {
          const queueIndex =
            currentIndex +
            1 +
            offset

          const isMenuOpen =
            openMenuItemId ===
            item.id

          const isDragging =
            draggingItemId ===
            item.id

          return (
            <div
              className={`queue-row${
                isDragging
                  ? " dragging"
                  : ""
              }`}
              key={item.id}
              data-queue-index={
                queueIndex
              }
            >
              <div className="queue-row-main">
                <button
                  className="queue-title-button"
                  type="button"
                  onClick={() =>
                    void player
                      .playQueueIndex(
                        queueIndex
                      )
                  }
                >
                  <span className="queue-title">
                    {getDisplayTitle(
                      item.title
                    )}
                  </span>
                </button>

                <div className="queue-row-actions">
                  <button
                    className={`queue-icon-button${
                      isMenuOpen
                        ? " active"
                        : ""
                    }`}
                    type="button"
                    aria-label="Queue actions"
                    aria-expanded={
                      isMenuOpen
                    }
                    onClick={() =>
                      setOpenMenuItemId(
                        isMenuOpen
                          ? null
                          : item.id
                      )
                    }
                  >
                    <MoreHorizontal
                      size={18}
                      strokeWidth={1.8}
                    />
                  </button>

                  <button
                    className="queue-drag-handle"
                    type="button"
                    aria-label={`Reorder ${getDisplayTitle(
                      item.title
                    )}`}
                    onPointerDown={(
                      event
                    ) =>
                      handleDragStart(
                        event,
                        queueIndex,
                        item.id
                      )
                    }
                    onPointerMove={
                      handleDragMove
                    }
                    onPointerUp={
                      handleDragEnd
                    }
                    onPointerCancel={
                      handleDragEnd
                    }
                  >
                    <GripVertical
                      size={18}
                      strokeWidth={1.7}
                    />
                  </button>
                </div>
              </div>

              {isMenuOpen && (
                <div className="queue-inline-actions">
                  <button
                    className="queue-play-next"
                    type="button"
                    onClick={() => {
                      player
                        .moveItemToNext(
                          item.id
                        )

                      setOpenMenuItemId(
                        null
                      )
                    }}
                  >
                    Play next
                  </button>
                </div>
              )}
            </div>
          )
        }
      )}
    </div>
  )
}
