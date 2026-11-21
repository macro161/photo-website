/** Shown instead of a blank page for unknown links and failed catalog loads. */
export default function NotFound({ title = 'Page not found', message, onHome, onRetry, backLabel = '← Back to catalogs', onBack }) {
  return (
    <section className="empty">
      <h2>{title}</h2>
      <p>{message || "That link doesn't lead anywhere. It may have been renamed or removed."}</p>
      {onRetry && (
        <button className="back-link" onClick={onRetry}>
          Try again
        </button>
      )}
      <button className="back-link" onClick={onBack || onHome}>
        {backLabel}
      </button>
    </section>
  )
}
