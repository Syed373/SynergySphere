import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './Providers';

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SynergySphere - Advanced Team Collaboration Platform',
  description: 'Streamline team collaboration with intelligent project management, task tracking, and seamless communication. Built for teams that want to work smarter.',
  keywords: ['team collaboration', 'project management', 'task tracking', 'team communication', 'productivity'],
  authors: [{ name: 'SynergySphere Team' }],
  viewport: 'width=device-width, initial-scale=1',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://synergysphere.app',
    siteName: 'SynergySphere',
    title: 'SynergySphere - Advanced Team Collaboration Platform',
    description: 'Streamline team collaboration with intelligent project management, task tracking, and seamless communication.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'SynergySphere Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@synergysphere',
    creator: '@synergysphere',
    title: 'SynergySphere - Advanced Team Collaboration Platform',
    description: 'Streamline team collaboration with intelligent project management, task tracking, and seamless communication.',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
        <link rel="canonical" href="https://synergysphere.app" />
      </head>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}