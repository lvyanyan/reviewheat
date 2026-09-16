export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export const LEVEL_ORDER: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  context: string;
  added: string[];
  removed: string[];
  addedCount: number;
  removedCount: number;
}

export interface FileDiff {
  oldPath: string;
  newPath: string;
  status: 'added' | 'deleted' | 'renamed' | 'modified';
  binary: boolean;
  hunks: Hunk[];
  addedCount: number;
  removedCount: number;
}

export interface RiskFactor {
  id: string;
  weight: number;
  detail: string;
}

export interface HunkScore {
  risk: number;
  level: RiskLevel;
  factors: RiskFactor[];
  behavioralLines: number;
  cosmeticLines: number;
  ocr?: import('./ocr.js').OcrComment[];
}

export interface FileScore {
  risk: number;
  level: RiskLevel;
  isTest: boolean;
  isDoc: boolean;
  isConfig: boolean;
  isChurn: boolean;
  testGap: boolean;
  hunks: HunkScore[];
  ocrUnpinned?: import('./ocr.js').OcrComment[];
}

export interface FileEntry {
  file: FileDiff;
  score: FileScore;
}

export interface Totals {
  files: number;
  added: number;
  removed: number;
  redLines: number;
  redAddedLines: number;
}

export interface AnalysisMeta {
  mode: string;
  repoName: string;
  branch: string;
  commit: string;
  subject: string;
  generatedAt: string;
}

export interface AnalysisResult {
  meta: AnalysisMeta;
  files: FileEntry[];
  totals: Totals;
}
