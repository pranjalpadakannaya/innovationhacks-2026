import type { PolicyRecord } from '../types/policy'

export interface StringencyResult {
  score: number
  breakdown: {
    pa: number
    criteriaType: number
    duration: number
    exclusions: number
  }
}

// Criterion types that are genuinely burdensome to satisfy
const CRITERION_WEIGHTS: Record<string, number> = {
  step_therapy:            3.5,
  combination_restriction: 2.8,
  prior_therapy:           2.5,
  line_of_therapy:         2.5,
  disease_severity:        2.0,
  lab_value:               2.0,
  prescriber:              1.5,
  age_weight:              1.5,
  clinical_response:       1.2,
  diagnosis:               1.0,
  other:                   0.8,
}

function criteriaWeight(type: string): number {
  return CRITERION_WEIGHTS[type] ?? 0.8
}

export function computeStringency(record: PolicyRecord): StringencyResult {
  const { indications, exclusions } = record
  if (!indications.length) {
    return { score: 0, breakdown: { pa: 0, criteriaType: 0, duration: 0, exclusions: 0 } }
  }

  // PA ratio — unchanged
  const paRatio = indications.filter(i => i.pa_required).length / indications.length
  const pa = Math.round(paRatio * 35)

  // Type-weighted criteria score (initial + 50% reauth weight + specialty bonus)
  const avgWeightedCriteria = indications.reduce((sum, ind) => {
    const initial = ind.initial_authorization?.criteria ?? []
    const reauth  = ind.reauthorization?.criteria ?? []
    const initialScore = initial.reduce((s, c) => s + criteriaWeight(c.criterion_type), 0)
    const reauthScore  = reauth.reduce((s, c) => s + criteriaWeight(c.criterion_type), 0) * 0.5
    const specialtyBonus = (ind.initial_authorization?.required_prescriber_specialties?.length ?? 0) > 0 ? 3 : 0
    return sum + initialScore + reauthScore + specialtyBonus
  }, 0) / indications.length
  const criteriaType = Math.min(Math.round(avgWeightedCriteria * 3.0), 40)

  // Authorization duration penalty — shorter auth = more reauth burden
  const indsWithDuration = indications.filter(
    i => i.initial_authorization?.authorization_duration_months != null
  )
  const durationScore = indsWithDuration.length > 0
    ? indsWithDuration.reduce((sum, i) => {
        const dur = i.initial_authorization.authorization_duration_months!
        return sum + Math.max(0, 12 - dur) * 1.5
      }, 0) / indsWithDuration.length
    : 0
  const duration = Math.min(Math.round(durationScore), 15)

  const exclusionScore = Math.min((exclusions?.length ?? 0) * 5, 10)

  return {
    score: pa + criteriaType + duration + exclusionScore,
    breakdown: { pa, criteriaType, duration, exclusions: exclusionScore },
  }
}

export function getStringencyColor(score: number): string {
  if (score >= 70) return 'bg-red-500'
  if (score >= 40) return 'bg-yellow-500'
  return 'bg-green-500'
}

export function getStringencyLabel(score: number): string {
  if (score >= 70) return 'High'
  if (score >= 40) return 'Medium'
  return 'Low'
}
