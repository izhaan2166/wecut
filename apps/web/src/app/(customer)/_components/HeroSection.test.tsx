/************************************************************
 * Author       : KATABATHUNI BOSE
 * Date         : Created - 12-06-2026 & Updated - 31-10-2026
 *
 * Project      : wecut-webapp
 * Module Name  : HeroSection (component test)
 * Scope        : Customer Pages — Homepage Hero
 *
 * Description  : Component tests for the editorial homepage hero. Verifies
 *                the headline, the Book and Call actions, and that the photo
 *                renders only when one is passed in.
 *
 * Tech Stack   : Vitest, @testing-library/react, jsdom
 * Layer        : Testing (Presentation / Component)
 ************************************************************/

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { HeroSection } from './HeroSection'

afterEach(() => {
  cleanup()
})

describe('HeroSection', () => {
  it('renders the headline and both actions', () => {
    render(<HeroSection />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Where beauty meets royalty.',
    )
    expect(screen.getByRole('link', { name: 'Book an appointment at WeCut' })).toHaveAttribute(
      'href',
      '/?book=1',
    )
    expect(screen.getByRole('link', { name: 'Call 81483 08344' })).toHaveAttribute(
      'href',
      'tel:+918148308344',
    )
  })

  it('shows the photo only when one is given', () => {
    const { container, rerender } = render(<HeroSection />)
    expect(container.querySelector('img')).toBeNull()

    rerender(<HeroSection image={{ url: 'https://example.com/salon.jpg', alt: 'Salon chair' }} />)
    expect(screen.getByRole('img', { name: 'Salon chair' })).toHaveAttribute(
      'src',
      'https://example.com/salon.jpg',
    )
  })
})
