import { useCallback, useEffect, useRef, useState } from "react"
import type { MouseEvent, PointerEvent } from "react"

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

// Player SheetのUp Nextを「長押し + ドラッグ」で並び替えるための状態と
// ポインターイベントハンドラをまとめる。並び替え自体はonReorderに委ねる。
export function useQueueReorder(
  onReorder: (fromIndex: number, toIndex: number) => void,
) {
  const dragIndexRef = useRef<number | null>(null)
  const holdTimerRef = useRef<number | null>(null)
  const pendingReorderRef = useRef<PendingReorder | null>(null)
  const suppressClickItemIdRef = useRef<string | number | null>(null)
  const dragPreviewRef = useRef<HTMLDivElement | null>(null)

  const [draggingItemId, setDraggingItemId] = useState<
    string | number | null
  >(null)
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null)

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current === null) return

    window.clearTimeout(holdTimerRef.current)
    holdTimerRef.current = null
  }, [])

  const resetReorderTracking = useCallback(() => {
    clearHoldTimer()
    pendingReorderRef.current = null
    dragIndexRef.current = null
    setDraggingItemId(null)
    setDragPreview(null)
  }, [clearHoldTimer])

  useEffect(() => clearHoldTimer, [clearHoldTimer])

  const startLongPressReorder = useCallback(
    (
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
    },
    [],
  )

  const handleReorderMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
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

      onReorder(fromIndex, targetIndex)
      dragIndexRef.current = targetIndex
    },
    [resetReorderTracking, onReorder],
  )

  const finishReorder = useCallback(
    (
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
    },
    [clearHoldTimer],
  )

  const handleRowClickCapture = useCallback(
    (
      event: MouseEvent<HTMLDivElement>,
      itemId: string | number,
    ) => {
      if (suppressClickItemIdRef.current !== itemId) return

      suppressClickItemIdRef.current = null
      event.preventDefault()
      event.stopPropagation()
    },
    [],
  )

  return {
    draggingItemId,
    dragPreview,
    dragPreviewRef,
    startLongPressReorder,
    handleReorderMove,
    finishReorder,
    handleRowClickCapture,
  }
}
