export type CloudStorageUsage = {
  usedBytes: number
  objectCount: number
  freeTierBytes: number
  usagePercent: number
  checkedAt: string
}

const CACHE_TTL_MS = 5 * 60 * 1000

let cachedUsage: CloudStorageUsage | null = null
let cachedAt = 0

export async function fetchCloudStorageUsage(
  force = false,
): Promise<CloudStorageUsage> {
  const now = Date.now()

  if (
    !force &&
    cachedUsage &&
    now - cachedAt < CACHE_TTL_MS
  ) {
    return cachedUsage
  }

  const response = await fetch("/api/storage", {
    cache: force ? "no-store" : "default",
  })

  if (!response.ok) {
    throw new Error(
      `クラウド容量の取得に失敗しました。(${response.status})`,
    )
  }

  const usage = (await response.json()) as CloudStorageUsage

  cachedUsage = usage
  cachedAt = Date.now()

  return usage
}

export function formatStorage(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 MB"

  if (bytes >= 1_000_000_000) {
    return `${(bytes / 1_000_000_000).toFixed(2)} GB`
  }

  if (bytes >= 1_000_000) {
    return `${(bytes / 1_000_000).toFixed(0)} MB`
  }

  return `${Math.max(0, Math.round(bytes / 1000))} KB`
}
