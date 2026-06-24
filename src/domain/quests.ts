/**
 * GitHub Projects v2 のアイテムをクエストに変換する純粋ロジック。
 *
 * EXP は専用フィールドを作らず Size から換算する（手入力を最小化）。
 * Size 未設定でも既定 EXP で動く。Status はクリア/進行中/未着手の3バケツに畳む。
 */

export type QuestBucket = 'todo' | 'doing' | 'done'
export type QuestType = 'main' | 'sub'

export interface RawQuest {
  number: number
  title: string
  status: string
  size?: string
  url?: string
}

export interface SizeExpMap {
  XS: number
  S: number
  M: number
  L: number
  XL: number
  /** Size 未設定のときの既定 EXP */
  default: number
}

export interface QuestRules {
  sizeExp: SizeExpMap
  /** クリア扱いにする Status 名 */
  doneStatuses: string[]
  /** 進行中扱いにする Status 名 */
  doingStatuses: string[]
  /** Main クエスト扱いにする Size 名（他は Sub） */
  mainSizes: string[]
}

export interface Quest {
  number: number
  title: string
  url?: string
  bucket: QuestBucket
  type: QuestType
  exp: number
}

export interface QuestBoard {
  todo: Quest[]
  doing: Quest[]
  done: Quest[]
  /** クリア済みクエストの EXP 合計 */
  clearedExp: number
  total: number
}

export function questExp(size: string | undefined, m: SizeExpMap): number {
  if (!size) return m.default
  if (size === 'XS' || size === 'S' || size === 'M' || size === 'L' || size === 'XL') {
    return m[size]
  }
  return m.default
}

export function bucketOf(status: string, rules: QuestRules): QuestBucket {
  if (rules.doneStatuses.includes(status)) return 'done'
  if (rules.doingStatuses.includes(status)) return 'doing'
  return 'todo'
}

export function typeOf(size: string | undefined, rules: QuestRules): QuestType {
  return size !== undefined && rules.mainSizes.includes(size) ? 'main' : 'sub'
}

export function buildQuestBoard(raws: RawQuest[], rules: QuestRules): QuestBoard {
  const quests: Quest[] = raws.map((q) => ({
    number: q.number,
    title: q.title,
    url: q.url,
    bucket: bucketOf(q.status, rules),
    type: typeOf(q.size, rules),
    exp: questExp(q.size, rules.sizeExp),
  }))
  const todo = quests.filter((q) => q.bucket === 'todo')
  const doing = quests.filter((q) => q.bucket === 'doing')
  const done = quests.filter((q) => q.bucket === 'done')
  const clearedExp = done.reduce((sum, q) => sum + q.exp, 0)
  return { todo, doing, done, clearedExp, total: quests.length }
}
