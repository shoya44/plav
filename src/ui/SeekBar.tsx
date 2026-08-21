import { cssVars } from "../cssVars"

type Props = {
  className: string
  value: number
  max: number
  onPreview: (time: number) => void
  onCommit: (time: number) => void
}

// Mini PlayerとPlayer Sheetで共通の再生位置バー。
// ドラッグ中はonPreviewで表示だけ動かし、指を離した時（複数のイベントのいずれか）に
// onCommitで実際のSeekを1回だけ確定させる。
export function SeekBar({ className, value, max, onPreview, onCommit }: Props) {
  const progress = max > 0 ? (value / max) * 100 : 0

  const commit = (raw: string) => onCommit(Number(raw))

  return (
    <input
      className={className}
      type="range"
      min="0"
      max={max || 0}
      step="0.1"
      value={value}
      aria-label="再生位置"
      style={cssVars({ "--progress": progress })}
      onInput={(event) => onPreview(Number(event.currentTarget.value))}
      onPointerUp={(event) => commit(event.currentTarget.value)}
      onPointerCancel={(event) => commit(event.currentTarget.value)}
      onTouchEnd={(event) => commit(event.currentTarget.value)}
      onKeyUp={(event) => commit(event.currentTarget.value)}
      onBlur={(event) => commit(event.currentTarget.value)}
    />
  )
}
