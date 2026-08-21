# Plav

iPhone / PWA向けの個人用Audio / Video Player。

この版では、旧 `plav`（Frontend）と `plav-api`（API Worker）を **1つのPlav Worker** に統合しています。

## 全体フロー

```text
iPhone / PWA
    │
    ▼
Cloudflare Worker: plav
    │
    ├─ /, /assets/*        → React / Vite
    │
    └─ /api/*
         │
         ├─ /api/tracks    → Supabase tracks
         │
         └─ /api/media/:id → R2 yt-player-audio
                               │
                               └─ Range Streaming → <audio>
                                                      │
                                                      └─ iOS Media Session
```

FrontendとAPIが同じOriginになるため、旧構成で必要だった
`VITE_API_BASE_URL` / `ALLOWED_ORIGINS` / 別Worker URLは不要です。

## ディレクトリ

```text
plav/
├─ public/
│  ├─ icons/              # PWA / Lock Screen / Header icon
│  └─ site.webmanifest
│
├─ src/
│  ├─ main.tsx            # React起動
│  ├─ App.tsx             # 画面全体の組み立て
│  ├─ media.ts            # Media型・曲一覧API・表示用utility
│  ├─ audio.ts            # Audio再生・Queue・Media Session
│  ├─ video.ts            # Video再生
│  │
│  ├─ ui/
│  │  ├─ Library.tsx      # 曲一覧 + 長押しDetail
│  │  ├─ CollapsedPlayer.tsx
│  │  ├─ PlayerSheet.tsx
│  │  ├─ PlaybackQueue.tsx
│  │  ├─ VideoPlayer.tsx
│  │  └─ Settings.tsx
│  │
│  └─ styles/
│     ├─ app.css          # 共通・Home・Library・Settings・Navigation
│     └─ player.css       # Bottom Sheet・Audio/Video Player
│
├─ worker/
│  ├─ index.ts            # API routing / error handling
│  ├─ tracks.ts           # Supabase
│  └─ media.ts            # R2 / Range streaming
│
├─ index.html
├─ package.json
├─ package-lock.json
├─ tsconfig.json
├─ vite.config.ts
└─ wrangler.jsonc
```

### 分割ルール

- **画面全体の流れ** → `App.tsx`
- **再生状態・操作** → `audio.ts` / `video.ts`
- **見た目・操作部品** → `ui/`
- **外部データ** → `media.ts` / `worker/tracks.ts`
- **MP3配信** → `worker/media.ts`

「1要素ごとにTSX + CSS」はやめ、CSSは2ファイルへ集約しています。

## 旧版から削除したもの

- Desktopの独立した `plav-api/`
- Frontendの `src/api.ts`
- Frontendから直接Supabaseへ接続する `src/lib/supabase.ts`
- `@supabase/supabase-js`
- `appInfo.ts`
- ComponentごとのCSS 7ファイル
- `tree.txt`
- `public/media/test*.mp3`
- `public/media/test-video*.mp4`
- 編集用アイコンmaster / 1024px中間ファイル
- `VITE_API_BASE_URL`
- API用CORS設定

Videoの再生ロジック自体は残していますが、現在のSupabase `tracks` がAudioのみなので
Videoタブにはデータは表示されません。

## 初回セットアップ

```powershell
cd C:\Users\Shoya\Desktop\plav
npm install
npm run build
```

`npm run build` はFrontendとWorker TypeScriptをまとめて型チェックします。

## Cloudflare移行

この構成では既存の `plav` Worker自身がAPIも担当します。

### 1. Supabase Secretをplav Workerへ登録

```powershell
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

値にはSupabaseの `sb_secret_...` Secret keyを入力します。
SecretはGitへ保存しません。

### 2. Deploy

```powershell
npm run deploy
```

または、GitHubへPushして現在のCloudflare Buildsを利用します。

既存設定が

```text
Build command  : npm run build
Deploy command : npx wrangler deploy
Production     : main
```

ならそのまま利用できます。

### 3. 確認

```text
https://plav.take503503.workers.dev/api/health
https://plav.take503503.workers.dev/api/tracks
https://plav.take503503.workers.dev/
```

曲一覧・再生・Seek・Player Sheet・Lock Screen操作まで確認します。

問題なければ旧 `plav-api` Workerと
`C:\Users\Shoya\Desktop\plav-api` は削除できます。

## Local development

```powershell
npm run dev
```

Viteの `/api` は、本番 `plav.take503503.workers.dev` へproxyします。
そのため `.env.local` は不要です。

## よく触る場所

UI変更:
```text
src/App.tsx
src/ui/*
src/styles/*
```

再生ロジック:
```text
src/audio.ts
src/video.ts
```

Supabase / R2:
```text
worker/tracks.ts
worker/media.ts
```

通常はこの4領域以外を触る必要はありません。
