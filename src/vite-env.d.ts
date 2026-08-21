/// <reference types="vite/client" />

// import.meta.env の未宣言キーが暗黙的に any になるのを防ぐため、
// strictImportMetaEnv を有効化し、独自の環境変数をここで明示的に宣言する。
interface ViteTypeOptions {
  strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string
}
