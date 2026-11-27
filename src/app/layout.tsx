import type { Metadata } from "next";
import { Provider } from "@/components/ui/provider";
import "./globals.css";

/**
 * Typography follows docs/minimax-studio-ui: Nimbus Sans for the interface
 * and Liberation Mono for technical data, with local fallbacks. No webfont is
 * downloaded; the stacks live in the Chakra theme.
 */
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
    <html lang="en">
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
