/************************************************************
 * Author       : KATABATHUNI BOSE
 * Date         : Created - 04-06-2026 & Updated - 04-06-2026
 *
 * Project      : wecut-webapp
 * Module Name  : email
 * Scope        : Notifications — Email
 *
 * Description  : Transactional email delivery provider via Resend.
 *                Optional dependency — no-op when API key is absent.
 *
 * Responsibilities :
 * - Send transactional emails via Resend API
 * - No-op gracefully when RESEND_API_KEY is not configured
 * - Never throw to caller (return false on failure)
 *
 * Features / Functionality :
 * - sendEmail({ to, subject, html, replyTo? }) — async boolean delivery
 * - Configurable from address via RESEND_FROM_EMAIL
 *
 * Tech Stack   : TypeScript, Resend (optional)
 * Layer        : API Infrastructure
 *
 * Dependencies : @rgss/logger (Resend REST API over fetch)
 *
 * Notes        : Reads process.env directly for graceful degradation
 ************************************************************/

import { createLogger } from '@rgss/logger'

// Transactional email delivery provider (Resend).
//
// We read `RESEND_API_KEY` / `RESEND_FROM_EMAIL` straight from `process.env`
// (NOT from `@/env`) on purpose: `env.ts` types the key as required and would
// fail build-time validation when it is absent. Reading `process.env` directly
// behind a truthy guard lets the app build and run with no key configured
// (Property 10 — no-op + return false without config).
//
// Delivery goes straight to Resend's REST API with fetch, so no SDK is needed.
// This helper NEVER throws to its caller (Property 9): any failure is caught,
// logged, and reported as `false`.

const logger = createLogger({
  service: 'web:notifications:email',
  environment: process.env.NODE_ENV ?? 'development',
})

const DEFAULT_FROM = 'WeCut <onboarding@resend.dev>'

export type SendEmailParams = {
  to: string | string[]
  subject: string
  html: string
  // Optional Reply-To. When set, a recipient's reply is routed here instead of
  // the `from` address — e.g. the contact form sends FROM our verified domain
  // but routes replies back to the customer who submitted the enquiry.
  replyTo?: string | string[]
  // Optional file attachments (e.g. the GST invoice PDF). Resend accepts a
  // base64-encoded `content` string per attachment. Only forwarded when present
  // so the payload stays minimal for ordinary text emails.
  attachments?: { filename: string; content: string }[]
}

const RESEND_API_URL = 'https://api.resend.com/emails'

export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM

  // Not configured → no-op (Property 10). Nothing was sent.
  if (!apiKey) {
    logger.info('sendEmail skipped (RESEND_API_KEY not configured)', {
      subject: params.subject,
    })
    return false
  }

  try {
    // Call Resend's REST API directly, so no SDK needs to be installed.
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        // Only include reply_to when provided; keeps the payload minimal otherwise.
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
        // Only include attachments when provided (keeps text emails minimal).
        ...(params.attachments && params.attachments.length > 0
          ? { attachments: params.attachments }
          : {}),
      }),
    })

    if (!res.ok) {
      logger.error('sendEmail rejected by Resend', {
        status: res.status,
        body: (await res.text().catch(() => '')).slice(0, 500),
      })
      return false
    }

    return true
  } catch (error) {
    // Never throw to the caller (Property 9).
    logger.error('sendEmail failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}
