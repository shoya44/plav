
const APP_VERSION = "0.1.0"

export function Settings() {
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

          <div className="settings-divider" />

          <div className="settings-row">
            <span className="settings-row-label">
              Version
            </span>

            <span className="settings-row-value">
              {APP_VERSION}
            </span>
          </div>
        </div>
      </section>
    </main>
  )
}
