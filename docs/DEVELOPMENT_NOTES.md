# 開発ノート: つまずいたポイントと学び

このドキュメントは、Plavの開発（特にPlayer Sheetの並び替え機能やアニメーション周り）で
実際に発生した不具合と、その原因・直し方・教訓をまとめたものです。

「なぜそのコードになっているのか」を後から見て思い出せるように、また同じような機能を
別の場所で実装するときに同じ罠を踏まないように、初学者の方でも読める粒度で書いています。
コードの詳細な仕様は [`SPECIFICATION.md`](./SPECIFICATION.md) を参照してください。こちらは
「何が起きて、なぜそうなったか」というストーリー中心のドキュメントです。

---

## 1. 発生した問題と原因

### 1-1. ドラッグ中に指を動かしただけで並び替えが止まる（Pointer Captureが外れる問題）

**何が起きたか**

Player SheetのQueue（Up Next / History）で、1回の指の動きで複数の曲を一気に飛び越えて
並び替えようとすると、1つ目の並び替えは成功するのに、2つ目以降が反応しなくなる不具合が
ありました。

**なぜ起きたか（背景知識）**

ブラウザには「Pointer Capture（ポインターキャプチャ）」という仕組みがあります。これは
「指を押した要素に、指を動かしている間ずっとイベントを送り続ける」ための機能です。
通常、指がある要素の上から外れると `pointermove` イベントはその下にある別の要素に
送られてしまいますが、Pointer Captureを使うと「最初に掴んだ要素」に送り続けることが
できます。

```js
element.setPointerCapture(pointerId)
```

今回のバグは、**このPointer Captureを「並び替え対象の行（曲の1行）」自体に設定していた**
ことが原因でした。並び替えが成立してReactが再レンダリングすると、その行はDOM上で
「別の位置に移動」します（Reactが `insertBefore` で実際のDOM要素を動かす）。

ブラウザの仕様上、**Pointer Captureを設定した要素がDOM上で移動すると、キャプチャは
自動的に解除されてしまいます**（`lostpointercapture` イベントが発生します）。つまり、

1. 1回目の並び替えが成立する
2. Reactがその行をDOM上の新しい位置に移動する
3. ブラウザが「あ、この要素動いたな」と判断してPointer Captureを解除する
4. 以降の指の動き（`pointermove`）がどこにも届かなくなる

という流れでした。同じ要素（Reactコンポーネント）でも、DOM上の位置が変わるだけで
キャプチャが切れてしまうというのは直感的にわかりにくい部分です。

**どう直したか**

Pointer Captureを「並び替えで動く行」ではなく、**並び替えが起きても絶対に位置が変わらない
親要素（`.queue-list` コンテナ）** に設定するようにしました。

```ts
// src/hooks/useQueueReorder.ts
const captureTarget = row.closest<HTMLElement>(".queue-list") ?? row
current.captureTarget.setPointerCapture(current.pointerId)
```

あわせて、`onPointerMove` / `onPointerUp` / `onPointerCancel` などのイベントハンドラも、
各行ではなく `.queue-list` コンテナ側にまとめて付け替えました（後述の1-3とも関係します）。

**教訓**

> ドラッグ操作で並び替え・移動が発生するUIでは、Pointer Captureや継続的なイベント
> ハンドラは「動く要素」ではなく「動かない祖先要素」に持たせる。

これは並び替えUIを実装するときに何度でも踏みやすい罠なので、覚えておく価値があります。

---

### 1-2. 曲がHistory⇔Up Next間を移動すると中身が壊れる（Reactのstate更新順序の問題）

**何が起きたか**

Up NextからHistoryへ、あるいはHistoryからUp Nextへ曲を1回移動させるだけなら問題ないのに、
続けてもう一度別の移動を行うと、`history` や `upNext` の中身が消えたり壊れたりすることが
ありました（実際にはさらに別のバグ＝1-3が重なって「Sheet自体が閉じてしまい、Queueの表示が
消えたように見えていた」だけでしたが、調査の過程で本質的な問題も見つかりました）。

**なぜ起きたか**

Plavでは再生キューを2つの独立した状態（`useState`）で管理しています。

```ts
const [history, setHistory] = useState<MediaItem[]>([])
const [upNext, setUpNext] = useState<MediaItem[]>([])
```

「HistoryからUp Nextへ曲を移す」という操作は、実際には

1. `history` から該当の曲を取り除く（`setHistory`）
2. `upNext` にその曲を挿入する（`setUpNext`）

