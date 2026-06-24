import { describe, expect, it } from 'vitest'
import {
  type QuestRules,
  type RawQuest,
  bucketOf,
  buildQuestBoard,
  questExp,
  typeOf,
} from '../quests'

const rules: QuestRules = {
  sizeExp: { XS: 10, S: 20, M: 50, L: 100, XL: 200, default: 30 },
  doneStatuses: ['Done'],
  doingStatuses: ['In progress', 'In review'],
  mainSizes: ['L', 'XL'],
}

describe('questExp', () => {
  it('Size に応じた EXP を返す', () => {
    expect(questExp('XS', rules.sizeExp)).toBe(10)
    expect(questExp('XL', rules.sizeExp)).toBe(200)
  })
  it('Size 未設定や未知の値は既定 EXP', () => {
    expect(questExp(undefined, rules.sizeExp)).toBe(30)
    expect(questExp('???', rules.sizeExp)).toBe(30)
  })
})

describe('bucketOf', () => {
  it('Done はクリア', () => {
    expect(bucketOf('Done', rules)).toBe('done')
  })
  it('In progress / In review は進行中', () => {
    expect(bucketOf('In progress', rules)).toBe('doing')
    expect(bucketOf('In review', rules)).toBe('doing')
  })
  it('Backlog や Ready は未着手', () => {
    expect(bucketOf('Backlog', rules)).toBe('todo')
    expect(bucketOf('Ready', rules)).toBe('todo')
  })
})

describe('typeOf', () => {
  it('L / XL は Main、他は Sub', () => {
    expect(typeOf('L', rules)).toBe('main')
    expect(typeOf('XL', rules)).toBe('main')
    expect(typeOf('S', rules)).toBe('sub')
    expect(typeOf(undefined, rules)).toBe('sub')
  })
})

describe('buildQuestBoard', () => {
  const raws: RawQuest[] = [
    { number: 1, title: 'A', status: 'Backlog', size: 'S' },
    { number: 2, title: 'B', status: 'In progress', size: 'L' },
    { number: 3, title: 'C', status: 'Done', size: 'M' },
    { number: 4, title: 'D', status: 'Done' }, // size 未設定
  ]

  it('Status でバケツ分けする', () => {
    const b = buildQuestBoard(raws, rules)
    expect(b.todo.map((q) => q.number)).toEqual([1])
    expect(b.doing.map((q) => q.number)).toEqual([2])
    expect(b.done.map((q) => q.number)).toEqual([3, 4])
    expect(b.total).toBe(4)
  })

  it('クリア済みの EXP を合計する（M=50 + 既定30）', () => {
    expect(buildQuestBoard(raws, rules).clearedExp).toBe(80)
  })

  it('Main/Sub を Size から判定する', () => {
    const b = buildQuestBoard(raws, rules)
    expect(b.doing[0]?.type).toBe('main') // L
    expect(b.todo[0]?.type).toBe('sub') // S
  })
})
