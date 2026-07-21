import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export default async function handler(req, res) {
  // 브라우저 접속 확인용 (GET)
  if (req.method === 'GET') {
    return res.status(200).send('API가 정상적으로 작동 중입니다!');
  }

  if (req.method === 'POST') {
    try {
      const body = req.body;

      // 1. 웹훅 등록 검증 처리
      if (body.verification_token) {
        return res.status(200).json({ verification_token: body.verification_token });
      }

      // 2. 이벤트 감지 및 로그 출력
      const { entity } = body;
      if (entity && entity.id) {
        const pageId = entity.id;
        
        // 노션 API로 페이지 데이터 조회
        const page = await notion.pages.retrieve({ page_id: pageId });
        
        // '룰' 선택 속성의 현재 값
        const selectedRule = page.properties["룰"]?.select?.name;

        console.log("==========================================");
        console.log(`[이벤트 감지] 페이지 ID: ${pageId}`);
        console.log(`[선택된 룰]: ${selectedRule || "선택되지 않음(empty)"}`);
        console.log("==========================================");
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[에러 발생]", error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}