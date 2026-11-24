import React from 'react';
import VaultUnlockDialog from './VaultUnlockDialog';

interface Pending { id: string; name: string; blob: Blob; taskId?: string }
interface Props {
  pending: Pending | null;
  userId: string;
  onCancel: () => void;
  onUnlocked: (p: Pending) => void;
  reason?: string;
}

export default function VaultUnlockFor({ pending, userId, onCancel, onUnlocked, reason }: Props) {
  return (
    <VaultUnlockDialog
      open={!!pending}
      userId={userId}
      onClose={onCancel}
      onUnlocked={() => { if (pending) onUnlocked(pending); }}
      reason={reason}
    />
  );
}
