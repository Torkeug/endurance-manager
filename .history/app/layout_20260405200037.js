import './globals.css'
import Nav from '../components/Nav'

export const metadata = {
  title: 'Kronos Endurance Planner',
  description: 'Outil de planification de courses pour Kronos SimSports',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  )
}