import { useState, useCallback, useRef } from 'react';
import exifr from 'exifr';
import { ImageFile, KeywordRule, ProcessingProgress, LIMITS, PartialMatchSettings, MatchCandidate } from '../types';
import { parsePngTextChunks } from '../utils/pngParser';
import { createThumbnail } from '../utils/thumbnail';

// 키워드를 토큰으로 분리
const tokenizeKeyword = (keyword: string, separator: string): string[] => {
  return keyword
    .split(separator)
    .map(token => token.trim())
    .filter(token => token.length > 0);
};

// 부분 매칭 점수 계산
const calculatePartialMatchScore = (
  keyword: string,
  fieldValue: string,
  separator: string
): { score: number; matchedTokens: string[]; totalTokens: number } => {
  const tokens = tokenizeKeyword(keyword, separator);
  if (tokens.length === 0) {
    return { score: 0, matchedTokens: [], totalTokens: 0 };
  }

  const matchedTokens: string[] = [];
  for (const token of tokens) {
    if (fieldValue.includes(token)) {
      matchedTokens.push(token);
    }
  }

  return {
    score: matchedTokens.length / tokens.length,
    matchedTokens,
    totalTokens: tokens.length,
  };
};

export function useImageProcessor() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const totalSizeRef = useRef(0);

  // 모든 메타데이터 추출
  const extractAllMetadata = async (file: File): Promise<Record<string, string>> => {
    const metadata: Record<string, string> = {};
    const buffer = await file.arrayBuffer();

    // 1. PNG 텍스트 청크 파싱 (PNG:Comment 등)
    if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
      try {
        const pngMeta = await parsePngTextChunks(buffer);
        Object.entries(pngMeta).forEach(([key, value]) => {
          if (value && typeof value === 'string' && value.trim()) {
            metadata[key] = value;
          }
        });
      } catch (e) {
        console.warn('PNG 메타데이터 파싱 실패:', e);
      }
    }

    // 2. EXIF/XMP/IPTC 메타데이터 파싱 (모든 필드)
    try {
      const exifData = await exifr.parse(buffer, {
        tiff: true,
        xmp: true,
        iptc: true,
        icc: true,
        jfif: true,
        ihdr: true,
        translateKeys: true,
        translateValues: true,
        reviveValues: true,
      });

      if (exifData) {
        Object.entries(exifData).forEach(([key, value]) => {
          let strValue: string;
          if (value === null || value === undefined) {
            return;
          } else if (typeof value === 'string') {
            strValue = value;
          } else if (value instanceof Date) {
            strValue = value.toISOString();
          } else if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
            return;
          } else if (typeof value === 'object') {
            try {
              strValue = JSON.stringify(value);
            } catch {
              return;
            }
          } else {
            strValue = String(value);
          }

          if (strValue.trim()) {
            metadata[`EXIF:${key}`] = strValue;
          }
        });
      }
    } catch (e) {
      console.warn('EXIF 메타데이터 파싱 실패:', e);
    }

    return metadata;
  };

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    
    // 제한 체크
    const currentCount = images.length;
    const newCount = fileArray.length;
    
    if (currentCount + newCount > LIMITS.MAX_IMAGES) {
      const allowed = LIMITS.MAX_IMAGES - currentCount;
      alert(`최대 ${LIMITS.MAX_IMAGES}개까지만 업로드 가능합니다.\n현재 ${currentCount}개, 추가 가능: ${allowed}개`);
      if (allowed <= 0) return;
      fileArray.splice(allowed);
    }

    // 파일 크기 체크
    const validFiles: File[] = [];
    let addedSize = 0;
    
    for (const file of fileArray) {
      if (file.size > LIMITS.MAX_FILE_SIZE) {
        console.warn(`파일 크기 초과: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
        continue;
      }
      if (totalSizeRef.current + addedSize + file.size > LIMITS.MAX_TOTAL_SIZE) {
        alert('총 용량 제한(6GB)에 도달했습니다.');
        break;
      }
      validFiles.push(file);
      addedSize += file.size;
    }

    if (validFiles.length === 0) return;

    setIsProcessing(true);
    const imageFiles: ImageFile[] = [];

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      
      setProgress({
        current: i + 1,
        total: validFiles.length,
        phase: 'processing',
        message: `처리 중: ${file.name}`,
      });

      try {
        const [metadata, thumbnailUrl] = await Promise.all([
          extractAllMetadata(file),
          createThumbnail(file),
        ]);

        imageFiles.push({
          id: crypto.randomUUID(),
          file,
          originalName: file.name,
          fileSize: file.size,
          metadata,
          matchedRule: null,
          matchedField: null,
          newFileName: null,
          thumbnailUrl,
        });
      } catch (e) {
        console.error(`파일 처리 실패: ${file.name}`, e);
      }

      // 10개마다 UI 업데이트를 위한 짧은 대기
      if (i % 10 === 9) {
        await new Promise(r => setTimeout(r, 0));
      }
    }

    totalSizeRef.current += addedSize;
    setImages((prev) => [...prev, ...imageFiles]);
    setIsProcessing(false);
    setProgress(null);
  }, [images.length]);

  const applyRules = useCallback((
    rules: KeywordRule[],
    partialMatchSettings?: PartialMatchSettings
  ) => {
    setImages((prev) =>
      prev.map((img) => {
        const metadataEntries = Object.entries(img.metadata);
        if (metadataEntries.length === 0) {
          return {
            ...img,
            matchedRule: null,
            matchedField: null,
            newFileName: null,
            matchScore: undefined,
            candidateMatches: undefined,
            isPartialMatch: undefined,
          };
        }

        const enabledRules = rules.filter((r) => r.enabled);
        const allCandidates: MatchCandidate[] = [];

        // 1단계: 완전 일치 검색 (기존 로직)
        for (const rule of enabledRules) {
          for (const [fieldName, fieldValue] of metadataEntries) {
            if (fieldValue.includes(rule.keyword)) {
              const ext = img.originalName.split('.').pop() || 'jpg';
              const baseName = rule.newFileName.replace(/\.[^.]+$/, '');

              // 완전 일치는 바로 반환 (가장 높은 우선순위)
              return {
                ...img,
                matchedRule: rule,
                matchedField: fieldName,
                newFileName: `${baseName}.${ext}`,
                matchScore: 1.0,
                candidateMatches: undefined,
                isPartialMatch: false,
              };
            }
          }
        }

        // 2단계: 부분 매칭 검색 (설정이 활성화된 경우)
        if (partialMatchSettings?.globalEnabled) {
          const separator = partialMatchSettings.tokenSeparator || ',';
          const minRatio = partialMatchSettings.minMatchRatio || 0.7;

          for (const rule of enabledRules) {
            // 전역 부분 매칭이 켜져 있거나, 개별 규칙의 부분 매칭이 켜져 있는 경우
            const isPartialMatchEnabled = partialMatchSettings.globalEnabled || rule.partialMatch;
            if (!isPartialMatchEnabled) continue;

            for (const [fieldName, fieldValue] of metadataEntries) {
              const { score, matchedTokens, totalTokens } = calculatePartialMatchScore(
                rule.keyword,
                fieldValue,
                separator
              );

              // 최소 일치율을 넘는 경우 후보에 추가
              if (score >= minRatio && score < 1.0) {
                allCandidates.push({
                  rule,
                  matchedField: fieldName,
                  matchScore: score,
                  matchedTokens,
                  totalTokens,
                });
              }
            }
          }
        } else {
          // 전역 부분 매칭이 꺼져 있더라도, 개별 규칙에서 부분 매칭이 켜져 있는 경우 처리
          const separator = partialMatchSettings?.tokenSeparator || ',';
          const minRatio = partialMatchSettings?.minMatchRatio || 0.7;

          for (const rule of enabledRules) {
            if (!rule.partialMatch) continue;

            for (const [fieldName, fieldValue] of metadataEntries) {
              const { score, matchedTokens, totalTokens } = calculatePartialMatchScore(
                rule.keyword,
                fieldValue,
                separator
              );

              if (score >= minRatio && score < 1.0) {
                allCandidates.push({
                  rule,
                  matchedField: fieldName,
                  matchScore: score,
                  matchedTokens,
                  totalTokens,
                });
              }
            }
          }
        }

        // 부분 매칭 후보가 있는 경우
        if (allCandidates.length > 0) {
          // 점수 순으로 정렬 (높은 점수 우선)
          allCandidates.sort((a, b) => b.matchScore - a.matchScore);

          // 가장 높은 점수의 후보를 기본 매칭으로 설정
          const bestMatch = allCandidates[0];
          const ext = img.originalName.split('.').pop() || 'jpg';
          const baseName = bestMatch.rule.newFileName.replace(/\.[^.]+$/, '');

          return {
            ...img,
            matchedRule: bestMatch.rule,
            matchedField: bestMatch.matchedField,
            newFileName: `${baseName}.${ext}`,
            matchScore: bestMatch.matchScore,
            candidateMatches: allCandidates.length > 1 ? allCandidates : undefined,
            isPartialMatch: true,
          };
        }

        return {
          ...img,
          matchedRule: null,
          matchedField: null,
          newFileName: null,
          matchScore: undefined,
          candidateMatches: undefined,
          isPartialMatch: undefined,
        };
      })
    );
  }, []);

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) {
        totalSizeRef.current -= img.fileSize;
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const removeMultipleImages = useCallback((ids: Set<string>) => {
    setImages((prev) => {
      let removedSize = 0;
      const filtered = prev.filter((img) => {
        if (ids.has(img.id)) {
          removedSize += img.fileSize;
          return false;
        }
        return true;
      });
      totalSizeRef.current -= removedSize;
      return filtered;
    });
  }, []);

  const clearAllImages = useCallback(() => {
    totalSizeRef.current = 0;
    setImages([]);
  }, []);

  const clearUnmatchedImages = useCallback(() => {
    setImages((prev) => {
      let removedSize = 0;
      const filtered = prev.filter((img) => {
        if (!img.matchedRule) {
          removedSize += img.fileSize;
          return false;
        }
        return true;
      });
      totalSizeRef.current -= removedSize;
      return filtered;
    });
  }, []);

  // 특정 이미지의 매칭 규칙을 수동으로 선택
  const selectMatchForImage = useCallback((imageId: string, candidate: MatchCandidate) => {
    setImages((prev) =>
      prev.map((img) => {
        if (img.id !== imageId) return img;

        const ext = img.originalName.split('.').pop() || 'jpg';
        const baseName = candidate.rule.newFileName.replace(/\.[^.]+$/, '');

        return {
          ...img,
          matchedRule: candidate.rule,
          matchedField: candidate.matchedField,
          newFileName: `${baseName}.${ext}`,
          matchScore: candidate.matchScore,
          isPartialMatch: candidate.matchScore < 1.0,
        };
      })
    );
  }, []);

  return {
    images,
    isProcessing,
    progress,
    processFiles,
    applyRules,
    removeImage,
    removeMultipleImages,
    clearAllImages,
    clearUnmatchedImages,
    selectMatchForImage,
    totalSize: totalSizeRef.current,
  };
}
