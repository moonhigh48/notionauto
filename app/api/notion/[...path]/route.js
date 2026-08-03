/**
 * app/api/notion/[...path]/route.js
 */

const NOTION_VERSION = "2022-06-28";
const NOTION_API = "https://api.notion.com/v1";

// apiKey 매개변수를 받아서 노션 API 호출 시 사용
async function notionFetch(path, apiKey, options = {}) {
  const res = await fetch(`${NOTION_API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": NOTION_VERSION,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function json(data, status) {
  return Response.json(data, { status });
}

async function handle(request, paramsPromise, method) {
  try {
    // Next.js 최신 버전(v15 이상) 호환을 위한 params 비동기 처리
    const params = await paramsPromise;
    const path = params.path;

    // 1. 클라이언트 헤더에서 Authorization (Bearer secret_...) 읽기
    const authHeader = request.headers.get("authorization");
    let clientApiKey = authHeader ? authHeader.replace(/^Bearer\s+/i, "") : null;

    // GET 메서드가 아니면 body도 미리 읽어서 apiKey 확인 준비
    let body = {};
    if (method !== "GET") {
      body = await request.json().catch(() => ({}));
    }

    // 2. 헤더에 없으면 body의 apiKey 필드 확인
    if (!clientApiKey && body.apiKey) {
      clientApiKey = body.apiKey;
    }

    // 3. 외부 전달 키가 없으면 Vercel 환경변수 fallback 사용
    const finalApiKey = clientApiKey || process.env.NOTION_API_KEY;

    if (!finalApiKey) {
      return json(
        { message: "노션 API 키가 전달되지 않았고, 서버 환경변수에도 설정되어 있지 않습니다." },
        400
      );
    }

    // POST /pages -> 새 페이지 생성
    if (path.length === 1 && path[0] === "pages" && method === "POST") {
      if (!body.databaseId) return json({ message: "databaseId가 필요해." }, 400);
      const { status, data } = await notionFetch("/pages", finalApiKey, {
        method: "POST",
        body: JSON.stringify({
          parent: { database_id: body.databaseId },
          properties: body.properties || {},
        }),
      });
      return json(data, status);
    }

    // PATCH /pages/:id -> 기존 페이지 갱신
    if (path.length === 2 && path[0] === "pages" && method === "PATCH") {
      const { status, data } = await notionFetch(`/pages/${path[1]}`, finalApiKey, {
        method: "PATCH",
        body: JSON.stringify({ properties: body.properties || {} }),
      });
      return json(data, status);
    }

    // GET /pages/:id -> 페이지 단건 조회
    if (path.length === 2 && path[0] === "pages" && method === "GET") {
      const { status, data } = await notionFetch(`/pages/${path[1]}`, finalApiKey, {
        method: "GET",
      });
      return json(data, status);
    }

    // POST /query -> 데이터베이스 조회(목록)
    if (path.length === 1 && path[0] === "query" && method === "POST") {
      if (!body.databaseId) return json({ message: "databaseId가 필요해." }, 400);
      const { status, data } = await notionFetch(`/databases/${body.databaseId}/query`, finalApiKey, {
        method: "POST",
        body: JSON.stringify({
          page_size: body.page_size || 50,
          sorts: body.sorts || [{ timestamp: "last_edited_time", direction: "descending" }],
          ...(body.filter ? { filter: body.filter } : {}),
        }),
      });
      return json(data, status);
    }

    return json({ message: "지원하지 않는 경로/메서드야." }, 404);
  } catch (e) {
    return json({ message: e.message || "알 수 없는 오류" }, 500);
  }
}

export async function GET(request, { params }) {
  return handle(request, params, "GET");
}
export async function POST(request, { params }) {
  return handle(request, params, "POST");
}
export async function PATCH(request, { params }) {
  return handle(request, params, "PATCH");
}