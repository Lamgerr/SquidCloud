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

const INCREMENT = 40;

const GridSkeleton = () => (
  <div className="rounded-xl border border-border/20 bg-card/30 overflow-hidden animate-pulse">
    <div className="p-4">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-[12px] bg-muted/20 flex-shrink-0" />
        <div className="flex-1 space-y-2.5 pt-1">
          <div className="h-3.5 bg-muted/20 rounded w-3/4" />
          <div className="h-2.5 bg-muted/10 rounded w-1/2" />
        </div>
      </div>
    </div>
  </div>
);

const CompactSkeleton = () => (
  <div className="rounded-xl border border-border/20 bg-card/30 overflow-hidden animate-pulse">
    <div className="p-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-muted/20 flex-shrink-0" />
        <div className="flex-1 space-y-2 pt-0.5">
          <div className="h-3 bg-muted/20 rounded w-3/4" />
          <div className="h-2.5 bg-muted/10 rounded w-1/3" />
        </div>
      </div>
    </div>
  </div>
);

const ListSkeleton = () => (
  <div className="flex items-center gap-2.5 px-3 h-11 rounded-lg border border-border/10 bg-card/10 animate-pulse">
    <div className="w-7 h-7 rounded-md bg-muted/20 flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-3 bg-muted/20 rounded w-48" />
    </div>
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
      { threshold: 0, rootMargin: '400px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  useEffect(() => {
    if (visibleCount >= files.length) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const rect = sentinel.getBoundingClientRect();
    if (rect.top < window.innerHeight + 400) {
      const t = setTimeout(() => {
        setVisibleCount(prev => Math.min(prev + batchSize, files.length));
      }, 16);
      return () => clearTimeout(t);
    }
  }, [visibleCount, files.length, batchSize]);

  const getGridClass = () => {
    if (isCompact) return 'grid grid-cols-3 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5';
    if (isGrid) return 'grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3';
    return 'space-y-0.5';
  };

  if (loading) {
    const n = Math.min(batchSize, 12);
    return (
      <div className={getGridClass()}>
        {Array.from({ length: n }).map((_, i) => {
          if (isCompact) return <CompactSkeleton key={i} />;
          if (isGrid) return <GridSkeleton key={i} />;
          return <ListSkeleton key={i} />;
        })}
      </div>
    );
  }

  if (!loading && files.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const visibleFiles = files.slice(0, visibleCount);
  const hasMore = visibleCount < files.length;
  const remaining = Math.min(4, files.length - visibleCount);

  const renderSkeleton = (i: number) => {
    if (isCompact) return <CompactSkeleton key={i} />;
    if (isGrid) return <GridSkeleton key={i} />;
    return <ListSkeleton key={i} />;
  };

  return (
    <div>
      <div className={cn(getGridClass(), !loading && 'stagger-card')}>
        {visibleFiles.map((file, index) => (
          <React.Fragment key={file.id}>
            {renderFile(file, index)}
          </React.Fragment>
        ))}
      </div>

      <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />

      {hasMore && (
        <div className={cn('mt-2', getGridClass())}>
          {Array.from({ length: remaining }).map((_, i) => renderSkeleton(i))}
        </div>
      )}
    </div>
  );
};

export default memo(LazyFileGrid);
export { LazyFileGrid };
