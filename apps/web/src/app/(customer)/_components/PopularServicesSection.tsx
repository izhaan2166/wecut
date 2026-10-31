/************************************************************
 * Author       : KATABATHUNI BOSE
 * Date         : Created - 31-10-2026 & Updated - 31-10-2026
 *
 * Project      : wecut-webapp
 * Module Name  : PopularServicesSection
 * Scope        : Customer Pages — Homepage
 *
 * Description  : A short two-column list of everyday services with time,
 *                price and a Book button on every row. Book opens the booking
 *                dialog with that service already selected.
 *
 * Responsibilities :
 * - Render the services picked by pickPopularServices
 * - Link each row to its booking deep-link (/?book=1&service=<slug>)
 *
 * Tech Stack   : React (server), Next.js 16 (App Router), Tailwind CSS v4
 * Layer        : Presentation (Component)
 *
 * Dependencies : ./home-catalogue, next/link
 ************************************************************/

import Link from 'next/link'
import { formatRupees, type PopularService } from './home-catalogue'

export function PopularServicesSection({ services }: { services: PopularService[] }) {
  if (services.length === 0) return null

  return (
    <section
      aria-labelledby="popular-heading"
      className="mx-auto w-full max-w-[1200px] px-5 py-16 md:px-10 lg:py-20"
    >
      <h2
        id="popular-heading"
        className="mb-6 font-display text-[clamp(30px,4vw,40px)] leading-[1.1] text-ink"
      >
        Popular services
      </h2>

      <ul className="grid grid-cols-1 gap-x-12 border-t border-hairline md:grid-cols-2 md:border-t-0">
        {services.map((service) => (
          <li
            key={service.id}
            className="flex items-center justify-between gap-4 border-b border-hairline py-4 md:[&:nth-child(-n+2)]:border-t"
          >
            <div className="min-w-0">
              <p className="font-ui text-[17px] font-semibold text-ink">{service.name}</p>
              <p className="mt-0.5 font-sans text-sm text-ink-muted">
                {service.durationMinutes} min
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <span className="font-ui text-[17px] font-semibold text-ink">
                {formatRupees(service.pricePaise)}
              </span>
              <Link
                href={service.href}
                aria-label={`Book ${service.name}`}
                className="inline-flex min-h-[44px] items-center rounded-full bg-ink px-5 font-ui text-sm font-semibold text-paper transition-colors duration-200 hover:bg-ink-soft"
              >
                Book
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
