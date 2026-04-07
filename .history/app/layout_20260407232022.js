import { Rajdhani, DM_Mono } from 'next/font/google'
import './globals.css'
import Nav from '../components/Nav'

const rajdhani = Rajdhani({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-rajdhani',
  display: 'swap',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata = {
  title: 'Kronos Endurance Planner',
  description: "Planification des courses d'endurance Kronos SimSports",
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${rajdhani.variable} ${dmMono.variable}`}>
      <body>
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  )
}