という**2つの別々のstate更新**です。Reactは複数のstate更新をまとめて1回の再レンダリングに
「バッチ処理」することがありますが、そのときの適用順序は「呼んだ順番」ではなく「hookを
宣言した順番」に依存する場合があります。ドラッグ中に短い間隔で連続して移動操作が呼ばれると、
この「呼んだ順番」と「実際に適用される順番」のズレによって、意図しない中身になってしまう
ことがありました。

**どう直したか**

`react-dom` の `flushSync` を使い、Queueの移動処理では毎回のstate更新を**同期的に**
即座に確定させるようにしました。

```ts
import { flushSync } from "react-dom"

flushSync(() => {
  setSource((current) => current.filter((_, index) => index !== from.index))
  setDestination((current) => {
    /* 挿入処理 */
  })
})
```

こうすることで、「次の移動操作を処理する前に、前の移動が確実にstateへ反映されている」
状態を保証できます。

**教訓**

> 複数の`useState`にまたがる関連データ（今回で言う`history`と`upNext`）を、短時間に
> 連続して更新する処理（ドラッグ中の逐次呼び出しなど）を書くときは、更新順序の保証が
> 必要かどうかを意識する。必要なら`flushSync`で同期化するか、そもそも1つの`useState`
> （1つのオブジェクト）にまとめることを検討する。

`flushSync`は本来「多用すべきでない」API（パフォーマンスコストがあるため）ですが、
今回のように「順序保証がバグに直結する」場面では適切な選択でした。

---

### 1-3. Queueをドラッグしていたら、Player Sheetが閉じてしまう（イベントの横取り問題）

**何が起きたか**

これが1-2の調査中に見つかった「本当の原因」でした。Queue内で曲を1回移動させたあと、
続けて別の曲を動かそうとすると、なぜかPlayer Sheet全体が閉じてしまうという不具合です。

**なぜ起きたか**

Player Sheetは「上下にスワイプすると拡大・縮小・閉じる」というジェスチャーを持っており、
そのための`pointerdown`/`pointermove`ハンドラをSheet全体に持っています。一方、Queueの
各行にも「長押ししてからドラッグすると並び替え」という、**別のジェスチャー**が乗っています。

同じ`pointerdown`イベントに対して、内側（Queueの行）と外側（Sheet）の両方がジェスチャーを
「開始しようとする」状態になっていました。1-1のバグ（Pointer Captureが外れる）が発生すると、

1. 行のPointer Captureが外れる
2. 以降の`pointermove`が、Queueの行ではなく通常のDOM階層に沿ってSheetまでバブリング（伝播）する
3. Sheet側のジェスチャーハンドラが「これはSheetを閉じるスワイプだ」と誤認識する

という連鎖が起きていました。

**どう直したか**

2段階で対処しています。

1. **1-1の根本修正**（Pointer Captureを安定した親要素に持たせる）によって、そもそも
   イベントが本来の受け手からズレて配送されること自体を防ぎました。
2. さらに保険として、Queueの行で`pointerdown`が発生した時点で`event.stopPropagation()`を
   呼び、**Sheet側のジェスチャーが同じ操作に反応して二重に起動しないようにしました。**

```ts
// src/hooks/useQueueReorder.ts
const startLongPressReorder = useCallback((event, ...) => {
  // ...
  // Queue行で始まったポインター操作は、Player SheetのDrag（拡大/縮小/閉じる）
  // に横取りされないよう、ここで伝播を止める。
  event.stopPropagation()
  // ...
})
```

**教訓**

> 画面の中に「親のジェスチャー」と「子のジェスチャー」が重なって存在する場合
> （スワイプで閉じるSheetの中に、長押しドラッグできる行がある、など）、
> 子側のジェスチャーが確定したら**必ず`stopPropagation()`で親への伝播を止める**。
> 「たまたま動いていた」状態は、他の不具合（今回で言うPointer Captureが外れる問題）が
> 重なった瞬間に破綻するので、両方を対処してはじめて安定する。

---

### 1-4. Sheetを閉じる動きが唐突に見える（アニメーションと unmount タイミングのズレ）

**何が起きたか**

Player Sheetを閉じたとき、CSSのアニメーションが完了しきる前に急にSheetの要素そのものが
消えてしまい、「スッ」と滑らかに消えるのではなく「パッ」と唐突に消えるように見えました。

**なぜ起きたか**

CSS側では、閉じるときのフェードアウト・スライドダウンを200msの`transition`で
定義していました。

```css
.player-sheet.is-closing {
  transition: transform 200ms ease, opacity 200ms ease;
}
```

