import type { GamifyConfig } from './src/domain/config-types'

/**
 * gamify の設定の雛形。
 * `cp config.example.ts config.ts` してから自分の環境に合わせて書き換える。
 * 実体の config.ts は .gitignore 済み（個人のパス・メール・owner を含むため）。
 */
export const config: GamifyConfig = {
  repoPath: '/path/to/your/repo',
  projectName: 'your-project',
  // repoSlug は未指定 → git remote から自動検出
  // 自分の貢献だけ集計したい場合は author にコミットメールを指定する
  author: 'you@example.com',
  ghAuthor: '@me',
  releaseSource: 'auto', // gh Releases 優先・タグ fallback
  startDate: undefined, // 未指定なら最初のコミット日から算出
  // 既定 true: origin/HEAD（リモートのデフォルトブランチ）を読み、集計前に git fetch
  // して真の最新を反映する。ローカルのチェックアウト状態には左右されない。
  // オフライン中心なら false にすると fetch を省ける。
  fetchBeforeRead: true,

  levelCurve: { base: 150, step: 30 },

  exp: {
    perCommit: 5,
    perMergedPR: 25,
    perRelease: 100,
  },

  // GitHub Projects v2 連携。EXP は Size から換算（手入力を最小化）。
  // 不要なら quests ごと削除してよい。
  quests: {
    owner: 'your-github-login',
    projectNumber: 1,
    addClearedExpToTotal: true,
    rules: {
      sizeExp: { XS: 10, S: 20, M: 50, L: 100, XL: 200, default: 30 },
      doneStatuses: ['Done'],
      doingStatuses: ['In progress', 'In review'],
      mainSizes: ['L', 'XL'],
    },
  },

  htmlOut: 'out/cockpit.html',

  // バッジ。解放で街の建物が増える（演出）。
  badges: [
    {
      id: 'first-release',
      name: '初リリース',
      icon: '🚀',
      unlocks: '⛪ チャペル',
      test: (m) => m.releases >= 1,
    },
    {
      id: 'streak-7',
      name: '7日連続稼働',
      icon: '🔥',
      unlocks: '🕰️ 時計塔',
      test: (m) => m.longestStreak >= 7,
    },
    {
      id: 'commits-100',
      name: 'コミット100',
      icon: '🏗️',
      unlocks: '🏢 高層ビル',
      test: (m) => m.totalCommits >= 100,
    },
    {
      id: 'commits-500',
      name: 'コミット500',
      icon: '🏙️',
      unlocks: '🌆 区画拡張',
      test: (m) => m.totalCommits >= 500,
    },
    {
      id: 'prs-10',
      name: 'PR 10本マージ',
      icon: '🛠️',
      unlocks: '🏛️ 役場',
      test: (m) => m.mergedPRs >= 10,
    },
    {
      id: 'coverage-80',
      name: 'カバレッジ80%',
      icon: '🧪',
      unlocks: '🏥 病院',
      test: (m) => (m.coverage ?? 0) >= 80,
    },
  ],
}
