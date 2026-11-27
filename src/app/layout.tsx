import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Mono } from "next/font/google";
import { Provider } from "@/components/ui/provider";
import "./globals.css";

/**
 * UI face: Bricolage Grotesque, an editorial grotesque with enough character
 * to carry the headings without decoration. Mono face for timecode, values
 * and ids: DM Mono, with tabular numerals so a parameter set compares down
 * the column.
 *
 * See docs/design.md for the brief behind both choices.
 */
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
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
    <html lang="en" className={`${bricolage.variable} ${dmMono.variable}`}>
      <body className={bricolage.className}>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
