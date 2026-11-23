import React, { useEffect, useState } from 'react';
import MinimizedPreviewStack from './MinimizedPreviewStack';
import { previewTabs, type PreviewTab } from '@/services/preview-tabs';

/**
 * Store-connected wrapper for the presentational MinimizedPreviewStack.
 * Owns the bridge between the preview tab store and the floating card deck:
 * the deck itself stays purely presentational.
 */
export default function PreviewTabStack() {
  const [tabs, setTabs] = useState<PreviewTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => previewTabs.subscribe((next) => {
    setTabs(next);
    setActiveId(previewTabs.activeTabId);
  }), []);

  return (
    <MinimizedPreviewStack
      tabs={tabs.filter(t => t.minimized).map(t => ({ id: t.id, title: t.label, kind: t.kind }))}
      activeId={activeId}
      onRestore={(id) => previewTabs.restore(id)}
      onClose={(id) => previewTabs.close(id)}
      onCloseAll={() => previewTabs.closeAll()}
    />
  );
}
