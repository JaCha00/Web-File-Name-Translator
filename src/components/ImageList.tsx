import React, { useState, useMemo, useRef, useCallback } from 'react';
import { ImageFile, FilterMode, LIMITS, MatchCandidate } from '../types';
import { cn } from '../utils/cn';
import { formatFileSize } from '../utils/thumbnail';

interface ImageListProps {
  images: ImageFile[];
  onRemove: (id: string) => void;
  onRemoveMultiple: (ids: Set<string>) => void;
  filterMode: FilterMode;
  onFilterChange: (mode: FilterMode) => void;
  onSelectMatch: (imageId: string, candidate: MatchCandidate) => void;
}

// 페이지네이션 상수
const ITEMS_PER_PAGE = 50;

// 개별 메타데이터 필드 컴포넌트
function MetadataField({
  fieldKey,
  value,
  isMatched,
  matchedKeyword
}: {
  fieldKey: string;
  value: string;
  isMatched: boolean;
  matchedKeyword: string | null;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLongText = value.length > 100;

  // 키워드 하이라이트
  const highlightKeyword = (text: string, keyword: string | null) => {
    if (!keyword) return text;
    const index = text.indexOf(keyword);
    if (index === -1) return text;

    const before = text.slice(Math.max(0, index - 30), index);
    const match = keyword;
    const after = text.slice(index + keyword.length, index + keyword.length + 30);

    return (
      <>
        {index > 30 && '...'}
        {before}
        <mark className="bg-yellow-300 px-0.5 rounded font-medium">{match}</mark>
        {after}
        {index + keyword.length + 30 < text.length && '...'}
      </>
    );
  };

  const displayValue = () => {
    if (isMatched && matchedKeyword) {
      if (isExpanded) {
        // 전체 텍스트에서 키워드 하이라이트 (여러 개 가능)
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let searchIndex = 0;

        while (true) {
          const index = value.indexOf(matchedKeyword, searchIndex);
          if (index === -1) break;

          if (index > lastIndex) {
            parts.push(value.slice(lastIndex, index));
          }
          parts.push(
            <mark key={index} className="bg-yellow-300 px-0.5 rounded font-medium">
              {matchedKeyword}
            </mark>
          );
          lastIndex = index + matchedKeyword.length;
          searchIndex = lastIndex;
        }

        if (lastIndex < value.length) {
          parts.push(value.slice(lastIndex));
        }

        return parts.length > 0 ? parts : value;
      } else {
        return highlightKeyword(value, matchedKeyword);
      }
    } else {
      if (isExpanded) {
        return value;
      } else {
        return isLongText ? value.slice(0, 100) + '...' : value;
      }
    }
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(prev => !prev);
  };

  return (
    <div
      className={cn(
        'text-xs rounded p-1.5 border',
        isMatched
          ? 'bg-yellow-50 border-yellow-300'
          : 'bg-gray-50 border-gray-200'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-gray-700 flex-shrink-0">
          {fieldKey}
        </span>
        {isLongText && (
          <button
            type="button"
            onClick={handleToggleExpand}
            className={cn(
              'text-xs px-1.5 py-0.5 rounded flex-shrink-0 transition-colors cursor-pointer select-none z-10',
              isExpanded
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            )}
          >
            {isExpanded ? '접기' : '펼치기'}
          </button>
        )}
      </div>
      <div
        className={cn(
          'text-gray-600 break-all whitespace-pre-wrap mt-1',
          isExpanded ? 'max-h-60 overflow-y-auto' : ''
        )}
      >
        {displayValue()}
      </div>
    </div>
  );
}

function MetadataViewer({ metadata, matchedField, matchedKeyword }: { 
  metadata: Record<string, string>; 
  matchedField: string | null;
  matchedKeyword: string | null;
}) {
  const [showAllFields, setShowAllFields] = useState(false);
  const entries = Object.entries(metadata);

  if (entries.length === 0) {
    return <p className="text-xs text-gray-400 italic">메타데이터 없음</p>;
  }

  // 매칭된 필드를 우선 표시
  const sortedEntries = useMemo(() => {
    if (!matchedField) return entries;
    return [...entries].sort((a, b) => {
      if (a[0] === matchedField) return -1;
      if (b[0] === matchedField) return 1;
      return 0;
    });
  }, [entries, matchedField]);

  const displayEntries = showAllFields ? sortedEntries : sortedEntries.slice(0, 2);

  return (
    <div className="mt-1">
      <div className="space-y-1">
        {displayEntries.map(([key, value]) => (
          <MetadataField
            key={key}
            fieldKey={key}
            value={value}
            isMatched={matchedField === key}
            matchedKeyword={matchedKeyword}
          />
        ))}
      </div>
      {entries.length > 2 && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowAllFields(prev => !prev);
          }}
          className="text-xs text-blue-600 hover:text-blue-800 mt-1.5 font-medium flex items-center gap-1 cursor-pointer select-none z-10"
        >
          {showAllFields ? (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              필드 접기
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              +{entries.length - 2}개 필드 더 보기
            </>
          )}
        </button>
      )}
    </div>
  );
}

