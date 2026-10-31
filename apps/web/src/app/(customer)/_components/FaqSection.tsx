/************************************************************
 * Author       : KATABATHUNI BOSE
 * Date         : Created - 04-06-2026 & Updated - 31-10-2026
 *
 * Project      : wecut-webapp
 * Module Name  : FaqSection
 * Scope        : Customer Pages
 *
 * Description  : Homepage FAQ block — editorial heading column beside an
 *                expandable list of customer questions. Receives a pre-resolved
 *                FAQ list from the homepage server component (CMS-first via
 *                resolveFaqs, static fallback otherwise). Rebuilt on the
 *                shadcn/ui Accordion (Radix) primitive with a motion Reveal.
 *
 * Responsibilities :
 * - Present the most frequently asked questions with answers
 * - Provide an editorial intro with a WhatsApp support mention
 * - Offer an accessible Radix accordion question list
 *
 * Features / Functionality :
 * - Two-column editorial + accordion layout
 * - Radix accordion with gold hover affordance + animated expand
 * - Shows up to five FAQs from the resolved list
 *
 * Tech Stack   : React, Next.js 16 (App Router), Tailwind CSS v4, shadcn/ui,
 *                Radix, motion
 * Layer        : Presentation (Component)
 *
 * Dependencies : @/lib/seo/business, @/components/ui/accordion,
 *                @/components/ui/motion/reveal
 *
 * Notes        :
 * - Data is resolved on the server; this component is presentational only.
 ************************************************************/

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Reveal } from '@/components/ui/motion/reveal'
import type { Faq } from '@/lib/seo/business'

const HOMEPAGE_FAQ_LIMIT = 5

export function FaqSection({ faqs }: { faqs: Faq[] }) {
  const visibleFaqs = faqs.slice(0, HOMEPAGE_FAQ_LIMIT)

  return (
    <section
      aria-labelledby="faq-heading"
      className="mx-auto w-full max-w-[1200px] px-5 py-16 md:px-10 lg:py-20"
    >
      <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-2">
        <Reveal className="flex flex-col justify-center" as="div">
          <p className="mb-3 font-ui text-[13px] font-medium uppercase tracking-[0.18em] text-ink-muted">
            Got a question?
          </p>
          <h2
            id="faq-heading"
            className="mb-6 font-display text-[clamp(34px,4.5vw,52px)] leading-[1.05] text-ink"
          >
            Frequently asked
          </h2>
          <p className="max-w-xl font-sans text-lg leading-relaxed text-ink-soft">
            Can&apos;t find the answer you&apos;re looking for?
            <br />
            Don&apos;t hesitate to connect with us via{' '}
            <a href="tel:+918148308344" className="font-semibold text-ink underline">
              phone
            </a>{' '}
            or{' '}
            <a
              href="https://wa.me/918148308344"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-ink underline"
            >
              WhatsApp
            </a>{' '}
            to get in touch with our receptionist.
          </p>
        </Reveal>

        <Reveal as="div">
          <Accordion type="single" collapsible className="w-full">
            {visibleFaqs.map((faq) => (
              <AccordionItem key={faq.question} value={faq.question} className="border-hairline">
                <AccordionTrigger className="py-5 font-ui text-lg font-semibold text-ink hover:text-ink-soft hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="pr-8 font-sans text-[15px] leading-relaxed text-ink-soft">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  )
}
