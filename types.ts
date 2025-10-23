
export interface Correction {
  original: string;
  issue: string;
  suggestion: string;
  type: 'correção' | 'sugestão';
}