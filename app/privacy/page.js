export default function PrivacyPage() {
  return (
    <main className="ut-page ut-legal">
      <div className="ut-shell">
        <div className="ut-legal-hero">
          <h1 className="ut-legal-title">Privacy Policy</h1>
          <p className="ut-legal-sub">
            Your privacy matters. This page explains what the app stores and what it doesn’t.
          </p>

          <div className="ut-legal-chip">Last updated: 23/02/2026</div>
        </div>

        <div className="ut-legal-grid">
          <section className="ut-legal-card">
            <div className="ut-legal-card-head">
              <div className="ut-legal-icon">📄</div>
              <h2>Information We Store</h2>
            </div>
            <ul>
              <li>Your journal entries (saved to your account)</li>
              <li>Mood tags and timestamps</li>
              <li>Your anonymous display name (for public sharing, if you use it)</li>
            </ul>
            <div className="ut-legal-note">
              Tip: Your PIN is <b>device-only</b> and works like a temporary screen lock.
            </div>
          </section>

          <section className="ut-legal-card">
            <div className="ut-legal-card-head">
              <div className="ut-legal-icon">⚡</div>
              <h2>How We Use It</h2>
            </div>
            <div className="ut-legal-stack">
              <div className="ut-legal-pill">
                <b>Emotional journaling</b>
                <span>Save and organize thoughts</span>
              </div>
              <div className="ut-legal-pill">
                <b>Insights</b>
                <span>Mood tracker + streak counters</span>
              </div>
              <div className="ut-legal-pill">
                <b>Anonymous sharing</b>
                <span>Only if you tap “Share”</span>
              </div>
            </div>
          </section>

          <section className="ut-legal-card">
            <div className="ut-legal-card-head">
              <div className="ut-legal-icon">🛡️</div>
              <h2>Security Notes</h2>
            </div>
            <p>
              The in-app PIN is a <b>temporary device-only lock</b> (stored in this browser).
              If you forget it, you can reset it from the lock screen.
            </p>
          </section>

          <section className="ut-legal-card">
            <div className="ut-legal-card-head">
              <div className="ut-legal-icon">📩</div>
              <h2>Contact</h2>
            </div>
            <p className="ut-legal-muted">
              Add your support email later (or a form). For now, keep this simple.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}