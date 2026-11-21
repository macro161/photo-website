/**
 * Date-range filter: From / To date inputs plus year shortcuts.
 * value = { from: 'YYYY-MM-DD' | '', to: 'YYYY-MM-DD' | '' }
 */
import { yearsWithDates } from '../dates.js'

const years = yearsWithDates()

export default function DateFilter({ value, onChange, shown, total, hiddenUndated }) {
  const { from, to } = value
  const active = Boolean(from || to)
  const set = (patch) => onChange({ ...value, ...patch })
  const isYear = (y) => from === `${y}-01-01` && to === `${y}-12-31`

  return (
    <div className="date-filter" role="group" aria-label="Filter by date">
      <div className="df-fields">
        <label>
          <span>From</span>
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => set({ from: e.target.value })}
          />
        </label>
        <label>
          <span>To</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => set({ to: e.target.value })}
          />
        </label>
      </div>
      <div className="df-presets">
        {years.map((y) => (
          <button
            key={y}
            type="button"
            className={isYear(y) ? 'on' : ''}
            aria-pressed={isYear(y)}
            onClick={() => onChange(isYear(y) ? { from: '', to: '' } : { from: `${y}-01-01`, to: `${y}-12-31` })}
          >
            {y}
          </button>
        ))}
        {active && (
          <button type="button" className="df-clear" onClick={() => onChange({ from: '', to: '' })}>
            Clear
          </button>
        )}
      </div>
      {active && (
        <p className="df-status" role="status">
          Showing {shown} of {total}
          {hiddenUndated > 0 ? ` · ${hiddenUndated} without a date hidden` : ''}
        </p>
      )}
    </div>
  )
}
