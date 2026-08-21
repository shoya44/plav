import { useEffect, useState } from "react"
import { House, Music2, Settings, Shuffle, Video } from "lucide-react"

import { useAudioPlayer } from "./audio"
import { fetchTracks, type MediaItem, type MediaType } from "./media"
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

  const audio = useAudioPlayer(mediaItems)
  const video = useVideoPlayer()

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

  const filteredItems = mediaItems.filter((item) => item.type === mediaType)
  const showCollapsedPlayer = Boolean(audio.currentItem) && !video.currentItem
  const showShuffle =
    page === "home" &&
    mediaType === "audio" &&
    !isPlayerOpen &&
    !video.currentItem

  const openPage = (nextPage: Page) => {
    setIsPlayerOpen(false)
    video.close()
    setPage(nextPage)
  }

  const playMedia = async (item: MediaItem) => {
    if (item.type === "audio") {
      video.close()
      await audio.playItem(item)
      return
    }

    audio.pause()
    setIsPlayerOpen(false)
    await video.playItem(item)
  }

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
            onPlay={(item) => void playMedia(item)}
          />
        </main>
      ) : (
        <SettingsView version={APP_VERSION} />
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
