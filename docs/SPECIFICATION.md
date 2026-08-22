# Plav 詳細仕様書

**対象:** Plav v0.4.0
**用途:** ユーザー操作、保守、UI調整、障害調査、機能追加時の共通理解
**主対象端末:** iPhone / iOS PWA
**実装:** React + TypeScript + Vite + Cloudflare Workers + Supabase + Cloudflare R2

---

# 1. 文書の目的

本書はPlavの「何がどこで動いているか」を1つの資料で把握できるようにするための詳細仕様書です。

対象範囲:

- ユーザー向け操作
- UI構造
- Audio playback
- Playback Queue
- Play next
- Player Sheet gesture
- Local download / Cache
- Cloud storage表示
- PWA / Media Session
- Frontend / Worker / Supabase / R2間のデータフロー
- Cloudflare / Supabase設定
- API仕様
- ファイル責務
- UI調整時の修正箇所
- Build / Deploy / Patch運用
- テスト観点
- 既知の制約

---

# 2. システム概要

Plavは、FrontendとAPIを1つのCloudflare Workerへ統合したSame-Origin構成です。

```text
User
 │
 │ HTTPS
 ▼
Cloudflare Worker: plav
 │
 ├─ Static Assets
 │    └─ React / Vite PWA
 │
 └─ /api/*
      ├─ /api/health
      ├─ /api/tracks
      ├─ /api/media/:id
      └─ /api/storage
           │
           ├──────────────► Supabase
           │                public.tracks
           │
           └──────────────► Cloudflare R2
                            yt-player-audio
```

Browser側にはさらにCache Storageがあります。

```text
Audio playback request
        │
        ▼
Is track cached locally?
   │                │
  Yes              No
   │                │
   ▼                ▼
Cache Storage    /api/media/:id
   │                │
   └──────┬─────────┘
          ▼
       <audio>
```

---

# 3. 技術スタック

| Layer | Technology | Role |
|---|---|---|
| UI | React | Component rendering |
| Language | TypeScript | Frontend / Worker共通 |
| Build | Vite | Frontend build / dev server |
| Icon | lucide-react | UI icon |
| Hosting | Cloudflare Workers Static Assets | PWA配信 |
| API | Cloudflare Worker | tracks / media / storage |
| Metadata DB | Supabase Postgres | tracks metadata |
| Media storage | Cloudflare R2 | MP3 Object storage |
| Local media | Cache Storage | iPhone内のAudio保存 |
| Player | HTMLMediaElement | `<audio>` / `<video>` |
| OS integration | Media Session API | Lock Screen controls |
| Deployment | Wrangler | Build / deploy / binding |

---

# 4. Project構造と責務

```text
src/
├─ App.tsx
├─ audio.ts
├─ video.ts
├─ media.ts
├─ offline.ts
├─ cloud.ts
├─ main.tsx
├─ ui/
├─ hooks/
└─ styles/

worker/
├─ index.ts
├─ tracks.ts
├─ media.ts
└─ storage.ts
```

## 4.1 Frontend core

### `src/App.tsx`

責務:

- Home / Settings Page state
- Audio / Video tab state
- Media list保持
- Audio / Video controller生成
- Library / Player / Settingsの組み立て
- AudioとVideoの排他制御
- Navigation

変更例:

- Header位置
- Nav項目
- Audio/Video tab
- Playerの表示条件
- Page追加

### `src/media.ts`

責務:

- `MediaItem` 型
- `/api/tracks` 取得
- API Track → MediaItem変換
- title / extension / time utility

現在の `MediaItem`:

```ts
type MediaItem = {
  id: string
  title: string
  type: "audio" | "video"
  url?: string
  durationSeconds?: number
}
```

現在の本番 `/api/tracks` はAudioのみをMediaItemへ変換します。

### `src/audio.ts`

Audio Playerの中心です。

保持する主な状態:

```text
history
currentItem
upNext
isPlaying
currentTime
seekPreviewTime
duration
isRepeat
```

責務:

- Audio source選択
- Local Cache優先再生
- Play / Pause
- Previous / Next
- Seek preview / commit
- Shuffle
- Repeat
- History
- Up Next
- Play next
- Queue reorder
- Media Session

### `src/video.ts`

責務:

- Video source
- Play / Pause
- Seek
- Skip
- Close
- Fullscreen

