import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const IMAGE_MAP = {
  "어둠 속의 칼날": "https://image.aladin.co.kr/product/18153/52/cover200/8988060555_1.jpg",
  "CoC 7th": "https://image.yes24.com/goods/95728858/XL"
};

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).send('API가 정상적으로 작동 중입니다!');
  }

  if (req.method === 'POST') {
    // 1. 요청 진입 로그 (웹훅 신호 도착 여부 확인)
    console.log(">>> [웹훅 수신] POST 요청이 도착했습니다.");
    console.log("수신 바디:", JSON.stringify(req.body, null, 2));

    try {
      const body = req.body;

      // 검증 토큰 처리
      if (body.verification_token) {
        console.log(">>> 검증 토큰 응답 처리 완료");
        return res.status(200).json({ verification_token: body.verification_token });
      }

      const { entity } = body;
      if (entity && entity.id) {
        const pageId = entity.id;
        console.log(`>>> 페이지 조회 시작 (ID: ${pageId})`);
        
        const page = await notion.pages.retrieve({ page_id: pageId });
        
        // 속성값 추출 (속성 이름 '룰'이 정확한지 확인)
        const selectedRule = page.properties["룰"]?.select?.name;
        console.log(`>>> 선택된 룰: "${selectedRule}"`);

        const targetImageUrl = IMAGE_MAP[selectedRule];

        if (selectedRule && targetImageUrl) {
          console.log(`>>> 노션 페이지 업데이트 시도 (이미지: ${targetImageUrl})`);
          
          await notion.pages.update({
            page_id: pageId,
            properties: {
              "사진": {
                files: [
                  {
                    name: `${selectedRule} 표지`,
                    type: "external",
                    external: { url: targetImageUrl }
                  }
                ]
              }
            }
          });
          console.log(`>>> [성공] 업데이트 완료`);
        } else {
          console.log(`>>> [스킵] 매핑된 이미지가 없거나 룰이 선택되지 않음`);
        }
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      // API 오류 시 Vercel Logs에 에러 메시지와 스택을 명확히 출력
      console.error(">>> [API 에러 상세]:", error.message);
      if (error.body) console.error(">>> 노션 응답 에러:", error.body);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}