一方、React側では「アニメーションが終わったころを見計らって」`onClose`（実際に
コンポーネントをunmountする処理）を呼ぶために`setTimeout`を使っていました。

```ts
// 修正前
window.setTimeout(onClose, 180) // ← CSSは200msなのに180ms
```

CSSのアニメーション時間（200ms）よりも、JS側のタイマー（180ms）の方が**20ms短い**
ため、アニメーションが視覚的に終わりきる前にDOM要素が消えてしまっていました。

**どう直したか**

CSSの`transition`時間と同じ（またはそれ以上の）時間をJS側にも設定し、コメントで
「この数字はCSSの何と対応しているか」を明記しました。

```ts
// player.cssの.is-closingは transform/opacity を200msで遷移させる。
// ここが200ms未満だとアニメーションの完了前にSheetがunmountされ、
// クローズが唐突に見える。
const CLOSE_ANIMATION_MS = 210
window.setTimeout(onClose, reduceMotion ? 0 : CLOSE_ANIMATION_MS)
```

**教訓**

> CSSの`transition`時間とJSの`setTimeout`時間を「別々の場所に別々の数値」として
> ハードコードすると、どちらかだけ変更したときにズレて気づきにくいバグになる。
> 可能であれば片方の値にコメントで対応関係を明記する（今回のように定数化して
> コメントを添えるだけでも十分効果がある）。数値がズレていないか疑うのは、
> 「アニメーションが唐突に終わる/开始する」系のバグを調査するときの定石。

---

### 1-5. 履歴に同じ曲が2回入るとおかしな挙動になりうる（keyにindexを含めていた問題）

**何が起きたか**

Historyの各行を`key={`history-${item.id}-${index}`}`のように、配列のindexを含めた
keyで描画していました。並び替えでindexが変わると、Reactは「別のkey＝別の要素」と
判断して、**DOM要素ごと作り直して（unmount→再mount）**しまいます。

これが1-1のPointer Captureの問題をさらに悪化させる原因にもなっていました
（要素が作り直されると、当然そこに設定していたPointer Captureも失われます）。

**どう直したか**

keyを`item.id`のみ（indexを含めない）に変更しました。

```tsx
// 修正前: key={`history-${item.id}-${index}`}
// 修正後:
<div key={item.id} ...>
```

**教訓**

> Reactの`key`は「この要素とこのデータが同じものである」という目印。
> **並び替えが起きるリスト**では、配列のindexをkeyに含めてはいけない（indexが
> 変わるたびに「別物」として扱われ、DOM要素が作り直されてしまう）。IDなど、
> 中身が同じであれば変わらない値だけをkeyにする。
>
> （なお、同じ曲がHistoryに複数回入るとkeyが重複する可能性がありますが、
> 発生頻度が低く実害も見た目上の軽微な取り違えに留まるため許容しています。）

---

## 2. iPhone / PWA特有の制約と回避策

### 2-1. 長押しで文字選択メニューが出てしまう

iOS Safariでは、長押しした要素にテキストが含まれていると「コピー」「調べる」などの
選択メニューが出てしまい、アプリのUI（長押しでDetail Sheetを開く、長押しでドラッグ
並び替えを始める、など）と競合します。

**回避策**: 対象要素に以下のCSSを設定します。

```css
user-select: none;
-webkit-user-select: none;
-webkit-touch-callout: none; /* iOS Safari独自: 長押しメニュー自体を抑制 */
```

Plavでは`.media-row`（Home一覧）や`.player-sheet`全体にこれを適用しています。
さらに、PWAとしてホーム画面から起動した場合（standaloneモード）で選択が起きやすいという
実機報告があったため、`html, body`レベルでもベースラインとして適用しています。

```css
html, body {
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
```

> **注意**: これはiOSの既知の癖に対する一般的な緩和策であり、100%完全に選択を
> 防げるとは限りません（iOS側のバージョンや状況によって挙動が変わることがあります）。
> 「直った」と過信せず、実機で気になる報告が来たら都度確認するのが安全です。

### 2-2. 音量をJavaScriptから操作できない

iOSでは、セキュリティ/UX方針上、Webページの`<audio>`要素の`volume`プロパティを
JavaScriptから変更しても実際の再生音量には反映されません。音量は常に本体の物理ボタンや
コントロールセンターでのみ変更できます。そのため、**Plavには独自の音量スライダーUIを
持たせていません**（実装しても意味がないため）。他プラットフォーム向けに音量UIを
追加したくなった場合は、iOSでは非表示にするなどの分岐が必要になります。

### 2-3. Pointer Eventsの「Capture」の挙動はブラウザの実装依存の癖がある

