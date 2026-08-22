import { useCallback, useEffect, useRef, useState } from "react"
import type { MouseEvent, PointerEvent } from "react"

import type { QueueList, QueuePosition } from "../audio"

type PendingReorder = {
  pointerId: number
  itemId: string | number
  title: string
  startX: number
  startY: number
  active: boolean
  row: HTMLDivElement
  // 並び替え中でも位置が変わらない祖先要素（.queue-list）。
  // 並び替え対象の行自体にpointer captureを持たせると、並び替えで
  // その行がDOM上で移動した際にブラウザがcaptureを解放してしまう
  // （lostpointercapture）ため、常に同じ場所にある祖先へcaptureする。
  captureTarget: HTMLElement
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

// Player SheetのHistory / Up Nextを「長押し + ドラッグ」で並び替え・
// 移動するための状態とポインターイベントハンドラをまとめる。
// 同一リスト内の並び替えだけでなく、History⇔Up Next間の移動もonMoveへ委ねる。
export function useQueueReorder(
  onMove: (from: QueuePosition, to: QueuePosition) => void,
) {
  const dragPositionRef = useRef<QueuePosition | null>(null)
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
    dragPositionRef.current = null
    setDraggingItemId(null)
    setDragPreview(null)
  }, [clearHoldTimer])

  useEffect(() => clearHoldTimer, [clearHoldTimer])

  const startLongPressReorder = useCallback(
    (
      event: PointerEvent<HTMLDivElement>,
      list: QueueList,
      index: number,
      itemId: string | number,
      itemTitle: string,
    ) => {
      if (
        pendingReorderRef.current ||
        (event.pointerType === "mouse" && event.button !== 0)
      ) {
        return
      }

      // Queue行で始まったポインター操作は、Player SheetのDrag(ドラッグで
      // 拡大/縮小/閉じる)に横取りされないよう、ここで伝播を止める。
      event.stopPropagation()

      const row = event.currentTarget
      const captureTarget =
        row.closest<HTMLElement>(".queue-list") ?? row

      const pending: PendingReorder = {
        pointerId: event.pointerId,
        itemId,
        title: itemTitle,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
        row,
        captureTarget,
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
        dragPositionRef.current = { list, index }
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
          current.captureTarget.setPointerCapture(current.pointerId)
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

      const from = dragPositionRef.current
      if (!from) return

      const element = document.elementFromPoint(
        event.clientX,
        event.clientY,
      )
      const row = element?.closest<HTMLElement>("[data-queue-list]")

      if (!row) return

      const targetList = row.dataset.queueList as QueueList | undefined
      const targetIndex = Number(row.dataset.queueIndex)

      if (
        !targetList ||
        Number.isNaN(targetIndex) ||
        (targetList === from.list && targetIndex === from.index)
      ) {
        return
      }

      const to: QueuePosition = { list: targetList, index: targetIndex }

      onMove(from, to)
      dragPositionRef.current = to
    },
    [resetReorderTracking, onMove],
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
        pending.captureTarget.hasPointerCapture(event.pointerId)
      ) {
        pending.captureTarget.releasePointerCapture(event.pointerId)
      }

      pendingReorderRef.current = null
      dragPositionRef.current = null
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

  // 長押し成立後の並び替えでは、ドラッグ中の要素がDOM上で移動する
  // （並び順が変わる）ことがあり、その際ブラウザがpointer captureを
  // 解放してlostpointercaptureが発生することがある。これは並び替えの
  // 正常な副作用でありドラッグの中断ではないため、成立後は無視して
  // pointerup/pointercancelでのみ終了させる。成立前（長押し確定前）に
  // 何らかの理由でcaptureが失われた場合だけキャンセル扱いにする。
  const handlePointerCaptureLost = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const pending = pendingReorderRef.current
      if (!pending || pending.pointerId !== event.pointerId) return
      if (pending.active) return

      finishReorder(event, true)
    },
    [finishReorder],
  )

  return {
    draggingItemId,
    dragPreview,
    dragPreviewRef,
    startLongPressReorder,
    handleReorderMove,
    finishReorder,
    handlePointerCaptureLost,
    handleRowClickCapture,
  }
}
