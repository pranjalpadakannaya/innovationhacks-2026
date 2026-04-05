import { motion } from 'framer-motion'
import type { ChangeEntry } from '../types/policy'

interface ChangeDigestProps {
  changes: ChangeEntry[]
}

const severityConfig = {
  HIGH: { accent: '#DC2626', label: 'HIGH' },
  MED:  { accent: '#D97706', label: 'MED' },
  LOW:  { accent: '#6B7583', label: 'LOW' },
}

const changeTypeLabels: Record<string, string> = {
  ADDED_STEP_THERAPY:   'Step therapy added',
  ADDED_CRITERION:      'Criterion added',
  REMOVED_CRITERION:    'Criterion removed',
  MODIFIED_THRESHOLD:   'Threshold changed',
  MODIFIED_WORDING:     'Wording updated',
  MODIFIED_PA_REQUIRED: 'PA status changed',
  ADDED_INDICATION:     'Indication added',
  REMOVED_INDICATION:   'Indication removed',
}

const criterionChipColors: Record<string, { bg: string; text: string }> = {
  step_therapy:            { bg: '#FEF3C7', text: '#92400E' },
  combination_restriction: { bg: '#EDE9FE', text: '#5B21B6' },
  prior_therapy:           { bg: '#FEF9C3', text: '#713F12' },
  line_of_therapy:         { bg: '#EBF4FA', text: '#2D6A90' },
  disease_severity:        { bg: '#FEE2E2', text: '#B91C1C' },
  lab_value:               { bg: '#D0F4F1', text: '#0A6B62' },
  diagnosis:               { bg: '#F1F5F9', text: '#475569' },
  prescriber:              { bg: '#DCFCE7', text: '#166534' },
  clinical_response:       { bg: '#CCFBF1', text: '#0F766E' },
  other:                   { bg: '#F8FAFC', text: '#64748B' },
}

export function ChangeDigest({ changes }: ChangeDigestProps) {
  const highCount  = changes.filter(c => c.severity === 'HIGH').length
  const payerCount = new Set(changes.map(c => c.payer)).size

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#2D6A90' }}>
            Policy Surveillance
          </p>
          <p className="text-sm font-semibold" style={{ color: '#0E1117' }}>Q1 2026 — Policy Changes</p>
          <p className="text-xs mt-1" style={{ color: '#6B7583' }}>
            {changes.length} changes across {payerCount} payer{payerCount !== 1 ? 's' : ''}
            {highCount > 0 && (
              <span className="ml-2 font-semibold" style={{ color: '#DC2626' }}>
                · {highCount} high-severity
              </span>
            )}
          </p>
        </div>
        <button className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
          style={{ borderColor: '#E2E7EF', color: '#6B7583', background: '#fff' }}>
          Subscribe to alerts
        </button>
      </div>

      {/* Count chips */}
      <div className="flex gap-2">
        {(['HIGH', 'MED', 'LOW'] as const).map(sev => {
          const count = changes.filter(c => c.severity === sev).length
          const cfg = severityConfig[sev]
          return (
            <div key={sev} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: '#fff', border: '1px solid #E2E7EF', color: cfg.accent }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.accent }} />
              {count} {cfg.label}
            </div>
          )
        })}
      </div>

      {/* Change entries */}
      <div className="space-y-2.5">
        {changes.map((change, i) => {
          const cfg = severityConfig[change.severity]
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.15, ease: 'easeOut' }}
              className="rounded-lg overflow-hidden"
              style={{
                background: '#fff',
                border: '1px solid #E2E7EF',
                borderLeft: `3px solid ${cfg.accent}`,
              }}
            >
              <div className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-[10px] font-bold tracking-wider" style={{ color: cfg.accent }}>
                        {cfg.label}
                      </span>
                      <span style={{ color: '#D0D9E4' }}>·</span>
                      <span className="text-xs font-semibold" style={{ color: '#0E1117' }}>{change.payer}</span>
                      <span style={{ color: '#D0D9E4' }}>·</span>
                      <span className="text-xs" style={{ color: '#6B7583' }}>{change.drug}</span>
                      <span style={{ color: '#D0D9E4' }}>·</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                        style={{ background: '#F5F6F8', color: '#6B7583' }}>
                        {changeTypeLabels[change.change_type] ?? change.change_type}
                      </span>
                      {change.criterion_type && (() => {
                        const chip = criterionChipColors[change.criterion_type] ?? criterionChipColors.other
                        return (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                            style={{ background: chip.bg, color: chip.text }}>
                            {change.criterion_type.replace(/_/g, ' ')}
                          </span>
                        )
                      })()}
                      {change.auth_phase === 'reauth' && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                          style={{ background: '#F0F4FF', color: '#4361BB' }}>
                          reauth
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: '#334155' }}>{change.summary}</p>
                    {change.before_text && change.after_text && (
                      <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                        <span className="px-1.5 py-0.5 rounded font-mono" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                          {change.before_text}mo
                        </span>
                        <span style={{ color: '#C0CDD9' }}>→</span>
                        <span className="px-1.5 py-0.5 rounded font-mono" style={{ background: '#DCFCE7', color: '#166534' }}>
                          {change.after_text}mo
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] flex-shrink-0 font-mono tabular-nums" style={{ color: '#9AA3AF' }}>
                    {change.date}
                  </div>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      <p className="text-[10px] text-center" style={{ color: '#9AA3AF' }}>
        Showing all changes for the current quarter
      </p>
    </div>
  )
}
