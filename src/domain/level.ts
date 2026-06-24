/**
 * EXP とレベルの相互変換。
 *
 * レベルは「累計EXP」のしきい値で決まる。レベル L から L+1 へ上がるのに必要な EXP は
 * `base + step * (L - 1)` で、レベルが上がるほど必要量が増える素直なカーブ。
 */

export interface LevelCurve {
  /** Lv1 → Lv2 に必要な EXP */
  base: number
  /** レベルごとに増える必要 EXP */
  step: number
}

export interface LevelInfo {
  level: number
  totalExp: number
  /** 現在のレベルに到達するのに必要だった累計 EXP */
  levelFloor: number
  /** 次のレベルに到達する累計 EXP */
  nextLevelAt: number
  /** 今のレベル内で稼いだ EXP */
  expIntoLevel: number
  /** 今のレベルを抜けるのに必要な EXP 幅 */
  expForLevel: number
  /** 次のレベルまであと何 EXP か */
  toNext: number
  /** 今のレベル内の進捗（0〜1） */
  progress: number
}

/** レベル L から L+1 へ上がるのに必要な EXP */
export function expToAdvance(level: number, curve: LevelCurve): number {
  return curve.base + curve.step * (level - 1)
}

/** レベル L に到達するのに必要な累計 EXP（Lv1 到達は 0） */
export function cumExpForLevel(level: number, curve: LevelCurve): number {
  let sum = 0
  for (let l = 1; l < level; l++) {
    sum += expToAdvance(l, curve)
  }
  return sum
}

export function levelFromExp(totalExpRaw: number, curve: LevelCurve): LevelInfo {
  const totalExp = Math.max(0, Math.floor(totalExpRaw))
  let level = 1
  while (cumExpForLevel(level + 1, curve) <= totalExp) {
    level++
  }
  const levelFloor = cumExpForLevel(level, curve)
  const nextLevelAt = cumExpForLevel(level + 1, curve)
  const expForLevel = nextLevelAt - levelFloor
  const expIntoLevel = totalExp - levelFloor
  return {
    level,
    totalExp,
    levelFloor,
    nextLevelAt,
    expIntoLevel,
    expForLevel,
    toNext: nextLevelAt - totalExp,
    progress: expForLevel === 0 ? 0 : expIntoLevel / expForLevel,
  }
}
