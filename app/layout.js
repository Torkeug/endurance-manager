import { Rajdhani, DM_Mono } from "next/font/google";
import "./globals.css";
import Nav from "../components/Nav";
import PullToRefresh from "../components/PullToRefresh";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale } from "next-intl/server";

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-rajdhani",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata = {
  title: "Kronos Endurance Planner",
  description: "Planification des courses d'endurance Kronos SimSports",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({ children }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${rajdhani.variable} ${dmMono.variable}`} data-scroll-behavior="smooth">
      <body className="h-screen flex flex-col overflow-hidden">
        <NextIntlClientProvider messages={messages}>
          <Nav />
          <PullToRefresh>{children}</PullToRefresh>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
