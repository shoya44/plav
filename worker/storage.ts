import type { Env } from "./index"

// Cloudflare R2 Standard storage の無料枠。
// 料金上の GB に合わせ、10 GB = 10,000,000,000 bytes として扱う。
const R2_FREE_STORAGE_BYTES = 10_000_000_000
const LIST_LIMIT = 1000
const MAX_PAGES = 1000

export async function getStorageUsage(env: Env) {
  let cursor: string | undefined
  let usedBytes = 0
  let objectCount = 0
  let pageCount = 0

  do {
    const result = await env.AUDIO_BUCKET.list({
      limit: LIST_LIMIT,
      ...(cursor ? { cursor } : {}),
    })

    for (const object of result.objects) {
      usedBytes += object.size
      objectCount += 1
    }

    pageCount += 1

    if (pageCount >= MAX_PAGES && result.truncated) {
      throw new Error("R2 object listing exceeded the safety limit.")
    }

    cursor = result.truncated ? result.cursor : undefined
  } while (cursor)

  const usagePercent =
    R2_FREE_STORAGE_BYTES > 0
      ? (usedBytes / R2_FREE_STORAGE_BYTES) * 100
      : 0

  return Response.json(
    {
      usedBytes,
      objectCount,
      freeTierBytes: R2_FREE_STORAGE_BYTES,
      usagePercent,
      checkedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    },
  )
}
