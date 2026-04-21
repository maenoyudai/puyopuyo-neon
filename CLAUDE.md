# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # install dependencies (Vite + TypeScript only)
npm run dev        # start dev server at http://localhost:5173
npm run build      # tsc type-check then Vite bundle → dist/
npm run preview    # serve the dist/ build locally
npx tsc --noEmit   # type-check without emitting (fastest CI check)
```

## Architecture

Vanilla TypeScript + Vite, no framework. All game logic is pure (immutable state → new state), the renderer is imperative Canvas.

```
src/
  game/
    constants.ts   – board dimensions, color palettes, scoring tables, timing
    Piece.ts       – PairPuyo type, rotation helpers (rotateCW/CCW), satPos()
    Board.ts       – Board type (Cell[][]), place/gravity/popGroups/isGameOver
    GameEngine.ts  – GameState, tick(), player action functions (moveLeft, etc.)
  renderer/
    Renderer.ts    – Canvas drawing: board, puyos (radial-gradient + eyes), particles
  ui/
    Audio.ts       – Web Audio API procedural beeps (no asset files)
  main.ts          – RAF loop, keyboard/touch input, HUD DOM updates
```

### Data flow

`GameState` is an immutable value object. Every player action and `tick()` returns a **new** `GameState`; no mutations. `main.ts` owns the single mutable reference (`let gs`).

### Game phases (`GameState.anim.phase`)

`falling` → `locking` (landed, 400 ms delay) → `popping` (flash animation) → `dropping` (gravity) → back to `falling` (or `gameover`).

The chain loop lives entirely in `startChain()` inside `GameEngine.ts`: it calls `popGroups()`, increments `chainIndex`, and re-enters `popping`. No async involved.

### Scoring

Follows the official Puyo Puyo formula: `BASE_POP * count * max(1, chainPower + colorBonus + groupBonus)`. Look-up tables are in `constants.ts` (`CHAIN_POWER`, `COLOR_BONUS`, `GROUP_BONUS`).

### Renderer

`Renderer.render()` is called every animation frame from the RAF loop. It redraws the entire canvas each frame — no dirty tracking. Particles are managed inside `Renderer` as a local array and are not part of `GameState`.

### Board coordinate system

Row 0 is the hidden spawn row (top). Row `BOARD_ROWS - 1` is the floor. The canvas draws rows 1 through `BOARD_ROWS - 1` (the `VISIBLE_ROWS`).

---

## 要件定義

### 1. プロジェクト概要

| 項目 | 内容 |
|------|------|
| プロダクト名 | ぷよぷよ Neon Edition |
| 種別 | ブラウザ動作型落ちものパズルゲーム |
| ターゲット | スマートフォン・PC 双方のカジュアルゲームプレイヤー |
| 技術スタック | TypeScript + Vite（外部 UI フレームワークなし） |

---

### 2. 機能要件

#### 2.1 ゲームボード

| # | 要件 |
|---|------|
| F-01 | ボードサイズは **6列 × 12行**（スポーン用の非表示行1行を含む計13行）とする |
| F-02 | セルは占有状態（色番号 1〜5）または空（0）のいずれかを持つ |
| F-03 | ゲームオーバーは中央列（3・4列目）の先頭行が埋まった時点で判定する |

#### 2.2 ぷよペア（操作ピース）

| # | 要件 |
|---|------|
| F-04 | 操作単位は **軸ぷよ（pivot）＋衛星ぷよ（satellite）** の2個ペアとする |
| F-05 | 衛星ぷよは軸ぷよを中心に上下左右4方向に配置でき、回転操作により切り替わる |
| F-06 | 時計回り（CW）・反時計回り（CCW）の2方向回転を提供する |
| F-07 | 壁際での回転は壁蹴り（±1 列のナッジ）を試みる。不可能な場合は回転をキャンセルする |
| F-08 | 次に落下するペア（NEXT）を常に1組先読み表示する |
| F-09 | ペアは5色からランダムに生成される（色は独立乱数） |

#### 2.3 落下・操作

| # | 要件 |
|---|------|
| F-10 | ペアは一定間隔で1行ずつ自動落下する（初期 700 ms／ステップ、レベルアップで短縮） |
| F-11 | ソフトドロップ（↓長押し）で落下間隔を 60 ms に短縮する |
| F-12 | ハードドロップ（Space）で即座に最下行まで落下・固定する |
| F-13 | 左右移動（←→）で列を変更できる |
| F-14 | 着地から **400 ms** のロック猶予を設ける。猶予中に移動・回転すると猶予をリセットする |

#### 2.4 重力・消去・連鎖

| # | 要件 |
|---|------|
| F-15 | ペア固定後、重力によりすべての浮遊ぷよを最下行へ落下させる |
| F-16 | 同色ぷよが **4個以上** 隣接（上下左右）する群を消去する |
| F-17 | 消去後に再び重力を適用し、新たな消去が発生すれば**連鎖**としてカウントする |
| F-18 | 連鎖は最大12連鎖まで公式ルールの倍率テーブルを適用する |

#### 2.5 スコアリング

公式スコア計算式を採用する:

```
スコア = BASE_POP(10) × 消去ぷよ数 × max(1, 連鎖倍率 + 色ボーナス + 組ボーナス)
```

| ボーナス | 内容 |
|----------|------|
| 連鎖倍率 | `CHAIN_POWER[chainIndex]`（0, 8, 16, 32, 64 … 512） |
| 色ボーナス | 同時消去した色数に応じた加算（0, 3, 6, 12, 24） |
| 組ボーナス | 消去グループのサイズに応じた加算（4個=0, 5個=2 … 10個以上=10） |

#### 2.6 レベルシステム

| # | 要件 |
|---|------|
| F-19 | 累計消去ぷよ数 30個ごとにレベルが1上昇する |
| F-20 | レベルアップにより自動落下間隔を短縮する（`max(100ms, 700ms - (level-1)×50ms)`） |

#### 2.7 ハイスコア

| # | 要件 |
|---|------|
| F-21 | ハイスコアは `localStorage` に永続保存し、セッションをまたいで引き継ぐ |
| F-22 | ゲームオーバー時に現スコアがハイスコアを超えていれば即時更新する |

---

### 3. 非機能要件

#### 3.1 パフォーマンス

| # | 要件 |
|---|------|
| NF-01 | ゲームループは `requestAnimationFrame` で駆動し、目標 60 fps を維持する |
| NF-02 | 1フレームあたりのゲームロジック処理は 1 ms 未満を目標とする |
| NF-03 | Canvas は毎フレーム全体再描画とし、ダーティ追跡は行わない |

#### 3.2 操作性

| # | 要件 |
|---|------|
| NF-04 | キーボード（PC）とタッチ（モバイル）の両入力方式を提供する |
| NF-05 | タッチ操作：タップ=回転、左右スワイプ=移動、下スワイプ=ソフトドロップ、上スワイプ=ハードドロップ |
| NF-06 | 入力からレンダリング反映までのレイテンシは 1フレーム（約 16.7 ms）以内とする |

#### 3.3 レスポンシブ対応

| # | 要件 |
|---|------|
| NF-07 | 画面幅 520px 未満ではレイアウトを縦並びに切り替え、HUD は折り返し表示とする |
| NF-08 | ゲームボードの Canvas サイズはピクセル固定（324×660 px）とし、CSS スケーリングは行わない |

#### 3.4 サウンド

| # | 要件 |
|---|------|
| NF-09 | 効果音は Web Audio API の手続き的生成とし、外部音声ファイルに依存しない |
| NF-10 | 移動・回転・着地・消去・ゲームオーバーに対応した効果音を提供する |
| NF-11 | 連鎖数に応じて効果音の音程を段階的に上昇させる |

#### 3.5 アクセシビリティ・UX

| # | 要件 |
|---|------|
| NF-12 | ぷよの識別は**色＋形状（目のデザイン）**の両方で行い、色覚多様性に配慮する |
| NF-13 | 連鎖発生時にビジュアルフィードバック（パーティクルバースト＋チェインバッジアニメーション）を提供する |
| NF-14 | ゲームオーバー画面からワンアクション（ボタン or Enter キー）でリスタートできる |

#### 3.6 依存関係・ビルド

| # | 要件 |
|---|------|
| NF-15 | ランタイム依存はゼロとする（Vite と TypeScript は devDependencies のみ） |
| NF-16 | `npm run build` で `dist/` に静的ファイルを出力し、任意の静的ホスティングに配置可能とする |

---

### 4. 操作仕様まとめ

| 入力 | PC キー | タッチ |
|------|---------|--------|
| 左移動 | `←` | 左スワイプ |
| 右移動 | `→` | 右スワイプ |
| ソフトドロップ | `↓`（長押し） | 下スワイプ |
| ハードドロップ | `Space` | 上スワイプ |
| 時計回り回転 | `X` / `↑` | タップ |
| 反時計回り回転 | `Z` | — |
| リスタート | `Enter`（GO 画面） | ボタンタップ |

---

### 5. ゲームフロー

```
起動
 └─ GAME OVER オーバーレイ表示（開始前も共用）
      └─ [PLAY AGAIN] or Enter
           └─ falling フェーズ開始
                │
                ├─ 左右移動 / 回転 / ドロップ受付
                │
                ├─ 自動落下タイマー経過
                │    └─ 着地判定 → locking フェーズ (400ms)
                │         └─ ロック確定
                │              └─ 重力適用
                │                   └─ popGroups()
                │                        ├─ 消去なし → 次ペアスポーン → falling
                │                        └─ 消去あり → popping (フラッシュ) → dropping (重力) → popGroups() …
                │                                                                                   └─ 消去なし → 次ペアスポーン
                └─ スポーン位置が埋まっている → GAME OVER
```