現在BackendからVideo itemを供給していないため、実運用では拡張用ロジックです。

### `src/offline.ts`

責務:

- Cache Storage feature detection
- Audio download
- Audio delete
- Download status
- Auto save
- Cached AudioのBlob URL生成
- Persistent Storage request

Cache名:

```text
plav-media-v1
```

Auto save設定キー:

```text
plav:auto-download
```

### `src/cloud.ts`

責務:

- `/api/storage` 呼び出し
- 5分間のFrontendメモリキャッシュ
- byte表示変換

---

# 5. UI Components

## 5.1 `Library.tsx`

Homeの楽曲リストを担当します。

主な操作:

```text
Short tap on title
  → play now

Long press on title
  → Detail Sheet
      ├─ Play next
      ├─ 編集アイコン → タイトル編集（PATCH /api/tracks/:id）
      └─ Delete → 確認ダイアログ → 完全削除（DELETE /api/tracks/:id）

Tap download icon
  → Download / Remove local cache
```

長押し判定:

```text
450 ms
```

長押し成立前に10pxを超えて移動すると長押しをキャンセルし、通常スクロールを優先します。

iOS文字選択対策:

- `user-select: none`
- `-webkit-user-select: none`
- `-webkit-touch-callout: none`
- PointerDown中のGlobal selection lock
- `selectstart` preventDefault
- Selection range clear

Detail SheetはMini Player表示中、Mini Playerの上へ配置します。

### Home: ソート

`.home-toolbar`内の`.sort-button`をタップするたびに、以下の3モードを順に切り替えます
（`src/media.ts`の`SortMode` / `sortItems`、状態は`src/App.tsx`）。

```text
dateAddedDesc (Newest) → dateAddedAsc (Oldest) → titleAsc (A–Z) → (先頭へ戻る)
```

選択中のモードは`localStorage`（キー: `plav:sort-mode`）へ保存し、次回起動時も維持します。

**再生キューとの関係**: `useAudioPlayer`へ渡す曲一覧は、Home表示用にmediaType
（Audio/Video）で絞り込む**前**にこのソートを適用したものです。そのため、Up Nextは
常にHomeで現在選択中の並び順を引き継ぎます。この設計に至った経緯・踏んだ罠は
[`DEVELOPMENT_NOTES.md`](./DEVELOPMENT_NOTES.md) の「1-6」を参照してください。

### Detail Sheet: タイトル編集

編集アイコンをタップすると、タイトル表示部分が`<input>` + Save/Cancelへ切り替わります
（拡張子部分は編集対象から除き、保存時に元の拡張子を付け戻します）。保存が成功すると
編集UIは閉じ、Detail Sheetはそのまま開いたまま新しいタイトルを表示します
（`Library.tsx`はDetail Sheetの対象をID（`detailItemId`）だけで保持し、表示するitemは
毎回`items`から都度検索して取り出す実装のため、親から渡される`items`が更新されれば
自動的に反映されます。詳細は [`DEVELOPMENT_NOTES.md`](./DEVELOPMENT_NOTES.md) の
「1-7」を参照）。保存に失敗した場合はSheetを閉じずにエラーメッセージを表示します。

### Detail Sheet: 完全削除

`Delete`ボタンをタップすると`window.confirm`で確認し、承諾された場合のみ削除を実行します。
成功するとDetail Sheetを閉じ、Homeの一覧からも即座に取り除きます。ローカルCacheへ
ダウンロード済みだった場合は、そのキャッシュエントリも合わせて削除します
（`offline.ts`の`removeDownload`）。削除に失敗した場合はSheetを閉じずにエラー
メッセージを表示します。

再生キュー（History / Current / Up Next）に既に乗っている曲を削除した場合、キュー自体
からは自動的には取り除かれません（キューはHomeの一覧とは独立したセッション内の
スナップショットのため）。詳細は「10.4 `DELETE /api/tracks/:id`」を参照してください。

## 5.2 `CollapsedPlayer.tsx`

Audio再生中に常時表示するMini Playerです。

責務:

- Current title
- Play/Pause
- Progress
- Player Sheet open

## 5.3 `PlayerSheet.tsx`

Audioの詳細操作画面です。

状態:

```text
Half
Expanded
```

主なUI:

