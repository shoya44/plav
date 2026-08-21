export interface ApiTrack {
  id: string;
  title: string;
  durationSeconds: number;
  mediaUrl: string;
}

interface TracksResponse {
  tracks: ApiTrack[];
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL;

export async function fetchTracks(): Promise<ApiTrack[]> {
  if (!API_BASE_URL) {
    throw new Error(
      "VITE_API_BASE_URL が設定されていません。",
    );
  }

  const response = await fetch(
    `${API_BASE_URL}/api/tracks`,
  );

  if (!response.ok) {
    throw new Error(
      `曲一覧の取得に失敗しました。(${response.status})`,
    );
  }

  const data =
    (await response.json()) as TracksResponse;

  return data.tracks;
}