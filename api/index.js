import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// '룰' 속성 값과 이미지 URL 매핑
const IMAGE_MAP = {
  "어둠 속의 칼날": "https://image.aladin.co.kr/product/18153/52/cover200/8988060555_1.jpg"
  // 추후 필요한 다른 룰과 이미지 URL을 여기에 계속 추가하면 돼.
};

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).send('API가 정상적으로 작동 중입니다!');
  }

  if (req.method === 'POST') {
    try {
      const body = req.body;

      // 1. 웹훅 등록 및 인증 처리
      if (body.verification_token) {
        return res.status(200).json({ verification_token: body.verification_token });
      }

      // 2. 이벤트 감지 및 사진 속성 자동 업데이트
      const { entity } = body;
      if (entity && entity.id) {
        const pageId = entity.id;
        
        // 변경된 노션 페이지 정보 가져오기
        const page = await notion.pages.retrieve({ page_id: pageId });
        
        // '룰' 선택 속성의 값 확인
        const selectedRule = page.properties["룰"]?.select?.name;
        const targetImageUrl = IMAGE_MAP[selectedRule];

        if (selectedRule && targetImageUrl) {
          // '사진' 속성에 외부 이미지 링크 입력
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
          console.log(`[성공] 페이지 ID ${pageId} : '룰' -> '${selectedRule}' 이미지 적용 완료`);
        }
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[에러 발생]", error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}