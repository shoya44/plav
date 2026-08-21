# iPhone interaction fix v2

## 変更点

- Collapsed Playerのタイトル領域を上スワイプすると、1回でPlayer Sheetを開きます。
- Half状態のPlayer Sheetは、上方向へ24px程度動いた時点でExpandedへ即スナップします。指を離すまで待ちません。
- Half状態の上部/Queue領域を明示的なgesture surfaceにして、iOS Safariのpointer cancelを避けます。
- Player SheetのVolume sliderを常時表示へ戻しました。
- Desktopでは`audio.volume`へ反映します。
- iPhone Safari/PWAではOS仕様によりJavaScriptから段階的な端末音量を変更できません。0はmuteとして機能し、1〜100%の実音量はiPhone側の音量ボタンで決まります。

## 置き換え

```text
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
