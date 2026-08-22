# Plav

Plav は、iPhone / PWA を主対象とした個人用の軽量メディアプレイヤーです。
現在の実運用は **Audio中心** で、React/Vite のフロントエンドと Cloudflare Worker API を1つの Worker (`plav`) に統合しています。

- Repository: `https://github.com/shoya44/plav`
- Production: `https://plav.take503503.workers.dev/`
- Current version: `v0.4.0`
- Frontend: React + TypeScript + Vite
- Backend: Cloudflare Workers
- Metadata: Supabase `tracks`
- Media: Cloudflare R2 `yt-player-audio`
- Local save: Browser Cache Storage

> 詳細な内部仕様・データフロー・UI修正箇所・テスト観点は [`docs/SPECIFICATION.md`](docs/SPECIFICATION.md) を参照してください。
> 初めて保守に入る方は、まず [`docs/MAINTAINER_GUIDE.md`](docs/MAINTAINER_GUIDE.md)（要点だけの早見表）から読むのがおすすめです。

---

## 1. 主な機能

### Audio

- Supabaseの楽曲一覧をHomeへ表示
- 再生 / 一時停止
- Previous / Next
- Seek
- Shuffle
- Repeat
- Playback history
- Up Next queue
- Home長押しから `Play next`
- Player Sheet上でUp Nextを **長押し + ドラッグ** して並び替え
- iOS Media Session / Lock Screen操作
- 保存済み楽曲はローカルCacheから再生

### Local download

Homeの各Audio行の右側に保存状態を表示します。

| 表示 | 状態 |
|---|---|
| Download icon | 未保存 |
| Spinner | 保存中 |
| Check | ローカル保存済み |
| Error tone | 保存失敗 / 再試行可能 |

`Settings > Downloads > Auto save` をONにすると、未保存のAudioを1曲ずつCache Storageへ保存します。

### Cloud usage check

`Settings > Cloud > R2 storage` に、R2 Bucketの現在容量を表示します。

- 使用量 / 10 GB
- 使用率
- Object数
- 80%以上: `Near limit`
- 100%以上: `Over limit`
- タップで再取得

この表示は **現在のBucketスナップショット** です。Cloudflareの請求上のStorageはGB-monthで計算されるため、画面の値がそのまま月間請求量を表すわけではありません。また、Class A / Class B Operationsの月間使用量はPlav内では取得していません。

### Video

Video PlayerのUI / 再生ロジックは残していますが、現在の `/api/tracks` はAudioのみを返すため、通常の本番運用ではVideoタブに項目は表示されません。

---

## 2. iPhoneでの使い方

### Home

1. Audioタブを開く
2. 曲名をタップすると再生
3. 右側のDownload iconをタップするとローカル保存
4. 曲名を長押しするとDetail Sheetを表示
5. 再生中に別の曲を長押しし、`Play next` を押すと次の曲へ設定

Homeの長押し操作では、iOS Safari/PWAの文字選択・コピーCalloutが発生しにくいよう選択抑止を入れています。

### Mini Player

Audio再生中はHome下部にCollapsed Playerを表示します。

- 曲名部分: Player Sheetを開く
- Play/Pause: 再生制御
- Progress: 現在位置

### Player Sheet

Collapsed Playerをタップして開きます。

- Half / Expandedの2段階
- Seek
- Previous / Play-Pause / Next
- Shuffle / Repeat
- History
- Current track
- Up Next

Up Next / Historyの並び替えは **長押しして行が浮いた後、そのまま上下へドラッグ** します。通常の短いタップでは並び替えません。
Up Nextの曲を再生中トラックより上（Historyエリア）までドラッグするとHistoryへ移動し、逆にHistoryの曲をUp Nextまでドラッグすると次に再生される側へ戻せます（`moveQueueItem` / `QueuePosition`、実装は「9. UIを変更するときの主な修正箇所」の「Queue / 並び替え」を参照）。

### Settings

- `Downloads`: Auto save / 保存曲数
- `Cloud`: R2現在容量
- `App`: Version / Update app
- `About`: Released（ビルド日時）/ Repository（GitHubリンク）

`Update app > Load latest` は最新の `index.html` をno-storeで取得し直します。ローカル保存したAudio Cacheは削除しません。

---

## 3. 全体アーキテクチャ

```text
┌─────────────────────────────────────────────┐
│ iPhone / PWA                                │
│ React + Vite                                │
│                                             │
│ Home / Player / Queue / Settings            │
│                 │                           │
│                 ├── Cache Storage           │
│                 │    └── 保存済みMP3        │
│                 │                           │
│                 └── /api/*                  │
└─────────────────┬───────────────────────────┘
                  │ same origin
                  ▼
┌─────────────────────────────────────────────┐
│ Cloudflare Worker: plav                     │
│                                             │
│ /              → Vite static assets         │
│ /api/health    → Health                     │
│ /api/tracks    → Supabase                   │
│ /api/media/:id → R2 Range streaming         │
│ /api/storage   → R2 usage snapshot          │
└────────────┬──────────────────┬──────────────┘
             │                  │
             ▼                  ▼
┌──────────────────────┐  ┌───────────────────┐
│ Supabase             │  │ Cloudflare R2     │
│ Project: yt-player   │  │ yt-player-audio   │
│ public.tracks        │  │ MP3 objects       │
└──────────────────────┘  └───────────────────┘
```

