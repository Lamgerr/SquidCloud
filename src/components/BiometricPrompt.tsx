import React, { useState, useEffect, useCallback } from 'react'
import { Fingerprint } from '@/lib/icon-map'
import { cn } from '@/lib/utils'
import { detectBiometric, triggerBiometricSimple, type BiometricType } from '@/lib/biometric'
import { useAuth } from '@/contexts/AuthContext'

interface BiometricPromptProps {
  title?: string
  description?: string
  onSuccess: () => void
  onError?: (error: string) => void
  autoTrigger?: boolean
  onCancel?: () => void
}

export function BiometricPrompt({
  title = 'SquidCloud Locked',
  description,
  onSuccess,
  onError,
  autoTrigger = true,
  onCancel,
}: BiometricPromptProps) {
  const { user } = useAuth()
  const [bioType, setBioType] = useState<BiometricType>('fingerprint')
  const [bioLabel, setBioLabel] = useState('Fingerprint')
  const [verifying, setVerifying] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    detectBiometric().then(res => {
      if (res.available) {
        setBioType(res.type)
        setBioLabel(res.label)
      }
    })
  }, [])

  const handleBiometric = useCallback(async () => {
    if (!user?.id || verifying) return
    setVerifying(true)
    setFailed(false)
    const result = await triggerBiometricSimple(user.id, user.email || '')
    setVerifying(false)
    if (result.success) {
      onSuccess()
    } else if (result.error === 'cancelled') {
      setFailed(true)
    } else {
      setFailed(true)
      onError?.('Biometric verification failed')
    }
  }, [user?.id, user?.email, verifying, onSuccess, onError])

  useEffect(() => {
    if (autoTrigger && !verifying && !failed && user?.id && !description) {
      handleBiometric()
    }
  }, [autoTrigger, verifying, failed, user?.id, description, handleBiometric])

  const handleRetry = () => {
    setFailed(false)
    handleBiometric()
  }

  const iconSize = bioType === 'face' ? 'w-10 h-10' : 'w-9 h-9'

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[300px]">
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-full dialpad-btn flex items-center justify-center">
          <Fingerprint className={cn(iconSize, 'text-[#4FC3F7]')} weight="fill" />
        </div>
        <div
          className={cn(
            'absolute -inset-4 rounded-full',
            verifying ? 'animate-biometric-ring' : failed ? 'opacity-40' : 'opacity-20'
          )}
          style={{
            background: 'conic-gradient(from 0deg, transparent, rgba(79,195,247,0.3), rgba(124,77,255,0.3), transparent)',
            WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), white calc(100% - 1px))',
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), white calc(100% - 1px))',
          }}
        />
      </div>

      <h2 className="text-white/90 text-lg font-semibold mb-2">{title}</h2>

      {description ? (
        <p className="text-white/50 text-sm text-center max-w-xs mb-6">{description}</p>
      ) : (
        <p className="text-white/50 text-sm mb-6">
          {verifying ? `Verifying ${bioLabel}...` : `Use ${bioLabel} to unlock`}
        </p>
      )}

      {verifying && (
        <div className="flex items-center gap-2 mb-4">
          <svg className="animate-spin w-4 h-4 text-[#4FC3F7]" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="32" strokeDashoffset="8" />
          </svg>
          <span className="text-[#4FC3F7]/60 text-sm">Verifying...</span>
        </div>
      )}

      {failed && !verifying && (
        <button
          onClick={handleRetry}
          className="w-full max-w-[240px] h-12 rounded-xl bg-[#4FC3F7]/10 text-[#4FC3F7] border border-[#4FC3F7]/20 hover:bg-[#4FC3F7]/20 transition-all text-base font-medium flex items-center justify-center gap-2"
        >
          <Fingerprint className="w-4 h-4" />
          Try Again
        </button>
      )}

      {onCancel && failed && !verifying && (
        <button
          onClick={onCancel}
          className="mt-4 text-white/25 hover:text-white/45 text-xs transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  )
}