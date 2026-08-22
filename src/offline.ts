import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { MediaItem } from "./media"

export const MEDIA_CACHE_NAME = "plav-media-v1"

const AUTO_DOWNLOAD_KEY = "plav:auto-download"
const CACHE_KEY_PREFIX = "/__plav_media_cache/audio/"

function cacheSupported() {
  return (
    typeof window !== "undefined" &&
    "caches" in window
  )
}

function cacheKey(itemId: string) {
  return new URL(
    `${CACHE_KEY_PREFIX}${encodeURIComponent(itemId)}`,
    window.location.origin,
  ).href
}

async function openMediaCache() {
  return window.caches.open(MEDIA_CACHE_NAME)
}

let persistenceRequested = false

async function requestPersistentStorage() {
  if (persistenceRequested) return
  persistenceRequested = true

  try {
    await navigator.storage?.persist?.()
  } catch {
    // 永続化を許可しない環境でもCache Storage自体は利用できる。
  }
}

export async function getCachedMediaObjectUrl(
  itemId: string,
): Promise<string | null> {
  if (!cacheSupported()) return null

  const cache = await openMediaCache()
  const response = await cache.match(cacheKey(itemId))

  if (!response) return null

  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

// downloadedIds / downloadingIds / errorIds に共通する
// 「1件だけadd/removeしてSetを作り直す」操作をまとめる。
function useIdSet() {
  const [ids, setIds] = useState<Set<string>>(() => new Set())

  const add = useCallback((id: string) => {
    setIds((current) => {
      if (current.has(id)) return current
      return new Set(current).add(id)
    })
  }, [])

  const remove = useCallback((id: string) => {
    setIds((current) => {
      if (!current.has(id)) return current
      const next = new Set(current)
      next.delete(id)
      return next
    })
  }, [])

  // actionsの参照を固定し、これに依存するuseCallbackが
  // 不要に再生成されないようにする。
  const actions = useMemo(
    () => ({ add, remove, reset: setIds }),
    [add, remove],
  )

  return [ids, actions] as const
}

export function useOfflineMedia(items: MediaItem[]) {
  const audioItems = useMemo(
    () =>
      items.filter(
        (item) => item.type === "audio" && Boolean(item.url),
      ),
    [items],
  )

  const [downloadedIds, downloadedIdSet] = useIdSet()
  const [downloadingIds, downloadingIdSet] = useIdSet()
  const [errorIds, errorIdSet] = useIdSet()
  const [isReady, setIsReady] = useState(false)
  const [autoDownload, setAutoDownloadState] = useState(() => {
    try {
      return localStorage.getItem(AUTO_DOWNLOAD_KEY) === "true"
    } catch {
      return false
    }
  })

  const inFlightRef = useRef(new Set<string>())
  const isSupported = cacheSupported()

  useEffect(() => {
    let cancelled = false

    if (!isSupported) {
      setIsReady(true)
      return
    }

    setIsReady(false)

    void (async () => {
      try {
        const cache = await openMediaCache()
        const checks = await Promise.all(
          audioItems.map(async (item) => ({
            id: item.id,
            downloaded: Boolean(
              await cache.match(cacheKey(item.id)),
            ),
          })),
        )

        if (cancelled) return

        downloadedIdSet.reset(
          new Set(
            checks
              .filter((item) => item.downloaded)
              .map((item) => item.id),
          ),
        )
      } catch (error) {
        console.error("ローカル保存状態の確認に失敗しました:", error)
      } finally {
        if (!cancelled) setIsReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [audioItems, isSupported, downloadedIdSet])

  const downloadItem = useCallback(
    async (item: MediaItem) => {
      if (
        !isSupported ||
        item.type !== "audio" ||
        !item.url ||
        inFlightRef.current.has(item.id)
      ) {
        return false
      }

      inFlightRef.current.add(item.id)
      downloadingIdSet.add(item.id)
      errorIdSet.remove(item.id)

      try {
        await requestPersistentStorage()

        const response = await fetch(item.url, {
          cache: "no-store",
        })

        // Cache APIではRange responseを保存せず、必ず曲全体の200 responseを保存する。
        if (!response.ok || response.status !== 200) {
          throw new Error(
            `Download failed: ${response.status}`,
          )
        }

        const cache = await openMediaCache()
        await cache.put(cacheKey(item.id), response)

        downloadedIdSet.add(item.id)

        return true
      } catch (error) {
        console.error("曲のローカル保存に失敗しました:", error)
        errorIdSet.add(item.id)
        return false
      } finally {
        inFlightRef.current.delete(item.id)
        downloadingIdSet.remove(item.id)
      }
    },
    [isSupported, downloadingIdSet, errorIdSet, downloadedIdSet],
  )

  const removeItem = useCallback(
    async (itemId: string) => {
      if (!isSupported || inFlightRef.current.has(itemId)) {
        return false
      }

      try {
        const cache = await openMediaCache()
        await cache.delete(cacheKey(itemId))

        downloadedIdSet.remove(itemId)
        errorIdSet.remove(itemId)

        return true
      } catch (error) {
        console.error("ローカル保存の削除に失敗しました:", error)
        return false
      }
    },
    [isSupported, downloadedIdSet, errorIdSet],
  )

  const toggleDownload = useCallback(
    async (item: MediaItem) => {
      if (downloadedIds.has(item.id)) {
        return removeItem(item.id)
      }

      return downloadItem(item)
    },
    [downloadItem, downloadedIds, removeItem],
  )

  const setAutoDownload = useCallback((enabled: boolean) => {
    setAutoDownloadState(enabled)

    try {
      localStorage.setItem(
        AUTO_DOWNLOAD_KEY,
        enabled ? "true" : "false",
      )
    } catch {
      // localStorageが使えない環境では現在のセッションだけ反映する。
    }
  }, [])

  useEffect(() => {
    if (!autoDownload || !isReady || !isSupported) return

    let cancelled = false

    void (async () => {
      for (const item of audioItems) {
        if (cancelled) return

        try {
          const cache = await openMediaCache()
          const alreadyDownloaded = await cache.match(
            cacheKey(item.id),
          )

          if (alreadyDownloaded) continue

          await downloadItem(item)
        } catch (error) {
          console.error("自動保存に失敗しました:", error)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    audioItems,
    autoDownload,
    downloadItem,
    isReady,
    isSupported,
  ])

  const downloadedCount = useMemo(
    () =>
      audioItems.filter((item) => downloadedIds.has(item.id)).length,
    [audioItems, downloadedIds],
  )

  // 戻り値オブジェクトの参照を安定させ、これをpropsとして受け取る
  // 画面側（Library等）が不要に再レンダリングされないようにする。
  return useMemo(
    () => ({
      isSupported,
      isReady,
      autoDownload,
      downloadedIds,
      downloadingIds,
      errorIds,
      downloadedCount,
      totalCount: audioItems.length,
      toggleDownload,
      setAutoDownload,
    }),
    [
      isSupported,
      isReady,
      autoDownload,
      downloadedIds,
      downloadingIds,
      errorIds,
      downloadedCount,
      audioItems.length,
      toggleDownload,
      setAutoDownload,
    ],
  )
}

export type OfflineMediaController = ReturnType<
  typeof useOfflineMedia
>
