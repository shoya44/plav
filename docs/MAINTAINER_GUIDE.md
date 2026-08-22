# 保守担当者向けガイド

このドキュメントは、Plavを初めて/久しぶりに触る人が「まず何を読めばいいか」「ちょっとした
UI調整をどこで行えばいいか」を素早く把握するための、要点だけを抜粋した資料です。

より詳しい情報は、目的に応じて以下を参照してください。

| 知りたいこと | 参照先 |
|---|---|
| セットアップ・Cloudflare/Supabase設定・デプロイ手順など、全体像 | [`README.md`](../README.md) |
| 画面ごとの詳細な仕様・状態遷移・テスト観点 | [`docs/SPECIFICATION.md`](./SPECIFICATION.md) |
| 過去に発生した不具合の原因と教訓、iPhone/PWA特有の制約 | [`docs/DEVELOPMENT_NOTES.md`](./DEVELOPMENT_NOTES.md) |

---

## 1. Plavとは（30秒で把握）

- iPhone / PWA向けの**個人用**音楽・動画プレイヤー。ユーザーは基本的に1人（オーナー）のみ。
- Supabaseに登録された楽曲一覧をHomeへ表示し、Cloudflare R2に置かれたMP3を再生する。
- フロントエンドとAPIは**1つのCloudflare Worker**にまとまっている（別サーバーは無い）。
- 現在の実運用はAudio中心。Video再生のUI/ロジックはあるが、`/api/tracks` がAudioしか
  返さないため通常は使われない。
- 一覧取得だけでなく、曲のタイトル更新・完全削除（Supabaseレコード + R2ファイル）も
  Workerの`PATCH` / `DELETE /api/tracks/:id`経由でサポートしている。

### 技術スタック

| 層 | 技術 |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | Cloudflare Workers |
| メタデータDB | Supabase（`public.tracks`テーブル） |
| メディア保存 | Cloudflare R2（Bucket: `yt-player-audio`） |
| 端末ローカル保存 | Browser Cache Storage（オフライン再生用） |
| デプロイ | Wrangler (`npx wrangler deploy`) |

### 主要コマンド

```bash
npm run dev        # ローカル開発サーバー（/api は本番Workerへproxy）
npm run typecheck  # tsc --noEmit
npm run lint       # oxlint
npm run build      # typecheck + vite build
npm run deploy     # build + wrangler deploy
```

---

## 2. 画面と、それを構成する主なファイル

```text
Home（曲一覧）        → src/ui/Library.tsx
Mini Player          → src/ui/CollapsedPlayer.tsx
Player Sheet         → src/ui/PlayerSheet.tsx + src/hooks/useDraggableSheet.ts
  └ Queue（並び替え） → src/ui/PlaybackQueue.tsx + src/hooks/useQueueReorder.ts
Settings             → src/ui/Settings.tsx
Video再生             → src/ui/VideoPlayer.tsx
```

状態管理（ロジック）はUIコンポーネントの中に置かず、`src/audio.ts`（Audio再生・Queue）や
`src/video.ts`（Video再生）、`src/offline.ts`（ローカル保存）といった専用のCustom Hookに
まとめてあります。UIコンポーネント（`src/ui/`）は基本的に「表示」と「イベントを呼ぶだけ」
の薄い層です。新しい画面や機能を追加するときも、この分離（UI ⇔ ロジック）を崩さないように
してください。

---

## 3. 軽微なUI調整をしたいときの最短ルート

「色を変えたい」「余白を調整したい」「ボタンの挙動を少し変えたい」程度の変更であれば、
だいたい以下の対応表だけで場所が特定できます。

