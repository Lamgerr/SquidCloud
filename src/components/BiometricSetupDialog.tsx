import React, { useState, useEffect } from 'react'
import { Check, Fingerprint as FingerprintIcon } from '@/lib/icon-map'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { BottomSheet, BottomSheetContent } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { biometricAuthService } from '@/services/biometricAuthService'
import { detectBiometric, type BiometricType } from '@/lib/biometric'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

interface BiometricSetupDialogProps {
  open: boolean
  onClose: () => void
  onComplete: () => void
}

const STEPS = ['Configure', 'Done']

const BiometricSetupDialog: React.FC<BiometricSetupDialogProps> = ({ open, onClose, onComplete }) => {
  const { user } = useAuth()
  const { toast } = useToast()
  const isMobile = useIsMobile()

  const [step, setStep] = useState(0)
  const [bioAvailable, setBioAvailable] = useState(false)
  const [bioType, setBioType] = useState<BiometricType>('fingerprint')
  const [bioLabel, setBioLabel] = useState('Fingerprint')
  const [doneAnim, setDoneAnim] = useState(false)

  const [requireOnStartup, setRequireOnStartup] = useState(false)
  const [requireForShares, setRequireForShares] = useState(true)
  const [requireForSettings, setRequireForSettings] = useState(true)
  const [requireForVault, setRequireForVault] = useState(true)

  useEffect(() => {
    if (open) {
      setStep(0)
      setDoneAnim(false)
      detectBiometric().then(res => {
        setBioAvailable(res.available)
        setBioType(res.type)
        setBioLabel(res.label)
      })
    }
  }, [open])

  const handleFinishSetup = async () => {
    if (!user) return
    const success = await biometricAuthService.enableBiometric(user.id, {
      requireOnStartup,
      requireForShares,
      requireForSettings,
      requireForVault,
      timeoutMinutes: 5,
    })
    if (success) {
      setStep(1)
      setDoneAnim(true)
      setTimeout(() => {
        toast({
          title: 'Biometric Security Enabled',
          description: `${bioLabel} is now protecting your files`,
        })
        onComplete()
        onClose()
      }, 2000)
    } else {
      toast({ title: 'Setup Failed', description: 'Failed to enable biometric security.', variant: 'destructive' })
    }
  }

  const renderStepIndicator = () => (
    <div className="flex justify-center gap-2 mb-8">
      {STEPS.map((s, i) => {
        const isDone = i < step
        const isActive = i === step
        return (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold transition-all duration-300',
              isDone ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' :
              isActive ? 'bg-[#4FC3F7]/10 text-[#4FC3F7] border border-[#4FC3F7]/25' :
              'bg-white/5 text-white/30 border border-white/10',
            )}>
              {isDone ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('w-6 h-[2px] rounded-full', i < step ? 'bg-emerald-500/30' : 'bg-white/10')} />
            )}
          </div>
        )
      })}
    </div>
  )

  const renderConfigureStep = () => (
    <div className="flex flex-col gap-5 animate-fade-enter px-1">
      <div className="text-center mb-2">
        <h2 className="text-white text-lg font-semibold mb-1">Configure Security</h2>
        <p className="text-white/50 text-sm">Choose when to require biometric verification</p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/80 text-sm font-medium">Require on App Start</p>
          <p className="text-white/40 text-xs">Lock when app opens</p>
        </div>
        <Switch checked={requireOnStartup} onCheckedChange={setRequireOnStartup} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/80 text-sm font-medium">Creating Shares</p>
          <p className="text-white/40 text-xs">Verify before sharing files</p>
        </div>
        <Switch checked={requireForShares} onCheckedChange={setRequireForShares} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/80 text-sm font-medium">Security Settings</p>
          <p className="text-white/40 text-xs">Verify before changing settings</p>
        </div>
        <Switch checked={requireForSettings} onCheckedChange={setRequireForSettings} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/80 text-sm font-medium">SquidVault Access</p>
          <p className="text-white/40 text-xs">Verify before opening vault</p>
        </div>
        <Switch checked={requireForVault} onCheckedChange={setRequireForVault} />
      </div>

      <Button
        onClick={handleFinishSetup}
        className="w-full h-12 rounded-xl bg-[#4FC3F7] text-white hover:bg-[#4FC3F7]/90 transition-all text-base font-medium mt-2"
      >
        Enable Security
      </Button>
    </div>
  )

  const renderDoneStep = () => (
    <div className="flex flex-col items-center justify-center py-12 gap-4 animate-fade-enter">
      <div className={cn('w-20 h-20 rounded-full flex items-center justify-center bg-emerald-500/10', doneAnim && 'animate-bounce-in')}>
        <svg className="w-8 h-8 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h2 className="text-white text-lg font-semibold">All Set!</h2>
      <p className="text-white/50 text-sm text-center max-w-xs">
        Your {bioLabel} is now protecting your files.
      </p>
      <div className="flex gap-1.5 mt-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full bg-emerald-400/60 animate-bounce" style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.6s' }} />
        ))}
      </div>
    </div>
  )

  const mainContent = (
    <div className="flex flex-col px-6 pt-6 pb-8">
      {step === 0 && renderStepIndicator()}

      {step === 0 ? (
        renderConfigureStep()
      ) : (
        renderDoneStep()
      )}
    </div>
  )

  if (isMobile) {
    return (
      <BottomSheet open={open} onOpenChange={(open) => { if (!open) onClose() }}>
        <BottomSheetContent hideHandle hideClose className="border-none bg-transparent p-0">
          <div className="relative overflow-hidden rounded-t-[28px] bg-[#0A0E1A] min-h-[80vh]">
            {mainContent}
          </div>
        </BottomSheetContent>
      </BottomSheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="!p-0 border-0 bg-transparent shadow-none max-w-[420px]" showCloseButton={false}>
        <div className="relative overflow-hidden rounded-[28px] bg-[#0A0E1A]">{mainContent}</div>
      </DialogContent>
    </Dialog>
  )
}

export default BiometricSetupDialog