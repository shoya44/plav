import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import type { CSSProperties, PointerEvent } from "react"
import { Check, Download, ListPlus, LoaderCircle } from "lucide-react"

import type { OfflineMediaController } from "../offline"
import {
  getDisplayTitle,
  getFileExtension,
  type MediaItem,
} from "../media"

type Props = {
  items: MediaItem[]
  currentAudioId?: string
  currentVideoId?: string
  offline: OfflineMediaController
  onPlay: (item: MediaItem) => void
  onPlayNext: (item: MediaItem) => void
}

const LONG_PRESS_MS = 450
const MOVE_CANCEL_PX = 10
const SELECTION_LOCK_CLASS = "plav-long-press-lock"

let selectionLockActive = false

function preventNativeSelection(event: Event) {
  event.preventDefault()
}

function lockNativeSelection() {
  if (selectionLockActive) return

  selectionLockActive = true
  document.documentElement.classList.add(SELECTION_LOCK_CLASS)
  document.addEventListener("selectstart", preventNativeSelection, true)
  window.getSelection()?.removeAllRanges()
}

function unlockNativeSelection() {
  if (!selectionLockActive) return

  selectionLockActive = false
  document.documentElement.classList.remove(SELECTION_LOCK_CLASS)
  document.removeEventListener("selectstart", preventNativeSelection, true)
  window.getSelection()?.removeAllRanges()
}

export const Library = memo(function Library({
  items,
  currentAudioId,
  currentVideoId,
  offline,
  onPlay,
  onPlayNext,
}: Props) {
  const [detailItem, setDetailItem] = useState<MediaItem | null>(null)
  const { toggleDownload } = offline

  // MediaRowへ渡す関数参照を安定させ、曲一覧の再生中の
  // 不要な再レンダリングを防ぐ（各行でinline関数を作らない）。
  const handleToggleDownload = useCallback(
    (item: MediaItem) => void toggleDownload(item),
    [toggleDownload],
  )

  const handlePlayNext = useCallback(() => {
    if (!detailItem) return
    onPlayNext(detailItem)
    setDetailItem(null)
  }, [detailItem, onPlayNext])

  const closeDetail = useCallback(() => setDetailItem(null), [])

  return (
    <>
      <div className="media-list">
        {items.map((item) => (
          <MediaRow
            key={item.id}
            item={item}
            isPlaying={
              item.type === "audio"
                ? currentAudioId === item.id
                : currentVideoId === item.id
            }
            isDownloaded={offline.downloadedIds.has(item.id)}
            isDownloading={offline.downloadingIds.has(item.id)}
            hasDownloadError={offline.errorIds.has(item.id)}
            canDownload={offline.isSupported && item.type === "audio"}
            onPlay={onPlay}
            onToggleDownload={handleToggleDownload}
            onShowDetail={setDetailItem}
          />
        ))}
      </div>

      {detailItem && (
        <DetailSheet
          item={detailItem}
          showPlayNext={detailItem.type === "audio"}
          canPlayNext={Boolean(currentAudioId)}
          hasMiniPlayer={Boolean(currentAudioId)}
          onPlayNext={handlePlayNext}
          onClose={closeDetail}
        />
      )}
    </>
  )
})

