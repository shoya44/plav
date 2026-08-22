import {
  memo,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import {
  Check,
  Download,
  ListPlus,
  LoaderCircle,
  Pencil,
  Trash2,
} from "lucide-react"

import { cssVars } from "../cssVars"
import { useLongPress } from "../hooks/useLongPress"
import { useSwipeToClose } from "../hooks/useSwipeToClose"
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
  onUpdateTitle: (item: MediaItem, title: string) => Promise<void>
  onDeleteTrack: (item: MediaItem) => Promise<void>
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
  onUpdateTitle,
  onDeleteTrack,
}: Props) {
  // Detail SheetはIDだけ保持し、表示するitemは毎回itemsから引く。
  // item自体をstateに持つと、タイトル更新後もSheetが開いた時点の
  // 古いスナップショットを表示し続けてしまう（そのための同期用useEffectを
  // 増やすよりも、そもそも重複した状態を持たない方がシンプルで正しい）。
  const [detailItemId, setDetailItemId] = useState<MediaItem["id"] | null>(
    null,
  )
  const detailItem =
    (detailItemId
      ? items.find((item) => item.id === detailItemId)
      : null) ?? null
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
    setDetailItemId(null)
  }, [detailItem, onPlayNext])

  const closeDetail = useCallback(() => setDetailItemId(null), [])

  const showDetail = useCallback(
    (item: MediaItem) => setDetailItemId(item.id),
    [],
  )

  // 削除成功時だけDetail Sheetを閉じる（失敗時はSheet内にエラーを
  // 表示したまま残す）。
  const handleDelete = useCallback(
    async (item: MediaItem) => {
      await onDeleteTrack(item)
      setDetailItemId(null)
    },
    [onDeleteTrack],
  )

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
            onShowDetail={showDetail}
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
          onUpdateTitle={onUpdateTitle}
          onDelete={handleDelete}
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
  // iOS Safariの長押し文字選択を、押した瞬間から一時的に無効化する。
  // 長押しが成立してDetail Sheetが表示されたら解除する
  // （楽曲行自体のCSSロックは残るので、文字選択は再発しない）。
  const longPress = useLongPress({
    delayMs: LONG_PRESS_MS,
    cancelDistancePx: MOVE_CANCEL_PX,
    onStart: lockNativeSelection,
    onLongPress: () => {
      window.getSelection()?.removeAllRanges()
      onShowDetail(item)
    },
    onEnd: unlockNativeSelection,
  })

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
        onPointerDown={longPress.onPointerDown}
        onPointerMove={longPress.onPointerMove}
        onPointerUp={longPress.onPointerUp}
        onPointerCancel={longPress.onPointerCancel}
        onClick={() => {
          if (longPress.consumeDidLongPress()) return
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
  onUpdateTitle,
  onDelete,
  onClose,
}: {
  item: MediaItem
  showPlayNext: boolean
  canPlayNext: boolean
  hasMiniPlayer: boolean
  onPlayNext: () => void
  onUpdateTitle: (item: MediaItem, title: string) => Promise<void>
  onDelete: (item: MediaItem) => Promise<void>
  onClose: () => void
}) {
  const swipeToClose = useSwipeToClose(onClose)
  const titleViewportRef = useRef<HTMLDivElement>(null)
  const titleTextRef = useRef<HTMLSpanElement>(null)
  const [titleOverflow, setTitleOverflow] = useState(0)

  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(() =>
    getDisplayTitle(item.title),
  )
  const [isSavingTitle, setIsSavingTitle] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

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

  const extension = getFileExtension(item.title)

  const startEditingTitle = () => {
    setTitleDraft(getDisplayTitle(item.title))
    setErrorMessage("")
    setIsEditingTitle(true)
  }

  const cancelEditingTitle = () => {
    setIsEditingTitle(false)
    setErrorMessage("")
  }

  const saveTitle = async () => {
    const trimmed = titleDraft.trim()
    if (!trimmed || isSavingTitle) return

    const fullTitle = extension ? `${trimmed}.${extension}` : trimmed

    setIsSavingTitle(true)
    setErrorMessage("")

    try {
      await onUpdateTitle(item, fullTitle)
      setIsEditingTitle(false)
    } catch (error) {
      console.error("タイトルの更新に失敗しました:", error)
      setErrorMessage("Couldn't save the title. Try again.")
    } finally {
      setIsSavingTitle(false)
    }
  }

  const handleDeleteTap = async () => {
    if (isDeleting) return

    const confirmed = window.confirm(
      `Delete "${getDisplayTitle(item.title)}"? This removes the file permanently and can't be undone.`,
    )
    if (!confirmed) return

    setIsDeleting(true)
    setErrorMessage("")

    try {
      await onDelete(item)
    } catch (error) {
      console.error("曲の削除に失敗しました:", error)
      setErrorMessage("Couldn't delete this track. Try again.")
      setIsDeleting(false)
    }
  }

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
        onTouchStart={swipeToClose.onTouchStart}
        onTouchEnd={swipeToClose.onTouchEnd}
      >
        <div className="sheet-handle detail-handle" />

        {isEditingTitle ? (
          <div className="detail-title-edit">
            <input
              className="detail-title-input"
              type="text"
              value={titleDraft}
              autoFocus
              disabled={isSavingTitle}
              onChange={(event) => setTitleDraft(event.target.value)}
            />

            <div className="detail-title-edit-actions">
              <button
                className="detail-title-edit-cancel"
                type="button"
                disabled={isSavingTitle}
                onClick={cancelEditingTitle}
              >
                Cancel
              </button>

              <button
                className="detail-title-edit-save"
                type="button"
                disabled={isSavingTitle || !titleDraft.trim()}
                onClick={() => void saveTitle()}
              >
                {isSavingTitle ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <div className="detail-title-row">
            <div className="detail-title-viewport" ref={titleViewportRef}>
              <span
                ref={titleTextRef}
                className={`detail-title${titleOverflow > 0 ? " scrolling" : ""}`}
                style={cssVars({ "--title-overflow": `${titleOverflow}px` })}
              >
                {getDisplayTitle(item.title)}
              </span>
            </div>

            <button
              className="detail-title-edit-button"
              type="button"
              aria-label="Edit title"
              onClick={startEditingTitle}
            >
              <Pencil size={16} strokeWidth={1.8} />
            </button>
          </div>
        )}

        <div className="detail-meta">
          <span>{item.type === "audio" ? "Audio" : "Video"}</span>
          {extension && <span>{extension.toUpperCase()}</span>}
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

        <button
          className="detail-delete"
          type="button"
          disabled={isDeleting}
          onClick={() => void handleDeleteTap()}
        >
          <Trash2 size={17} strokeWidth={1.8} />
          <span>{isDeleting ? "Deleting..." : "Delete"}</span>
        </button>

        {errorMessage && (
          <div className="detail-error">{errorMessage}</div>
        )}
      </section>
    </>
  )
}