- Current title
- Playback Queue
- Seek
- Previous
- Play/Pause
- Next
- Shuffle
- Repeat

Sheet gestureとQueue scrollが競合しないよう、Pointer eventの優先度を調整しています。

## 5.4 `PlaybackQueue.tsx`

表示順:

```text
History
Current
Up Next
```

### History

短いタップ:

```text
その履歴位置まで巻き戻して再生
```

### Current

現在再生中の曲です。

### Up Next

短いタップ:

```text
その曲を今すぐ再生
```

### History / Up Next 共通: 長押し + Drag

History行・Up Next行のどちらも同じ長押しDragで並び替え・移動できます。

```text
150 ms hold
   ↓
浮いたDrag Preview表示
   ↓
上下Drag
   ↓
同一リスト内reorder、または
再生中トラックを跨いでHistory ⇔ Up Next間を移動
   ↓
Pointer releaseで確定
```

移動先の判定は各行の `data-queue-list` / `data-queue-index` を `document.elementFromPoint` で読み取り、`useQueueReorder.ts` の `onMove(from, to)` (`QueuePosition = { list, index }`) 経由で `audio.ts` の `moveQueueItem` を呼び出します。同一リスト内なら配列内move、リストを跨ぐ場合は移動元から削除して移動先へ挿入し、いずれも `flushSync` で同期commitします（History/Up Nextが別々の`useState`のため、非同期batchだと更新順がずれて壊れることがあるため）。

Pointer captureは並び替え対象の行自体ではなく、常に位置が変わらない祖先 `.queue-list`（`captureTarget`）に対して行います。対象行はreorderでDOM上の位置が変わるため、行自体にcaptureすると`lostpointercapture`で意図せずDragが中断してしまうためです。

並び替え中は:

- 文字選択禁止
- Sheet swipe抑止（`pointerdown`時点で`stopPropagation`し、Player SheetのDrag-to-close/resizeへ横取りされないようにする）
- PreviewはPortalでbody直下へ描画
- Queue端でAuto scroll
- Drag終了直後の誤Click抑止

## 5.5 `Settings.tsx`

Sections:

```text
Downloads
Cloud
App
About
```

---

# 6. Audio Playback Session仕様

Plavの連続再生は単純なLibrary indexではなく、以下の3要素で管理します。

```text
[ history ] [ current ] [ upNext ]
```

例:

```text
History          Current        Up Next
A, B             C              D, E, F
```

Next:

```text
A, B, C          D              E, F
```

Previous:

```text
A, B             C              D, E, F
```

## 6.1 Homeから曲を通常再生

Library内の曲 `C` を選択:

```text
history = []
current = C
upNext = Cより後ろのLibrary items
```

これは新しいPlayback Sessionとして扱います。

## 6.2 Play next

HomeでAudioを長押しし `Play next`:

```text
current = C
upNext = D, E, F
```

EをPlay next:

```text
upNext = E, D, F
```

既にUp Next内に対象曲がある場合、一度取り除いて先頭へ移動します。

現在曲自身をPlay nextへ指定した場合は、現在曲終了後に同じ曲を1回再生できます。

まだAudioを1曲も開始していない場合、`Play next` はDisabledです。

## 6.3 Repeat

Repeatは現在のPlayback Session全体を同じ順番でもう1巡します。

## 6.4 Shuffle

Home Shuffle:

```text
Library全体をshuffle
→ 先頭をCurrent
→ 残りをUp Next
```

Player Sheet Shuffle:

```text
History / Currentは維持
Up Nextのみshuffle
```

## 6.5 Previous

App UI:

- Current position > 3秒 → 曲頭へ
- 3秒以下 → Previous track

Lock Screen Previous:

- 3秒ルールなし
- 常にPrevious track

---

# 7. Seek仕様

iPhoneでSeek sliderを動かすたびにR2 Range requestを発生させない設計です。

```text
Drag start
  ↓
previewSeek
  ↓
UI上の時間だけ更新
  ↓
Pointer release
  ↓
commitSeek
  ↓
audio.currentTimeを1回変更
```

これによりSeek中のCloud request増加とUI負荷を抑えます。

---

# 8. Local Download / Cache仕様

## 8.1 保存

