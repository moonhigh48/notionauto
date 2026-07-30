// app/api/search/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) return NextResponse.json({ items: [] });

  const API_KEY = process.env.YOUTUBE_API_KEY; // .env.local에 저장
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&q=${encodeURIComponent(query)}&key=${API_KEY}`
  );
  const data = await res.json();

  const items = data.items?.map((item: any) => ({
    youtubeId: item.id.videoId,
    title: item.snippet.title,
    artist: item.snippet.channelTitle,
    coverUrl: item.snippet.thumbnails.high.url,
  })) || [];

  return NextResponse.json({ items });
}