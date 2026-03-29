export default function Head() {
  const title = "Hakkinda - AI Haber Ajansi";
  const description = "AI Haber Ajansi mimarisi, RSS pipeline, ML kategorizasyon ve Gemini destekli icerik akisini taniyin.";

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
    </>
  );
}
