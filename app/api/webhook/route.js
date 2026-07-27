import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// 1. '룰' 속성용 이미지 매핑
const RULE_MAP = {
  "어둠 속의 칼날": "https://image.aladin.co.kr/product/18153/52/cover200/8988060555_1.jpg",
  "CoC 7th": "https://contents.kyobobook.co.kr/sih/fit-in/400x0/pdt/9788988060391.jpg?t=2974099"
};

// 2. '서플리먼트' 속성용 이미지 매핑 (업데이트된 URL 반영)
const SUPPLEMENT_MAP = {
  "CoC 입문 세트": "https://image.aladin.co.kr/product/25679/68/cover500/8988060644_1.jpg",
  "이름 없는 공포들": "https://contents.kyobobook.co.kr/sih/fit-in/400x0/pdt/9788988060421.jpg?t=2974191"
};

// GET 요청 처리 (서버 동작 확인용)
export async function GET() {
  return new Response('API가 정상적으로 작동 중입니다!', { status: 200 });
}

// POST 요청 처리 (노션 웹훅 수신용)
export async function POST(req) {
  try {
    // Next.js App Router 비동기 바디 파싱
    const body = await req.json();

    // 웹훅 검증 토큰 응답
    if (body.verification_token) {
      return Response.json({ verification_token: body.verification_token });
    }

    const { entity } = body;

    if (entity && entity.id) {
      // 데이터베이스 이벤트 스킵 (에러 방지)
      if (entity.object === 'database') {
        console.log(`[스킵] 데이터베이스 변경 이벤트(ID: ${entity.id})`);
        return Response.json({ success: true });
      }

      const pageId = entity.id;
      let page;

      // 권한 없거나 페이지 삭제 시 404 에러 스킵 처리
      try {
        page = await notion.pages.retrieve({ page_id: pageId });
      } catch (pageError) {
        if (pageError.code === 'object_not_found') {
          console.warn(`[스킵] 페이지를 찾을 수 없거나 접근 권한이 없습니다. (ID: ${pageId})`);
          return Response.json({ success: true, message: 'Page not found or no access' });
        }
        throw pageError;
      }

      const selectedRule = page.properties["룰"]?.select?.name;
      const supplementText = page.properties["서플리먼트"]?.rich_text?.[0]?.plain_text?.trim();

      let targetImageUrl = null;
      let imageLabel = "";

      // 우선순위 1: 서플리먼트
      if (supplementText && SUPPLEMENT_MAP[supplementText]) {
        targetImageUrl = SUPPLEMENT_MAP[supplementText];
        imageLabel = `${supplementText} 표지`;
      } 
      // 우선순위 2: 룰
      else if (selectedRule && RULE_MAP[selectedRule]) {
        targetImageUrl = RULE_MAP[selectedRule];
        imageLabel = `${selectedRule} 표지`;
      }

      // 이미지 속성 업데이트
      if (targetImageUrl) {
        await notion.pages.update({
          page_id: pageId,
          properties: {
            "사진": {
              files: [
                {
                  name: imageLabel,
                  type: "external",
                  external: { url: targetImageUrl }
                }
              ]
            }
          }
        });
        console.log(`[성공] 페이지 ID ${pageId} : '${imageLabel}' 적용 완료`);
      } else {
        console.log(`[스킵] 자동 설정할 이미지가 없습니다.`);
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[에러 발생]", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}