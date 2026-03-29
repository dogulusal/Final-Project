import { render, screen, waitFor } from "@testing-library/react";
import SentimentBiasMap from "../SentimentBiasMap";

jest.mock("@/lib/auth", () => ({
  getAccessToken: jest.fn(() => "mock-token"),
}));

describe("SentimentBiasMap", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (global as { fetch?: unknown }).fetch;
  });

  it("renders fetched sentiment data", async () => {
    const mockResponse = {
      success: true,
      data: {
        distribution: {
          Pozitif: { count: 50, percentage: 50 },
          "Nötr": { count: 30, percentage: 30 },
          Negatif: { count: 20, percentage: 20 },
        },
        confidence: { average: 88, min: 60, max: 99 },
        totalArticles: 100,
      },
    };

    (global as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    render(<SentimentBiasMap autoFetch apiUrl="http://localhost:3001" />);

    await waitFor(() => {
      expect(screen.getByText(/Gündem Duygu Haritası/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Pozitif oranı/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nötr oranı/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Negatif oranı/i })).toBeInTheDocument();
    expect(screen.getByText(/%88/)).toBeInTheDocument();
  });

  it("shows demo fallback message when API fails", async () => {
    (global as { fetch: jest.Mock }).fetch = jest.fn().mockRejectedValue(new Error("Network fail"));

    render(<SentimentBiasMap autoFetch apiUrl="http://localhost:3001" />);

    await waitFor(() => {
      expect(screen.getByText(/Demo verisi gösteriliyor/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Güven Skoru:/i)).toBeInTheDocument();
  });
});
