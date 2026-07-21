import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const RULE_MAP = {
  "어둠 속의 칼날": "https://image.aladin.co.kr/product/18153/52/cover200/8988060555_1.jpg",
  "CoC 7th": "https://contents.kyobobook.co.kr/sih/fit-in/400x0/pdt/9788988060391.jpg?t=2974099"
};

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

      if (body.verification_token) {
        return res.status(200).json({ verification_token: body.verification_token });
      }

      const { entity } = body;

      if (entity && entity.id) {
        if (entity.object === 'database') {
          console.log(`[스킵] 데이터베이스 변경 이벤트(ID: ${entity.id})는 처리하지 않습니다.`);
          return res.status(200).json({ success: true });
        }

        const pageId = entity.id;
        let page;

        // 권한이 없거나 페이지를 찾을 수 없는 경우 개별 예외 처리
        try {
          page = await notion.pages.retrieve({ page_id: pageId });
        } catch (pageError) {
          if (pageError.code === 'object_not_found') {
            console.warn(`[스킵] 페이지를 찾을 수 없거나 접근 권한이 없습니다. (ID: ${pageId})`);
            return res.status(200).json({ success: true, message: 'Page not found or no access' });
          }
          throw pageError; // 다른 에러는 상위 catch로 전달
        }

        const selectedRule = page.properties["룰"]?.select?.name;
        const supplementText = page.properties["서플리먼트"]?.rich_text?.[0]?.plain_text?.trim();

        let targetImageUrl = null;
        let imageLabel = "";

        if (supplementText && SUPPLEMENT_MAP[supplementText]) {
          targetImageUrl = SUPPLEMENT_MAP[supplementText];
          imageLabel = `${supplementText} 표지`;
        } else if (selectedRule && RULE_MAP[selectedRule]) {
          targetImageUrl = RULE_MAP[selectedRule];
          imageLabel = `${selectedRule} 표지`;
        }

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

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[에러 발생]", error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}