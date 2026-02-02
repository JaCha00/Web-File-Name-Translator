import { LIMITS } from '../types';

/**
 * 이미지에서 작은 썸네일을 생성하여 메모리를 절약합니다.
 * 원본 이미지 대신 작은 data URL만 저장합니다.
 */
export async function createThumbnail(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve('');
        return;
      }
      
      // 가로세로 비율 유지하면서 썸네일 크기로 축소
      const size = LIMITS.THUMBNAIL_SIZE;
      const ratio = Math.min(size / img.width, size / img.height);
      const width = Math.round(img.width * ratio);
      const height = Math.round(img.height * ratio);
      
      canvas.width = width;
      canvas.height = height;
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // 낮은 품질로 압축하여 메모리 절약
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve('');
    };
    
    img.src = url;
  });
}

/**
 * 파일 크기를 사람이 읽기 쉬운 형식으로 변환
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}
