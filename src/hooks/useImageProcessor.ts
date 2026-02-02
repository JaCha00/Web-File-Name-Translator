import { useState, useCallback, useRef } from 'react';
import exifr from 'exifr';
import { ImageFile, KeywordRule, ProcessingProgress, LIMITS } from '../types';
import { parsePngTextChunks } from '../utils/pngParser';
import { createThumbnail } from '../utils/thumbnail';

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

  const applyRules = useCallback((rules: KeywordRule[]) => {
    setImages((prev) =>
      prev.map((img) => {
        const metadataEntries = Object.entries(img.metadata);
        if (metadataEntries.length === 0) {
          return { ...img, matchedRule: null, matchedField: null, newFileName: null };
        }

        const enabledRules = rules.filter((r) => r.enabled);
        
        for (const rule of enabledRules) {
          for (const [fieldName, fieldValue] of metadataEntries) {
            if (fieldValue.includes(rule.keyword)) {
              const ext = img.originalName.split('.').pop() || 'jpg';
              const baseName = rule.newFileName.replace(/\.[^.]+$/, '');
              return {
                ...img,
                matchedRule: rule,
                matchedField: fieldName,
                newFileName: `${baseName}.${ext}`,
              };
            }
          }
        }

        return { ...img, matchedRule: null, matchedField: null, newFileName: null };
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
    totalSize: totalSizeRef.current,
  };
}
