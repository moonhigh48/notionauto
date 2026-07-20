import express from 'express';
import { Client } from '@notionhq/client';

const app = express();
app.use(express.json());

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// '룰' 속성의 값과 그에 해당하는 이미지 URL 매핑
const IMAGE_MAP = {
  "어둠 속의 칼날": "https://image.aladin.co.kr/product/18153/52/cover200/8988060555_1.jpg",
  "룰 B": "https://example.com/image_b.png",
  "룰 C": "https://example.com/image_c.png"
  // 필요한 룰 항목을 여기에 추가하세요.
};

app.post('/api/webhook', async (req, res) => {
  try {
    const { entity } = req.body;

    if (entity && entity.id) {
      const pageId = entity.id;
      
      // 변경된 페이지 속성 조회
      const page = await notion.pages.retrieve({ page_id: pageId });
      
      // '룰' 선택 속성의 현재 값 추출
      const selectedRule = page.properties["룰"]?.select?.name;
      const targetImageUrl = IMAGE_MAP[selectedRule];

      // 선택된 '룰'에 대응하는 이미지 URL이 존재하는 경우 업데이트
      if (selectedRule && targetImageUrl) {
        await notion.pages.update({
          page_id: pageId,
          properties: {
            "사진": {
              files: [
                {
                  name: `${selectedRule} 이미지`,
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