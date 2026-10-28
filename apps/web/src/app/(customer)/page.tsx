/************************************************************
 * Author       : KATABATHUNI BOSE
 * Date         : Created - 04-06-2026 & Updated - 27-09-2026
 *
 * Project      : wecut-webapp
 * Module Name  : HomePage
 * Scope        : Customer Pages
 *
 * Description  : Main homepage of theroyalglow.in. Rebuilt to faithfully
 *                match the Stitch MCP design — "Homepage - Updated Font Stack".
 *                Renders: announcement bar, hero, brand logos,
 *                scrollable service cards, special offers, testimonials,
 *                FAQ accordion, booking CTA, footer.
 *
 * Responsibilities :
 * - Render the full-width dark hero card
 * - Render horizontally scrollable service category cards
 * - Render special offers 2-col grid
 * - Render testimonial 3-col grid
 * - Render FAQ left-right split with accordion
 * - Render 3-step booking CTA
 * - Emit JSON-LD structured data
 *
 * Tech Stack   : React, Next.js 16 App Router, Tailwind CSS v4, motion
 * Layer        : Presentation
 *
 * Dependencies : JsonLd, resolveFaqs, SEO helpers,
 *                next/link, motion
 *
 * Notes        :
 * - ISR with 1-hour revalidation for FAQ content from CMS
 * - Every Book Now link lands here as `/?book=1`. A signed-in account without
 *   a completed profile is sent to /onboarding first, before the booking
 *   dialog opens (requireProfileBeforeBooking).
 * - Without booking intent, a signed-in customer without a completed profile is
 *   re-prompted to /onboarding at most once per 24h (repromptPendingOnboarding).
 ************************************************************/

import type { Metadata } from 'next'
import { JsonLd } from '@/components/seo/JsonLd'
import { resolveFaqs } from '@/lib/cms/faqs'
import { repromptPendingOnboarding, requireProfileBeforeBooking } from '@/lib/onboarding-guard'
import {
  faqPageJsonLd,
  localBusinessJsonLd,
  organizationJsonLd,
  websiteJsonLd,
} from '@/lib/seo/jsonld'
import { buildMetadata } from '@/lib/seo/metadata'
import { BookingCTASection } from './_components/BookingCTASection'
import { BrandLogosSection } from './_components/BrandLogosSection'
import { FaqSection } from './_components/FaqSection'
import { HeroSection } from './_components/HeroSection'
import { OffersSection } from './_components/OffersSection'
import { ServicesSection } from './_components/ServicesSection'
import { TestimonialsSection } from './_components/TestimonialsSection'

export const metadata: Metadata = buildMetadata({
  title: 'Premium Salon & Spa in Bengaluru',
  description:
    'Experience premium salon and spa services in Bengaluru. Expert haircuts, facials, body therapies, and luxury SPA treatments. Book your appointment today.',
  path: '/',
})

export const revalidate = 3600

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams

  // Both onboarding redirects run before the CMS reads, so a redirect does not
  // pay for them. See lib/onboarding-guard.ts.
  // Book Now (`?book=1`) by a signed-in account with no profile: onboarding
  // comes first, so nobody fills in a booking the API would then refuse.
  await requireProfileBeforeBooking(params)
  // Otherwise a gentle re-prompt: at most once per 24h, and only for signed-in
  // customers without a profile.
  await repromptPendingOnboarding(params)

  const faqList = await resolveFaqs()

  return (
    <>
      {/* JSON-LD Structured Data */}
      <JsonLd
        data={[
          localBusinessJsonLd(),
          organizationJsonLd(),
          websiteJsonLd(),
          faqPageJsonLd(faqList),
        ]}
      />

      <div className="flex flex-col">
        <HeroSection />
        <BrandLogosSection />
        <ServicesSection />
        <OffersSection />
        <TestimonialsSection />
        <FaqSection faqs={faqList} />
        <BookingCTASection />
      </div>
    </>
  )
}
