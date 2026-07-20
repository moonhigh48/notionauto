import express from 'express';
import { Client } from '@notionhq/client';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// 규칙별 적용할 외부 이미지 URL 매핑
const IMAGE_MAP = {
  "규칙 A": "https://images.unsplash.com/photo-1579546929518-9e396f3cc809", // 예시 URL
  "규칙 B": "https://images.unsplash.com/photo-1557683316-973673baf926",
  "규칙 C": "https://images.unsplash.com/photo-1550684848-fac1c5b4e853"
};

app.post('/api/webhook', async (req, res) => {
  try {
    const { entity } = req.body; // 웹훅에서 전달된 데이터

    // 노션 페이지 업데이트 이벤트 확인
    if (entity && entity.id) {
      const pageId = entity.id;
      
      // 해당 페이지 정보 조회
      const page = await notion.pages.retrieve({ page_id: pageId });
      const selectedRule = page.properties["규칙"]?.select?.name;
      const targetImageUrl = IMAGE_MAP[selectedRule];

      if (selectedRule && targetImageUrl) {
        // 사진 속성 업데이트
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
        console.log(`[성공] Page: ${pageId} -> ${selectedRule} 이미지 변경 완료`);
      }
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[에러 발생]", error);
    return res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

export default app;