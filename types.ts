
export interface Correction {
  original: string;
  issue: string;
  suggestion: string;
  type: 'correção' | 'sugestão';
}

export interface ComparisonResult {
  item: string;
  issue: 'price_mismatch' | 'missing_in_menu' | 'missing_in_reference';
  details: {
    menuPrice?: string;
    referencePrice?: string;
    menuName?: string;
    referenceName?: string;
  };
}
