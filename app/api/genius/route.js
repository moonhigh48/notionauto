import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title');
  const artist = searchParams.get('artist');

  if (!title || !artist) {
    return NextResponse.json({ error: 'Missing title or artist' }, { status: 400 });
  }

  try {
    // 1. Genius 검색 API 호출
    const query = `${artist} ${title}`;
    const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(query)}`;
    
    const searchRes = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${GENIUS_ACCESS_TOKEN}`,
      },
    });

    const searchData = await searchRes.json();
    const hits = searchData?.response?.hits;

    if (!hits || hits.length === 0) {
      return NextResponse.json({ lyrics: null });
    }

    // 첫 번째 검색 결과의 곡 URL
    const songUrl = hits[0].result.url;

    // 2. 해당 곡의 Genius 웹페이지 HTML 수집
    const pageRes = await fetch(songUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      },
    });
    const html = await pageRes.text();

    // 3. Cheerio를 이용한 가사 태그 파싱
    const $ = cheerio.load(html);
    let lyrics = '';

    // Genius의 가사 영역 컨테이너 선택 (data-lyrics-container 속성)
    $('div[data-lyrics-container="true"]').each((_, el) => {
      // 줄바꿈 <br> 태그를 실제 \n 로 변환
      $(el).find('br').replaceWith('\n');
      lyrics += $(el).text() + '\n';
    });

    const cleanLyrics = lyrics.trim();

    if (cleanLyrics) {
      return NextResponse.json({ lyrics: cleanLyrics });
    }

    return NextResponse.json({ lyrics: null });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch Genius lyrics' }, { status: 500 });
  }
}