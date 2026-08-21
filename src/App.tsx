import { useState } from "react"
import {
  House,
  Music2,
  Settings,
  Shuffle,
  Video,
} from "lucide-react"

import { CollapsedPlayer } from "./components/CollapsedPlayer"
import { DetailSheet } from "./components/DetailSheet"
import { MediaRow } from "./components/MediaRow"
import { PlayerSheet } from "./components/PlayerSheet"
import { SettingsView } from "./components/SettingsView"
import { VideoPlayer } from "./components/VideoPlayer"
import { useAudioPlayer } from "./hooks/useAudioPlayer"
import { useVideoPlayer } from "./hooks/useVideoPlayer"
import {
  mediaItems,
  type MediaItem,
  type MediaType,
} from "./media"
import "./App.css"

type Page = "home" | "settings"

function App() {
  const [page, setPage] = useState<Page>("home")
  const [mediaType, setMediaType] = useState<MediaType>("audio")
  const [isPlayerOpen, setIsPlayerOpen] = useState(false)
  const [detailItem, setDetailItem] = useState<MediaItem | null>(null)

  const audioPlayer = useAudioPlayer(mediaItems)
  const videoPlayer = useVideoPlayer()

  const filteredItems = mediaItems.filter(
    (item) => item.type === mediaType
  )

  const showCollapsedPlayer =
    Boolean(audioPlayer.currentItem) && !videoPlayer.currentItem

  const showShuffle =
    page === "home" &&
    mediaType === "audio" &&
    !isPlayerOpen &&
    !videoPlayer.currentItem

  const openPage = (nextPage: Page) => {
    setDetailItem(null)
    setIsPlayerOpen(false)

    if (videoPlayer.currentItem) {
      videoPlayer.close()
    }

    setPage(nextPage)
  }

  const playMedia = async (item: MediaItem) => {
    setDetailItem(null)

    if (item.type === "audio") {
      if (videoPlayer.currentItem) {
        videoPlayer.close()
      }

      await audioPlayer.playItem(item)
      return
    }

    if (item.url) {
      audioPlayer.pause()
      setIsPlayerOpen(false)
    }

    await videoPlayer.playItem(item)
  }

  return (
    <div className={`app-shell${showCollapsedPlayer ? " has-player" : ""}`}>
      {/* Audio Playback Engine */}
      <audio
        ref={audioPlayer.audioRef}
        onPlay={audioPlayer.handlePlay}
        onPause={audioPlayer.handlePause}
        onTimeUpdate={(event) =>
          audioPlayer.handleTimeUpdate(event.currentTarget.currentTime)
        }
        onLoadedMetadata={(event) =>
          audioPlayer.handleLoadedMetadata(event.currentTarget.duration)
        }
        onVolumeChange={audioPlayer.handleVolumeChange}
        onEnded={audioPlayer.handleEnded}
      />

      <header className="app-header">
        <div className="app-logo" aria-label="Plav">
          P
        </div>
      </header>

      {page === "home" ? (
        <main className="home-content">
          <div className="media-switcher" aria-label="Media type">
            <button
              className={`switch-button${mediaType === "audio" ? " active" : ""}`}
              aria-label="Audio"
              onClick={() => setMediaType("audio")}
            >
              <Music2 size={18} strokeWidth={1.8} />
            </button>

            <button
              className={`switch-button${mediaType === "video" ? " active" : ""}`}
              aria-label="Video"
              onClick={() => setMediaType("video")}
            >
              <Video size={18} strokeWidth={1.8} />
            </button>
          </div>

          <div className="media-list">
            {filteredItems.map((item) => (
              <MediaRow
                key={item.id}
                item={item}
                isPlaying={
                  item.type === "audio"
                    ? audioPlayer.currentItem?.id === item.id
                    : videoPlayer.currentItem?.id === item.id
                }
                onPlay={() => void playMedia(item)}
                onShowDetail={() => setDetailItem(item)}
              />
            ))}
          </div>
        </main>
      ) : (
        <SettingsView />
      )}

      {showShuffle && (
        <button
          className="shuffle-button"
          aria-label="Shuffle all"
          type="button"
          onClick={() => void audioPlayer.shuffleAll()}
        >
          <Shuffle size={22} strokeWidth={1.9} />
        </button>
      )}

      {showCollapsedPlayer && (
        <CollapsedPlayer
          player={audioPlayer}
          onOpen={() => setIsPlayerOpen(true)}
        />
      )}

      {audioPlayer.currentItem &&
        isPlayerOpen &&
        !videoPlayer.currentItem && (
          <PlayerSheet
            player={audioPlayer}
            onClose={() => setIsPlayerOpen(false)}
          />
        )}

      <VideoPlayer player={videoPlayer} />

      {detailItem && (
        <DetailSheet
          item={detailItem}
          onClose={() => setDetailItem(null)}
        />
      )}

      <nav className="bottom-nav">
        <button
          className={`nav-button${page === "home" ? " active" : ""}`}
          aria-label="Home"
          type="button"
          onClick={() => openPage("home")}
        >
          <House size={22} strokeWidth={1.8} />
        </button>

        <button
          className={`nav-button${page === "settings" ? " active" : ""}`}
          aria-label="Settings"
          type="button"
          onClick={() => openPage("settings")}
        >
          <Settings size={22} strokeWidth={1.8} />
        </button>
      </nav>
    </div>
  )
}

export default App
