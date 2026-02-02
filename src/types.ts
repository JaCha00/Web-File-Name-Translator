export interface KeywordRule {
  id: string;
  keyword: string;
  newFileName: string;
  enabled: boolean;
  matchCount?: number; // 매칭된 이미지 수
  partialMatch?: boolean; // 부분 매칭 활성화 여부 (개별 설정)
}

// 부분 매칭 설정
export interface PartialMatchSettings {
  globalEnabled: boolean; // 전체 부분 매칭 ON/OFF
  minMatchRatio: number; // 최소 일치율 (0.0 ~ 1.0)
  tokenSeparator: string; // 토큰 구분자 (기본: ',')
}

// 매칭 후보 정보
export interface MatchCandidate {
  rule: KeywordRule;
  matchedField: string;
  matchScore: number; // 일치율 (0.0 ~ 1.0)
  matchedTokens: string[]; // 일치한 토큰들
  totalTokens: number; // 전체 토큰 수
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
  // 부분 매칭 관련
  matchScore?: number; // 현재 매칭의 일치율
  candidateMatches?: MatchCandidate[]; // 다중 매칭 후보들
  isPartialMatch?: boolean; // 부분 매칭으로 매칭되었는지 여부
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

// 부분 매칭 기본 설정
export const DEFAULT_PARTIAL_MATCH_SETTINGS: PartialMatchSettings = {
  globalEnabled: false,
  minMatchRatio: 0.7, // 기본 70% 일치율
  tokenSeparator: ',',
};

export type FilterMode = 'all' | 'matched' | 'unmatched';
