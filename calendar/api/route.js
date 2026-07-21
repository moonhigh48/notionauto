import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export async function GET() {
  try {
    const databaseId = process.env.NOTION_DATABASE_ID;
    
    // 데이터베이스 항목 전체 조회
    const response = await notion.databases.query({
      database_id: databaseId,
    });

    const events = [];

    response.results.forEach((page) => {
      // 속성 추출
      const title = page.properties["이름"]?.title?.[0]?.plain_text || "제목 없음";
      const rule = page.properties["룰"]?.select?.name || "";
      const datesText = page.properties["날짜목록"]?.rich_text?.[0]?.plain_text || "";
      const coverUrl = page.properties["사진"]?.files?.[0]?.external?.url || "";

      // 쉼표로 구분된 날짜들을 파싱해서 각각 개별 이벤트로 분리
      if (datesText) {
        const dateArray = datesText.split(',').map(d => d.trim());
        
        dateArray.forEach((dateStr) => {
          if (dateStr) {
            events.push({
              id: `${page.id}-${dateStr}`,
              pageId: page.id,
              title: title,
              start: dateStr,
              rule: rule,
              coverUrl: coverUrl,
              url: page.url // 노션 페이지 바로가기 링크
            });
          }
        });
      }
    });

    return Response.json({ events });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}