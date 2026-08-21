import { useCallback, useEffect, useRef } from "react"
import type { PointerEvent } from "react"

type UseLongPressOptions = {
  delayMs: number
  cancelDistancePx: number
  onLongPress: () => void
  onStart?: () => void
  onEnd?: () => void
}

// 「一定時間・一定距離以内で押し続けたら長押しとみなす」判定だけをまとめる。
// 判定成立後の挙動（詳細表示・ドラッグ開始など）は呼び出し側のonLongPressに委ねる。
export function useLongPress({
  delayMs,
  cancelDistancePx,
  onLongPress,
  onStart,
  onEnd,
}: UseLongPressOptions) {
  const timerRef = useRef<number | null>(null)
  const startPointRef = useRef<{ x: number; y: number } | null>(null)
  const didLongPressRef = useRef(false)

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    startPointRef.current = null
    onEnd?.()
  }, [onEnd])

  // 長押しタイマーが発火する前にコンポーネントがアンマウントされた場合も、
  // タイマーと呼び出し側の後始末（選択ロック解除など）を確実に行う。
  useEffect(() => clear, [clear])

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return

      didLongPressRef.current = false
      startPointRef.current = { x: event.clientX, y: event.clientY }
      onStart?.()

      timerRef.current = window.setTimeout(() => {
        didLongPressRef.current = true
        startPointRef.current = null
        onLongPress()
        onEnd?.()
      }, delayMs)
    },
    [delayMs, onStart, onLongPress, onEnd],
  )

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const start = startPointRef.current
      if (!start) return

      if (
        Math.abs(event.clientX - start.x) > cancelDistancePx ||
        Math.abs(event.clientY - start.y) > cancelDistancePx
      ) {
        clear()
      }
    },
    [cancelDistancePx, clear],
  )

  // 直前の操作が長押しとして成立していたかを読み取り、同時にリセットする。
  // click直後にonClick側で1回だけ判定し、通常のtapによる再生を抑止するために使う。
  const consumeDidLongPress = useCallback(() => {
    const didFire = didLongPressRef.current
    didLongPressRef.current = false
    return didFire
  }, [])

  return {
    consumeDidLongPress,
    onPointerDown,
    onPointerMove,
    onPointerUp: clear,
    onPointerCancel: clear,
  }
}
