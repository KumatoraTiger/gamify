# gamify

個人開発のモチベを保つための、開発ステータス・ダッシュボード。
対象リポジトリの git / gh 活動を RPG 風（レベル・EXP・ストリーク・クエスト・実績）に集計し、
**HTML ダッシュボード**と**ターミナル要約**に出力する。

別プロジェクトにも使い回せるよう、対象は `config.ts` で差し替える。

## 使い方

```bash
pnpm install
pnpm dev:stats     # ターミナルに要約を表示し、out/cockpit.html を生成
```

`out/cockpit.html` をブラウザで開くとダッシュボードが見られる。

## 設定（config.ts）

初回は雛形をコピーして自分の環境に合わせて書き換える（`config.ts` は個人のパス・メールを含むため gitignore 済み）:

```sh
cp config.example.ts config.ts
```

- `repoPath` … 集計対象リポジトリのローカルパス
- `projectName` … 表示名
- `author` … 自分のコミットだけ集計したいとき（git の author 名）
- `exp` … コミット / マージPR / リリース あたりの EXP 配点
- `levelCurve` … レベルアップに必要な EXP のカーブ
- `badges` … 実績バッジの定義（解放で街の建物が増える演出）

## 集計の中身

| 指標 | データ源 |
|------|----------|
| コミット数・ストリーク・週次推移 | `git log` |
| マージ PR | `gh pr list`（未認証なら自動スキップ） |
| リリース | `git tag v*` |
| クエスト・EXP（予定） | GitHub Projects v2（`gh auth refresh -s project,read:project` が必要） |

## 開発

```bash
pnpm test          # Vitest（ドメインは純粋関数で TDD）
pnpm format        # Biome
```

## ロードマップ

- [x] データ中心コア（Lv/EXP・ストリーク・週次・バッジ・HTML/ターミナル出力）
- [ ] GitHub Projects v2 連携でクエストを取り込み EXP に反映
- [ ] 冒険マップ（ステージ進行）・キャラ/装備・街（建物解放）の演出
- [ ] statusline 連携（1行版）