| 変更内容 | 主なファイル |
|---|---|
| Header / Nav / Home全体レイアウト | `src/App.tsx`, `src/styles/app.css` |
| Homeの曲一覧の見た目・挙動 | `src/ui/Library.tsx`, `src/styles/app.css` |
| Homeのソート（追加日 / タイトル順） | `src/App.tsx`, `src/media.ts`（`sortItems`） |
| 長押し / Play next | `src/ui/Library.tsx`, `src/hooks/useLongPress.ts`, `src/audio.ts` |
| タイトル編集 / 曲の完全削除 | `src/ui/Library.tsx`（Detail Sheet）, `src/media.ts`, `src/App.tsx`, `worker/tracks.ts`, `worker/media.ts` |
| ダウンロード状態の表示 | `src/ui/Library.tsx`, `src/offline.ts`, `src/styles/app.css` |
| Mini Player | `src/ui/CollapsedPlayer.tsx`, `src/ui/SeekBar.tsx`, `src/styles/player.css` |
| Player Sheet（開閉・拡大縮小） | `src/ui/PlayerSheet.tsx`, `src/hooks/useDraggableSheet.ts`, `src/styles/player.css` |
| Queue（並び替え・History⇔Up Next移動） | `src/ui/PlaybackQueue.tsx`, `src/hooks/useQueueReorder.ts`, `src/audio.ts`, `src/styles/player.css` |
| 再生系（Seek / Next / Previous / Repeat / Shuffle） | `src/audio.ts`, `src/ui/SeekBar.tsx`, `src/ui/PlayerSheet.tsx` |
| Settings画面 | `src/ui/Settings.tsx`, `src/styles/app.css` |
| 色・角丸・余白などの共通トークン | `src/styles/app.css` の `:root` （`--accent-bright`等） |

**配色・余白の基本ルール**: `src/styles/app.css` の先頭 `:root` に定義済みのCSS変数
（`--bg`, `--accent-bright`, `--radius-control`, `--page-padding-x` 等）を使ってください。
特定の1箇所だけの装飾（グラデーションや影）はベタ書きのrgba値でも構いませんが、
「アプリ全体で共通して使う値」は新しくベタ書きせず、既存のトークンを再利用するか
新しいトークンとして`:root`に追加してください。

**変更後の確認手順**:

```bash
npx tsc --noEmit   # 型エラーがないか
npm run build      # ビルドが通るか
```

可能であれば `npm run dev` でローカル起動し、iPhoneのSafari（同一Wi-Fi経由）か、
PCブラウザのモバイルビューポート＋タッチエミュレーションで実際に操作して確認してください。
特にPlayer Sheetの開閉・長押しドラッグ系は、PCのマウス操作だけでは気づけない不具合が
起きやすい領域です（詳細は [`DEVELOPMENT_NOTES.md`](./DEVELOPMENT_NOTES.md) 参照）。

---

## 4. 触るときに注意してほしいこと

- **型を緩めない**: `any` は使用禁止（このプロジェクトのルール）。`tsconfig.json` は
  `strict: true` / `noUnusedLocals` / `noUnusedParameters` を有効にしています。
- **UIとロジックを混ぜない**: 状態管理・タイマー・イベント処理などはCustom Hook
  （`src/hooks/`）か専用モジュール（`audio.ts`等）に置き、`src/ui/`配下のコンポーネントは
  それらを呼び出すだけにする。
- **ドラッグ・長押し系のジェスチャーを追加/変更するとき**は、必ず
  [`DEVELOPMENT_NOTES.md`](./DEVELOPMENT_NOTES.md) の「1. 発生した問題と原因」と
  「3. 今後の保守で気をつけるチェックリスト」を先に読んでください。Pointer Captureや
  イベント伝播まわりは直感に反する挙動をするため、同じバグを再発させやすい領域です。
- **Secretをコードやドキュメントに書かない**: `SUPABASE_SECRET_KEY` 等はWranglerの
  Secretとしてのみ保持し、Frontendやリポジトリへ埋め込まない。
- **Supabase / R2の外部リソースを勝手に変更しない**: `yt-player` DBの構造（カラム等）や
  `yt-player-audio` Bucketの名称は、Plav側の都合だけで変更しない（他用途でも使われている
  可能性があるため）。曲のタイトル更新・削除はPlavの正規機能として実装済みだが、
  それ以外の書き込み（新しいテーブル、スキーマ変更等）を安易に追加しない。
- **曲の削除は完全削除で元に戻せない**: `DELETE /api/tracks/:id` はSupabaseのレコードと
  R2のファイルを両方削除する（論理削除ではない）。この挙動を変える場合は
  [`SPECIFICATION.md`](./SPECIFICATION.md) の「10.4 `DELETE /api/tracks/:id`」を確認し、
  Settings > Cloudの容量表示との整合性も含めて検討すること。
- **ファイルを増やしすぎない**: 現在の分割方針（`App.tsx` / 状態は`audio.ts`等 / UIは
  `src/ui/` / 共通ジェスチャーは`src/hooks/` / CSSは`app.css`と`player.css`の2本）を
  基本形とし、ファイル数を減らすためだけに巨大な1ファイルへ統合したり、逆に1つの小さな
  変更のために不要な抽象化・新規ファイルを増やしたりしない。