FrontendとAPIは同一Originなので、Frontend側のAPI Base URLやCORS設定は不要です。

---

## 4. ディレクトリ構成

```text
plav/
├─ public/
│  ├─ icons/                  # PWA / Header / Media artwork
│  └─ site.webmanifest
│
├─ src/
│  ├─ App.tsx                 # App全体の組み立て / Page切替
│  ├─ audio.ts                # Audio state / Queue / Media Session
│  ├─ video.ts                # Video state / playback
│  ├─ media.ts                # Media型 / tracks API / utility
│  ├─ offline.ts              # Cache Storage / Auto save
│  ├─ cloud.ts                # R2 usage API client
│  ├─ cssVars.ts              # CSSカスタムプロパティ用の型ヘルパー
│  ├─ main.tsx                # React entry point
│  │
│  ├─ ui/
│  │  ├─ Library.tsx          # Home list / Download / Long press / Play next
│  │  ├─ CollapsedPlayer.tsx  # Mini Player
│  │  ├─ PlayerSheet.tsx      # Audio Player Sheet
│  │  ├─ PlaybackQueue.tsx    # History / Current / Up Next / Drag reorder
│  │  ├─ SeekBar.tsx          # Mini Player / Player Sheet共通のSeekバー
│  │  ├─ Settings.tsx         # Settings
│  │  └─ VideoPlayer.tsx      # Video UI
│  │
│  ├─ hooks/
│  │  ├─ useLongPress.ts      # 長押し判定（Library.tsx）
│  │  ├─ useSwipeToClose.ts   # 下スワイプで閉じる（VideoPlayer.tsx / Library.tsx）
│  │  ├─ useQueueReorder.ts   # Up Nextの長押し+ドラッグ並び替え（PlaybackQueue.tsx）
│  │  └─ useDraggableSheet.ts # Player Sheetのドラッグ/スナップ（PlayerSheet.tsx）
│  │
│  └─ styles/
│     ├─ app.css              # App / Home / Library / Settings / Nav
│     └─ player.css           # Mini Player / Player Sheet / Queue / Video
│
├─ worker/
│  ├─ index.ts                # API routing / Env型 / error handling
│  ├─ tracks.ts               # Supabase tracks取得
│  ├─ media.ts                # R2 Range streaming
│  └─ storage.ts              # R2容量集計
│
├─ docs/
│  ├─ MAINTAINER_GUIDE.md     # 保守担当者向け早見表（まずここから）
│  ├─ SPECIFICATION.md        # 詳細仕様書
│  └─ DEVELOPMENT_NOTES.md    # 開発中に発生した不具合・原因・教訓、iPhone/PWA制約
│
├─ index.html
├─ package.json
├─ package-lock.json
├─ tsconfig.json
├─ vite.config.ts
└─ wrangler.jsonc
```

### 分割方針

現在の分割を基本形とします。

- App composition → `App.tsx`
- State / domain logic → `audio.ts`, `video.ts`, `offline.ts`, `cloud.ts`
- UI behavior → `src/ui/`
- 複数のUIで共通するジェスチャー判定 → `src/hooks/`（`useLongPress` / `useSwipeToClose` 等）
- CSS → `app.css`, `player.css` の2ファイル
- Backend routing → `worker/index.ts`
- Backend responsibilities → `tracks.ts`, `media.ts`, `storage.ts`

ファイル数を減らすためだけに巨大な `AudioPlayer.tsx` 等へ統合しない方針です。

---

## 5. 初回セットアップ

```powershell
cd C:\Users\Shoya\Desktop\plav
npm install
npm run build
```

Cloudflareへログインしていない場合:

```powershell
npx wrangler login
```

WorkerにSupabase Secretを登録:

```powershell
npx wrangler secret put SUPABASE_SECRET_KEY --name plav
```

Secret値はGitへ保存しません。

---

## 6. 開発

### Local UI

```powershell
npm run dev
```

Vite開発サーバーでは `/api` を本番Workerへproxyします。

```text
Local browser
    ↓ /api/*
Vite proxy
    ↓
https://plav.take503503.workers.dev
```

そのため通常のUI開発では、ローカルにSupabase Secretを置く必要はありません。

### Type check / Lint / Build

```powershell
npm run typecheck
npm run lint
npm run build
```

### Deploy

```powershell
npm run deploy
```

`npm run deploy` は内部で `npm run build && wrangler deploy` を実行します。

---

## 7. Cloudflare設定

`wrangler.jsonc` の主要設定:

