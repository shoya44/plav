import { useCallback, useEffect, useState } from "react"

import {
  fetchCloudStorageUsage,
  formatStorage,
  type CloudStorageUsage,
} from "../cloud"
import type { OfflineMediaController } from "../offline"

type Props = {
  version: string
  offline: OfflineMediaController
}

function getStorageStatus(percent: number) {
  if (percent >= 100) return "Over limit"
  if (percent >= 80) return "Near limit"
  return "OK"
}

function getStorageTone(percent: number) {
  if (percent >= 100) return " danger"
  if (percent >= 80) return " warning"
  return ""
}

export function Settings({ version, offline }: Props) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateError, setUpdateError] = useState("")
  const [cloudUsage, setCloudUsage] =
    useState<CloudStorageUsage | null>(null)
  const [isCloudLoading, setIsCloudLoading] = useState(false)
  const [cloudError, setCloudError] = useState("")

  const loadCloudUsage = useCallback(async (force = false) => {
    if (isCloudLoading) return

    setIsCloudLoading(true)
    setCloudError("")

    try {
      setCloudUsage(await fetchCloudStorageUsage(force))
    } catch (error) {
      console.error("クラウド容量の取得に失敗しました:", error)
      setCloudError("Unavailable")
    } finally {
      setIsCloudLoading(false)
    }
  }, [isCloudLoading])

  useEffect(() => {
    void loadCloudUsage()
  }, [])

  const updateToLatest = async () => {
    if (isUpdating) return

    setIsUpdating(true)
    setUpdateError("")

    try {
      const updateUrl = new URL("/", window.location.origin)
      updateUrl.searchParams.set(
        "_plav_update",
        Date.now().toString(),
      )

      // Cache Storageの保存曲は消さず、最新index.htmlだけをno-storeで確認する。
      const response = await fetch(updateUrl, {
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error(
          `Update check failed: ${response.status}`,
        )
      }

      window.location.replace(updateUrl.toString())
    } catch (error) {
      console.error("Plavの更新確認に失敗しました:", error)
      setUpdateError("Update failed")
      setIsUpdating(false)
    }
  }

  const cloudPercent = cloudUsage?.usagePercent ?? 0
  const cloudTone = getStorageTone(cloudPercent)

  return (
    <main className="settings-content">
      <div className="settings-header">
        <h1 className="settings-title">
          Settings
        </h1>

        <p className="settings-subtitle">
          Plav preferences and app information
        </p>
      </div>

      <section className="settings-section">
        <h2 className="settings-section-title">
          Playback
        </h2>

        <div className="settings-group">
          <div className="settings-row">
            <span className="settings-row-label">
              Continuous playback
            </span>

            <span className="settings-row-value">
              Enabled
            </span>
          </div>

          <div className="settings-divider" />

          <div className="settings-row">
            <span className="settings-row-label">
              History
            </span>

            <span className="settings-row-value">
              Session only
            </span>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">
          Downloads
        </h2>

        <div className="settings-group">
          <div className="settings-row">
            <span className="settings-row-label">
              Auto save
            </span>

            <button
              className={`settings-switch${offline.autoDownload ? " active" : ""}`}
              type="button"
              role="switch"
              aria-checked={offline.autoDownload}
              aria-label="Auto save"
              disabled={!offline.isSupported}
              onClick={() =>
                offline.setAutoDownload(!offline.autoDownload)
              }
            >
              <span className="settings-switch-knob" />
            </button>
          </div>

          <div className="settings-divider" />

          <div className="settings-row">
            <span className="settings-row-label">
              Saved
            </span>

            <span className="settings-row-value">
              {offline.isSupported
                ? `${offline.downloadedCount} / ${offline.totalCount}`
                : "Unavailable"}
            </span>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">
          Cloud
        </h2>

        <div className="settings-group">
          <button
            className="settings-cloud-row"
            type="button"
            disabled={isCloudLoading}
            onClick={() => void loadCloudUsage(true)}
          >
            <span className="settings-row-label">
              R2 storage
            </span>

            <span className={`settings-cloud-value${cloudTone}`}>
              {isCloudLoading && !cloudUsage
                ? "Checking..."
                : cloudError
                  ? cloudError
                  : cloudUsage
                    ? `${formatStorage(cloudUsage.usedBytes)} / ${formatStorage(cloudUsage.freeTierBytes)}`
                    : "—"}
            </span>
          </button>

          {cloudUsage && (
            <>
              <div className="settings-storage-meter-wrap">
                <div className="settings-storage-meter">
                  <span
                    className={`settings-storage-meter-fill${cloudTone}`}
                    style={{
                      width: `${Math.min(
                        Math.max(cloudPercent, 0),
                        100,
                      )}%`,
                    }}
                  />
                </div>

                <div className="settings-storage-meta">
                  <span>
                    {cloudPercent.toFixed(1)}% · {getStorageStatus(cloudPercent)}
                  </span>
                  <span>
                    {cloudUsage.objectCount} files
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <p className="settings-storage-note">
          Current R2 snapshot. Tap to refresh. Free tier reference: 10 GB-month (Standard).
        </p>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">
          App
        </h2>

        <div className="settings-group">
          <div className="settings-row">
            <span className="settings-row-label">
              Version
            </span>

            <span className="settings-row-value">
              v{version}
            </span>
          </div>

          <div className="settings-divider" />

          <button
            className="settings-update-row"
            type="button"
            disabled={isUpdating}
            onClick={() => void updateToLatest()}
          >
            <span className="settings-row-label">
              Update app
            </span>

            <span className="settings-update-value">
              {isUpdating
                ? "Checking..."
                : "Load latest"}
            </span>
          </button>
        </div>

        {updateError && (
          <p className="settings-update-error">
            {updateError}
          </p>
        )}
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">
          About
        </h2>

        <div className="settings-group">
          <div className="settings-row">
            <span className="settings-row-label">
              Plav
            </span>

            <span className="settings-row-value">
              Personal media player
            </span>
          </div>
        </div>
      </section>
    </main>
  )
}
