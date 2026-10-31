/************************************************************
 * Author       : KATABATHUNI BOSE
 * Date         : Created - 31-10-2026 & Updated - 31-10-2026
 *
 * Project      : wecut-webapp
 * Module Name  : VisitSection
 * Scope        : Customer Pages — Homepage
 *
 * Description  : Four quick-action cards at the foot of the homepage:
 *                Directions, Call, WhatsApp and opening hours.
 *
 * Responsibilities :
 * - Link to Google Maps, the phone number and WhatsApp
 * - Show opening hours from the BUSINESS facts
 *
 * Tech Stack   : React (server), Tailwind CSS v4, lucide-react
 * Layer        : Presentation (Component)
 *
 * Dependencies : @/lib/seo/business, lucide-react
 ************************************************************/

import { Clock, MapPin, MessageCircle, Phone } from 'lucide-react'
import { BUSINESS } from '@/lib/seo/business'

const CARD =
  'flex h-full items-center gap-4 rounded-[14px] border border-hairline bg-white p-5 text-ink'

function dayRange(days: readonly string[]): string {
  const first = days[0]?.slice(0, 3) ?? ''
  const last = days[days.length - 1]?.slice(0, 3) ?? ''
  return first === last ? first : `${first}–${last}`
}

function to12h(time: string): string {
  const hour = Number(time.slice(0, 2))
  const suffix = hour >= 12 ? 'pm' : 'am'
  return `${hour % 12 || 12}${suffix}`
}

export function VisitSection() {
  return (
    <section
      aria-labelledby="visit-heading"
      className="mx-auto w-full max-w-[1200px] px-5 pb-16 md:px-10 lg:pb-20"
    >
      <h2 id="visit-heading" className="sr-only">
        Visit or contact us
      </h2>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <li>
          <a href={BUSINESS.hasMap} target="_blank" rel="noopener noreferrer" className={CARD}>
            <MapPin className="size-6 shrink-0" strokeWidth={1.6} aria-hidden="true" />
            <span>
              <span className="block font-ui font-semibold">Directions</span>
              <span className="font-sans text-sm text-ink-soft">Narmada Complex, Rayasandra</span>
            </span>
          </a>
        </li>
        <li>
          <a href="tel:+918148308344" className={CARD}>
            <Phone className="size-6 shrink-0" strokeWidth={1.6} aria-hidden="true" />
            <span>
              <span className="block font-ui font-semibold">Call</span>
              <span className="font-sans text-sm text-ink-soft">{BUSINESS.telephone}</span>
            </span>
          </a>
        </li>
        <li>
          <a
            href="https://wa.me/918148308344"
            target="_blank"
            rel="noopener noreferrer"
            className={CARD}
          >
            <MessageCircle className="size-6 shrink-0" strokeWidth={1.6} aria-hidden="true" />
            <span>
              <span className="block font-ui font-semibold">WhatsApp</span>
              <span className="font-sans text-sm text-ink-soft">Message the front desk</span>
            </span>
          </a>
        </li>
        <li>
          <div className={CARD}>
            <Clock className="size-6 shrink-0" strokeWidth={1.6} aria-hidden="true" />
            <span>
              <span className="block font-ui font-semibold">Opening hours</span>
              {BUSINESS.openingHours.map((hours) => (
                <span key={hours.days.join()} className="block font-sans text-sm text-ink-soft">
                  {dayRange(hours.days)} {to12h(hours.opens)} – {to12h(hours.closes)}
                </span>
              ))}
            </span>
          </div>
        </li>
      </ul>
    </section>
  )
}
