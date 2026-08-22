import { useCallback, useEffect, useMemo, useState } from "react"
import { House, Music2, Settings, Shuffle, Video } from "lucide-react"

import { useAudioPlayer } from "./audio"
import { fetchTracks, type MediaItem, type MediaType } from "./media"
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

export default function App() {
  const [page, setPage] = useState<Page>("home")
  const [mediaType, setMediaType] = useState<MediaType>("audio")
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [isPlayerOpen, setIsPlayerOpen] = useState(false)

  const offline = useOfflineMedia(mediaItems)
  const audio = useAudioPlayer(mediaItems)
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
    () => mediaItems.filter((item) => item.type === mediaType),
    [mediaItems, mediaType],
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

          <Library
            items={filteredItems}
            currentAudioId={audio.currentItem?.id}
            currentVideoId={video.currentItem?.id}
            offline={offline}
            onPlay={handleLibraryPlay}
            onPlayNext={audio.queueItemNext}
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