```text
User taps Download
        │
        ▼
GET /api/media/:id
Range headerなし
        │
        ▼
HTTP 200 full audio
        │
        ▼
Cache Storage
plav-media-v1
```

Partial Content (`206`) は保存対象にしません。Audio全体の `200` Responseのみ保存します。

## 8.2 再生時

```text
startAudioItem(item)
        │
        ▼
Cache Storage lookup
   │            │
 hit           miss
   │            │
 Blob URL       item.url
   │            │
   └──────┬─────┘
          ▼
      audio.src
```

Cached Audioは`Blob URL`として再生し、曲変更時に古いObject URLをrevokeします。

## 8.3 削除

Check iconをタップするとCache entryを削除します。

## 8.4 Auto save

Auto save ON:

```text
Audio list
  ↓
1曲ずつCache確認
  ↓
未保存ならDownload
  ↓
次の曲
```

並列で全曲Downloadしない設計です。

## 8.5 永続性

`navigator.storage.persist()` をbest-effortで要求します。

ただしiOS / Safari / OS側が永続化を保証するわけではありません。端末容量不足等によりCacheが削除される可能性があります。

---

# 9. Cloud Storage表示仕様

## 9.1 Frontend

`src/cloud.ts` → `GET /api/storage`

Frontend内の取得結果は5分間メモリキャッシュします。

SettingsのR2 rowをタップした場合はforce refreshします。

## 9.2 Worker

`worker/storage.ts` が `AUDIO_BUCKET.list()` をページングし、Objectの `size` を合計します。

Response例:

```json
{
  "usedBytes": 180000000,
  "objectCount": 32,
  "freeTierBytes": 10000000000,
  "usagePercent": 1.8,
  "checkedAt": "2026-08-21T15:00:00.000Z"
}
```

## 9.3 表示判定

```text
< 80%       OK
80 - 99.9%  Near limit
>= 100%     Over limit
```

## 9.4 課金チェックとしての制約

Plavが表示するのは「今この瞬間にBucketへ存在するObjectの合計サイズ」です。

Cloudflare R2 Standard無料枠の主要項目は、2026-08時点で:

```text
Storage            10 GB-month / month
Class A Operations 1 million / month
Class B Operations 10 million / month
Egress             Free
```

ただし:

- Storage請求はGB-month
- 日次Peak storageの平均で計算
- Plav画面は月間平均ではなく現在値
- Class A/Bの月間利用回数はPlavでは表示しない
- `/api/storage` 自身のR2 listはClass A operation

したがって、SettingsのCloud表示は「容量の早期警告」であり、Cloudflare Billing Dashboardの代替ではありません。

---

# 10. Worker API仕様

Base URL:

```text
https://plav.take503503.workers.dev
```

## 10.1 `GET /api/health`

目的:

- Worker routing確認
- Deploy後のSmoke test

Response:

```json
{
  "status": "ok",
  "service": "plav"
}
```

## 10.2 `GET /api/tracks`

目的:

- Audio Library metadata取得

WorkerはSupabase RESTへ以下の条件で問い合わせます。

```text
owner_id = PLAV_OWNER_ID
status   = ready
order    = created_at desc, id desc
```

Frontend向け主要Response:

```json
{
  "tracks": [
    {
      "id": "uuid",
      "title": "track title",
      "durationSeconds": 215,
      "mediaUrl": "/api/media/uuid",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "fileSizeBytes": 5242880
    }
  ]
}
```

`createdAt`はHomeのソート機能（追加日順）のために、`fileSizeBytes`はSettings > Downloads
の「Saved」欄でダウンロード済み合計サイズを表示するために、それぞれFrontendへ返しています
（`fileSizeBytes`はSupabaseの`file_size_bytes`カラムをそのまま転送しているだけで、
Cache Storageの実ファイルを読みには行きません）。

## 10.3 `PATCH /api/tracks/:id`

目的:

- 曲タイトルの更新（Home長押し → Detail Sheet → 編集アイコン）

Request body:

```json
{ "title": "new title.mp3" }
```

`title`が空文字列の場合は`400 INVALID_TITLE`を返します。SupabaseのRESTへ
`owner_id = PLAV_OWNER_ID`かつ`id = :id`の条件でPATCHします（`worker/tracks.ts`の
`updateTrackTitle`）。拡張子込みのtitleをそのまま保存するため、Frontend側
（`Library.tsx`のDetail Sheet編集UI）で表示用に外した拡張子を保存時に付け戻します。

