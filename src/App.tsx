import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  House,
  Music2,
  Settings,
  Shuffle,
  Video,
} from "lucide-react"

import { useAudioPlayer } from "./audio"
import {
  deleteTrack,
  fetchTracks,
  sortItems,
  updateTrackTitle,
  type MediaItem,
  type MediaType,
  type SortMode,
} from "./media"
import { useOfflineMedia } from "./offline"
import { useVideoPlayer } from "./video"
import { CollapsedPlayer } from "./ui/CollapsedPlayer"
import { Library } from "./ui/Library"
import { PlayerSheet } from "./ui/PlayerSheet"
import { Settings as SettingsView } from "./ui/Settings"
import { VideoPlayer } from "./ui/VideoPlayer"

type Page = "home" | "settings"

const APP_VERSION =
  import.meta.env.VITE_APP_VERSION ?? "dev"

const SORT_STORAGE_KEY = "plav:sort-mode"
const SORT_MODES: SortMode[] = ["dateAddedDesc", "dateAddedAsc", "titleAsc"]
const SORT_LABELS: Record<SortMode, string> = {
  dateAddedDesc: "Newest",
  dateAddedAsc: "Oldest",
  titleAsc: "A–Z",
}
const SORT_ICONS: Record<SortMode, typeof ArrowDownWideNarrow> = {
  dateAddedDesc: ArrowDownWideNarrow,
  dateAddedAsc: ArrowUpWideNarrow,
  titleAsc: ArrowDownAZ,
}

function readStoredSortMode(): SortMode {
  try {
    const stored = localStorage.getItem(SORT_STORAGE_KEY)
    if (stored && (SORT_MODES as string[]).includes(stored)) {
      return stored as SortMode
    }
  } catch {
    // localStorageが使えない環境ではデフォルトのまま。
  }

  return "dateAddedDesc"
}

