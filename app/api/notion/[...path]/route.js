/**
 * Next.js(App Router) API 라우트로 노션을 프록시하는 예시.
 *
 * 제미나이가 말한 방식 그대로: 이미 Next.js 서버가 있다면 별도로
 * Cloudflare Worker를 배포할 필요 없이, 이 라우트 하나로 브라우저의
 * CORS 문제를 똑같이 해결할 수 있어. 서버에 키를 고정해두지 않고
 * 클라이언트가 입력한 키를 헤더(x-notion-key)로 받아서 그대로
 * 노션에 전달하는 "패스스루" 방식.
 *
 * 파일 위치: app/api/notion/[...path]/route.js
 * 예) POST /api/notion/pages          -> 노션 페이지 생성
 *     PATCH /api/notion/pages/abcd123 -> 노션 페이지 갱신
 *     GET   /api/notion/pages/abcd123 -> 노션 페이지 조회
 *     POST /api/notion/databases/<id>/query -> 데이터베이스 조회
 *
 * 시트(클라이언트) 쪽에서는 fetch 시 헤더에 다음을 실어 보내면 돼:
 *   headers: { "x-notion-key": "<사용자가 입력한 연동 키>" }
 *
 * 주의(보안 트레이드오프):
 * - 이 방식은 키를 서버에 저장하지 않고 매 요청마다 그대로 흘려보내기만 해.
 *   여러 사용자가 각자의 키로 쓰는 다중 사용자 툴에 적합해.
 * - 반면 Cloudflare Worker 예시(notion-proxy-worker)처럼 서버(secret)에
 *   키를 고정해두면, 사용자는 키를 몰라도 되고 매번 입력할 필요도 없어 —
 *   혼자 쓰는 개인용 시트라면 이 방식이 더 편해.
 * - 어느 쪽이든 키가 "그 서버"를 거쳐가는 건 같아. 신뢰할 수 있는 자신의
 *   서버라면 문제 없지만, 제3자가 운영하는 서버라면 키를 넘기지 않는 게 좋아.
 */

const NOTION_VERSION = "2022-06-28";
const NOTION_API = "https://api.notion.com/v1";

async function proxy(request, path) {
  const notionKey = request.headers.get("x-notion-key");
  if (!notionKey) {
    return Response.json({ message: "x-notion-key 헤더가 필요해." }, { status: 400 });
  }

  const isBodyMethod = ["POST", "PATCH", "PUT"].includes(request.method);
  const body = isBodyMethod ? await request.text() : undefined;

  const res = await fetch(`${NOTION_API}/${path.join("/")}`, {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${notionKey}`,
      "Notion-Version": NOTION_VERSION,
    },
    body,
  });

  const data = await res.text();
  return new Response(data, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(request, { params }) {
  return proxy(request, params.path);
}
export async function POST(request, { params }) {
  return proxy(request, params.path);
}
export async function PATCH(request, { params }) {
  return proxy(request, params.path);
}
