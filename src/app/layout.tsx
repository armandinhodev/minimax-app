import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import { Provider } from "@/components/ui/provider";
import "./globals.css";

/**
 * UI face: a grotesque with signage roots — industrial, slightly condensed,
 * high x-height. Mono face for values, ids and statuses: tabular numerals
 * let a parameter set be compared down the column.
 *
 * See docs/design.md for the brief behind both choices.
 */
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-archivo",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MiniMax Studio",
  description: "MiniMax studio for speech, image, video, music and transcription",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${archivo.variable} ${plexMono.variable}`}>
      <body className={archivo.className}>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
