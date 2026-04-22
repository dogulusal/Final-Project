export function getConfidenceBand(confidence: number | null): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (!confidence) return 'LOW';
  if (confidence >= 0.85) return 'HIGH';
  if (confidence >= 0.60) return 'MEDIUM';
  return 'LOW';
}
