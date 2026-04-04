import { useState } from 'react'
import { motion } from 'framer-motion'
import type { DrugPortfolioEntry } from '../data/mockPortfolio'
import { computeStringency } from '../lib/stringency'
import { mockChanges } from '../data/mockChanges'
import { SparkLine } from './SparkLine'
import { CoverageHeatmap } from './CoverageHeatmap'
import { RecentChangeFeed } from './RecentChangeFeed'

interface PortfolioViewProps {
  portfolio: DrugPortfolioEntry[]
  onSelectDrug: (id: string) => void
}

function shortPayer(name: string) {
  if (name === 'Blue Cross NC') return 'BCNC'
  if (name === 'UnitedHealth')  return 'UHC'
  return name
}

// ── Stat card data ─────────────────────────────────────────────────────────
function buildStats(portfolio: DrugPortfolioEntry[]) {
  const policiesTracked  = portfolio.length * 3
  const payersMonitored  = 3
  const highImpact       = mockChanges.filter(c => c.severity === 'HIGH').length
  const tighteningCount  = portfolio.flatMap(d => d.trends).filter(t => t.direction === 'tightening').length
  const looseningCount   = portfolio.flatMap(d => d.trends).filter(t => t.direction === 'loosening').length
  const outlierPolicies  = portfolio.flatMap(d => d.trends).filter(t => Math.abs(t.delta) > 8).length

  return [
    {
      label: 'Policies Tracked',
      value: policiesTracked,
      sub: `+0 this quarter`,
    },
    {
      label: 'Payers Monitored',
      value: payersMonitored,
      sub: 'Commercial + Medicare LCDs',
    },
    {
      label: 'High-Impact Changes',
      value: highImpact,
      sub: `${tighteningCount} tightening, ${looseningCount} loosening`,
      highlight: highImpact > 0,
    },
    {
      label: 'Outlier Policies',
      value: outlierPolicies,
      sub: 'Unique restrictions flagged',
    },
  ]
}

// ── Drug card ──────────────────────────────────────────────────────────────
const stagger = {
  container: { transition: { staggerChildren: 0.05 } },
  item: { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.18, ease: 'easeOut' } },
}

