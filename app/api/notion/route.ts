// app/api/notion/route.ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // 클라이언트에서 보낸 apiKey, databaseId, properties 추출
    const { apiKey, databaseId, pageId, properties } = body;

    if (!apiKey) {
      return NextResponse.json({ error: "API Key가 없습니다." }, { status: 400 });
    }

    const isUpdate = Boolean(pageId);
    
    // 노션 API URL (생성 또는 수정)
    const notionUrl = isUpdate
      ? `https://api.notion.com/v1/pages/${pageId}`
      : `https://api.notion.com/v1/pages`;

    // 노션 API로 전달할 요청 body
    const payload = isUpdate
      ? { properties }
      : { parent: { database_id: databaseId }, properties };

    // Next.js 서버(백엔드)에서 노션 API 호출 (CORS 제약 없음)
    const response = await fetch(notionUrl, {
      method: isUpdate ? "PATCH" : "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.message || "노션 API 오류" }, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "서버 내부 오류가 발생했습니다." }, { status: 500 });
  }
}