function ImageItem({
  img,
  isSelected,
  onToggleSelect,
  onRemove,
  onSelectMatch,
}: {
  img: ImageFile;
  isSelected: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
  onSelectMatch: (candidate: MatchCandidate) => void;
}) {
  const [showCandidates, setShowCandidates] = useState(false);
  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-all',
        img.matchedRule
          ? 'bg-green-50 border-green-200 hover:border-green-300'
          : 'bg-white border-gray-200 hover:border-gray-300',
        isSelected && 'ring-2 ring-blue-500 ring-offset-1'
      )}
    >
      {/* 체크박스 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect();
        }}
        className={cn(
          'w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center mt-0.5 transition-colors',
          isSelected
            ? 'bg-blue-500 border-blue-500 text-white'
            : 'border-gray-300 bg-white hover:border-blue-400'
        )}
      >
        {isSelected && (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      {/* 썸네일 */}
      {img.thumbnailUrl ? (
        <img
          src={img.thumbnailUrl}
          alt=""
          className="w-14 h-14 object-cover rounded-lg border border-gray-200 flex-shrink-0"
        />
      ) : (
        <div className="w-14 h-14 bg-gray-100 rounded-lg border border-gray-200 flex-shrink-0 flex items-center justify-center">
          <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}

      {/* 정보 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-800 truncate" title={img.originalName}>
              {img.originalName}
            </p>
            <p className="text-xs text-gray-400">
              {formatFileSize(img.fileSize)}
            </p>
            {img.newFileName && (
              <div className={cn(
                'mt-1 p-1.5 rounded border',
                img.isPartialMatch
                  ? 'bg-orange-100 border-orange-200'
                  : 'bg-green-100 border-green-200'
              )}>
                <div className="flex items-center justify-between gap-2">
                  <p className={cn(
                    'text-xs flex items-center gap-1 min-w-0',
                    img.isPartialMatch ? 'text-orange-700' : 'text-green-700'
                  )} title={img.newFileName}>
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <span className="font-semibold truncate">{img.newFileName}</span>
                  </p>
                  {/* 매칭 점수 표시 */}
                  {img.matchScore !== undefined && (
                    <span className={cn(
                      'text-xs px-1.5 py-0.5 rounded-full flex-shrink-0',
                      img.matchScore === 1.0
                        ? 'bg-green-200 text-green-700'
                        : 'bg-orange-200 text-orange-700'
                    )}>
                      {Math.round(img.matchScore * 100)}%
                    </span>
                  )}
                </div>
                {/* 다중 매칭 후보가 있는 경우 */}
                {img.candidateMatches && img.candidateMatches.length > 1 && (
                  <div className="mt-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowCandidates(prev => !prev);
                      }}
                      className="text-xs text-orange-600 hover:text-orange-800 flex items-center gap-1 cursor-pointer select-none"
                    >
                      <svg
                        className={cn('w-3 h-3 transition-transform', showCandidates && 'rotate-180')}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      다른 매칭 후보 {img.candidateMatches.length - 1}개
                    </button>
                    {showCandidates && (
                      <div className="mt-2 p-2 bg-white rounded border border-orange-200 max-h-64 overflow-y-auto">
                        <div className="text-xs text-gray-500 mb-2 pb-1 border-b border-gray-100">
                          매칭 후보 (점수순 정렬)
                        </div>
                        <div className="space-y-1.5">
                          {img.candidateMatches.map((candidate) => {
                            const isSelected = candidate.rule.id === img.matchedRule?.id;
                            return (
                              <div
                                key={candidate.rule.id}
                                className={cn(
                                  'flex items-center justify-between gap-2 p-2 rounded text-xs transition-colors',
                                  isSelected
                                    ? 'bg-orange-100 border border-orange-300'
                                    : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                                )}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    {isSelected && (
                                      <span className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0" />
                                    )}
                                    <p className="font-medium text-gray-700 truncate">
                                      {candidate.rule.newFileName}
                                    </p>
                                  </div>
                                  <p className="text-gray-500 mt-0.5">
                                    {candidate.matchedTokens.length}/{candidate.totalTokens} 토큰 일치
                                    <span className="text-gray-400 ml-1">
                                      ({candidate.matchedField})
                                    </span>
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span className={cn(
                                    'px-2 py-0.5 rounded-full font-medium',
                                    candidate.matchScore >= 0.9
                                      ? 'bg-green-100 text-green-700'
                                      : candidate.matchScore >= 0.8
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-yellow-100 text-yellow-700'
                                  )}>
                                    {Math.round(candidate.matchScore * 100)}%
                                  </span>
                                  {!isSelected && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onSelectMatch(candidate);
                                        setShowCandidates(false);
                                      }}
                                      className="px-2 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors font-medium"
                                    >
                                      선택
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
            title="삭제"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* 메타데이터 */}
        <MetadataViewer 
          metadata={img.metadata} 
          matchedField={img.matchedField}
          matchedKeyword={img.matchedRule?.keyword || null}
        />
      </div>
    </div>
  );
}

export function ImageList({ images, onRemove, onRemoveMultiple, filterMode, onFilterChange, onSelectMatch }: ImageListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // 필터링된 이미지
  const filteredImages = useMemo(() => {
    switch (filterMode) {
      case 'matched':
        return images.filter((img) => img.matchedRule);
      case 'unmatched':
        return images.filter((img) => !img.matchedRule);
      default:
        return images;
    }
  }, [images, filterMode]);

  // 페이지네이션
  const totalPages = Math.ceil(filteredImages.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredImages.length);
  const visibleImages = filteredImages.slice(startIndex, endIndex);

  // 선택 토글
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // 현재 페이지 전체 선택/해제
  const toggleSelectPage = () => {
    const pageIds = visibleImages.map((img) => img.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  // 전체 선택
  const selectAll = () => {
    setSelectedIds(new Set(filteredImages.map((img) => img.id)));
  };

  // 전체 해제
  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // 선택된 항목 삭제
  const removeSelected = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`선택한 ${selectedIds.size}개 이미지를 삭제하시겠습니까?`)) {
      onRemoveMultiple(selectedIds);
      setSelectedIds(new Set());
    }
  };

  // 필터 변경 시 초기화
  const handleFilterChange = (mode: FilterMode) => {
    onFilterChange(mode);
    setCurrentPage(1);
    setSelectedIds(new Set());
  };

  // 페이지 변경
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const matchedCount = images.filter((img) => img.matchedRule).length;
  const unmatchedCount = images.length - matchedCount;

  if (images.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm font-medium">이미지를 업로드하면 여기에 표시됩니다</p>
        <p className="text-xs text-gray-400 mt-1">최대 {LIMITS.MAX_IMAGES.toLocaleString()}개</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-200px)] min-h-[500px]">
      {/* 필터 탭 */}
      <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-gray-200">
        <div className="flex gap-1">
          <button
            onClick={() => handleFilterChange('all')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
              filterMode === 'all'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            전체 ({images.length.toLocaleString()})
          </button>
          <button
            onClick={() => handleFilterChange('matched')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
              filterMode === 'matched'
                ? 'bg-green-600 text-white'
                : 'bg-green-50 text-green-700 hover:bg-green-100'
            )}
          >
            매칭 ({matchedCount.toLocaleString()})
          </button>
          <button
            onClick={() => handleFilterChange('unmatched')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
              filterMode === 'unmatched'
                ? 'bg-gray-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            미매칭 ({unmatchedCount.toLocaleString()})
          </button>
        </div>

        <div className="flex-1" />

        {/* 선택 도구 */}
        <div className="flex items-center gap-1">
          <button
            onClick={toggleSelectPage}
            className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
            title="현재 페이지 선택/해제"
          >
            페이지 선택
          </button>
          <button
            onClick={selectAll}
            className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
            title="전체 선택"
          >
            전체 선택
          </button>
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={deselectAll}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
              >
                선택 해제
              </button>
              <button
                onClick={removeSelected}
                className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 font-medium"
              >
                {selectedIds.size.toLocaleString()}개 삭제
              </button>
            </>
          )}
        </div>
      </div>

      {/* 이미지 목록 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto space-y-2 pr-2"
      >
        {visibleImages.map((img) => (
          <ImageItem
            key={img.id}
            img={img}
            isSelected={selectedIds.has(img.id)}
            onToggleSelect={() => toggleSelect(img.id)}
            onRemove={() => onRemove(img.id)}
            onSelectMatch={(candidate) => onSelectMatch(img.id, candidate)}
          />
        ))}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="pt-3 mt-3 border-t border-gray-200">
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              className="p-1.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="처음"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="이전"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex items-center gap-1 mx-2">
              <input
                type="number"
                min={1}
                max={totalPages}
                value={currentPage}
                onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                className="w-12 px-2 py-1 text-xs text-center border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-500">/ {totalPages.toLocaleString()}</span>
            </div>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="다음"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="마지막"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          <div className="text-center mt-2 text-xs text-gray-500">
            {startIndex + 1}~{endIndex} / {filteredImages.length.toLocaleString()}개
            {selectedIds.size > 0 && (
              <span className="ml-2 text-blue-600 font-medium">
                · {selectedIds.size.toLocaleString()}개 선택됨
              </span>
            )}
          </div>
        </div>
      )}

      {/* 하단 정보 (페이지네이션 없을 때) */}
      {totalPages <= 1 && (
        <div className="pt-2 mt-2 border-t border-gray-200 text-xs text-gray-500 text-center">
          {filteredImages.length.toLocaleString()}개 표시 중
          {selectedIds.size > 0 && (
            <span className="ml-2 text-blue-600 font-medium">
              · {selectedIds.size.toLocaleString()}개 선택됨
            </span>
          )}
        </div>
      )}
    </div>
  );
}
