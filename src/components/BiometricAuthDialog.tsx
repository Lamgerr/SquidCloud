import React, { useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { BottomSheet, BottomSheetContent } from '@/components/ui/bottom-sheet'
import { BiometricPrompt } from '@/components/BiometricPrompt'
import { useIsMobile } from '@/hooks/use-mobile'

interface BiometricAuthDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  title?: string
  description?: string
}

const BiometricAuthDialog: React.FC<BiometricAuthDialogProps> = ({
  open,
  onClose,
  onSuccess,
  title = 'SquidCloud Locked',
  description,
}) => {
  const isMobile = useIsMobile()
  const [error, setError] = useState('')

  const content = (
    <div className="flex flex-col items-center px-6 pt-16 pb-10">
      <BiometricPrompt
        title={title}
        description={description}
        onSuccess={onSuccess}
        onError={setError}
        autoTrigger={true}
        onCancel={onClose}
      />
      {error && (
        <div className="mt-4 px-4 py-2 bg-red-500/8 border border-red-500/15 rounded-xl">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
    </div>
  )

  if (isMobile) {
    return (
      <BottomSheet open={open} onOpenChange={(open) => { if (!open) onClose() }}>
        <BottomSheetContent hideHandle hideClose className="border-none bg-transparent p-0">
          <div className="relative overflow-hidden rounded-t-[28px] bg-[#0A0E1A] min-h-[60vh] flex items-center justify-center">
            {content}
          </div>
        </BottomSheetContent>
      </BottomSheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="!p-0 border-0 bg-transparent shadow-none max-w-[380px]" hideClose>
        <div className="relative overflow-hidden rounded-[28px] bg-[#0A0E1A] p-8 flex items-center justify-center min-h-[320px]">
          {content}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default BiometricAuthDialog