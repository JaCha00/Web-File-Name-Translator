import { useState, useMemo, useRef } from 'react';
import { KeywordRule, LIMITS, PartialMatchSettings, DEFAULT_PARTIAL_MATCH_SETTINGS } from '../types';
import { cn } from '../utils/cn';

interface RuleManagerProps {
  rules: KeywordRule[];
  onRulesChange: (rules: KeywordRule[]) => void;
  matchCounts: Map<string, number>;
  partialMatchSettings: PartialMatchSettings;
  onPartialMatchSettingsChange: (settings: PartialMatchSettings) => void;
}

export function RuleManager({
  rules,
  onRulesChange,
  matchCounts,
  partialMatchSettings,
  onPartialMatchSettingsChange,
}: RuleManagerProps) {
  const [keyword, setKeyword] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKeyword, setEditKeyword] = useState('');
  const [editFileName, setEditFileName] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [showPartialMatchSettings, setShowPartialMatchSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 파일명 정규화: 띄어쓰기 → _, 위험 문자 제거
  const sanitizeFileName = (name: string): string => {
    return name
      .replace(/\s+/g, '_')           // 띄어쓰기 → _
      .replace(/[<>:"/\\|?*]/g, '_')  // Windows 금지 문자 → _
      .replace(/_+/g, '_')            // 연속 _ → 단일 _
      .replace(/^_|_$/g, '');         // 앞뒤 _ 제거
  };

  // TXT 파일에서 규칙 Import (줄바꿈 무시, #태그 기준 분리)
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        const newRules: KeywordRule[] = [];
        
        let currentFileName: string | null = null;
        let currentKeywordParts: string[] = [];
        
        const saveCurrentRule = () => {
          if (currentFileName && currentKeywordParts.length > 0) {
            // 모든 줄을 공백으로 연결하고 연속 공백 정리
            const keyword = currentKeywordParts
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim();
            
            if (keyword) {
              // 중복 체크 (기존 규칙 + 새로 추가할 규칙)
              const isDuplicate = 
                rules.some(r => r.keyword === keyword) ||
                newRules.some(r => r.keyword === keyword);
              
              if (!isDuplicate) {
                // 파일명 정규화 적용
                const sanitizedFileName = sanitizeFileName(currentFileName);
                newRules.push({
                  id: crypto.randomUUID(),
                  keyword,
                  newFileName: sanitizedFileName,
                  enabled: true,
                });
              }
            }
          }
        };
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          
          // #으로 시작하면 새 파일명
          if (trimmedLine.startsWith('#')) {
            // 이전 규칙 저장
            saveCurrentRule();
            
            // 새 파일명 설정 (# 제거)
            currentFileName = trimmedLine.slice(1).trim();
            currentKeywordParts = [];
          } else if (currentFileName && trimmedLine) {
            // 빈 줄이 아닌 경우만 추가 (줄바꿈 무시)
            currentKeywordParts.push(trimmedLine);
          }
        }
        
        // 마지막 규칙 저장
        saveCurrentRule();
        
        if (newRules.length === 0) {
          alert('가져올 규칙이 없습니다. 형식을 확인해주세요.\n\n형식:\n#파일명\n키워드(프롬프트)');
          return;
        }
        
        const confirmMsg = `${newRules.length}개의 규칙을 가져왔습니다.\n\n기존 규칙에 추가할까요?\n(취소 시 기존 규칙을 대체합니다)`;
        
        if (confirm(confirmMsg)) {
          // 기존 규칙에 추가
          onRulesChange([...rules, ...newRules]);
        } else {
          // 기존 규칙 대체
          onRulesChange(newRules);
        }
        
        alert(`${newRules.length}개의 규칙을 성공적으로 가져왔습니다.`);
      } catch (error) {
        console.error('Import error:', error);
        alert('파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    
    reader.readAsText(file, 'UTF-8');
    
    // input 초기화 (같은 파일 다시 선택 가능하도록)
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // TXT 파일로 규칙 Export
  const handleExport = () => {
    try {
      if (rules.length === 0) {
        alert('내보낼 규칙이 없습니다.');
        return;
      }
      
      let content = '';
      
      for (const rule of rules) {
        content += `#${rule.newFileName}\n`;
        content += `${rule.keyword}\n\n`;
      }
      
      // BOM 추가하여 한글 인코딩 보장
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + content.trim()], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      // 다운로드 링크 생성
      const a = document.createElement('a');
      a.href = url;
      a.download = `keyword_rules_${new Date().toISOString().slice(0, 10)}.txt`;
      a.style.display = 'none';
      document.body.appendChild(a);
      
      // 클릭 실행
      a.click();
      
      // 정리 (약간의 딜레이 후)
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
    } catch (error) {
      console.error('Export error:', error);
      alert('내보내기 중 오류가 발생했습니다: ' + (error as Error).message);
    }
  };

  const addRule = () => {
    const trimmedKeyword = keyword.trim();
    const trimmedFileName = newFileName.trim();
    
    if (!trimmedKeyword || !trimmedFileName) return;
    
    // 길이 제한 체크
    if (trimmedKeyword.length > LIMITS.MAX_KEYWORD_LENGTH) {
      alert(`키워드는 ${LIMITS.MAX_KEYWORD_LENGTH}자를 초과할 수 없습니다.`);
      return;
    }
    if (trimmedFileName.length > LIMITS.MAX_FILENAME_LENGTH) {
      alert(`파일명은 ${LIMITS.MAX_FILENAME_LENGTH}자를 초과할 수 없습니다.`);
      return;
    }

    // 중복 키워드 체크
    if (rules.some(r => r.keyword === trimmedKeyword)) {
      alert('이미 존재하는 키워드입니다.');
      return;
    }

    // 파일명 정규화 적용
    const sanitizedFileName = sanitizeFileName(trimmedFileName);

    const newRule: KeywordRule = {
      id: crypto.randomUUID(),
      keyword: trimmedKeyword,
      newFileName: sanitizedFileName,
      enabled: true,
    };

    onRulesChange([...rules, newRule]);
    setKeyword('');
    setNewFileName('');
  };

  const startEdit = (rule: KeywordRule) => {
    setEditingId(rule.id);
    setEditKeyword(rule.keyword);
    setEditFileName(rule.newFileName);
  };

  const saveEdit = () => {
    if (!editingId) return;
    
    const trimmedKeyword = editKeyword.trim();
    const trimmedFileName = editFileName.trim();
    
    if (!trimmedKeyword || !trimmedFileName) {
      setEditingId(null);
      return;
    }

    // 파일명 정규화 적용
    const sanitizedFileName = sanitizeFileName(trimmedFileName);

    onRulesChange(
      rules.map((r) =>
        r.id === editingId
          ? { ...r, keyword: trimmedKeyword, newFileName: sanitizedFileName }
          : r
      )
    );
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const toggleRule = (id: string) => {
    onRulesChange(
      rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const removeRule = (id: string) => {
    onRulesChange(rules.filter((r) => r.id !== id));
  };

  const toggleAllRules = (enabled: boolean) => {
    onRulesChange(rules.map((r) => ({ ...r, enabled })));
  };

  // 개별 규칙의 부분 매칭 토글
  const toggleRulePartialMatch = (id: string) => {
    onRulesChange(
      rules.map((r) => (r.id === id ? { ...r, partialMatch: !r.partialMatch } : r))
    );
  };

  // 전체 규칙의 부분 매칭 일괄 설정
  const toggleAllPartialMatch = (partialMatch: boolean) => {
    onRulesChange(rules.map((r) => ({ ...r, partialMatch })));
  };

  const removeAllRules = () => {
    if (confirm('모든 규칙을 삭제하시겠습니까?')) {
      onRulesChange([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addRule();
    }
  };

  // 검색 필터링
  const filteredRules = useMemo(() => {
    if (!searchTerm.trim()) return rules;
    const term = searchTerm.toLowerCase();
    return rules.filter(
      (r) =>
        r.keyword.toLowerCase().includes(term) ||
        r.newFileName.toLowerCase().includes(term)
    );
  }, [rules, searchTerm]);

  const displayRules = showAll ? filteredRules : filteredRules.slice(0, 20);
  const hasMore = filteredRules.length > 20 && !showAll;

  // 키워드 축약 표시
  const truncateKeyword = (text: string, maxLen: number = 50) => {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + '...';
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      {/* 헤더 + Import/Export 버튼 */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          규칙
          {rules.length > 0 && (
            <span className="text-xs font-normal text-gray-500">({rules.length}개)</span>
          )}
        </h3>
        <div className="flex gap-1">
          {/* Import 버튼 */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded flex items-center gap-1"
            title="TXT 파일에서 규칙 가져오기"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import
          </button>
          {/* Export 버튼 */}
          <button
            onClick={handleExport}
            disabled={rules.length === 0}
            className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            title="TXT 파일로 규칙 내보내기"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* 규칙 일괄 관리 버튼 */}
      {rules.length > 0 && (
        <div className="flex gap-1 mb-3 p-2 bg-gray-50 rounded-lg">
          <button
            onClick={() => toggleAllRules(true)}
            className="px-2 py-1 text-xs text-green-600 hover:bg-green-100 rounded"
            title="모두 활성화"
          >
            전체 ON
          </button>
          <button
            onClick={() => toggleAllRules(false)}
            className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 rounded"
            title="모두 비활성화"
          >
            전체 OFF
          </button>
          <div className="flex-1" />
          <button
            onClick={removeAllRules}
            className="px-2 py-1 text-xs text-red-500 hover:bg-red-100 rounded"
            title="모두 삭제"
          >
            전체 삭제
          </button>
        </div>
      )}

      {/* 부분 매칭 설정 */}
      <div className="mb-3">
        <button
          onClick={() => setShowPartialMatchSettings(!showPartialMatchSettings)}
          className={cn(
            'w-full flex items-center justify-between p-2 rounded-lg border transition-colors',
            partialMatchSettings.globalEnabled
              ? 'bg-orange-50 border-orange-200 hover:bg-orange-100'
              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
          )}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span className="text-xs font-medium text-gray-700">
              부분 매칭
              {partialMatchSettings.globalEnabled && (
                <span className="ml-1 text-orange-600">(전역 ON)</span>
              )}
            </span>
          </div>
          <svg
            className={cn('w-4 h-4 text-gray-400 transition-transform', showPartialMatchSettings && 'rotate-180')}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showPartialMatchSettings && (
          <div className="mt-2 p-3 bg-orange-50 rounded-lg border border-orange-200 space-y-3">
            {/* 전역 ON/OFF */}
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-700">전역 부분 매칭</label>
              <button
                onClick={() =>
                  onPartialMatchSettingsChange({
                    ...partialMatchSettings,
                    globalEnabled: !partialMatchSettings.globalEnabled,
                  })
                }
                className={cn(
                  'relative w-10 h-5 rounded-full transition-colors',
                  partialMatchSettings.globalEnabled ? 'bg-orange-500' : 'bg-gray-300'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                    partialMatchSettings.globalEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>

            {/* 최소 일치율 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-700">최소 일치율</label>
                <span className="text-xs font-medium text-orange-600">
                  {Math.round(partialMatchSettings.minMatchRatio * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.99"
                step="0.05"
                value={partialMatchSettings.minMatchRatio}
                onChange={(e) =>
                  onPartialMatchSettingsChange({
                    ...partialMatchSettings,
                    minMatchRatio: parseFloat(e.target.value),
                  })
                }
                className="w-full h-2 bg-orange-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>10%</span>
                <span>99%</span>
              </div>
            </div>

            {/* 토큰 구분자 */}
            <div>
              <label className="text-xs text-gray-700 block mb-1">토큰 구분자</label>
              <input
                type="text"
                value={partialMatchSettings.tokenSeparator}
                onChange={(e) =>
                  onPartialMatchSettingsChange({
                    ...partialMatchSettings,
                    tokenSeparator: e.target.value || ',',
                  })
                }
                className="w-full px-2 py-1 text-xs border border-orange-200 rounded focus:ring-1 focus:ring-orange-400 outline-none"
                placeholder=","
              />
              <p className="text-xs text-gray-400 mt-1">
                키워드를 분리할 문자 (기본: 쉼표)
              </p>
            </div>

            {/* 개별 규칙 부분 매칭 일괄 설정 */}
            {rules.length > 0 && (
              <div className="pt-2 border-t border-orange-200">
                <p className="text-xs text-gray-600 mb-2">개별 규칙 부분 매칭</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleAllPartialMatch(true)}
                    className="flex-1 px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                  >
                    모두 ON
                  </button>
                  <button
                    onClick={() => toggleAllPartialMatch(false)}
                    className="flex-1 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                  >
                    모두 OFF
                  </button>
                </div>
              </div>
            )}

            {/* 설명 */}
            <div className="pt-2 border-t border-orange-200">
              <p className="text-xs text-gray-500">
                💡 부분 매칭이 켜지면 키워드 토큰 중 일부만 일치해도 매칭됩니다.
                전역 ON 시 모든 규칙에 적용되고, 개별 설정으로 규칙별 ON/OFF가 가능합니다.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 새 규칙 추가 */}
      <div className="space-y-2 mb-3">
        <textarea
          placeholder="키워드 (메타데이터에서 검색할 텍스트)&#10;예: -1::production_art::, 1::halo::..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none font-mono text-xs"
        />
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="새 파일명 (확장자 제외)"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
          />
          <button
            onClick={addRule}
            disabled={!keyword.trim() || !newFileName.trim()}
            className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            추가
          </button>
        </div>
      </div>

      {/* 검색 */}
      {rules.length > 5 && (
        <div className="mb-3">
          <input
            type="text"
            placeholder="규칙 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-gray-50"
          />
        </div>
      )}

      {/* 규칙 목록 */}
      {filteredRules.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-3">
          {rules.length === 0 ? '아직 규칙이 없습니다.' : '검색 결과가 없습니다.'}
        </p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {displayRules.map((rule) => {
            const matchCount = matchCounts.get(rule.id) || 0;
            const isEditing = editingId === rule.id;

            return (
              <div
                key={rule.id}
                className={cn(
                  'p-2 rounded-lg border transition-colors',
                  rule.enabled
                    ? matchCount > 0
                      ? 'bg-green-50 border-green-200'
                      : 'bg-purple-50 border-purple-200'
                    : 'bg-gray-50 border-gray-200 opacity-60'
                )}
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editKeyword}
                      onChange={(e) => setEditKeyword(e.target.value)}
                      rows={2}
                      className="w-full px-2 py-1 text-xs border rounded font-mono resize-none"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editFileName}
                        onChange={(e) => setEditFileName(e.target.value)}
                        className="flex-1 px-2 py-1 text-xs border rounded"
                      />
                      <button
                        onClick={saveEdit}
                        className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                      >
                        저장
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <button
                      onClick={() => toggleRule(rule.id)}
                      className={cn(
                        'w-5 h-5 rounded flex items-center justify-center border transition-colors flex-shrink-0 mt-0.5',
                        rule.enabled
                          ? 'bg-purple-600 border-purple-600 text-white'
                          : 'bg-white border-gray-300'
                      )}
                    >
                      {rule.enabled && (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      {/* 키워드 */}
                      <div
                        className="text-xs font-mono text-purple-700 bg-white/50 px-1.5 py-0.5 rounded border border-purple-200 break-all cursor-pointer hover:bg-white"
                        onClick={() => startEdit(rule)}
                        title={rule.keyword}
                      >
                        {truncateKeyword(rule.keyword, 80)}
                      </div>
                      
                      {/* 화살표 + 파일명 */}
                      <div className="flex items-center gap-1 mt-1">
                        <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                        <span className="text-xs font-mono text-green-700 bg-white/50 px-1.5 py-0.5 rounded border border-green-200">
                          {rule.newFileName}
                        </span>
                        {matchCount > 0 && (
                          <span className="text-xs text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">
                            {matchCount}개 매칭
                          </span>
                        )}
                        {/* 개별 부분 매칭 토글 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRulePartialMatch(rule.id);
                          }}
                          className={cn(
                            'text-xs px-1.5 py-0.5 rounded-full transition-colors',
                            rule.partialMatch
                              ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          )}
                          title={rule.partialMatch ? '부분 매칭 ON' : '부분 매칭 OFF'}
                        >
                          {rule.partialMatch ? '부분' : '전체'}
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => startEdit(rule)}
                        className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                        title="수정"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => removeRule(rule.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="삭제"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          
          {hasMore && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full py-2 text-xs text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors"
            >
              +{filteredRules.length - 20}개 더 보기
            </button>
          )}
        </div>
      )}
    </div>
  );
}
