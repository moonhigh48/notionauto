import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// 1. '룰' 속성용 이미지 매핑
const RULE_MAP = {
  "어둠 속의 칼날": "https://image.aladin.co.kr/product/18153/52/cover200/8988060555_1.jpg",
  "CoC 7th": "https://contents.kyobobook.co.kr/sih/fit-in/400x0/pdt/9788988060391.jpg?t=2974099"
};

// 2. '서플리먼트' 속성용 이미지 매핑
const SUPPLEMENT_MAP = {
  "CoC 입문 세트": "https://image.aladin.co.kr/product/25679/68/cover500/8988060644_1.jpg",
  "이름 없는 공포들": "https://contents.kyobobook.co.kr/sih/fit-in/400x0/pdt/9788988060421.jpg?t=2974191"
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

      const { entity } = body;

      if (entity && entity.id) {
        // 데이터베이스 자체의 변경 이벤트일 경우 스킵 (에러 방지)
        if (entity.object === 'database') {
          console.log(`[스킵] 데이터베이스 변경 이벤트(ID: ${entity.id})는 처리하지 않습니다.`);
          return res.status(200).json({ success: true });
        }

        const pageId = entity.id;
        const page = await notion.pages.retrieve({ page_id: pageId });

        // 속성값 읽기
        const selectedRule = page.properties["룰"]?.select?.name;
        const supplementText = page.properties["서플리먼트"]?.rich_text?.[0]?.plain_text?.trim();

        let targetImageUrl = null;
        let imageLabel = "";

        // 우선순위 1: '서플리먼트' 입력값이 등록된 경우 서플리먼트 표지 적용
        if (supplementText && SUPPLEMENT_MAP[supplementText]) {
          targetImageUrl = SUPPLEMENT_MAP[supplementText];
          imageLabel = `${supplementText} 표지`;
        } 
        // 우선순위 2: 서플리먼트가 없거나 목록에 없으면 '룰' 표지 적용
        else if (selectedRule && RULE_MAP[selectedRule]) {
          targetImageUrl = RULE_MAP[selectedRule];
          imageLabel = `${selectedRule} 표지`;
        }

        // 매핑된 이미지가 있을 때만 노션 속성 업데이트
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
          console.log(`[스킵] 자동 설정할 이미지가 없으므로 사용자 수동 설정을 유지합니다.`);
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