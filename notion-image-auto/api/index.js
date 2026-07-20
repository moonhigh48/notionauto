import express from 'express';
import { Client } from '@notionhq/client';

const app = express();
app.use(express.json());

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// '룰' 속성 값과 이미지 URL 매핑
const IMAGE_MAP = {
  "어둠 속의 칼날": "https://image.aladin.co.kr/product/18153/52/cover200/8988060555_1.jpg"
  // 추후 필요한 다른 룰 옵션들을 이곳에 계속 추가하시면 됩니다.
};

app.post('/api/webhook', async (req, res) => {
  try {
    const body = req.body;

    // 1. 노션 웹훅 등록 시 검증(Verification) 요청 처리
    if (body.verification_token) {
      console.log("==========================================");
      console.log("NOTION VERIFICATION TOKEN:", body.verification_token);
      console.log("==========================================");
      
      return res.status(200).json({ verification_token: body.verification_token });
    }

    // 2. 실제 데이터 변경 이벤트 처리
    const { entity } = body;
    if (entity && entity.id) {
      const pageId = entity.id;
      const page = await notion.pages.retrieve({ page_id: pageId });
      
      const selectedRule = page.properties["룰"]?.select?.name;
      const targetImageUrl = IMAGE_MAP[selectedRule];

      if (selectedRule && targetImageUrl) {
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
        console.log(`[성공] 페이지 ID ${pageId} : '룰' -> '${selectedRule}' 이미지 변경 완료`);
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[에러 발생]", error);
    return res.status(500).json({ error: error.message });
  }
});

export default app;