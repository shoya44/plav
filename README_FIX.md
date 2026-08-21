# iPhone interaction fix

対象: refactored Plav の iPhone 操作不具合 3点。

## 修正内容

1. Collapsed Player -> Player Sheet
   - `touchstart/touchend` のみの判定をやめ、Pointer Eventsで上方向18pxを検出した時点で開く。
   - Play / Next / Seek操作はスワイプ判定から除外。
   - Player Sheet自体のdragは、毎frame React state + getComputedStyle を更新せず、CSS変数をDOMへ直接反映。
   - Half -> Expandedの判定距離を短くして、一度の自然なスワイプで反応しやすくした。

2. Volume
   - iOS Safari/PWAでは `HTMLMediaElement.volume` をアプリ内スライダーで端末音量として制御できないため、iPhoneではスライダーを表示しない。
   - 「iPhoneの音量ボタンで調整」と表示する。
   - Desktop等、実際にvolumeを変更できる環境では従来どおりスライダーを表示する。

3. Seek
   - ドラッグ中に `audio.currentTime` を何十回も更新しない。
   - `onInput` ではつまみの表示だけ更新し、指を離した時に1回だけ実Seekする。
   - R2 Range requestの連発を防ぎ、iPhoneでの引っ掛かりを減らす。
   - `<audio preload="metadata">` を明示。

## 置き換えるファイル

```text
src/App.tsx
src/audio.ts
src/ui/CollapsedPlayer.tsx
src/ui/PlayerSheet.tsx
src/styles/player.css
```

## 確認

```powershell
npm run build
npm run dev
```

その後iPhone実機で次を確認:
- Collapsed Playerを1回上スワイプでSheetが開く
- Half Sheetを1回上スワイプでExpandedになる
- Seekバーは指に追従し、離した時に再生位置が移動する
- iPhoneではVolumeスライダーではなく「iPhoneの音量ボタンで調整」が出る