export default function App() {
  const [page, setPage] = useState<Page>("home")
  const [mediaType, setMediaType] = useState<MediaType>("audio")
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [isPlayerOpen, setIsPlayerOpen] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>(readStoredSortMode)

  // Up Next等の再生キューも、Homeで選択中のソート順に沿って構築する
  // （mediaTypeでは絞り込まない。タブを切り替えても再生中Audioのキューは
  // 保持したいため、Audio/Video両方を含めたままソートのみ適用する）。
  const sortedMediaItems = useMemo(
    () => sortItems(mediaItems, sortMode),
    [mediaItems, sortMode],
  )

  const offline = useOfflineMedia(mediaItems)
  const audio = useAudioPlayer(sortedMediaItems)
  const video = useVideoPlayer()

  // useCallbackの依存配列に安定した個々の関数を渡すため、先に取り出しておく。
  const { close: closeVideo, playItem: playVideoItem } = video
  const { playItem: playAudioItem, pause: pauseAudio } = audio

  useEffect(() => {
    let cancelled = false

    fetchTracks()
      .then((items) => {
        if (!cancelled) setMediaItems(items)
      })
      .catch((error) => {
        console.error("曲一覧の取得に失敗しました:", error)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const filteredItems = useMemo(
    () =>
      sortedMediaItems.filter((item) => item.type === mediaType),
    [sortedMediaItems, mediaType],
  )
  const showCollapsedPlayer = Boolean(audio.currentItem) && !video.currentItem
  const showShuffle =
    page === "home" &&
    mediaType === "audio" &&
    !isPlayerOpen &&
    !video.currentItem

  const openPage = useCallback((nextPage: Page) => {
    setIsPlayerOpen(false)
    closeVideo()
    setPage(nextPage)
  }, [closeVideo])

  const playMedia = useCallback(async (item: MediaItem) => {
    if (item.type === "audio") {
      closeVideo()
      await playAudioItem(item)
      return
    }

    pauseAudio()
    setIsPlayerOpen(false)
    await playVideoItem(item)
  }, [closeVideo, playAudioItem, pauseAudio, playVideoItem])

  // Libraryの各行へ同じ関数参照を渡し、曲一覧の不要な再レンダリングを防ぐ。
  const handleLibraryPlay = useCallback(
    (item: MediaItem) => void playMedia(item),
    [playMedia],
  )

  const cycleSortMode = useCallback(() => {
    setSortMode((current) => {
      const next =
        SORT_MODES[(SORT_MODES.indexOf(current) + 1) % SORT_MODES.length]

      try {
        localStorage.setItem(SORT_STORAGE_KEY, next)
      } catch {
        // localStorageが使えない環境では今回のセッションだけ反映する。
      }

      return next
    })
  }, [])

  const handleUpdateTitle = useCallback(
    async (item: MediaItem, title: string) => {
      await updateTrackTitle(item.id, title)

      setMediaItems((current) =>
        current.map((existing) =>
          existing.id === item.id ? { ...existing, title } : existing,
        ),
      )
    },
    [],
  )

  const { removeDownload } = offline

  // 完全削除: Supabaseのレコード + R2のファイルの両方を削除する
  // （Settings > Cloudの容量表示と実際の使用量を一致させるため）。
  // ローカルCacheへ保存済みだった場合はそちらも合わせて削除する。
  const handleDeleteTrack = useCallback(
    async (item: MediaItem) => {
      await deleteTrack(item.id)

      setMediaItems((current) =>
        current.filter((existing) => existing.id !== item.id),
      )

      await removeDownload(item.id)
    },
    [removeDownload],
  )

  return (
    <div className={`app-shell${showCollapsedPlayer ? " has-player" : ""}`}>
      <audio
        ref={audio.audioRef}
        preload="metadata"
        onPlay={audio.handlePlay}
        onPause={audio.handlePause}
        onTimeUpdate={(event) =>
          audio.handleTimeUpdate(event.currentTarget.currentTime)
        }
        onLoadedMetadata={(event) =>
          audio.handleLoadedMetadata(event.currentTarget.duration)
        }
        onEnded={audio.handleEnded}
      />

      <header className="app-header">
        <div className="app-logo" aria-label="Plav" />
        <span className="app-version">
          v{APP_VERSION}
        </span>
      </header>

      {page === "home" ? (
        <main className="home-content">
          <div className="home-toolbar">
            <div className="media-switcher" aria-label="Media type">
              <button
                className={`switch-button${mediaType === "audio" ? " active" : ""}`}
                type="button"
                aria-label="Audio"
                onClick={() => setMediaType("audio")}
              >
                <Music2 size={18} strokeWidth={1.8} />
              </button>

              <button
                className={`switch-button${mediaType === "video" ? " active" : ""}`}
                type="button"
                aria-label="Video"
                onClick={() => setMediaType("video")}
              >
                <Video size={18} strokeWidth={1.8} />
              </button>
            </div>

            <button
              className="sort-button"
              type="button"
              aria-label={`Sort: ${SORT_LABELS[sortMode]}. Tap to change.`}
              title={`Sort: ${SORT_LABELS[sortMode]}`}
              onClick={cycleSortMode}
            >
              {(() => {
                const SortIcon = SORT_ICONS[sortMode]
                return <SortIcon size={16} strokeWidth={1.8} />
              })()}
              <span className="sort-button-label">
                {SORT_LABELS[sortMode]}
              </span>
            </button>
          </div>

          <Library
            items={filteredItems}
            currentAudioId={audio.currentItem?.id}
            currentVideoId={video.currentItem?.id}
            offline={offline}
            onPlay={handleLibraryPlay}
            onPlayNext={audio.queueItemNext}
            onUpdateTitle={handleUpdateTitle}
            onDeleteTrack={handleDeleteTrack}
          />
        </main>
      ) : (
        <SettingsView
          version={APP_VERSION}
          offline={offline}
        />
      )}

      {showShuffle && (
        <button
          className="shuffle-button"
          type="button"
          aria-label="Shuffle all"
          onClick={() => void audio.shuffleAll()}
        >
          <Shuffle size={22} strokeWidth={1.9} />
        </button>
      )}

      {showCollapsedPlayer && (
        <CollapsedPlayer
          player={audio}
          onOpen={() => setIsPlayerOpen(true)}
        />
      )}

      {audio.currentItem && isPlayerOpen && !video.currentItem && (
        <PlayerSheet
          player={audio}
          onClose={() => setIsPlayerOpen(false)}
        />
      )}

      <VideoPlayer player={video} />

      <nav className="bottom-nav">
        <button
          className={`nav-button${page === "home" ? " active" : ""}`}
          type="button"
          aria-label="Home"
          onClick={() => openPage("home")}
        >
          <House size={22} strokeWidth={1.8} />
        </button>

        <button
          className={`nav-button${page === "settings" ? " active" : ""}`}
          type="button"
          aria-label="Settings"
          onClick={() => openPage("settings")}
        >
          <Settings size={22} strokeWidth={1.8} />
        </button>
      </nav>
    </div>
  )
}
