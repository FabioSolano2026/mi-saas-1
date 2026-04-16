'use client'

import { useState } from 'react'

export function useCopyLink(baseUrl?: string) {
  const [copied, setCopied] = useState(false)

  const copyLink = async (idCorto: string) => {
    const origin = baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : '')
    const url    = `${origin}/c/${idCorto}`

    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Fallback para browsers sin Clipboard API
      const el = document.createElement('textarea')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }

    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return { copied, copyLink }
}
