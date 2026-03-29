export default function Head() {
  const title = "Kategoriler - AI Haber Ajansi";
  const description = "Spor, teknoloji, ekonomi, siyaset ve diger haber kategorilerini kesfedin.";

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
