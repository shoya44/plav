import { useState } from "react"
import {
  House,
  Music2,
  Settings,
  Shuffle,
  Video,
} from "lucide-react"

import { DetailSheet } from "./components/DetailSheet"
import { ExpandedPlayer } from "./components/ExpandedPlayer"
import { MediaRow } from "./components/MediaRow"
import { MiniPlayer } from "./components/MiniPlayer"
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

type Page =
  | "home"
  | "settings"

function App() {
  // Screen state
  const [page, setPage] =
    useState<Page>("home")

  // Home always starts with Audio.
  const [
    mediaType,
    setMediaType,
  ] =
    useState<MediaType>(
      "audio"
    )

  const [
    isPlayerExpanded,
    setIsPlayerExpanded,
  ] = useState(false)

  const [
    detailItem,
    setDetailItem,
  ] =
    useState<
      MediaItem | null
    >(null)

  // Playback
  const audioPlayer =
    useAudioPlayer(
      mediaItems
    )

  const videoPlayer =
    useVideoPlayer()

  // Home data
  const filteredItems =
    mediaItems.filter(
      (item) =>
        item.type ===
        mediaType
    )

  const showAudioMiniPlayer =
    Boolean(
      audioPlayer.currentItem
    ) &&
    !videoPlayer.currentItem

  const showShuffle =
    page === "home" &&
    mediaType === "audio" &&
    !isPlayerExpanded &&
    !videoPlayer.currentItem

  const openPage = (
    nextPage: Page
  ) => {
    setDetailItem(null)
    setIsPlayerExpanded(false)

    if (
      videoPlayer.currentItem
    ) {
      videoPlayer.close()
    }

    setPage(nextPage)
  }

  const playMedia = async (
    item: MediaItem
  ) => {
    setDetailItem(null)

    if (
      item.type === "audio"
    ) {
      if (
        videoPlayer.currentItem
      ) {
        videoPlayer.close()
      }

      await audioPlayer
        .playItem(item)

      return
    }

    if (item.url) {
      audioPlayer.pause()
      setIsPlayerExpanded(false)
    }

    await videoPlayer
      .playItem(item)
  }

  return (
    <div
      className={`app-shell${
        showAudioMiniPlayer
          ? " has-player"
          : ""
      }`}
    >
      {/* Audio Playback Engine */}
      <audio
        ref={audioPlayer.audioRef}
        onPlay={audioPlayer.handlePlay}
        onPause={audioPlayer.handlePause}
        onTimeUpdate={(event) =>
          audioPlayer.handleTimeUpdate(
            event.currentTarget.currentTime
          )
        }
        onLoadedMetadata={(event) =>
          audioPlayer.handleLoadedMetadata(
            event.currentTarget.duration
          )
        }
        onEnded={audioPlayer.handleEnded}
      />

      {/* Header */}
      <header className="app-header">
        <div
          className="app-logo"
          aria-label="Plav"
        >
          P
        </div>
      </header>

      {/* Main Screen */}
      {page === "home" ? (
        <main className="home-content">
          <div
            className="media-switcher"
            aria-label="Media type"
          >
            <button
              className={`switch-button${
                mediaType === "audio"
                  ? " active"
                  : ""
              }`}
              aria-label="Audio"
              onClick={() =>
                setMediaType("audio")
              }
            >
              <Music2
                size={18}
                strokeWidth={1.8}
              />
            </button>

            <button
              className={`switch-button${
                mediaType === "video"
                  ? " active"
                  : ""
              }`}
              aria-label="Video"
              onClick={() =>
                setMediaType("video")
              }
            >
              <Video
                size={18}
                strokeWidth={1.8}
              />
            </button>
          </div>

          <div className="media-list">
            {filteredItems.map(
              (item) => (
                <MediaRow
                  key={item.id}
                  item={item}
                  isPlaying={
                    item.type === "audio"
                      ? audioPlayer
                          .currentItem
                          ?.id === item.id
                      : videoPlayer
                          .currentItem
                          ?.id === item.id
                  }
                  onPlay={() =>
                    void playMedia(item)
                  }
                  onShowDetail={() =>
                    setDetailItem(item)
                  }
                />
              )
            )}
          </div>
        </main>
      ) : (
        <SettingsView />
      )}

      {/* Home Action */}
      {showShuffle && (
        <button
          className="shuffle-button"
          aria-label="Shuffle all"
          type="button"
          onClick={() =>
            void audioPlayer.shuffleAll()
          }
        >
          <Shuffle
            size={22}
            strokeWidth={1.9}
          />
        </button>
      )}

      {/* Audio Players */}
      {showAudioMiniPlayer && (
        <MiniPlayer
          player={audioPlayer}
          onOpen={() =>
            setIsPlayerExpanded(true)
          }
        />
      )}

      {audioPlayer.currentItem &&
        isPlayerExpanded &&
        !videoPlayer.currentItem && (
          <ExpandedPlayer
            player={audioPlayer}
            onClose={() =>
              setIsPlayerExpanded(false)
            }
          />
        )}

      {/* Video Player */}
      <VideoPlayer player={videoPlayer} />

      {/* Detail */}
      {detailItem && (
        <DetailSheet
          item={detailItem}
          onClose={() =>
            setDetailItem(null)
          }
        />
      )}

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <button
          className={`nav-button${
            page === "home"
              ? " active"
              : ""
          }`}
          aria-label="Home"
          type="button"
          onClick={() =>
            openPage("home")
          }
        >
          <House
            size={22}
            strokeWidth={1.8}
          />
        </button>

        <button
          className={`nav-button${
            page === "settings"
              ? " active"
              : ""
          }`}
          aria-label="Settings"
          type="button"
          onClick={() =>
            openPage("settings")
          }
        >
          <Settings
            size={22}
            strokeWidth={1.8}
          />
        </button>
      </nav>
    </div>
  )
}

export default App
