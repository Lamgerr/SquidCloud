import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, Check, X } from '@/lib/icon-map'
import { exchangeCode, storeToken } from '@/services/github-clone'

const GitHubOAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [message, setMessage] = useState('Connecting GitHub account...')

  useEffect(() => {
    const code = searchParams.get('code')
    const errorParam = searchParams.get('error')

    if (errorParam) {
      setStatus('error')
      setMessage('GitHub authorization was denied or failed.')
      setTimeout(() => navigate('/dashboard'), 3000)
      return
    }

    if (!code) {
      setStatus('error')
      setMessage('No authorization code received from GitHub.')
      setTimeout(() => navigate('/dashboard'), 3000)
      return
    }

    const processCode = async () => {
      try {
        const result = await exchangeCode(code)
        await storeToken({
          accessToken: result.access_token,
          ghUserId: result.github_user_id,
          ghUsername: result.github_username,
          scope: result.scope,
        })
        setStatus('success')
        setMessage(`GitHub account @${result.github_username} connected!`)
        setTimeout(() => navigate('/dashboard'), 1500)
      } catch (e: any) {
        setStatus('error')
        setMessage(e.message || 'Failed to connect GitHub account.')
        setTimeout(() => navigate('/dashboard'), 3000)
      }
    }

    processCode()
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8">
        {status === 'processing' && (
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
        )}
        {status === 'success' && (
          <Check className="w-12 h-12 mx-auto text-green-500" />
        )}
        {status === 'error' && (
          <X className="w-12 h-12 mx-auto text-destructive" />
        )}
        <h1 className="text-xl font-semibold">
          {status === 'processing' && 'Connecting...'}
          {status === 'success' && 'Connected!'}
          {status === 'error' && 'Connection Failed'}
        </h1>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}

export default GitHubOAuthCallback
