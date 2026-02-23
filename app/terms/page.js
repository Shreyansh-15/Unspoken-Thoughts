export default function TermsPage() {
  return (
    <main className="ut-page ut-legal">
      <div className="ut-shell">
        <div className="ut-legal-hero">
          <h1 className="ut-legal-title">Terms of Service</h1>
          <p className="ut-legal-sub">
            Use the app respectfully. You own your content and you control what you share.
          </p>
          <div className="ut-legal-chip">Last updated: 23/02/2026</div>
        </div>

        <div className="ut-legal-grid">
          <section className="ut-legal-card">
            <div className="ut-legal-card-head">
              <div className="ut-legal-icon">✅</div>
              <h2>Acceptable Use</h2>
            </div>
            <ul>
              <li>Don’t post harmful/abusive content to the public feed</li>
              <li>Don’t impersonate others</li>
              <li>Use reporting for unsafe content</li>
            </ul>
          </section>

          <section className="ut-legal-card">
            <div className="ut-legal-card-head">
              <div className="ut-legal-icon">🌍</div>
              <h2>Public Feed</h2>
            </div>
            <p>
              If you share, your post becomes visible to others. You can delete your own public posts.
            </p>
          </section>

          <section className="ut-legal-card">
            <div className="ut-legal-card-head">
              <div className="ut-legal-icon">🔒</div>
              <h2>PIN Lock Disclaimer</h2>
            </div>
            <p>
              PIN is a <b>temporary device-only lock</b>. If forgotten, it can be reset from the lock screen.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}