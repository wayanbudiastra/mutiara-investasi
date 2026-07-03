/**
 * Kalkulasi murni untuk modul Strategi Average Down (prd/strategi_avg_down.md).
 * Tidak menyentuh DB/network — supaya bisa dipanggil client-side (F11) dan diuji manual (F5).
 */

export type Timeframe = 'short' | 'medium' | 'long'
export type AllocationMethod = 'pyramid' | 'equal'

export const TIMEFRAME_PRESETS: Record<Timeframe, { stages: number; intervalPct: number; label: string }> = {
  short:  { stages: 2, intervalPct: 7,  label: 'Pendek (< 3 bulan)' },
  medium: { stages: 3, intervalPct: 10, label: 'Menengah (3–12 bulan)' },
  long:   { stages: 5, intervalPct: 12, label: 'Panjang (> 12 bulan)' },
}

export const STAGES_MIN = 1
export const STAGES_MAX = 10
export const INTERVAL_PCT_MIN = 1
export const INTERVAL_PCT_MAX = 50

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

/** Fraksi harga (tick size) BEI — F6. */
export function getTickSize(price: number): number {
  if (price < 200) return 1
  if (price < 500) return 2
  if (price < 2000) return 5
  if (price < 5000) return 10
  return 25
}

/** Bulatkan ke bawah ke tick BEI terdekat — level trigger tidak boleh lebih tinggi dari target turun. */
export function roundDownToTick(price: number): number {
  const tick = getTickSize(price)
  return Math.max(tick, Math.floor(price / tick) * tick)
}

export interface AvgDownInput {
  currentPrice: number
  capital: number
  timeframe: Timeframe
  /** Override manual — jika diisi, dipakai menggantikan preset timeframe (F12). */
  stages?: number
  intervalPct?: number
  allocationMethod?: AllocationMethod
  /** Posisi awal opsional — jika tidak diisi/lot=0, dianggap belum punya posisi. */
  initialAvgPrice?: number
  initialLot?: number
}

export interface AvgDownStage {
  stage: number
  levelPrice: number
  dropFromCurrentPct: number
  lots: number
  sharesUsed: number
  capitalUsed: number
  cumulativeShares: number
  cumulativeCost: number
  avgPriceAfter: number
  avgDropPct: number
  breakEvenDistancePct: number
}

export interface AvgDownPlan {
  stagesUsed: number
  intervalPctUsed: number
  allocationMethod: AllocationMethod
  stages: AvgDownStage[]
  totalLots: number
  totalCapitalUsed: number
  unallocatedCapital: number
  finalAvgPrice: number
  initialAvgPrice: number | null
  initialLot: number
  currentPrice: number
}

export function calculateAvgDownPlan(input: AvgDownInput): AvgDownPlan {
  const preset = TIMEFRAME_PRESETS[input.timeframe]
  const stagesCount = clamp(Math.round(input.stages ?? preset.stages), STAGES_MIN, STAGES_MAX)
  const intervalPct = clamp(input.intervalPct ?? preset.intervalPct, INTERVAL_PCT_MIN, INTERVAL_PCT_MAX)
  const method: AllocationMethod = input.allocationMethod ?? 'pyramid'
  const initialLot = input.initialLot ?? 0
  const initialAvgPrice = input.initialAvgPrice ?? 0

  const weights = method === 'pyramid'
    ? Array.from({ length: stagesCount }, (_, i) => i + 1)
    : Array.from({ length: stagesCount }, () => 1)
  const weightSum = weights.reduce((a, b) => a + b, 0)

  let cumulativeShares = initialLot * 100
  let cumulativeCost = cumulativeShares * initialAvgPrice
  let prevAvgPrice = cumulativeShares > 0 ? initialAvgPrice : input.currentPrice
  let levelPrice = input.currentPrice
  let totalCapitalUsed = 0

  const stages: AvgDownStage[] = []
  for (let i = 0; i < stagesCount; i++) {
    levelPrice = roundDownToTick(levelPrice * (1 - intervalPct / 100))
    const capitalForStage = (input.capital * weights[i]) / weightSum
    const rawShares = Math.floor(capitalForStage / levelPrice)
    const lots = Math.floor(rawShares / 100)
    const sharesUsed = lots * 100
    const capitalUsed = sharesUsed * levelPrice

    cumulativeShares += sharesUsed
    cumulativeCost += capitalUsed
    totalCapitalUsed += capitalUsed

    const avgPriceAfter = cumulativeShares > 0 ? cumulativeCost / cumulativeShares : 0
    const dropFromCurrentPct = ((input.currentPrice - levelPrice) / input.currentPrice) * 100
    const avgDropPct = prevAvgPrice > 0 ? ((prevAvgPrice - avgPriceAfter) / prevAvgPrice) * 100 : 0
    const breakEvenDistancePct = levelPrice > 0 ? ((avgPriceAfter - levelPrice) / levelPrice) * 100 : 0

    stages.push({
      stage: i + 1, levelPrice, dropFromCurrentPct, lots, sharesUsed, capitalUsed,
      cumulativeShares, cumulativeCost, avgPriceAfter, avgDropPct, breakEvenDistancePct,
    })

    prevAvgPrice = avgPriceAfter
  }

  return {
    stagesUsed: stagesCount,
    intervalPctUsed: intervalPct,
    allocationMethod: method,
    stages,
    totalLots: cumulativeShares / 100,
    totalCapitalUsed,
    unallocatedCapital: input.capital - totalCapitalUsed,
    finalAvgPrice: stages.length > 0 ? stages[stages.length - 1].avgPriceAfter : prevAvgPrice,
    initialAvgPrice: initialLot > 0 ? initialAvgPrice : null,
    initialLot,
    currentPrice: input.currentPrice,
  }
}
