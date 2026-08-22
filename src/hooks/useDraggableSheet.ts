import { useLayoutEffect, useRef, useState } from "react"
import type { MouseEvent, PointerEvent } from "react"

export type SheetSnap = "half" | "expanded"

type SnapHeights = {
  half: number
  expanded: number
}

type Options = {
  // Sheetの内容が入れ替わったタイミング（例: currentItem.id）で
  // スナップ高さの再計測をトリガーするためのキー。
  contentKey: string | undefined
  onClose: () => void
}

// player.cssの.player-sheet.is-closing / .player-backdrop.is-closingの
// transitionは200ms。unmountはそれ以降に行う（詳細はcloseWithAnimation参照）。
const CLOSE_ANIMATION_MS = 210

// Player Sheetのボトムシート化（上下ドラッグでの拡大/縮小/閉じる）を
// 管理する。速度・距離のしきい値やDOMへの直接描画によるドラッグの
// 軽量化など、ジェスチャー固有のロジックをここへ集約する。
export function useDraggableSheet({ contentKey, onClose }: Options) {
  const sheetRef = useRef<HTMLElement | null>(null)
  const backdropRef = useRef<HTMLDivElement | null>(null)
  const snapHeightsRef = useRef<SnapHeights>({ half: 320, expanded: 620 })
  const currentHeightRef = useRef(320)

  const activePointerIdRef = useRef<number | null>(null)
  const dragStartXRef = useRef(0)
  const dragStartYRef = useRef(0)
  const dragStartHeightRef = useRef(0)
  const dragStartTimeRef = useRef(0)
  const dragStartedRef = useRef(false)
  const dragOriginQueueRef = useRef<HTMLElement | null>(null)
  const suppressClickRef = useRef(false)
  const closingRef = useRef(false)
  const startSnapRef = useRef<SheetSnap>("half")

  const [snap, setSnap] = useState<SheetSnap>("half")
  const [isDragging, setIsDragging] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  const measureSnapHeights = (): SnapHeights => {
    const viewportHeight =
      window.visualViewport?.height ?? window.innerHeight

    // Navigation + safe-area分を残しつつ、Expandedは画面上端近くまで使う。
    const expanded = Math.max(360, viewportHeight - 96)
    const half = Math.min(
      Math.max(300, viewportHeight * 0.5),
      Math.max(240, expanded - 72),
    )

    return { half, expanded }
  }

  const setVisualHeight = (height: number) => {
    currentHeightRef.current = height
    sheetRef.current?.style.setProperty(
      "--player-sheet-height",
      `${height}px`,
    )

    const { half, expanded } = snapHeightsRef.current
    const span = Math.max(expanded - half, 1)
    const ratio = Math.min(Math.max((height - half) / span, 0), 1)

    if (backdropRef.current) {
      backdropRef.current.style.opacity = String(0.58 + ratio * 0.16)
    }
  }

  const snapTo = (nextSnap: SheetSnap) => {
    setSnap(nextSnap)
    setVisualHeight(snapHeightsRef.current[nextSnap])
  }

  useLayoutEffect(() => {
    if (!contentKey) return

    const syncSize = () => {
      if (closingRef.current || dragStartedRef.current) return

      snapHeightsRef.current = measureSnapHeights()
      setVisualHeight(snapHeightsRef.current[snap])
    }

    syncSize()
    window.addEventListener("resize", syncSize)
    window.visualViewport?.addEventListener("resize", syncSize)

    return () => {
      window.removeEventListener("resize", syncSize)
      window.visualViewport?.removeEventListener("resize", syncSize)
    }
  }, [contentKey, snap])

  const closeWithAnimation = () => {
    if (closingRef.current) return

    closingRef.current = true
    setIsDragging(false)
    setIsClosing(true)

    const reduceMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false

    // player.cssの.is-closingは transform/opacity を200msで遷移させる。
    // ここが200ms未満だとアニメーションの完了前にSheetがunmountされ、
    // クローズが唐突に見える（実際に20ms早くunmountされていたバグ）。
    window.setTimeout(onClose, reduceMotion ? 0 : CLOSE_ANIMATION_MS)
  }

  const resetPointerTracking = () => {
    activePointerIdRef.current = null
    dragStartedRef.current = false
    dragOriginQueueRef.current = null
    setIsDragging(false)
  }

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (
      closingRef.current ||
      activePointerIdRef.current !== null ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return
    }

    const target =
      event.target instanceof Element ? event.target : null

    // Seek / VolumeはSheet gestureから完全に除外する。
    if (target?.closest('input[type="range"]')) return

    activePointerIdRef.current = event.pointerId
    dragStartXRef.current = event.clientX
    dragStartYRef.current = event.clientY
    dragStartHeightRef.current = currentHeightRef.current
    dragStartTimeRef.current = performance.now()
    dragStartedRef.current = false
    startSnapRef.current = snap
    dragOriginQueueRef.current =
      (target?.closest(".player-sheet-queue-scroll") as HTMLElement | null) ?? null
  }

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return

    const deltaX = event.clientX - dragStartXRef.current
    const deltaY = event.clientY - dragStartYRef.current

    if (!dragStartedRef.current) {
      const vertical = Math.abs(deltaY)
      const horizontal = Math.abs(deltaX)

      if (vertical < 6) return

      if (horizontal > vertical * 0.95) {
        resetPointerTracking()
        return
      }

      const queue = dragOriginQueueRef.current

      if (queue && startSnapRef.current === "expanded") {
        if (deltaY < 0 || queue.scrollTop > 0) {
          resetPointerTracking()
          return
        }
      }

      dragStartedRef.current = true
      suppressClickRef.current = true
      setIsDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    }

    if (event.cancelable) event.preventDefault()

    // Half状態では「上へ少しスワイプ」で即Expandedへ。
    // 指を離すまで待たないので、iPhoneでも1回の操作で確実に拡大する。
    if (startSnapRef.current === "half" && deltaY <= -24) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      resetPointerTracking()
      snapTo("expanded")

      window.setTimeout(() => {
        suppressClickRef.current = false
      }, 0)
      return
    }

    const heights = snapHeightsRef.current
    const nextHeight = dragStartHeightRef.current - deltaY
    const minimum = Math.min(220, heights.half * 0.65)

    // React stateを毎frame更新せず、DOMのCSS変数だけ変更する。
    // Queue全体の再renderを避けるため、iPhoneでのdragが軽くなる。
    setVisualHeight(
      Math.min(Math.max(nextHeight, minimum), heights.expanded),
    )
  }

  const finishPointerDrag = (event: PointerEvent<HTMLElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return

    if (!dragStartedRef.current) {
      resetPointerTracking()
      return
    }

    const deltaY = event.clientY - dragStartYRef.current
    const elapsed = Math.max(performance.now() - dragStartTimeRef.current, 1)
    const velocityY = deltaY / elapsed

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const startSnap = startSnapRef.current
    resetPointerTracking()

    if (startSnap === "half") {
      const shouldExpand =
        deltaY <= -46 ||
        (deltaY <= -16 && velocityY <= -0.34)

      const shouldClose =
        deltaY >= 78 ||
        (deltaY >= 24 && velocityY >= 0.5)

      if (shouldExpand) snapTo("expanded")
      else if (shouldClose) closeWithAnimation()
      else snapTo("half")
    } else {
      const shouldCollapse =
        deltaY >= 58 ||
        (deltaY >= 18 && velocityY >= 0.4)

      snapTo(shouldCollapse ? "half" : "expanded")
    }

    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 0)
  }

  const cancelPointerDrag = (event: PointerEvent<HTMLElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return

    const startSnap = startSnapRef.current
    resetPointerTracking()
    snapTo(startSnap)
    suppressClickRef.current = false
  }

  const handleClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (!suppressClickRef.current) return

    suppressClickRef.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  return {
    sheetRef,
    backdropRef,
    snap,
    isDragging,
    isClosing,
    snapTo,
    closeWithAnimation,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: finishPointerDrag,
      onPointerCancel: cancelPointerDrag,
      onClickCapture: handleClickCapture,
    },
  }
}