const MediaRow = memo(function MediaRow({
  item,
  isPlaying,
  isDownloaded,
  isDownloading,
  hasDownloadError,
  canDownload,
  onPlay,
  onToggleDownload,
  onShowDetail,
}: {
  item: MediaItem
  isPlaying: boolean
  isDownloaded: boolean
  isDownloading: boolean
  hasDownloadError: boolean
  canDownload: boolean
  onPlay: (item: MediaItem) => void
  onToggleDownload: (item: MediaItem) => void
  onShowDetail: (item: MediaItem) => void
}) {
  const timerRef = useRef<number | null>(null)
  const startPointRef = useRef<{ x: number; y: number } | null>(null)
  const didLongPressRef = useRef(false)

  const clearPress = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    startPointRef.current = null
    unlockNativeSelection()
  }

  // 長押しタイマーが発火する前にこの行がアンマウントされた場合
  // （曲一覧の絞り込み変更など）、タイマーと選択ロックを確実に解除する。
  useEffect(() => {
    return () => clearPress()
  }, [])

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    didLongPressRef.current = false
    startPointRef.current = { x: event.clientX, y: event.clientY }

    // iOS Safariの長押し文字選択を、押した瞬間から一時的に無効化する。
    // スクロールへ移行した場合や指を離した場合はclearPressで即解除する。
    lockNativeSelection()

    timerRef.current = window.setTimeout(() => {
      didLongPressRef.current = true
      window.getSelection()?.removeAllRanges()
      onShowDetail(item)

      // Detail Sheetが表示されたら一時的な全体ロックは解除する。
      // 楽曲行自体のCSSロックは残るので、文字選択は再発しない。
      unlockNativeSelection()
    }, LONG_PRESS_MS)
  }

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const start = startPointRef.current
    if (!start) return

    if (
      Math.abs(event.clientX - start.x) > MOVE_CANCEL_PX ||
      Math.abs(event.clientY - start.y) > MOVE_CANCEL_PX
    ) {
      clearPress()
    }
  }

  const downloadLabel = isDownloading
    ? "Downloading"
    : isDownloaded
      ? "Remove download"
      : hasDownloadError
        ? "Retry download"
        : "Download"

  return (
    <div className={`media-row${isPlaying ? " playing" : ""}`}>
      <button
        className="media-row-main"
        type="button"
        aria-label={item.title}
        draggable={false}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={clearPress}
        onPointerCancel={clearPress}
        onClick={() => {
          if (didLongPressRef.current) {
            didLongPressRef.current = false
            return
          }
          onPlay(item)
        }}
        onContextMenu={(event) => event.preventDefault()}
        onDragStart={(event) => event.preventDefault()}
      >
        <span className="media-title">{getDisplayTitle(item.title)}</span>
      </button>

      {canDownload && (
        <button
          className={`media-download-button${isDownloaded ? " downloaded" : ""}${hasDownloadError ? " error" : ""}`}
          type="button"
          aria-label={downloadLabel}
          title={downloadLabel}
          disabled={isDownloading}
          onClick={() => onToggleDownload(item)}
        >
          {isDownloading ? (
            <LoaderCircle
              className="media-download-spinner"
              size={16}
              strokeWidth={1.8}
            />
          ) : isDownloaded ? (
            <Check size={17} strokeWidth={2} />
          ) : (
            <Download size={16} strokeWidth={1.8} />
          )}
        </button>
      )}
    </div>
  )
})

function DetailSheet({
  item,
  showPlayNext,
  canPlayNext,
  hasMiniPlayer,
  onPlayNext,
  onClose,
}: {
  item: MediaItem
  showPlayNext: boolean
  canPlayNext: boolean
  hasMiniPlayer: boolean
  onPlayNext: () => void
  onClose: () => void
}) {
  const touchStartYRef = useRef<number | null>(null)
  const titleViewportRef = useRef<HTMLDivElement>(null)
  const titleTextRef = useRef<HTMLSpanElement>(null)
  const [titleOverflow, setTitleOverflow] = useState(0)

  useLayoutEffect(() => {
    const measure = () => {
      const viewport = titleViewportRef.current
      const text = titleTextRef.current
      if (!viewport || !text) return
      setTitleOverflow(Math.max(0, text.scrollWidth - viewport.clientWidth))
    }

    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [item.title])

  const extension = getFileExtension(item.title).toUpperCase()

  return (
    <>
      <button
        className="sheet-backdrop detail-backdrop"
        type="button"
        aria-label="Close details"
        onClick={onClose}
      />

      <section
        className={`bottom-sheet detail-sheet${hasMiniPlayer ? " has-mini-player" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Media details"
        onTouchStart={(event) => {
          touchStartYRef.current = event.touches[0].clientY
        }}
        onTouchEnd={(event) => {
          if (touchStartYRef.current === null) return
          if (event.changedTouches[0].clientY - touchStartYRef.current > 40) {
            onClose()
          }
          touchStartYRef.current = null
        }}
      >
        <div className="sheet-handle detail-handle" />

        <div className="detail-title-viewport" ref={titleViewportRef}>
          <span
            ref={titleTextRef}
            className={`detail-title${titleOverflow > 0 ? " scrolling" : ""}`}
            style={{ "--title-overflow": `${titleOverflow}px` } as CSSProperties}
          >
            {getDisplayTitle(item.title)}
          </span>
        </div>

        <div className="detail-meta">
          <span>{item.type === "audio" ? "Audio" : "Video"}</span>
          {extension && <span>{extension}</span>}
        </div>

        {showPlayNext && (
          <button
            className="detail-play-next"
            type="button"
            disabled={!canPlayNext}
            aria-disabled={!canPlayNext}
            onClick={onPlayNext}
          >
            <ListPlus size={17} strokeWidth={1.8} />
            <span>Play next</span>
          </button>
        )}

        {showPlayNext && !canPlayNext && (
          <div className="detail-play-next-note">
            Start a track first
          </div>
        )}
      </section>
    </>
  )
}
