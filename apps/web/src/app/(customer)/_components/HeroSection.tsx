/************************************************************
 * Author       : KATABATHUNI BOSE
 * Date         : Created - 04-06-2026 & Updated - 28-10-2026
 *
 * Project      : wecut-webapp
 * Module Name  : HeroSection
 * Scope        : Customer Pages
 *
 * Description  : Homepage hero — a single full-width dark card with the brand
 *                headline, sub-copy, CTAs and service category tags.
 *
 * Responsibilities :
 * - Render the brand headline, sub-copy, and primary/secondary CTAs (Button)
 * - Surface service category tags as a quick-scan strip (Badge)
 *
 * Features / Functionality :
 * - Motion fade/slide-in entrance (reduced-motion safe via variants)
 * - Book Now (deep-link ?book=1) + Explore Services CTAs
 *
 * Tech Stack   : React, Next.js 16 (App Router), Tailwind CSS v4, shadcn/ui,
 *                Radix, motion, lucide-react
 * Layer        : Presentation (Component)
 *
 * Dependencies : @/components/ui/button, @/components/ui/badge, motion/react,
 *                lucide-react, next/link
 ************************************************************/
'use client'

import { ArrowRight } from 'lucide-react'
import { motion } from 'motion/react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { fadeInUp } from '@/components/ui/motion/motion-variants'

const categories = ['HAIR', 'SPA', 'SKIN', 'BRIDAL', 'NAILS', 'GROOMING']

export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="mx-auto w-full max-w-[1280px] px-4 py-10 md:px-8"
    >
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="flex min-h-[560px] flex-col items-center justify-center rounded-[6px] bg-cocoa-dark px-6 py-16 text-center sm:px-12 lg:px-16"
      >
        {/* Eyebrow */}
        {/* No opacity: at 60% the deep-gold computed to #826b3e on the dark hero
            = 3.69:1, below the 4.5:1 WCAG AA floor for this 10px bold text.
            Full deep-gold clears it comfortably. */}
        <p className="mb-6 font-ui text-[11px] font-bold uppercase tracking-[0.2em] text-deep-gold">
          WeCut Salon &amp; Spa
        </p>

        {/* Headline — each phrase is a non-wrapping block so it always
            renders as exactly two lines. */}
        <h1
          id="hero-heading"
          className="font-display text-[clamp(38px,7vw,88px)] font-black leading-[1.02] tracking-[-0.03em] text-canvas-white"
        >
          <span className="block whitespace-nowrap">Where beauty</span>
          <span className="block whitespace-nowrap">meets Royalty.</span>
        </h1>

        {/* Body */}
        <p className="mt-6 max-w-[560px] font-sans text-[17px] leading-[1.6] text-dusty-gray">
          A premium salon and spa experience in Bengaluru. Hair, skin, nails and signature rituals —
          crafted by master artists in a calm, golden sanctuary.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Button asChild variant="gold" size="lg" className="font-ui font-bold">
            <Link href="/?book=1" aria-label="Book an appointment at WeCut">
              Book Now
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild variant="onDark" size="lg" className="font-ui font-bold">
            <Link href="/services">Explore Services</Link>
          </Button>
        </div>

        {/* Category Tags */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {categories.map((cat) => (
            <Badge
              key={cat}
              variant="ghost"
              // opacity-40 computed to #766f6c on the dark hero = 3.81:1, under the
              // 4.5:1 AA floor. 70% keeps the muted treatment while clearing it.
              className="px-0 font-ui text-[10px] font-bold uppercase tracking-widest text-canvas-white opacity-70"
            >
              {cat}
            </Badge>
          ))}
        </div>
      </motion.div>
    </section>
  )
}
