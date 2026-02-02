export interface KeywordRule {
  id: string;
  keyword: string;
  newFileName: string;
  enabled: boolean;
  matchCount?: number; // 매칭된 이미지 수
}

export interface ImageFile {
  id: string;
  file: File;
  originalName: string;
  fileSize: number;
  metadata: Record<string, string>;
  matchedRule: KeywordRule | null;
  matchedField: string | null;
  newFileName: string | null;
  thumbnailUrl: string; // 작은 썸네일만 저장 (메모리 절약)
}

export interface ProcessingProgress {
  current: number;
  total: number;
  phase: 'reading' | 'processing' | 'zipping' | 'done';
  message: string;
}

export interface BatchDownloadInfo {
  batchNumber: number;
  totalBatches: number;
  filesInBatch: number;
}

// 시스템 제한
export const LIMITS = {
  MAX_IMAGES: 3000,           // 최대 이미지 수
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 단일 파일 최대 10MB
  MAX_TOTAL_SIZE: 6 * 1024 * 1024 * 1024, // 총 6GB
  BATCH_SIZE: 100,            // ZIP 배치당 파일 수
  THUMBNAIL_SIZE: 80,         // 썸네일 크기 (px)
  MAX_KEYWORD_LENGTH: 5000,   // 키워드 최대 길이
  MAX_FILENAME_LENGTH: 200,   // 파일명 최대 길이
} as const;

export type FilterMode = 'all' | 'matched' | 'unmatched';
