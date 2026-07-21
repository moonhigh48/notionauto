export const metadata = {
  title: 'Notion Auto Server',
  description: 'Notion Automation & TRPG Calendar',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}