import type { CSSProperties } from "react"

// React標準のCSSPropertiesはCSSカスタムプロパティ（--xxx）を表現できないため、
// 各コンポーネントで個別に `as CSSProperties` を書く代わりにここへ集約する。
export function cssVars(
  vars: Record<`--${string}`, string | number>,
): CSSProperties {
  return vars as CSSProperties
}
