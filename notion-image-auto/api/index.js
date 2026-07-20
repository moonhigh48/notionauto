import express from 'express';
import { Client } from '@notionhq/client';

const app = express();
app.use(express.json());

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const IMAGE_MAP = {
  "어둠 속의 칼날": "https://image.aladin.co.kr/product/18153/52/cover200/8988060555_1.jpg"
};

// Express 엔드포인트를 '/api/webhook'이 아닌 '/' 또는 '/webhook'으로 설정
app.post('/', async (req, res) => {
  try {
    const body = req.body;

    // 1. 인증 토큰 검증 처리
    if (body.verification_token) {
      console.log("==========================================");
      console.log("NOTION VERIFICATION TOKEN:", body.verification_token);
      console.log("==========================================");
      
      return res.status(200).json({ verification_token: body.verification_token });
    }

    // 2. 실제 업데이트 처리
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

// GET 요청 테스트용 (브라우저로 접속했을 때 404가 아니라는 것을 확인)
app.get('/', (req, res) => {
  res.send('Server is running!');
});

export default app;