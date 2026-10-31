/************************************************************
 * Author       : KATABATHUNI BOSE
 * Date         : Created - 04-06-2026 & Updated - 31-10-2026
 *
 * Project      : wecut-webapp
 * Module Name  : HeroSection
 * Scope        : Customer Pages
 *
 * Description  : Homepage hero in the editorial split layout: headline, one
 *                line of copy and two actions on the left, a tall salon photo
 *                on the right (stacked below the text on phones).
 *
 * Responsibilities :
 * - Render the brand headline, sub-copy and the Book / Call actions
 * - Render the hero photo when one is passed in
 *
 * Features / Functionality :
 * - Book (deep-link ?book=1) opens the booking dialog
 * - Call dials the salon directly
 *
 * Tech Stack   : React, Next.js 16 (App Router), Tailwind CSS v4, lucide-react
 * Layer        : Presentation (Component)
 *
 * Dependencies : lucide-react, next/link
 ************************************************************/

import { ArrowRight, Phone } from 'lucide-react'
import Link from 'next/link'

export type HeroImage = {
  url: string
  alt: string
}

export function HeroSection({ image }: { image?: HeroImage | undefined }) {
  return (
    <section
      aria-labelledby="hero-heading"
      className="mx-auto grid w-full max-w-[1200px] gap-10 px-5 pt-8 pb-16 md:px-10 lg:grid-cols-2 lg:gap-12 lg:pb-20"
    >
      <div className="flex flex-col justify-center gap-6">
        <p className="font-ui text-[13px] font-medium uppercase tracking-[0.18em] text-ink-muted">
          WeCut Salon &amp; Spa · Rayasandra
        </p>

        <h1
          id="hero-heading"
          className="font-display text-[clamp(44px,7vw,84px)] leading-[0.98] text-ink"
        >
          Where beauty meets royalty.
        </h1>

        <p className="max-w-[460px] font-sans text-lg leading-relaxed text-ink-soft">
          Cuts, colour, skin and spa, done carefully by people who listen first.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/?book=1"
            aria-label="Book an appointment at WeCut"
            className="inline-flex min-h-[50px] items-center gap-2 rounded-full bg-ink px-7 font-ui font-semibold text-paper transition-colors duration-200 hover:bg-ink-soft"
          >
            Book an appointment
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <a
            href="tel:+918148308344"
            className="inline-flex min-h-[50px] items-center gap-2 rounded-full border border-ink px-6 font-ui font-medium text-ink transition-colors duration-200 hover:bg-ink hover:text-paper"
          >
            <Phone className="size-4" aria-hidden="true" />
            Call 81483 08344
          </a>
        </div>
      </div>

      {image ? (
        <div className="relative aspect-[4/3] overflow-hidden rounded-[4px] bg-sand lg:aspect-auto lg:min-h-[560px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt={image.alt}
            fetchPriority="high"
            className="absolute inset-0 size-full object-cover"
          />
        </div>
      ) : null}
    </section>
  )
}
