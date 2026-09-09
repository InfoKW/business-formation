import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Business Formation | KelliWorks',
  description: 'Register your LLC, corporation, or other business entity online. KelliWorks handles the entire formation process.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
