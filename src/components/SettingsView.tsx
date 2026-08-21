import { APP_VERSION } from "../appInfo"
import "./SettingsView.css"

export function SettingsView() {
  return (
    <main className="settings-content">
      <div className="settings-header">
        <h1 className="settings-title">
          Settings
        </h1>
      </div>

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
              Local media player
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
