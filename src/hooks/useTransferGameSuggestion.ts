import { useState, useEffect, useRef, useCallback } from 'react';
import { smartTransferQueue } from '@/services/SmartTransferQueue';
import { supabase } from '@/integrations/supabase/client';

interface UseTransferGameSuggestionOptions {
  defaultEnabled?: boolean;
}

interface UseTransferGameSuggestionReturn {
  isGameModalOpen: boolean;
  activeTransferType: 'uploading' | 'downloading';
  activeFileName: string | undefined;
  gameSuggestionsEnabled: boolean;
  openGameModal: () => void;
  closeGameModal: () => void;
  updateGamePreference: (enabled: boolean) => Promise<void>;
}

export const useTransferGameSuggestion = (
  options: UseTransferGameSuggestionOptions = {}
): UseTransferGameSuggestionReturn => {
  const { defaultEnabled = true } = options;

  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [activeTransferType, setActiveTransferType] = useState<'uploading' | 'downloading'>('uploading');
  const [activeFileName, setActiveFileName] = useState<string | undefined>(undefined);
  const [gameSuggestionsEnabled, setGameSuggestionsEnabled] = useState(defaultEnabled);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasActiveTransfer = useRef(false);

  useEffect(() => {
    const unsubscribe = smartTransferQueue.subscribe((transfers) => {
      const activeTransfer = transfers.find(
        (t) => t.status === 'transferring' || t.status === 'queued' || t.status === 'preparing'
      );

      if (activeTransfer && !hasActiveTransfer.current) {
        hasActiveTransfer.current = true;

        if (!gameSuggestionsEnabled) return;

        const transferType = activeTransfer.type === 'upload' ? 'uploading' : 'downloading';
        setActiveTransferType(transferType);
        setActiveFileName(activeTransfer.fileName);

        debounceTimer.current = setTimeout(() => {
          const currentTransfers = smartTransferQueue.getTransfers();
          const stillActive = currentTransfers.some(
            (t) => t.status === 'transferring' || t.status === 'queued' || t.status === 'preparing'
          );
          if (stillActive) {
            setIsGameModalOpen(true);
          }
        }, 1500);
      }

      if (!activeTransfer && hasActiveTransfer.current) {
        hasActiveTransfer.current = false;
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
          debounceTimer.current = null;
        }
        setIsGameModalOpen(false);
      }
    });

    return () => {
      unsubscribe();
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [gameSuggestionsEnabled]);

  const openGameModal = useCallback(() => {
    setIsGameModalOpen(true);
  }, []);

  const closeGameModal = useCallback(() => {
    setIsGameModalOpen(false);
  }, []);

  const updateGamePreference = useCallback(async (enabled: boolean) => {
    setGameSuggestionsEnabled(enabled);
    try {
      await supabase.rpc('update_game_preference', { p_enable: enabled });
    } catch (error) {
      console.error('Failed to update game preference:', error);
    }
  }, []);

  return {
    isGameModalOpen,
    activeTransferType,
    activeFileName,
    gameSuggestionsEnabled,
    openGameModal,
    closeGameModal,
    updateGamePreference,
  };
};
