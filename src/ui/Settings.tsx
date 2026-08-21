import { useState } from "react"

type Props = {
  version: string
}

export function Settings({ version }: Props) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateError, setUpdateError] = useState("")

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

      // 同じURLのHTTPキャッシュを避け、最新index.htmlが取得できることを
      // 確認してからPWA全体を再読込する。
      const response = await fetch(updateUrl, {
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error(
          `Update check failed: ${response.status}`,
        )
      }

      // 将来Service Workerを追加した場合にも古いCache Storageを
      // 引きずらないよう、利用可能な環境だけ削除する。
      if ("caches" in window) {
        try {
          const cacheNames = await window.caches.keys()
          await Promise.all(
            cacheNames.map((name) =>
              window.caches.delete(name),
            ),
          )
        } catch {
          // iOSの設定等でCache APIが使えない場合は無視する。
        }
      }

      window.location.replace(updateUrl.toString())
    } catch (error) {
      console.error("Plavの更新確認に失敗しました:", error)
      setUpdateError("Update failed")
      setIsUpdating(false)
    }
  }

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
          Home
        </h2>

        <div className="settings-group">
          <div className="settings-row">
            <span className="settings-row-label">
              Default view
            </span>

            <span className="settings-row-value">
              Audio
            </span>
          </div>
        </div>
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
