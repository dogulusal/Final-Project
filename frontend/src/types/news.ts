export interface NewsItem {
  id: number;
  baslik: string;
  slug: string;
  metaAciklama: string | null;
  icerik: string | null;
  kategoriId: number;
  kaynakUrl: string | null;
  gorselUrl: string | null;
  sentiment: string | null;
  durum: string;
  mlConfidence: number | null;
  okumaSuresiDakika: number | null;
  yayinlanmaTarihi: string;
  goruntulemeSayisi: number;
  kategori: {
    id: number;
    ad: string;
    slug: string;
    renkKodu: string;
    ikon: string | null;
  };
}
