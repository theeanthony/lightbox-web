import { ClerkProvider } from '@clerk/nextjs' // <-- Add this import
import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // Wrap the entire HTML in ClerkProvider
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}