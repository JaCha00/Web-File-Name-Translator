import { useCallback, useState, useEffect } from 'react';
import { cn } from '../utils/cn';
import { ProcessingProgress, LIMITS } from '../types';
import { logger } from '../utils/logger';

// Check if running in Tauri environment
const isTauri = () => typeof window !== 'undefined' && '__TAURI__' in window;

interface DropZoneProps {
  onFilesDropped: (files: FileList | File[]) => void;
  isProcessing: boolean;
  progress: ProcessingProgress | null;
  currentCount: number;
}

export function DropZone({ onFilesDropped, isProcessing, progress, currentCount }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  // Tauri drag-drop event listener
  useEffect(() => {
    if (!isTauri()) return;

    const setupTauriDragDrop = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');

        // Listen for file drop events
        const unlisten = await listen<{ paths: string[] }>('tauri://drag-drop', async (event) => {
          logger.info('DropZone', 'Tauri drag-drop event received', event.payload);

          const paths = event.payload.paths;
          if (paths && paths.length > 0) {
            // Filter for image files
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.bmp'];
            const imagePaths = paths.filter(path =>
              imageExtensions.some(ext => path.toLowerCase().endsWith(ext))
            );

            if (imagePaths.length > 0) {
              // Convert paths to File objects
              const files: File[] = [];
              for (const filePath of imagePaths) {
                try {
                  const { readFile } = await import('@tauri-apps/plugin-fs');
                  const contents = await readFile(filePath);
                  const fileName = filePath.split(/[\\/]/).pop() || 'image';
                  const ext = fileName.split('.').pop()?.toLowerCase() || 'png';
                  const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;

                  const blob = new Blob([contents], { type: mimeType });
                  const file = new File([blob], fileName, { type: mimeType });
                  files.push(file);
                  logger.debug('DropZone', `Loaded file: ${fileName}`, { size: file.size });
                } catch (err) {
                  logger.error('DropZone', `Failed to read file: ${filePath}`, err);
                }
              }

              if (files.length > 0) {
                onFilesDropped(files);
              }
            }
          }
        });

        // Listen for drag enter/leave for visual feedback
        const unlistenEnter = await listen('tauri://drag-enter', () => {
          setIsDragging(true);
        });

        const unlistenLeave = await listen('tauri://drag-leave', () => {
          setIsDragging(false);
        });

        logger.info('DropZone', 'Tauri drag-drop listeners registered');

        return () => {
          unlisten();
          unlistenEnter();
          unlistenLeave();
        };
      } catch (err) {
        logger.error('DropZone', 'Failed to setup Tauri drag-drop', err);
      }
    };

    const cleanup = setupTauriDragDrop();
    return () => {
      cleanup.then(fn => fn?.());
    };
  }, [onFilesDropped]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        logger.info('DropZone', `Web drop: ${e.dataTransfer.files.length} files`);
        onFilesDropped(e.dataTransfer.files);
      }
    },
    [onFilesDropped]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        logger.info('DropZone', `File input: ${e.target.files.length} files`);
        onFilesDropped(e.target.files);
        e.target.value = '';
      }
    },
    [onFilesDropped]
  );

  const remaining = LIMITS.MAX_IMAGES - currentCount;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'relative rounded-xl border-2 border-dashed p-6 text-center transition-all duration-200',
        isDragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100',
        isProcessing && 'pointer-events-none'
      )}
    >
      <input
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={isProcessing}
      />
      
      {isProcessing && progress ? (
        <div className="space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">
              {progress.message}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {progress.current} / {progress.total}
            </p>
            <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-200"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">
              이미지 파일을 드래그하거나 클릭하여 선택
            </p>
            <p className="text-xs text-gray-500 mt-1">
              JPG, PNG, TIFF 등 · 단일 파일 최대 10MB
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {currentCount > 0 ? (
                <>현재 {currentCount.toLocaleString()}개 · </>
              ) : null}
              추가 가능: {remaining.toLocaleString()}개
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