Response: `{ "ok": true }`

## 10.4 `DELETE /api/tracks/:id`

目的:

- 曲の完全削除（Home長押し → Detail Sheet → Delete、確認ダイアログ後に実行）

処理（`worker/tracks.ts` / `worker/media.ts`）:

```text
track id
  ↓
findTrackでaudio_key確認（見つからなければ404 TRACK_NOT_FOUND）
  ↓
R2 AUDIO_BUCKET.delete(audio_key)
  ↓
SupabaseのtracksレコードをDELETE（owner_id + id条件）
```

Supabaseのレコードと R2 のファイルを両方削除する完全削除方式を採用しています
（論理削除ではありません）。これはSettings > Cloudの容量表示と実際の使用量を
一致させるための意図的な選択です。**元に戻せません。** Frontend側
（`Library.tsx`のDetail Sheet）では実行前に`window.confirm`で確認を挟みます。

削除対象がローカルCacheへダウンロード済みだった場合、Frontend側で
`offline.ts`の`removeDownload`も呼び出し、Cache Storageの該当エントリも
合わせて削除します（削除後も孤立したキャッシュが端末に残り続けるのを防ぐため）。

削除時に対象の曲がPlayer Sheetの再生キュー（History / Current / Up Next）に
既に乗っていた場合、そのキューへは反映されません（キューはLibraryとは独立した
セッション内スナップショットのため）。再生中に削除した場合、その回の再生は
そのまま最後まで（またはエラーになるまで）続行されます。

Response: `{ "ok": true }`

## 10.5 `GET /api/media/:id`

目的:

- R2 Audio delivery

対応:

- GET
- HEAD
- Range request
- 206 Partial Content
- 416 Range Not Satisfiable

主なResponse headers:

```text
Content-Type
Content-Length
Content-Range      # Range時
Accept-Ranges: bytes
ETag
X-Content-Type-Options: nosniff
Cache-Control: private, no-store
```

処理:

```text
track id
  ↓
Supabaseからowner/status/audio_key確認
  ↓
R2 AUDIO_BUCKET.get(audio_key)
  ↓
Rangeに合わせてResponse
```

## 10.6 `GET /api/storage`

目的:

- R2現在容量取得

R2 Object内容やObject key一覧はFrontendへ返さず、集計値だけ返します。

---

# 11. Supabase仕様

Project:

```text
yt-player
```

Plavは既存の共有Table `public.tracks` を利用します。

現行Column:

```text
id                  uuid
owner_id            uuid
title               text
audio_key           text
duration_seconds    integer
file_size_bytes     bigint
status              enum
created_at           timestamptz
source_key           text nullable
```

Status enum:

```text
processing
ready
deleting
```

Plavが通常読むのは `ready` のみです。

重要方針:

- Plavの都合でTable構造を変更しない
- Plavの都合でAuthを停止しない
- 既存RLS / Indexは他アプリへの影響を考慮する
- FrontendからSecret keyを使用しない
- Secret keyはCloudflare Workerのみで使用する

---

# 12. Cloudflare構成

## 12.1 Worker

```text
name: plav
main: worker/index.ts
```

Static Assets:

```text
directory: ./dist
not_found_handling: single-page-application
run_worker_first: /api/*
```

意味:

- `/api/*` は必ずWorker routingへ先に渡す
- その他はVite build assetsを配信
- SPA fallbackを利用

## 12.2 Vars

```text
PLAV_OWNER_ID
SUPABASE_URL
```

機密情報ではない設定値です。

## 12.3 Secret

```text
SUPABASE_SECRET_KEY
```

Cloudflare Secretとして保存し、Gitへ書きません。

## 12.4 R2 Binding

```text
binding: AUDIO_BUCKET
bucket:  yt-player-audio
```

Physical Bucket名は既存資産のため、名称整理だけを目的に変更しません。

---

# 13. PWA仕様

Manifest:

```text
public/site.webmanifest
```

Icons:

```text
public/icons/
```

iPhoneではSafariからHome Screenへ追加して利用します。

iOSはHome Screen icon / app nameを強くCacheするため、ManifestやIcon変更が反映されない場合は一度Home Screenから削除して再追加することがあります。

