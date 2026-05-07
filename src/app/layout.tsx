import type { Metadata } from "next"
import { Geist, Geist_Mono, Roboto } from "next/font/google"
import { Toaster } from "sonner"
import { Providers } from "@/components/layout/Providers"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const roboto = Roboto({
  variable: "--font-roboto",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "QAgrotis",
    template: "%s | QAgrotis",
  },
  description: "Your product description here.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ),
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${roboto.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>
          {children}
          <Toaster position="bottom-right" richColors />
        </Providers>
      </body>
    </html>
  )
}