```text
Worker             plav
Static Assets      ./dist
API priority       /api/*
R2 Binding         AUDIO_BUCKET
R2 Bucket          yt-player-audio
Var                PLAV_OWNER_ID
Var                SUPABASE_URL
Secret             SUPABASE_SECRET_KEY
```

Secretの確認:

```powershell
npx wrangler secret list --name plav
```

Health check:

```powershell
Invoke-RestMethod "https://plav.take503503.workers.dev/api/health"
```

Tracks:

```powershell
Invoke-RestMethod "https://plav.take503503.workers.dev/api/tracks"
```

Storage:

```powershell
Invoke-RestMethod "https://plav.take503503.workers.dev/api/storage"
```

---

## 8. Supabase / R2

Plavは既存のSupabase Project / R2 Bucketを利用します。

### Supabase

- Project: `yt-player`
- Table: `public.tracks`
- PlavからはWorker経由でRead
- `owner_id = PLAV_OWNER_ID`
- `status = ready`
- DB構造はPlav側から変更しない

### R2

- Bucket: `yt-player-audio`
- Binding: `AUDIO_BUCKET`
- AudioはWorkerの `/api/media/:id` 経由
- Range request対応
- BrowserからR2 Object keyを直接指定しない

---

## 9. UIを変更するときの主な修正箇所

| 変更内容 | 主なファイル |
|---|---|
| Header / Nav / Home layout | `src/App.tsx`, `src/styles/app.css` |
| Homeの曲一覧 | `src/ui/Library.tsx`, `src/styles/app.css` |
| 長押し / Play next | `src/ui/Library.tsx`, `src/hooks/useLongPress.ts`, `src/audio.ts` |
| Download表示 | `src/ui/Library.tsx`, `src/offline.ts`, `src/styles/app.css` |
| Mini Player | `src/ui/CollapsedPlayer.tsx`, `src/ui/SeekBar.tsx`, `src/styles/player.css` |
| Player Sheet | `src/ui/PlayerSheet.tsx`, `src/hooks/useDraggableSheet.ts`, `src/ui/SeekBar.tsx`, `src/styles/player.css` |
| Queue / 並び替え | `src/ui/PlaybackQueue.tsx`, `src/hooks/useQueueReorder.ts`, `src/audio.ts`, `src/styles/player.css` |
| Seek / Next / Previous / Repeat / Shuffle | `src/audio.ts`, `src/ui/SeekBar.tsx`, `src/ui/PlayerSheet.tsx` |
| Settings | `src/ui/Settings.tsx`, `src/styles/app.css` |
| Local Cache | `src/offline.ts` |
| R2容量表示 | `src/cloud.ts`, `src/ui/Settings.tsx`, `worker/storage.ts` |
| Tracks取得 | `src/media.ts`, `worker/tracks.ts` |
| R2 Streaming | `worker/media.ts` |
| API Route | `worker/index.ts` |

---

## 10. 今後の修正はGit Patchで適用する

複数ファイルをZIPで上書きせず、原則 `.patch` 1ファイルで更新します。

### 適用前確認

```powershell
cd C:\Users\Shoya\Desktop\plav
git apply --check C:\path\to\plav_fix.patch
```

### 適用

```powershell
git apply C:\path\to\plav_fix.patch
```

### 確認・Deploy

```powershell
npm run build
npx wrangler deploy
```

### 取り消し

未CommitのPatchだけを戻す場合:

```powershell
git apply -R C:\path\to\plav_fix.patch
```

`git status` / `git diff` を確認してからCommitしてください。

---

## 11. 注意事項

- `SUPABASE_SECRET_KEY` をFrontendへ埋め込まない
- Secret値をREADME / Git / Screenshotへ残さない
- `yt-player` Supabase DB構造はPlav都合で変更しない
- `yt-player-audio` R2 Bucketを名称整理だけのために移行しない
- Cloud容量表示はR2の現在値であり、Cloudflare請求額そのものではない
- PWA CacheはOS / Safariの判断で削除される可能性がある
- Audio Cacheは端末ごとに独立している
- Video backendは現在未接続

---

## 12. 詳細仕様

これから保守に入る方は、まず要点だけをまとめた早見表から読むのがおすすめです。

**[`docs/MAINTAINER_GUIDE.md`](docs/MAINTAINER_GUIDE.md)**
ツール概観、画面と主なファイルの対応、軽微なUI調整時の修正箇所、触るときの注意点。

実装担当者向けのより詳細な情報は以下に集約します。

**[`docs/SPECIFICATION.md`](docs/SPECIFICATION.md)**
画面ごとの詳細な仕様・状態遷移・テスト観点。

開発中に発生した不具合とその原因・直し方、iPhone/PWA特有の制約と回避策、保守時の
チェックリストは以下にまとめています。初学者向けに噛み砕いて書いているので、
Player Sheet / Queue周りを触る前に一読をおすすめします。

**[`docs/DEVELOPMENT_NOTES.md`](docs/DEVELOPMENT_NOTES.md)**