Plavは現状、独自Service WorkerによるApp Shellの完全Offline化は行っていません。

そのため:

- Audio fileのローカル保存は可能
- 既に画面が読み込まれている状態では保存曲をLocal Cacheから再生可能
- ネット完全切断後にアプリを新規起動してLibrary metadataまで完全復元することは保証しない

---

# 14. Media Session / iOS仕様

Audio再生時に `navigator.mediaSession` を使用します。

主な連携:

- Metadata title
- Artist `Plav`
- Artwork
- playbackState
- Play
- Pause
- Previous
- Next
- SeekTo
- Position state

iOSではJavaScriptからシステムMedia volumeを自由に変更できないため、Plav内の独自Volume UIは持ちません。音量はiPhoneの物理ボタン / Control Centerで操作します。

---

# 15. Settings仕様

## Downloads

| Item | Behavior |
|---|---|
| Auto save | ON/OFFをlocalStorageへ保持 |
| Saved | `Downloaded / Total · 合計サイズ`（例: `1 / 2 · 4 MB`）。サイズはSupabase由来の`fileSizeBytes`をダウンロード済みの曲だけ合算し、`formatStorage`で整形（Cache Storageの実ファイルは読まない） |

## Cloud

| Item | Behavior |
|---|---|
| R2 storage | 現在容量 / free-tier reference |
| Meter | percentage |
| Files | Object count |
| Tap | force refresh |

## App

- Version
- Update app / Load latest

## About

| Item | Behavior |
|---|---|
| Plav | `Personal media player` |
| Released | `import.meta.env.VITE_BUILD_DATE` をフォーマットして表示（ビルド時点のタイムスタンプ = そのバージョンのリリース日時） |
| Repository | GitHubリポジトリへの外部リンク（`target="_blank"`）。表示値は`REPOSITORY_URL`から導出した`owner/repo`（例: `shoya44/plav ↗`） |

`VITE_BUILD_DATE` は `vite.config.ts` の `define` でビルド時に `new Date().toISOString()` として埋め込まれます（`src/vite-env.d.ts` で型宣言）。

---

# 16. CSS / UI設計方針

CSSはComponentごとに細分化せず2ファイルへ集約します。

## `src/styles/app.css`

対象:

- Global tokens
- App shell
- Header
- Media tabs
- Home library
- Long press guard
- Detail Sheet
- Download buttons
- Bottom Navigation
- Settings
- Cloud storage meter

## `src/styles/player.css`

対象:

- Collapsed Player
- Queue
- Queue drag preview
- Player Sheet
- Sheet snap / gesture
- Seek
- Player controls
- Video Player

## UI変更時の原則

```text
状態 / 挙動を変える → TS/TSX
色 / spacing / size → CSS
Backend dataを変える → worker/*
```

見た目だけの調整で `audio.ts` やWorkerを変更しないようにします。

---

# 17. UI調整チートシート

## Header logo / version

```text
src/App.tsx
src/styles/app.css
public/icons/plav-header-mark.svg
```

## Bottom nav

```text
src/App.tsx
src/styles/app.css
```

## Home row height / font / spacing

```text
src/styles/app.css
.media-row
.media-row-main
.media-title
```

## Home sort

```text
src/App.tsx
src/media.ts
SortMode
sortItems
SORT_MODES / SORT_LABELS / SORT_ICONS
.home-toolbar
.sort-button
```

## Download icon

```text
src/ui/Library.tsx
src/styles/app.css
.media-download-button
```

## Long press duration

```text
src/ui/Library.tsx
src/hooks/useLongPress.ts
LONG_PRESS_MS
MOVE_CANCEL_PX
```

## Detail Sheet: title edit / delete

```text
src/ui/Library.tsx
.detail-title-edit-button
.detail-title-edit
.detail-delete
src/media.ts
updateTrackTitle / deleteTrack
worker/tracks.ts
worker/media.ts
```

## Play next Sheet

```text
src/ui/Library.tsx
src/styles/app.css
.detail-sheet
.detail-play-next
```

## Mini Player

```text
src/ui/CollapsedPlayer.tsx
src/styles/player.css
```

## Player Sheet height / snap

```text
src/ui/PlayerSheet.tsx
src/hooks/useDraggableSheet.ts
src/styles/player.css
```

