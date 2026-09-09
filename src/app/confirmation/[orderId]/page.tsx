/**
 * Confirmation page - shown after Stripe redirects back.
 *
 * Stripe redirects here after confirmPayment() with ?payment_intent=... and
 * ?payment_intent_client_secret=... query params. We verify the payment
 * status client-side, then poll /api/orders/:id/status for the server-side
 * confirmed state.
 *
 * Note: The correct message is "submitted for processing" - NOT "your business
 * is formed." (PRD §11)
 */
import { Suspense } from 'react'
import ConfirmationClient from './ConfirmationClient'

export default async function ConfirmationPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-kw-text-muted text-sm">Loading...</div>}>
      <ConfirmationClient orderId={orderId} />
    </Suspense>
  )
}
