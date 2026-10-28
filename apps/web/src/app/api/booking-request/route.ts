/************************************************************
 * Project      : wecut-webapp
 * Module Name  : POST /api/booking-request
 * Scope        : API — Public
 *
 * Description  : Guest booking request. The customer fills the booking dialog
 *                with their name and phone (no sign-in), and the request is
 *                emailed to the salon inbox so the team can confirm it.
 *
 * Responsibilities :
 * - Rate-limit unauthenticated submissions per IP (public write endpoint)
 * - Validate the request with Zod
 * - Look up service names and prices from the catalogue (never trust the client)
 * - Email the request to the salon inbox, with Reply-To set to the customer
 *
 * Notes        :
 * - Unlike /api/contact this is NOT best-effort: if the email is not delivered
 *   the customer gets an error and is asked to call or WhatsApp instead, so a
 *   booking is never silently lost.
 * - The inbox is CONTACT_INBOX_EMAIL. Delivery needs RESEND_API_KEY.
 ************************************************************/

import { normaliseValidIndianPhone } from '@rgss/business'
import { getActiveCatalogue, getPublicBranches } from '@rgss/db/queries'
import { badRequest, serviceUnavailable } from '@rgss/errors'
import { createLogger } from '@rgss/logger'
import { z } from 'zod'
import { apiSuccess, withErrorHandler } from '@/lib/api/error-handler'
import { enforceRateLimit, getClientIp } from '@/lib/api/rate-limit'
import { sendEmail } from '@/lib/notifications/providers/email'

const logger = createLogger({
  service: 'web:api:booking-request',
  environment: process.env.NODE_ENV ?? 'development',
})

const bookingRequestSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .refine((v) => normaliseValidIndianPhone(v) !== null, 'Enter a valid 10-digit mobile number'),
  email: z.union([z.string().trim().email().max(120), z.literal('')]).optional(),
  branchId: z.string().min(1).max(64).nullable().optional(),
  serviceType: z.enum(['salon', 'spa']),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  serviceIds: z.array(z.string().min(1).max(64)).min(1).max(20),
  notes: z.string().trim().max(500).optional(),
})

// Escape the five HTML-significant characters (same approach as /api/contact).
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatINR(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100)
}

// "15:30" → "3:30 PM"
function formatTime(time: string): string {
  const [h = 0, m = 0] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${period}`
}

function row(label: string, value: string): string {
  return `<p style="margin:4px 0;color:#5b5249;font-size:14px"><strong>${label}:</strong> ${value}</p>`
}

export const POST = withErrorHandler(async (req: Request) => {
  await enforceRateLimit(`booking-request:${getClientIp(req)}`)

  const body = await req.json().catch(() => null)
  const parsed = bookingRequestSchema.safeParse(body)
  if (!parsed.success) {
    throw badRequest('Please check your details and try again.', parsed.error.flatten().fieldErrors)
  }
  const input = parsed.data

  const [catalogue, branches] = await Promise.all([getActiveCatalogue(), getPublicBranches()])
  const servicesById = new Map(catalogue.flatMap((c) => c.services).map((s) => [s.id, s]))
  const services = input.serviceIds.flatMap((id) => servicesById.get(id) ?? [])
  if (services.length === 0) {
    throw badRequest('Please choose at least one service.')
  }
  const branch = branches.find((b) => b.id === input.branchId)
  const totalPaise = services.reduce((sum, s) => sum + s.pricePaise, 0)
  const phone = normaliseValidIndianPhone(input.phone) ?? input.phone
  const date = new Date(`${input.bookingDate}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const serviceRows = services
    .map(
      (s) =>
        `<tr><td style="padding:4px 0;color:#1a0f0a;font-size:14px">${esc(s.name)} (${s.durationMinutes} min)</td><td style="padding:4px 0;text-align:right;color:#1a0f0a;font-size:14px">${formatINR(s.pricePaise)}</td></tr>`,
    )
    .join('')

  const subject = `New booking: ${input.name}, ${date} at ${formatTime(input.startTime)}`
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#faf7f2;font-family:Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#ffffff;border:1px solid #ece7df;border-radius:12px;padding:28px">
      <h1 style="margin:0 0 12px;color:#1a0f0a;font-size:20px">New booking request</h1>
      ${row('Name', esc(input.name))}
      ${row('Phone', `<a href="tel:${esc(phone)}">${esc(phone)}</a> · <a href="https://wa.me/${esc(phone.replace(/\D/g, ''))}">WhatsApp</a>`)}
      ${input.email ? row('Email', esc(input.email)) : ''}
      ${row('Date', esc(date))}
      ${row('Time', esc(formatTime(input.startTime)))}
      ${branch ? row('Branch', esc(`${branch.name}, ${branch.city}`)) : ''}
      ${row('Type', input.serviceType === 'spa' ? 'SPA' : 'Salon')}
      <table style="width:100%;margin:16px 0 0;border-top:1px solid #ece7df;padding-top:8px">
        ${serviceRows}
        <tr><td style="padding:8px 0 0;font-weight:bold;font-size:14px">Total</td><td style="padding:8px 0 0;text-align:right;font-weight:bold;font-size:14px">${formatINR(totalPaise)}</td></tr>
      </table>
      ${
        input.notes
          ? `<div style="margin:16px 0 0;padding:12px 16px;background:#faf7f2;border-radius:8px"><p style="margin:0 0 6px;color:#9a9388;font-size:11px;text-transform:uppercase">Notes</p><p style="margin:0;color:#1a0f0a;font-size:14px;white-space:pre-wrap">${esc(input.notes)}</p></div>`
          : ''
      }
      <p style="margin:20px 0 0;color:#9a9388;font-size:12px">Call or WhatsApp the customer to confirm the appointment.</p>
    </div>
  </div>
</body></html>`

  const inbox = process.env.CONTACT_INBOX_EMAIL
  const delivered = inbox
    ? await sendEmail({
        to: inbox,
        subject,
        html,
        ...(input.email ? { replyTo: input.email } : {}),
      })
    : false

  if (!delivered) {
    logger.error('booking request email not delivered', { configured: Boolean(inbox) })
    throw serviceUnavailable('email')
  }

  return apiSuccess({ received: true }, undefined, 201)
})
