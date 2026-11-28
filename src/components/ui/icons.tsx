"use client";

/**
 * The line-icon set of the studio.
 *
 * One weight and one grid (18px, 1.6 stroke) so the navigation and the panel
 * headers read as the same family. Icons are decorative: the label is always
 * present next to them.
 */

import type { SVGProps } from "react";

export type IconName =
  | "overview"
  | "speech"
  | "asr"
  | "chat"
  | "image"
  | "music"
  | "video"
  | "video-agent"
  | "library"
  | "folder"
  | "file"
  | "wave"
  | "check"
  | "close"
  | "clock"
  | "play"
  | "pause"
  | "download"
  | "copy"
  | "chevron-down"
  | "menu"
  | "microphone"
  | "refresh";

const PATHS: Record<IconName, React.ReactNode> = {
  overview: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </>
  ),
  speech: (
    <>
      <path d="M4 10v4" />
      <path d="M8 7v10" />
      <path d="M12 4v16" />
      <path d="M16 7v10" />
      <path d="M20 10v4" />
    </>
  ),
  asr: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  chat: (
    <>
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M8 9h8M8 12h5" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="m4 18 5-5 4 4 3-3 4 4" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V6l10-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="6" width="12" height="12" rx="2" />
      <path d="m15 10 6-3v10l-6-3" />
    </>
  ),
  "video-agent": (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 6l3-3h13l2 3" />
      <path d="M8 6v4M13 6v4M18 6v4" />
    </>
  ),
  library: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
  folder: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
  file: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 16h6" />
    </>
  ),
  wave: (
    <>
      <path d="M4 9v6" />
      <path d="M8 5v14" />
      <path d="M12 8v8" />
      <path d="M16 4v16" />
      <path d="M20 9v6" />
    </>
  ),
  check: <path d="m4 12 5 5L20 6" />,
  close: <path d="m5 5 14 14M19 5 5 19" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  play: <path d="M7 4v16l13-8z" />,
  pause: (
    <>
      <path d="M8 4v16M16 4v16" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 21h16" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  "chevron-down": <path d="m5 9 7 7 7-7" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  microphone: (
    <>
      <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </>
  ),
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 18, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
