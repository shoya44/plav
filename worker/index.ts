import {
  deleteTrackRow,
  findTrack,
  listTracks,
  updateTrackTitle,
} from "./tracks"
import { deleteMediaObject, streamTrack } from "./media"
import { getStorageUsage } from "./storage"

export type R2ObjectBody = {
  body: ReadableStream<Uint8Array>
  size: number
  httpEtag: string
  httpMetadata?: { contentType?: string }
  writeHttpMetadata(headers: Headers): void
}

export type R2ListedObject = {
  size: number
}

export type R2ListResult = {
  objects: R2ListedObject[]
  truncated: boolean
  cursor?: string
}

export type Env = {
  PLAV_OWNER_ID: string
  SUPABASE_URL: string
  SUPABASE_SECRET_KEY: string
  AUDIO_BUCKET: {
    get(
      key: string,
      options?: { range?: { offset: number; length: number } },
    ): Promise<R2ObjectBody | null>
    list(options?: {
      cursor?: string
      limit?: number
    }): Promise<R2ListResult>
    delete(key: string): Promise<void>
  }
}

function error(status: number, code: string, message: string) {
  return Response.json({ error: code, message }, { status })
}

async function handleApi(request: Request, env: Env) {
  const url = new URL(request.url)

  if (request.method === "GET" && url.pathname === "/api/health") {
    return Response.json({ status: "ok", service: "plav" })
  }

  if (request.method === "GET" && url.pathname === "/api/tracks") {
    return listTracks(env)
  }

  if (request.method === "GET" && url.pathname === "/api/storage") {
    return getStorageUsage(env)
  }

  const mediaMatch = url.pathname.match(/^\/api\/media\/([^/]+)$/)

  if (
    mediaMatch &&
    (request.method === "GET" || request.method === "HEAD")
  ) {
    return streamTrack(request, env, mediaMatch[1])
  }

  const trackMatch = url.pathname.match(/^\/api\/tracks\/([^/]+)$/)

  if (trackMatch && request.method === "PATCH") {
    const trackId = trackMatch[1]
    const body = (await request.json().catch(() => null)) as {
      title?: unknown
    } | null

    if (typeof body?.title !== "string" || !body.title.trim()) {
      return error(
        400,
        "INVALID_TITLE",
        "タイトルを入力してください。",
      )
    }

    await updateTrackTitle(env, trackId, body.title.trim())
    return Response.json({ ok: true })
  }

  if (trackMatch && request.method === "DELETE") {
    const trackId = trackMatch[1]
    const track = await findTrack(env, trackId)

    if (!track) {
      return error(404, "TRACK_NOT_FOUND", "対象の曲が見つかりません。")
    }

    await deleteMediaObject(env, track.audio_key)
    await deleteTrackRow(env, trackId)
    return Response.json({ ok: true })
  }

  return error(404, "NOT_FOUND", "APIが見つかりません。")
}

export default {
  async fetch(request: Request, env: Env) {
    try {
      return await handleApi(request, env)
    } catch (errorResponse) {
      if (errorResponse instanceof Response) return errorResponse

      console.error("Unhandled Worker error", errorResponse)
      return error(
        500,
        "INTERNAL_ERROR",
        "サーバーでエラーが発生しました。",
      )
    }
  },
}
