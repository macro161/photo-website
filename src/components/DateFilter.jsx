/**
 * Minimal toolbar: a sort toggle and a collapsed date filter.
 *   Sort: Newest ↓            Dates ▾           (collapsed)
 *   Sort: Newest ↓            2026  ×   Dates ▾ (filter active)
 * The panel (From / To + year shortcuts + Clear) opens on demand. Year
 * shortcuts only list years that actually have something in the current view.
 * value = { from: 'YYYY-MM-DD' | '', to: 'YYYY-MM-DD' | '' }
 */
import { useState, useEffect, useRef } from 'react'

const fmt = (iso) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

function summary({ from, to }) {
  if (from && to && from.slice(0, 4) === to.slice(0, 4) && from.endsWith('-01-01') && to.endsWith('-12-31')) {
    return from.slice(0, 4)
  }
  if (from && to) return `${fmt(from)} – ${fmt(to)}`
  if (from) return `from ${fmt(from)}`
  return `until ${fmt(to)}`
}

export default function DateFilter({ value, onChange, years, shown, total, hiddenUndated, sort, onSort }) {
  const { from, to } = value
  const active = Boolean(from || to)
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const set = (patch) => onChange({ ...value, ...patch })
  const clear = () => onChange({ from: '', to: '' })
  const isYear = (y) => from === `${y}-01-01` && to === `${y}-12-31`

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    const onDown = (e) => root.current && !root.current.contains(e.target) && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <div className="toolbar" ref={root}>
      <div className="tb-row">
        {onSort && (
          <button type="button" className="tb-btn" onClick={onSort} aria-label={`Sort by date, currently ${sort === 'oldest' ? 'oldest' : 'newest'} first. Click to reverse.`}>
            {sort === 'oldest' ? 'Oldest first ↑' : 'Newest first ↓'}
          </button>
        )}
        <span className="tb-spacer" />
        {active && (
          <button type="button" className="tb-chip" onClick={clear} aria-label={`Clear date filter ${summary(value)}`}>
            {summary(value)} <span aria-hidden="true">×</span>
          </button>
        )}
        <button
          type="button"
          className={`tb-btn${open ? ' on' : ''}`}
          aria-expanded={open}
          aria-controls="date-filter-panel"
          onClick={() => setOpen((o) => !o)}
        >
          Dates <span aria-hidden="true" className="tb-caret">{open ? '▴' : '▾'}</span>
        </button>
      </div>

      {open && (
        <div className="tb-panel" id="date-filter-panel" role="group" aria-label="Filter by date">
          <div className="df-fields">
            <label>
              <span>From</span>
              <input type="date" value={from} max={to || undefined} onChange={(e) => set({ from: e.target.value })} />
            </label>
            <label>
              <span>To</span>
              <input type="date" value={to} min={from || undefined} onChange={(e) => set({ to: e.target.value })} />
            </label>
          </div>
          {years.length > 0 && (
            <div className="df-presets">
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  className={isYear(y) ? 'on' : ''}
                  aria-pressed={isYear(y)}
                  onClick={() => (isYear(y) ? clear() : onChange({ from: `${y}-01-01`, to: `${y}-12-31` }))}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
          {active && (
            <p className="df-status" role="status">
              Showing {shown} of {total}
              {hiddenUndated > 0 ? ` · ${hiddenUndated} without a date hidden` : ''}
              {' · '}
              <button type="button" className="df-link" onClick={clear}>Clear</button>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