## Queue row / drag

```text
src/ui/PlaybackQueue.tsx
src/hooks/useQueueReorder.ts
src/audio.ts
src/styles/player.css

HOLD_TO_REORDER_MS
HOLD_CANCEL_DISTANCE
```

## Seek

```text
src/audio.ts
src/ui/SeekBar.tsx
src/ui/PlayerSheet.tsx
src/ui/CollapsedPlayer.tsx
src/styles/player.css
```

## Settings layout

```text
src/ui/Settings.tsx
src/styles/app.css
```

---

# 18. Build / Deploy

## Local verification

```powershell
cd C:\Users\Shoya\Desktop\plav
npm run typecheck
npm run lint
npm run build
```

## Deploy

```powershell
npx wrangler deploy
```

または:

```powershell
npm run deploy
```

## Post-deploy Smoke Test

```powershell
Invoke-RestMethod "https://plav.take503503.workers.dev/api/health"
Invoke-RestMethod "https://plav.take503503.workers.dev/api/tracks"
Invoke-RestMethod "https://plav.take503503.workers.dev/api/storage"
```

Range test例:

```powershell
$tracks = Invoke-RestMethod "https://plav.take503503.workers.dev/api/tracks"
$track = $tracks.tracks[0]

curl.exe -r 0-1023 `
  -D - `
  -o NUL `
  "https://plav.take503503.workers.dev$($track.mediaUrl)"
```

期待:

```text
HTTP 206
Accept-Ranges: bytes
Content-Range: bytes 0-1023/...
Content-Length: 1024
```

---

# 19. Git Patch運用

今後の変更配布は原則1つの `.patch` にまとめます。

## Apply前

```powershell
git status
git apply --check C:\path\to\patch.patch
```

## Apply

```powershell
git apply C:\path\to\patch.patch
```

## Diff確認

```powershell
git diff
```

## Build

```powershell
npm run build
```

## Deploy

```powershell
npx wrangler deploy
```

## Commit

```powershell
git add .
git commit -m "Update Plav"
git push origin main
```

Patchを適用できない場合、無理にファイルを上書きせず、現在の `git diff` と対象ファイルを確認してPatchを作り直します。

---

# 20. テスト仕様

## 20.1 Home

- Audio listが表示される
- 通常Tapで再生
- Current titleがaccent表示
- Long pressでDetail Sheet
- Long press時に文字選択しない
- Vertical scroll時に長押し扱いにならない
- Detail SheetがMini Playerと重ならない
- Play nextがCurrent再生中に使用可能
- ソートボタンでNewest / Oldest / A–Zが順に切り替わる
- 選択したソートがリロード後も維持される（`localStorage`）
- ソート変更後にUp Nextが新しい並び順を引き継ぐ
- Detail Sheetのタイトル編集で保存後にHomeとDetail Sheet両方の表示が更新される
- タイトル編集の保存失敗時、Detail Sheetを閉じずにエラーを表示する
- Delete実行前に確認ダイアログが出る
- 削除成功後、Detail Sheetが閉じHomeの一覧から即座に消える
- 削除失敗時、Detail Sheetを閉じずにエラーを表示する

## 20.2 Mini Player

- Current title
- Play / Pause
- Progress
- Player Sheet open
- Bottom Navと干渉しない

## 20.3 Player Sheet

- Open / Closeがそれぞれアニメーション付きでシームレスに遷移する（`player-sheet-enter` / `is-closing`、Mini Player ⇔ Sheet切り替えを含む）
- Half / Expanded
- Long press時に文字選択しない
- Queue scroll
- Seek
- Previous
- Next
- Repeat
- Shuffle

## 20.4 Queue

- History表示
- Current表示
- Up Next表示
- Up Next tapで即再生
- History tapでその位置まで巻き戻して再生
- 短いtapではreorderしない
- 長押しでPreviewが浮く
- Dragで同一リスト内が並び替わる
- Up Next → History（再生中トラックより上）へDragで移動できる
- History → Up NextへDragで移動できる
- 複数hop（1回のDragで複数行を跨ぐ移動）でも並び替えが継続する
- Drag中に文字選択しない
- Drag終了直後に誤再生しない

## 20.5 Download

- 未保存 → Download icon
- Download中 → Spinner
- 完了 → Check
- Check tap → Delete
- 保存済み曲を再生
- Network requestなしでLocal Cache sourceを選択できる
- Auto save ON/OFF保持

## 20.6 Cloud

- `/api/storage` 200
- Settingsに容量表示
- Refresh可能
- 80% / 100%の表示tone

## 20.7 iOS

- Home Screen起動
- Safe area
- Long press selection抑止
- Lock Screen metadata
- Lock Screen play/pause
- Lock Screen previous/next
- Physical volume controls

---

# 21. 障害切り分け

## 曲一覧が出ない

```text
/api/health
  ↓
