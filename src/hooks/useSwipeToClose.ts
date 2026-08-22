import { useRef } from "react"
import type { TouchEvent } from "react"

const DEFAULT_THRESHOLD_PX = 40

// Video PlayerやDetail Sheet等のボトムシートを、下方向スワイプで閉じるための
// タッチイベントハンドラをまとめる。
export function useSwipeToClose(onClose: () => void, thresholdPx = DEFAULT_THRESHOLD_PX) {
  const startYRef = useRef<number | null>(null)

  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    startYRef.current = event.touches[0].clientY
  }

  const onTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const startY = startYRef.current
    startYRef.current = null

    if (startY === null) return

    if (event.changedTouches[0].clientY - startY > thresholdPx) {
      onClose()
    }
  }

  return { onTouchStart, onTouchEnd }
}
