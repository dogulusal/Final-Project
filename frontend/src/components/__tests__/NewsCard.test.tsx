import { render, screen } from "@testing-library/react";
import NewsCard from "../NewsCard";
import type { NewsItem } from "@/types/news";
import type { ReactNode } from "react";

jest.mock("next/link", () => {
  return ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

const baseNews: NewsItem = {
  id: 1,
  baslik: "Test Haber Basligi",
  slug: "test-haber-basligi",
  metaAciklama: "Kisa aciklama",
  icerik: "- Birinci madde\n- Ikinci madde\nNormal satir",
  kategoriId: 1,
  kaynakUrl: "https://example.com/haber",
  gorselUrl: null,
  sentiment: "Pozitif",
  durum: "hazir",
  mlConfidence: 0.92,
  okumaSuresiDakika: 3,
  yayinlanmaTarihi: new Date().toISOString(),
  goruntulemeSayisi: 10,
  kategori: {
    id: 1,
    ad: "Spor",
    slug: "spor",
    renkKodu: "#000000",
    ikon: "⚽",
  },
};

describe("NewsCard", () => {
  it("renders title, category badge and source host", () => {
    render(<NewsCard news={baseNews} />);

    expect(screen.getByText("Test Haber Basligi")).toBeInTheDocument();
    expect(screen.getByText("Spor")).toBeInTheDocument();
    expect(screen.getByText("example.com")).toBeInTheDocument();
  });

  it("renders first two bullet points from content", () => {
    render(<NewsCard news={baseNews} />);

    expect(screen.getByText("Birinci madde")).toBeInTheDocument();
    expect(screen.getByText("Ikinci madde")).toBeInTheDocument();
  });

  it("falls back to Ajans when source URL is invalid", () => {
    render(
      <NewsCard
        news={{
          ...baseNews,
          kaynakUrl: "gecersiz-url",
        }}
      />,
    );

    expect(screen.getByText("Ajans")).toBeInTheDocument();
  });

  it("falls back to Genel badge when category is missing", () => {
    render(
      <NewsCard
        news={{
          ...baseNews,
          kategori: undefined as unknown as NewsItem["kategori"],
        }}
      />,
    );

    expect(screen.getByText("Genel")).toBeInTheDocument();
  });
});