function DrugCard({ drug, onSelect }: { drug: DrugPortfolioEntry; onSelect: () => void }) {
  const scores   = drug.policies.map(p => computeStringency(p))
  const maxScore = Math.max(...scores.map(s => s.score))
  const maxColor = maxScore >= 70 ? '#DC2626' : maxScore >= 40 ? '#D97706' : '#10A090'

  return (
    <motion.button
      variants={stagger.item}
      onClick={onSelect}
      className="text-left rounded-xl border p-5 transition-all duration-200 group w-full"
      style={{ background: '#fff', borderColor: '#E5E2DC' }}
      whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(14,17,23,0.08)', borderColor: '#7BA8C4' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="font-bold text-base leading-tight group-hover:text-[#2D6A90] transition-colors"
            style={{ color: '#0E1117' }}>{drug.brandName}</p>
          <p className="text-xs mt-0.5 font-mono" style={{ color: '#9CA3AF' }}>
            {drug.genericName} · {drug.jCode}
          </p>
        </div>
        {drug.changeCount > 0 && (
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums leading-none" style={{ color: '#DC2626' }}>
              {drug.changeCount}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: '#9CA3AF' }}>changes</p>
          </div>
        )}
      </div>

      {/* Class pill */}
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full mt-2 mb-4"
        style={{ background: '#EBF4FA', color: '#2D6A90' }}>
        <span className="w-1 h-1 rounded-full" style={{ background: '#7BA8C4' }} />
        {drug.drugClass}
      </span>

      {/* PA burden bars */}
      <div className="space-y-1.5 mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#C4C9D1' }}>PA Burden</p>
        {drug.policies.map(p => {
          const paCount = p.indications.filter(i => i.pa_required).length
          const pct = Math.round((paCount / p.indications.length) * 100)
          const barColor = pct > 70 ? '#DC2626' : pct > 40 ? '#D97706' : '#10A090'
          return (
            <div key={p.payer.name} className="flex items-center gap-2">
              <span className="text-[10px] font-mono w-9 flex-shrink-0" style={{ color: '#9CA3AF' }}>
                {shortPayer(p.payer.name)}
              </span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#EEE9E1' }}>
                <motion.div className="h-full rounded-full" style={{ background: barColor }}
                  initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }} />
              </div>
              <span className="text-[10px] tabular-nums w-7 text-right" style={{ color: '#6B7280' }}>{pct}%</span>
            </div>
          )
        })}
      </div>

      {/* Trend sparklines */}
      <div className="pt-3 mb-3" style={{ borderTop: '1px solid #F0EDE7' }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#C4C9D1' }}>
          Trend (4Q)
        </p>
        <div className="flex gap-3 flex-wrap">
          {drug.trends.map(t => {
            const tColor = t.direction === 'tightening' ? '#DC2626'
              : t.direction === 'loosening' ? '#10A090' : '#9CA3AF'
            const arrow = t.direction === 'tightening' ? '↑' : t.direction === 'loosening' ? '↓' : '→'
            return (
              <div key={t.payerName} className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono" style={{ color: '#9CA3AF' }}>{shortPayer(t.payerName)}</span>
                <SparkLine data={t.history.map(h => h.score)} color={tColor} width={44} height={18} />
                <span className="text-[10px] font-bold" style={{ color: tColor }}>{arrow}{Math.abs(t.delta)}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2.5" style={{ borderTop: '1px solid #F0EDE7' }}>
        <p className="text-[10px]" style={{ color: '#9CA3AF' }}>{drug.livesAtRisk}</p>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: maxColor }} />
          <span className="text-xs" style={{ color: '#6B7280' }}>
            Max <span className="font-bold tabular-nums" style={{ color: maxColor }}>{maxScore}</span>
          </span>
        </div>
      </div>
    </motion.button>
  )
}

// ── Main view ──────────────────────────────────────────────────────────────
export function PortfolioView({ portfolio, onSelectDrug }: PortfolioViewProps) {
  const [search, setSearch] = useState('')
  const stats = buildStats(portfolio)

  const filtered = portfolio.filter(d =>
    d.brandName.toLowerCase().includes(search.toLowerCase()) ||
    d.genericName.toLowerCase().includes(search.toLowerCase()) ||
    d.drugClass.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex-1 flex flex-col min-h-screen" style={{ background: '#F2EFE9' }}>
      <div className="px-8 py-6 max-w-[1200px] w-full space-y-6">

        {/* ── 4 Stat cards ── */}
        <div className="grid grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.18 }}
              className="rounded-xl p-5"
              style={{ background: '#fff', border: '1px solid #E5E2DC' }}
            >
              <p className="text-xs mb-3" style={{ color: '#9CA3AF' }}>{stat.label}</p>
              <p className="text-3xl font-bold tabular-nums leading-none mb-1.5"
                style={{ color: stat.highlight ? '#DC2626' : '#0E1117' }}>
                {stat.value}
              </p>
              <p className="text-[11px]" style={{ color: '#9CA3AF' }}>{stat.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* ── Heatmap + Change feed split ── */}
        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 340px' }}>
          <CoverageHeatmap portfolio={portfolio} onSelectDrug={onSelectDrug} />
          <RecentChangeFeed changes={mockChanges} />
        </div>

        {/* ── Drug cards ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#9CA3AF' }}>
                Drug Portfolio
              </p>
              <p className="text-sm font-semibold" style={{ color: '#0E1117' }}>
                {portfolio.length} products tracked
              </p>
            </div>
            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border brand-focus"
              style={{ borderColor: '#E5E2DC', background: '#fff' }}>
              <span style={{ color: '#C4C9D1' }}>⌕</span>
              <input
                className="bg-transparent outline-none text-sm w-48"
                style={{ color: '#0E1117' }}
                placeholder="Search…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <motion.div
            className="grid grid-cols-3 gap-4"
            variants={stagger.container}
            initial="initial"
            animate="animate"
          >
            {filtered.map(drug => (
              <DrugCard key={drug.id} drug={drug} onSelect={() => onSelectDrug(drug.id)} />
            ))}
            <motion.div
              variants={stagger.item}
              className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-8 min-h-[200px]"
              style={{ borderColor: '#E5E2DC' }}
            >
              <p className="text-2xl mb-2" style={{ color: '#D1CEC8' }}>+</p>
              <p className="text-sm font-medium" style={{ color: '#9CA3AF' }}>Add product</p>
              <p className="text-xs mt-1 text-center" style={{ color: '#C4C9D1' }}>
                Upload a policy PDF to begin tracking
              </p>
            </motion.div>
          </motion.div>
        </div>

      </div>
    </div>
  )
}
