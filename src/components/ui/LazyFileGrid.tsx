import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { FileItem as FileItemType } from '@/lib/api';

interface LazyFileGridProps {
  files: FileItemType[];
  viewMode: 'grid' | 'list' | 'compact';
  renderFile: (file: FileItemType, index: number) => React.ReactNode;
  loading?: boolean;
  emptyState?: React.ReactNode;
  batchSize?: number;
}

const INCREMENT = 48;

const GridSkeleton = () => (
  <div className="rounded-lg border border-border/40 bg-muted/20 p-4 overflow-hidden animate-pulse">
    <div className="flex flex-col items-center gap-3">
      <div className="w-14 h-16 rounded-xl bg-muted/40 flex-shrink-0" />
      <div className="w-full space-y-2 pt-1 text-center">
        <div className="h-3 bg-muted/60 rounded w-3/4 mx-auto" />
        <div className="h-2 bg-muted/30 rounded w-1/2 mx-auto" />
      </div>
    </div>
  </div>
);

const ListSkeleton = () => (
  <div className="flex items-center gap-3 px-4 h-11 rounded-md border border-border/40 bg-muted/20 animate-pulse">
    <div className="w-7 h-7 rounded-lg bg-muted/50 flex-shrink-0" />
    <div className="flex-1 h-3 bg-muted/50 rounded max-w-[220px]" />
    <div className="w-20 h-2.5 bg-muted/30 rounded hidden md:block" />
    <div className="w-24 h-2.5 bg-muted/30 rounded hidden lg:block" />
  </div>
);

const LazyFileGrid: React.FC<LazyFileGridProps> = ({
  files,
  viewMode,
  renderFile,
  loading = false,
  emptyState,
  batchSize = INCREMENT,
}) => {
  const [visibleCount, setVisibleCount] = useState(batchSize);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(visibleCount);
  const filesLenRef = useRef(files.length);

  const isCompact = viewMode === 'compact';
  const isList = viewMode === 'list';
  const isGrid = viewMode === 'grid' || isCompact;

  useEffect(() => { visibleRef.current = visibleCount; }, [visibleCount]);
  useEffect(() => { filesLenRef.current = files.length; }, [files.length]);
  useEffect(() => { setVisibleCount(batchSize); }, [files.length, batchSize]);

  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + batchSize, filesLenRef.current));
  }, [batchSize]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleRef.current < filesLenRef.current) {
          loadMore();
        }
      },
      { threshold: 0, rootMargin: '600px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const getGridClass = () => {
    if (isCompact) return 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2';
    if (isGrid) return 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2.5';
    return 'space-y-0.5';
  };

  if (loading) {
    const n = Math.min(batchSize, 14);
    return (
      <div className={getGridClass()}>
        {Array.from({ length: n }).map((_, i) => (
          isList ? <ListSkeleton key={i} /> : <GridSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!loading && files.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const visibleFiles = files.slice(0, visibleCount);

  return (
    <div className="w-full select-none">
      {/* macOS Finder Table Headers (List Mode Only) */}
      {isList && (
        <div className="grid grid-cols-[1fr_100px_140px_36px] md:grid-cols-[1fr_110px_150px_100px_36px] items-center px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider border-b border-border/50 mb-1">
          <span>Name</span>
          <span className="hidden md:block">Kind</span>
          <span>Date Modified</span>
          <span>Size</span>
          <span />
        </div>
      )}

      <div className={cn(getGridClass())}>
        {visibleFiles.map((file, index) => (
          <React.Fragment key={file.id}>
            {renderFile(file, index)}
          </React.Fragment>
        ))}
      </div>

      <div ref={sentinelRef} aria-hidden="true" className="h-1 w-full" />
    </div>
  );
};

export default memo(LazyFileGrid);
export { LazyFileGrid };
