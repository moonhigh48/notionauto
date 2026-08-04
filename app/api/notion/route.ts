// app/api/notion/route.ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { apiKey, action } = body;

    if (!apiKey) {
      return NextResponse.json({ error: "API Key가 없습니다." }, { status: 400 });
    }

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    };

    // 1) 목록 조회 — "새로고침" 버튼, 이름으로 기존 페이지 찾기 등이 여기로 들어옴
    if (action === "query") {
      const { databaseId, page_size, filter, sorts } = body;
      if (!databaseId) {
        return NextResponse.json({ error: "데이터베이스 ID가 없습니다." }, { status: 400 });
      }

      const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          page_size: page_size || 50,
          ...(filter ? { filter } : {}),
          ...(sorts ? { sorts } : {}),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        return NextResponse.json({ error: data.message || "노션 API 오류" }, { status: response.status });
      }
      return NextResponse.json(data);
    }

    // 2) 단일 페이지 조회 — 노션에서 캐릭터 한 명을 불러올 때
    if (action === "getPage") {
      const { pageId } = body;
      if (!pageId) {
        return NextResponse.json({ error: "pageId가 없습니다." }, { status: 400 });
      }

      const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: "GET",
        headers,
      });

      const data = await response.json();
      if (!response.ok) {
        return NextResponse.json({ error: data.message || "노션 API 오류" }, { status: response.status });
      }
      return NextResponse.json(data);
    }

    // 3) action이 없는 요청 = 캐릭터 저장(생성 또는 수정)
    const { databaseId, pageId, properties } = body;
    if (!properties) {
      return NextResponse.json({ error: "properties가 없습니다." }, { status: 400 });
    }

    const isUpdate = Boolean(pageId);
    const notionUrl = isUpdate
      ? `https://api.notion.com/v1/pages/${pageId}`
      : `https://api.notion.com/v1/pages`;

    const payload = isUpdate
      ? { properties }
      : { parent: { database_id: databaseId }, properties };

    const response = await fetch(notionUrl, {
      method: isUpdate ? "PATCH" : "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.message || "노션 API 오류" }, { status: response.status });
    }

    // 프론트에서 setCurrentPageId(data.pageId)로 쓰고 있으므로 id를 pageId 키로도 함께 내려줌
    return NextResponse.json({ ...data, pageId: data.id });
  } catch (error) {
    return NextResponse.json({ error: "서버 내부 오류가 발생했습니다." }, { status: 500 });
  }
}