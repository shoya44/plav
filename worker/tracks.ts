import type { Env } from "./index"

export type TrackRow = {
  id: string
  title: string
  audio_key: string
  duration_seconds: number
  file_size_bytes: number
}

const TRACK_FIELDS =
  "id,title,audio_key,duration_seconds,file_size_bytes"

function databaseError(): never {
  throw Response.json(
    {
      error: "DATABASE_ERROR",
      message: "曲情報を取得できませんでした。",
    },
    { status: 502 },
  )
}

async function queryTracks(
  env: Env,
  params: Record<string, string>,
): Promise<TrackRow[]> {
  const url = new URL(
    "/rest/v1/tracks",
    `${env.SUPABASE_URL.replace(/\/+$/, "")}/`,
  )

  url.searchParams.set("select", TRACK_FIELDS)
  url.searchParams.set("owner_id", `eq.${env.PLAV_OWNER_ID}`)
  url.searchParams.set("status", "eq.ready")

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY },
  })

  if (!response.ok) {
    console.error(
      "Supabase error:",
      response.status,
      await response.text(),
    )
    databaseError()
  }

  return (await response.json()) as TrackRow[]
}

export async function listTracks(env: Env) {
  const tracks = await queryTracks(env, {
    order: "created_at.desc,id.desc",
  })

  return Response.json({
    tracks: tracks.map((track) => ({
      id: track.id,
      title: track.title,
      durationSeconds: track.duration_seconds,
      mediaUrl: `/api/media/${track.id}`,
    })),
  })
}

export async function findTrack(env: Env, trackId: string) {
  const tracks = await queryTracks(env, {
    id: `eq.${trackId}`,
    limit: "1",
  })

  return tracks[0] ?? null
}
