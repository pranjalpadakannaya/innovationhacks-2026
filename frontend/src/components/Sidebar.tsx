import { LayoutGrid, ArrowLeftRight, Bell } from 'lucide-react'
import { mockChanges } from '../data/mockChanges'
import { portfolio } from '../data/mockPortfolio'

// ── Auto-generate Quarter Signal from live data ──────────────────────────
const allTrends = portfolio.flatMap(d => d.trends)
const tighteningCount = allTrends.filter(t => t.direction === 'tightening').length
const totalTrends = allTrends.length

const payerTightenCount: Record<string, number> = {}
allTrends.filter(t => t.direction === 'tightening').forEach(t => {
  payerTightenCount[t.payerName] = (payerTightenCount[t.payerName] ?? 0) + 1
})
const mostTighteningPayer = Object.entries(payerTightenCount)
  .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Unknown'
const shortMTP = mostTighteningPayer === 'Blue Cross NC' ? 'BCNC'
  : mostTighteningPayer === 'UnitedHealth' ? 'UHC'
  : mostTighteningPayer

const alertCount = mockChanges.filter(c => c.severity === 'HIGH').length
const watchlistItems = mockChanges.filter(c => c.severity !== 'LOW').slice(0, 3)

const changeTypeShort: Record<string, string> = {
  ADDED_STEP_THERAPY:   'Step therapy added',
  ADDED_CRITERION:      'Criterion added',
  MODIFIED_THRESHOLD:   'Threshold changed',
  MODIFIED_WORDING:     'Wording updated',
  MODIFIED_PA_REQUIRED: 'PA status changed',
}

// ── Nav items ─────────────────────────────────────────────────────────────
type NavItem = { id: string; label: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }

const navItems: NavItem[] = [
  { id: 'portfolio', label: 'Overview',      Icon: LayoutGrid },
  { id: 'compare',   label: 'Coverage Matrix', Icon: ArrowLeftRight },
  { id: 'digest',    label: 'Policy Changes', Icon: Bell },
]

interface SidebarProps {
  active: string
  onNavigate: (id: string) => void
}

export function Sidebar({ active, onNavigate }: SidebarProps) {
  return (
    <aside
      className="w-[220px] min-h-screen flex-shrink-0 flex flex-col"
      style={{
        background: '#FFFFFF',
        borderRight: '1px solid #ECEAE4',
      }}
    >
      {/* Wordmark */}
      <div className="flex items-center gap-2.5 px-4 h-14 flex-shrink-0"
        style={{ borderBottom: '1px solid #ECEAE4' }}>
        {/* Mountain mark */}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{ background: '#0E1117' }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="8" fill="#161C26" />
            <path d="M1 9 A8 8 0 0 1 17 9 Z" fill="#7BA8C4" opacity="0.35" />
            <path d="M4 13 L9 5 L14 13 Z" fill="#7BA8C4" />
            <path d="M7 13 L9 8.5 L11 13 Z" fill="rgba(255,255,255,0.12)" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold leading-none tracking-tight">
            <span style={{ color: '#0E1117' }}>ANTON</span>
            <span style={{ color: '#7BA8C4' }}>Rx</span>
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: '#9CA3AF' }}>Policy Intelligence</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="px-3 py-4" style={{ borderBottom: '1px solid #ECEAE4' }}>
        <p className="text-[10px] font-semibold uppercase tracking-widest px-2 mb-2" style={{ color: '#C4C9D1' }}>
          Workspace
        </p>
        <div className="space-y-0.5">
          {navItems.map(({ id, label, Icon }) => {
            const isActive = active === id
            const showBadge = id === 'digest' && alertCount > 0
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm transition-all duration-100"
                style={{
                  background: isActive ? '#EBF4FA' : 'transparent',
                  color: isActive ? '#2D6A90' : '#374151',
                  boxShadow: isActive ? 'inset 2px 0 0 #7BA8C4' : 'none',
                  fontWeight: isActive ? 500 : 400,
                }}
                onMouseEnter={e => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = '#F9F8F5'
                }}
                onMouseLeave={e => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                }}
              >
                <div className="flex items-center gap-2.5">
                  <Icon size={14} strokeWidth={isActive ? 2 : 1.5} />
                  <span>{label}</span>
                </div>
                {showBadge && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: '#FEE2E2', color: '#DC2626' }}>
                    {alertCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Quarter Signal */}
      <div className="px-4 py-4" style={{ borderBottom: '1px solid #ECEAE4' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#9CA3AF' }}>
          Quarter Signal
        </p>
        <p className="text-sm font-bold leading-snug mb-1.5" style={{ color: '#0E1117' }}>
          {alertCount} high-impact changes
        </p>
        <p className="text-xs leading-relaxed" style={{ color: '#6B7280' }}>
          {tighteningCount} of {totalTrends} payer trends tightening.{' '}
          <span style={{ color: '#0E1117', fontWeight: 500 }}>{shortMTP}</span> adding the most restrictions this quarter.
        </p>
      </div>

      {/* Watchlist */}
      <div className="px-4 py-4 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: '#9CA3AF' }}>
          Watchlist
        </p>
        <ul className="space-y-2.5">
          {watchlistItems.map((item, i) => {
            const dotColor = item.severity === 'HIGH' ? '#DC2626' : '#D97706'
            return (
              <li key={i} className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: '#374151' }}>
                <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: dotColor }} />
                <span>
                  <span style={{ fontWeight: 500 }}>{item.payer}</span>{' '}
                  {changeTypeShort[item.change_type] ?? 'policy updated'} — {item.drug}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Footer */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid #ECEAE4' }}>
        <p className="text-[10px] font-mono" style={{ color: '#C4C9D1' }}>
          {portfolio.length} products · Q1 2026
        </p>
      </div>
    </aside>
  )
}