タッチ操作は最終的に`pointerdown`/`pointermove`/`pointerup`などのPointer Eventsとして
届きますが、1-1で説明した「DOM要素が動くとCaptureが外れる」という挙動はどのブラウザでも
共通の仕様です（Chromeでも同じことが起きます）。ただしiOS Safariは、それに加えて
「スクロール中は`preventDefault()`しないと勝手にページがスクロールしてしまう」といった
挙動もあるため、ドラッグ系のジェスチャーを実装するときは、

- `touch-action: none`（ブラウザの標準ジェスチャー、特にスクロールを無効化）
- `event.preventDefault()`（並び替えが「アクティブ」になったタイミングでのみ呼ぶ。
  そうしないと通常のスクロールやタップができなくなる）

をセットで意識する必要があります。

### 2-4. `backdrop-filter`などの重いCSSはiPhoneで実機確認が必須

半透明・ぼかし効果（`backdrop-filter: blur(...)`）は、Safari/iOSではGPU負荷が
高くなりやすく、シミュレーターやPCのブラウザでは気づけないカクつきが実機でだけ
発生することがあります。今回のレビューでは「実機での`backdrop-filter`のプロファイリング」
は対応不要（ユーザー側の判断）としてスキップしましたが、**見た目のリッチさとiPhoneでの
滑らかさはトレードオフになりうる**ことは覚えておく必要があります。気になる場合は
実機（できれば型落ちの機種）でスクロール・アニメーション中のフレームレートを
確認してください。

---

## 3. 今後の保守で気をつけるチェックリスト

Player Sheet / Queue周りに手を入れるときは、特に以下を確認してください。

- [ ] **ドラッグ・並び替え系の機能を追加/変更するとき**
  - Pointer Captureや`onPointerMove`/`onPointerUp`などの継続的なハンドラは、
    「操作中に位置が変わる可能性がある要素」ではなく、常に位置が変わらない
    祖先要素に持たせているか？
  - リストのkeyに配列のindexを使っていないか？（並び替えが起きるリストではNG）
  - 親子で別々のジェスチャー（Sheetの開閉 vs 行のドラッグなど）が重なる場所では、
    子のジェスチャーが確定した時点で`stopPropagation()`しているか？
  - 1回のドラッグで複数回移動が起きるケース（マルチホップ）をテストしたか？
    （1回だけの移動は動くのに複数回連続すると壊れる、というバグは典型パターン）

- [ ] **アニメーション/タイミングに関わる変更をするとき**
  - CSSの`transition`/`animation`時間と、JS側の`setTimeout`の時間が一致しているか？
    （片方だけ変更してもう片方を直し忘れていないか）
  - `prefers-reduced-motion: reduce`（モーション低減設定）でアニメーションを
    無効化するパスも一緒に動作確認したか？

- [ ] **複数の`useState`にまたがるデータを同時に更新するとき**
  - 更新の順序が結果に影響する場合、`flushSync`などで順序を保証しているか？
    それとも、そもそも1つのstateにまとめられないか検討したか？

- [ ] **iPhone Safari / PWA向けの見た目・操作性を変更するとき**
  - 長押しやドラッグが絡む要素に`user-select: none` / `-webkit-touch-callout: none`
    が付いているか？
  - 実機（できればiPhone実機、最低でもモバイルビューポート + touchエミュレーション）で
    一度は動作確認したか？ PCブラウザだけでは気づけない不具合が多い領域です。

---

## 4. 動作確認の方法（この開発で実際に使ったやり方）

このリポジトリは本番APIへの直接アクセスがサンドボックス環境から制限されているため、
Playwright（ブラウザ自動操作ツール）を使い、以下のようにモックしたAPIレスポンスで
動作確認を行いました。

```js
await page.route('**/api/tracks', (route) => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ tracks: [/* ダミーの曲データ */] }),
}))
```

iPhone 12 Proのビューポートサイズ・タッチ操作を再現するには以下のようにします。

```js
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
})
```

ドラッグ操作は、`page.mouse.down()` → `page.mouse.move(x, y, { steps: N })` →
`page.mouse.up()` の組み合わせで再現できます（`steps`を増やすと、より細かい
`pointermove`イベント列を再現でき、今回のようなマルチホップの並び替えバグの
再現・検証に役立ちました）。

ただし、これはあくまで**擬似的な検証**であり、実際のiPhone実機・実際のSafari/PWAでの
挙動を100%保証するものではありません。特に本ノートの「2. iPhone / PWA特有の制約」に
関わる項目は、可能な限り実機での最終確認をおすすめします。
