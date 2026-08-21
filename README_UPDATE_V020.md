# Plav v0.2.0

## Changes

- iPhoneで制御できないアプリ内音量スライダー / mute UIをAudio・Videoともに削除
  - iPhoneの音量は本体の音量ボタンで操作
- Bottom Navigationをコンパクト化
  - icon: 30px -> 24px
  - nav height: 58px -> 54px
  - tap areaは54pxを維持
- Headerロゴ右側に `v0.2.0` を小さく表示
- Settings > App に `Update app / Load latest` を追加
  - 最新の `/index.html` を `cache: no-store` + cache-busting queryで確認
  - 成功後にPWAを最新URLへ再読込
- versionは `package.json` を基準にVite build時に画面へ埋め込み

## Replace

```text
package.json
vite.config.ts
src/App.tsx
src/audio.ts
src/video.ts
src/ui/PlayerSheet.tsx
src/ui/VideoPlayer.tsx
src/ui/Settings.tsx
src/styles/app.css
src/styles/player.css
```

## Test

```powershell
npm install
npm run build
npm run dev
```

本番反映後は Settings > App > Update app から、
PWA自身を最新デプロイへ再読込できます。

※ iOSのホーム画面アイコン自体はOS側キャッシュのため、
アイコン更新時だけはPWAの再追加が必要になる場合があります。
