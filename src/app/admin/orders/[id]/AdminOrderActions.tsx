'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { OrderStatus } from '@/types'

interface Props {
  orderId: string
  status: OrderStatus
}

export default function AdminOrderActions({ orderId, status }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<'retry' | 'resolve' | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function retryNwra() {
    setLoading('retry')
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/retry-nwra`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Retry failed')
      setMessage({ type: 'success', text: 'NWRA retry queued successfully. Refresh in a moment to see updated status.' })
      router.refresh()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Retry failed' })
    } finally {
      setLoading(null)
    }
  }

  async function markResolved() {
    if (!confirm('Mark this order as manually resolved? This sets the status to "filed_with_nwra".')) return
    setLoading('resolve')
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/resolve`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Failed to resolve')
      setMessage({ type: 'success', text: 'Order marked as resolved.' })
      router.refresh()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed' })
    } finally {
      setLoading(null)
    }
  }

  if (status !== 'nwra_error') return null

  return (
    <div className="bg-white border border-kw-border-light rounded-card p-5">
      <p className="text-[12px] font-bold uppercase tracking-widest text-kw-text-muted mb-4">Admin Actions</p>
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={retryNwra}
          disabled={loading !== null}
          className="btn-gold text-[12px]"
        >
          {loading === 'retry' ? 'Retrying...' : 'Retry NWRA Submission'}
        </button>
        <button
          onClick={markResolved}
          disabled={loading !== null}
          className="btn-forest text-[12px]"
        >
          {loading === 'resolve' ? 'Saving...' : 'Mark as Manually Resolved'}
        </button>
      </div>
      {message && (
        <div className={`mt-3 text-sm p-3 rounded-card ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}
    </div>
  )
}
