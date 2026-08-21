import type { Env } from "./index"
import { findTrack } from "./tracks"

type ByteRange = {
  offset: number
  length: number
  end: number
}

function fail(status: number, code: string, message: string): never {
  throw Response.json({ error: code, message }, { status })
}

function parseRange(value: string, size: number): ByteRange | null {
  const match = value.match(/^bytes=(\d*)-(\d*)$/)
  if (!match || (!match[1] && !match[2])) return null

  if (!match[1]) {
    const suffixLength = Number(match[2])
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      return null
    }

    const length = Math.min(suffixLength, size)
    return {
      offset: size - length,
      length,
      end: size - 1,
    }
  }

  const offset = Number(match[1])
  if (!Number.isSafeInteger(offset) || offset < 0 || offset >= size) {
    return null
  }

  let end = size - 1

  if (match[2]) {
    const requestedEnd = Number(match[2])
    if (!Number.isSafeInteger(requestedEnd) || requestedEnd < offset) {
      return null
    }
    end = Math.min(requestedEnd, size - 1)
  }

  return {
    offset,
    length: end - offset + 1,
    end,
  }
}

export async function streamTrack(
  request: Request,
  env: Env,
  trackId: string,
) {
  const track = await findTrack(env, trackId)

  if (!track) {
    fail(404, "TRACK_NOT_FOUND", "対象の曲が見つかりません。")
  }

  const rangeHeader = request.headers.get("Range")
  const range = rangeHeader
    ? parseRange(rangeHeader, track.file_size_bytes)
    : null

  if (rangeHeader && !range) {
    return new Response(null, {
      status: 416,
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes */${track.file_size_bytes}`,
      },
    })
  }

  const object = await env.AUDIO_BUCKET.get(
    track.audio_key,
    range
      ? { range: { offset: range.offset, length: range.length } }
      : undefined,
  )

  if (!object) {
    fail(404, "MEDIA_NOT_FOUND", "音声ファイルが見つかりません。")
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set(
    "Content-Type",
    object.httpMetadata?.contentType ?? "audio/mpeg",
  )
  headers.set("Accept-Ranges", "bytes")
  headers.set("Cache-Control", "private, no-store")
  headers.set("ETag", object.httpEtag)
  headers.set("X-Content-Type-Options", "nosniff")

  if (range) {
    headers.set("Content-Length", String(range.length))
    headers.set(
      "Content-Range",
      `bytes ${range.offset}-${range.end}/${track.file_size_bytes}`,
    )

    return new Response(
      request.method === "HEAD" ? null : object.body,
      { status: 206, headers },
    )
  }

  headers.set("Content-Length", String(object.size))

  return new Response(
    request.method === "HEAD" ? null : object.body,
    { status: 200, headers },
  )
}
