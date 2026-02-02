import { useState, useEffect, useCallback, useMemo } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { DropZone } from './components/DropZone';
import { RuleManager } from './components/RuleManager';
import { ImageList } from './components/ImageList';
import { useImageProcessor } from './hooks/useImageProcessor';
import { KeywordRule, FilterMode, LIMITS, ProcessingProgress } from './types';
import { formatFileSize } from './utils/thumbnail';

const STORAGE_KEY = 'image-renamer-rules-v2';

export function App() {
  const [rules, setRules] = useState<KeywordRule[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [downloadProgress, setDownloadProgress] = useState<ProcessingProgress | null>(null);

  const {
    images,
    isProcessing,
    progress,
    processFiles,
    applyRules,
    removeImage,
    removeMultipleImages,
    clearAllImages,
    clearUnmatchedImages,
  } = useImageProcessor();

  // 규칙 변경 시 localStorage에 저장 및 이미지에 적용
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    } catch (e) {
      console.warn('규칙 저장 실패:', e);
    }
    applyRules(rules);
  }, [rules, applyRules]);

  // 이미지 추가 시 규칙 적용
  useEffect(() => {
    if (images.length > 0) {
      applyRules(rules);
    }
  }, [images.length, applyRules, rules]);

  // 규칙별 매칭 카운트 계산
  const matchCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const img of images) {
      if (img.matchedRule) {
        counts.set(img.matchedRule.id, (counts.get(img.matchedRule.id) || 0) + 1);
      }
    }
    return counts;
  }, [images]);

  // 매칭된 이미지
  const matchedImages = useMemo(() => images.filter((img) => img.newFileName), [images]);

  // 배치 다운로드
  const handleDownload = useCallback(async () => {
    if (matchedImages.length === 0) return;

    const totalFiles = matchedImages.length;
    const batchSize = LIMITS.BATCH_SIZE;
    const totalBatches = Math.ceil(totalFiles / batchSize);

    try {
      for (let batch = 0; batch < totalBatches; batch++) {
        const start = batch * batchSize;
        const end = Math.min(start + batchSize, totalFiles);
        const batchImages = matchedImages.slice(start, end);

        setDownloadProgress({
          current: start,
          total: totalFiles,
          phase: 'zipping',
          message: `ZIP 생성 중... (배치 ${batch + 1}/${totalBatches})`,
        });

        const zip = new JSZip();
        const fileNameCounts: Record<string, number> = {};

        for (let i = 0; i < batchImages.length; i++) {
          const img = batchImages[i];
          
          setDownloadProgress({
            current: start + i + 1,
            total: totalFiles,
            phase: 'zipping',
            message: `파일 추가 중: ${img.originalName}`,
          });

          // 중복 파일명 처리
          // 규칙: 첫 번째는 "파일명.ext", 두 번째부터 "파일명_1.ext", "파일명_2.ext"...
          const ext = img.originalName.split('.').pop() || 'jpg';
          const baseName = img.newFileName!.replace(/\.[^.]+$/, '');
          const nameKey = `${baseName.toLowerCase()}.${ext.toLowerCase()}`; // 대소문자 무시
          
          let finalName: string;
          if (fileNameCounts[nameKey] === undefined) {
            // 첫 번째 파일
            fileNameCounts[nameKey] = 0;
            finalName = `${baseName}.${ext}`;
          } else {
            // 중복 파일: _1, _2, _3...
            fileNameCounts[nameKey]++;
            finalName = `${baseName}_${fileNameCounts[nameKey]}.${ext}`;
          }

          const arrayBuffer = await img.file.arrayBuffer();
          zip.file(finalName, arrayBuffer);

          // 메모리 해제를 위한 짧은 대기
          if (i % 20 === 19) {
            await new Promise((r) => setTimeout(r, 0));
          }
        }

        setDownloadProgress({
          current: end,
          total: totalFiles,
          phase: 'zipping',
          message: 'ZIP 압축 중...',
        });

        const content = await zip.generateAsync(
          { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
          (metadata) => {
            setDownloadProgress({
              current: end,
              total: totalFiles,
              phase: 'zipping',
              message: `압축 중... ${Math.round(metadata.percent)}%`,
            });
          }
        );

        const fileName = totalBatches > 1
          ? `renamed_images_batch${batch + 1}_${Date.now()}.zip`
          : `renamed_images_${Date.now()}.zip`;
        
        saveAs(content, fileName);

        // 배치 간 대기
        if (batch < totalBatches - 1) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      setDownloadProgress({
        current: totalFiles,
        total: totalFiles,
        phase: 'done',
        message: '다운로드 완료!',
      });

      setTimeout(() => setDownloadProgress(null), 2000);
    } catch (error) {
      console.error('다운로드 실패:', error);
      alert('다운로드 중 오류가 발생했습니다. 파일 수를 줄여서 다시 시도해주세요.');
      setDownloadProgress(null);
    }
  }, [matchedImages]);

  const matchedCount = matchedImages.length;
  const unmatchedCount = images.length - matchedCount;
  const totalSize = images.reduce((sum, img) => sum + img.fileSize, 0);
  const matchedSize = matchedImages.reduce((sum, img) => sum + img.fileSize, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-zinc-100">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-1">
            이미지 메타데이터 파일명 변환기
          </h1>
          <p className="text-gray-500 text-xs">
            대용량 처리 지원 · 최대 {LIMITS.MAX_IMAGES.toLocaleString()}개 이미지
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-4">
          {/* 좌측: 설정 영역 (2/5) */}
          <div className="lg:col-span-2 space-y-4">
            {/* 규칙 관리 */}
            <RuleManager 
              rules={rules} 
              onRulesChange={setRules} 
              matchCounts={matchCounts}
            />

            {/* 파일 업로드 */}
            <DropZone 
              onFilesDropped={processFiles} 
              isProcessing={isProcessing}
              progress={progress}
              currentCount={images.length}
            />

            {/* 통계 및 액션 */}
            {images.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                {/* 통계 */}
                <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-lg font-bold text-gray-800">{images.length.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">전체</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2">
                    <p className="text-lg font-bold text-green-600">{matchedCount.toLocaleString()}</p>
                    <p className="text-xs text-green-600">매칭</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-lg font-bold text-gray-400">{unmatchedCount.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">미매칭</p>
                  </div>
                </div>

                {/* 용량 정보 */}
                <div className="text-xs text-gray-500 mb-3 text-center">
                  총 {formatFileSize(totalSize)} · 매칭 {formatFileSize(matchedSize)}
                </div>

                {/* 다운로드 진행률 */}
                {downloadProgress && (
                  <div className="mb-3 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700 mb-1">{downloadProgress.message}</p>
                    <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-200"
                        style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-blue-600 mt-1">
                      {downloadProgress.current} / {downloadProgress.total}
                    </p>
                  </div>
                )}

                {/* 액션 버튼 */}
                <div className="space-y-2">
                  <button
                    onClick={handleDownload}
                    disabled={matchedCount === 0 || downloadProgress !== null}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                  >
                    {downloadProgress ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        처리 중...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        매칭된 {matchedCount.toLocaleString()}개 다운로드
                        {matchedCount > LIMITS.BATCH_SIZE && (
                          <span className="text-xs opacity-75">
                            ({Math.ceil(matchedCount / LIMITS.BATCH_SIZE)}개 ZIP)
                          </span>
                        )}
                      </>
                    )}
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={clearUnmatchedImages}
                      disabled={unmatchedCount === 0}
                      className="flex-1 px-3 py-2 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      미매칭 제거 ({unmatchedCount})
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('모든 이미지를 삭제하시겠습니까?')) {
                          clearAllImages();
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100 transition-colors"
                    >
                      전체 삭제
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 사용 방법 */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <h4 className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                사용 방법
              </h4>
              <ol className="text-xs text-amber-700 space-y-0.5 list-decimal list-inside">
                <li>키워드(프롬프트 일부)와 새 파일명 규칙 추가</li>
                <li>이미지 파일 드래그 또는 클릭하여 업로드</li>
                <li>모든 메타데이터에서 키워드 자동 검색</li>
                <li>다운로드 버튼으로 ZIP 파일 받기</li>
              </ol>
              <div className="mt-2 pt-2 border-t border-amber-200 text-xs text-amber-600">
                <p>💡 {LIMITS.BATCH_SIZE}개씩 배치 처리로 안정적 다운로드</p>
                <p>💡 긴 프롬프트 키워드도 정확히 매칭</p>
              </div>
            </div>
          </div>

          {/* 우측: 이미지 목록 (3/5) */}
          <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              업로드된 이미지
            </h3>
            <ImageList 
              images={images} 
              onRemove={removeImage}
              onRemoveMultiple={removeMultipleImages}
              filterMode={filterMode}
              onFilterChange={setFilterMode}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-400">
          <p>PNG 텍스트 청크 · EXIF · XMP · IPTC 메타데이터 검색 지원</p>
          <p className="mt-0.5">Chrome/Edge 브라우저 권장</p>
        </div>
      </div>
    </div>
  );
}