/api/tracks
  ↓
Supabase Secret / URL / owner filter
```

確認:

```powershell
Invoke-RestMethod "https://plav.take503503.workers.dev/api/health"
Invoke-RestMethod "https://plav.take503503.workers.dev/api/tracks"
```

## 曲が再生できない

```text
/api/tracks の mediaUrl
  ↓
/api/media/:id
  ↓
Supabase audio_key
  ↓
R2 object
```

Range testを行います。

## R2 storageがUnavailable

まず:

```powershell
curl.exe -i "https://plav.take503503.workers.dev/api/storage"
```

- `404` → Workerのstorage route未反映
- `500` → R2 list / binding側
- `200` → Frontend表示 / PWA cache側

## PWAが古い

```text
Settings
→ App
→ Update app
→ Load latest
```

それでもIcon / App名が古い場合はHome Screenへの再追加を検討します。

---

# 22. Security / 運用上の注意

## Secret

`SUPABASE_SECRET_KEY` はWorker secretのみで管理します。

禁止:

```text
src/*
README
Git commit
Screenshot
.envをCommit
```

## API

現状Plav API自体にユーザー認証は設けていません。

`PLAV_OWNER_ID` をWorker側へ固定し、特定ownerのready tracksだけを取得します。個人利用前提の設計です。

一般公開サービスへ拡張する場合は認証・認可を別途設計する必要があります。

## `/api/storage`

外部へ返すのは以下のみです。

- usedBytes
- objectCount
- freeTierBytes
- usagePercent
- checkedAt

Object keyやファイル名は返しません。

---

# 23. 現在の既知制約

1. **Video data source未接続**
   Video UIは存在するが本番tracks APIはAudioのみ。

2. **完全Offline PWAではない**
   Audio CacheはあるがApp Shell / metadataを完全Offline化していない。

3. **Local Cacheは端末依存**
   OSによる削除の可能性あり。

4. **Cloud usageはStorage snapshotのみ**
   Class A/B月間operation数は表示しない。

5. **Playback stateはSession only**
   History / Up Nextをアプリ再起動後へ永続化しない。

6. **API認証なし**
   個人利用前提。一般公開用途には追加設計が必要。

---

# 24. 将来追加する場合の優先候補

現在の個人用Playerとして必須ではありませんが、拡張する場合は以下の順が自然です。

```text
1. Full offline metadata / App Shell
2. Downloaded only filter
3. Local storage usage表示
4. Queue persistence
5. Search
6. Video backend connection
7. Cloud usage operation monitoring
8. Authentication（一般公開する場合）
```

---

# 25. 現行構成の評価

現在のファイル分割は、規模に対して適切です。

```text
App composition
Domain logic
UI
Styles
Worker routes
Worker responsibilities
```

が分離されています。

今後も「ファイル数を減らすための統合」は行わず、1ファイルの責務が大きくなった時だけ分割します。

特に以下は独立維持します。

```text
CollapsedPlayer.tsx
PlayerSheet.tsx
PlaybackQueue.tsx
```

Mini Player、Sheet gesture、Queue reorderは操作特性が異なり、1つへ統合すると保守性が低下するためです。

---

# 26. 最終運用ルール

通常の変更:

```text
Patch受領
  ↓
git apply --check
  ↓
git apply
  ↓
git diff
  ↓
npm run build
  ↓
wrangler deploy
  ↓
PWA Update app
  ↓
実機確認
  ↓
Git commit / push
```

Cloud / DB変更を伴う場合:

```text
Code change
  ↓
Config / Secret / Binding確認
  ↓
API smoke test
  ↓
Frontend smoke test
  ↓
iPhone実機確認
```

この2フローを基本とします。
