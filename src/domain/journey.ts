/**
 * 冒険マップ。レベルの進行を「ステージを旅していく」道のりとして表現する純粋ロジック。
 *
 * - ステージ列: 到達レベルが決まった目的地の並び
 * - 現在地: 到達済みのうち最後のステージ
 * - ステージ内マップ（登山スタイル）: 現ステージ→次ステージの区間を、
 *   レベル単位の waypoint に区切り、今どこまで登ったかを figure として返す
 *
 * レベル内の細かな進捗（level.progress 相当）も effectiveLevel に織り込むので、
 * バーが連続的に伸びる。
 */

export interface StageDef {
  name: string
  icon: string
  /** このステージに到達するのに必要なレベル */
  requiredLevel: number
}

export interface StageState extends StageDef {
  reached: boolean
  current: boolean
}

export interface Waypoint {
  /** この地点に対応するレベル */
  level: number
  /** 区間内での位置（0〜1） */
  pos: number
  reached: boolean
  /** プレイヤーが今いる地点に最も近い waypoint か */
  here: boolean
}

export interface JourneyState {
  stages: StageState[]
  currentIndex: number
  current: StageDef
  next?: StageDef
  /** 現ステージ区間内の進捗（0〜1）。最終ステージ到達後は 1 */
  progressInStage: number
  /** ステージ内マップの中継地点 */
  waypoints: Waypoint[]
}

// 既定の冒険ルート（村→森→港→峠→山岳都市→王都→竜の頂）。
export const DEFAULT_STAGES: StageDef[] = [
  { name: 'はじまりの村', icon: '🏕️', requiredLevel: 1 },
  { name: '試練の森', icon: '🌲', requiredLevel: 5 },
  { name: '港町ハーバー', icon: '⚓', requiredLevel: 10 },
  { name: '霧の峠', icon: '🌫️', requiredLevel: 18 },
  { name: '山岳都市メサ', icon: '🏔️', requiredLevel: 28 },
  { name: '天空の王都', icon: '🏰', requiredLevel: 40 },
  { name: '竜の頂', icon: '🐉', requiredLevel: 55 },
]

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n))

/**
 * @param level 現在レベル
 * @param intraLevelProgress 現レベル内の進捗（0〜1）。バーを滑らかにするため加味する
 * @param stages ステージ列（既定は DEFAULT_STAGES）。requiredLevel 昇順前提
 */
export function buildJourney(
  level: number,
  intraLevelProgress = 0,
  stages: StageDef[] = DEFAULT_STAGES,
): JourneyState {
  const effectiveLevel = level + clamp01(intraLevelProgress)

  let currentIndex = 0
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i]
    if (s && level >= s.requiredLevel) currentIndex = i
  }

  const current = stages[currentIndex] as StageDef
  const next = stages[currentIndex + 1]

  const stageStates: StageState[] = stages.map((s, i) => ({
    ...s,
    reached: level >= s.requiredLevel,
    current: i === currentIndex,
  }))

  // 最終ステージに到達済みなら区間は埋まりきっている
  if (!next) {
    return {
      stages: stageStates,
      currentIndex,
      current,
      next: undefined,
      progressInStage: 1,
      waypoints: [{ level: current.requiredLevel, pos: 0, reached: true, here: true }],
    }
  }

  const span = next.requiredLevel - current.requiredLevel
  const progressInStage = clamp01((effectiveLevel - current.requiredLevel) / span)

  // 区間内の各レベルを中継地点にする（始点=現ステージ, 終点=次ステージ）
  const waypoints: Waypoint[] = []
  let hereIdx = 0
  for (let lv = current.requiredLevel; lv <= next.requiredLevel; lv++) {
    const pos = clamp01((lv - current.requiredLevel) / span)
    const reached = level >= lv
    if (reached) hereIdx = waypoints.length
    waypoints.push({ level: lv, pos, reached, here: false })
  }
  const hereWp = waypoints[hereIdx]
  if (hereWp) hereWp.here = true

  return {
    stages: stageStates,
    currentIndex,
    current,
    next,
    progressInStage,
    waypoints,
  }
}
