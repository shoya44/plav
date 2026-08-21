# プロジェクトガイドライン

## 技術スタック
- TypeScript (React, Vite)
- HTML / CSS
- Cloudflare Pages / Workers (Wrangler)

## 開発コマンド
- ビルド: `npm run build`
- 型チェック: `npx tsc --noEmit`
- デプロイ: `npx wrangler deploy`

## コーディング規約 & リファクタリング方針
- コンポーネントは機能ごとにディレクトリを分け、UIとロジック（Custom Hooks）を分離すること。
- `any` 型の使用は禁止。型定義は厳密に行うこと。
- パフォーマンス向上のため、不要な再レンダリングを防ぐ構造にすること。
- シンプルかつ可読性の高いコードとすること。