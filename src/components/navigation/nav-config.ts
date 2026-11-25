export type ProductAccent = "speech" | "asr" | "image" | "music" | "video" | "library";

export type NavMatchMode = "exact" | "prefix";

export interface ProductNavItem {
  href: string;
  label: string;
  description?: string;
  match?: NavMatchMode;
}

export interface ProductNavGroup {
  label: string;
  items: ProductNavItem[];
}

export interface ProductNavSection {
  id: ProductAccent;
  label: string;
  shortLabel: string;
  href: string;
  description: string;
  matchPaths: string[];
  groups: ProductNavGroup[];
}

export const PRODUCT_NAV_SECTIONS: ProductNavSection[] = [
  {
    id: "speech",
    label: "Speech",
    shortLabel: "SP",
    href: "/tts",
    description: "Voice generation suite",
    matchPaths: ["/tts", "/voices"],
    groups: [
      {
        label: "Core routes",
        items: [
          { href: "/tts", label: "Text to Speech", description: "Create speech from text" },
          { href: "/voices", label: "Voices", description: "Manage reusable voices" },
        ],
      },
      {
        label: "Voice tools",
        items: [
          { href: "/voices/clone", label: "Clone Voice", description: "Create a voice from audio" },
          { href: "/voices/design", label: "Design Voice", description: "Build a synthetic voice" },
        ],
      },
    ],
  },
  {
    id: "asr",
    label: "Transcription",
    shortLabel: "TR",
    href: "/asr",
    description: "Speech-to-Text studio",
    matchPaths: ["/asr"],
    groups: [
      {
        label: "Workflows",
        items: [
          { href: "/asr", label: "Transcribe Audio", description: "Turn audio into text and subtitles" },
        ],
      },
    ],
  },
  {
    id: "image",
    label: "Image",
    shortLabel: "IM",
    href: "/image",
    description: "Image generation studio",
    matchPaths: ["/image"],
    groups: [
      {
        label: "Workflows",
        items: [
          { href: "/image", label: "Text to Image", description: "Generate images from prompts" },
          { href: "/image/image-to-image", label: "Image to Image", description: "Transform an existing image" },
        ],
      },
    ],
  },
  {
    id: "music",
    label: "Music",
    shortLabel: "MU",
    href: "/music",
    description: "Music creation suite",
    matchPaths: ["/music"],
    groups: [
      {
        label: "Creation tools",
        items: [
          { href: "/music", label: "Music Generation", description: "Create complete tracks" },
          { href: "/music/lyrics", label: "Lyrics Generation", description: "Draft lyrics from a brief" },
          { href: "/music/cover-preprocess", label: "Cover Preprocess", description: "Prepare cover voice features" },
        ],
      },
    ],
  },
  {
    id: "video",
    label: "Video",
    shortLabel: "VI",
    href: "/video",
    description: "H3 multimodal video studio",
    matchPaths: ["/video"],
    groups: [
      {
        label: "Video workflows",
        items: [
          { href: "/video", label: "Video Studio", description: "Generate, enhance and regenerate videos" },
        ],
      },
    ],
  },
  {
    id: "library",
    label: "Library",
    shortLabel: "LB",
    href: "/library",
    description: "Saved audio, music, image, and video assets",
    matchPaths: ["/library"],
    groups: [],
  },
];

export const WIDE_CONTENT_MATCH_PATHS = ["/image", "/music", "/video"];

export function matchesPath(pathname: string, paths: string[]): boolean {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function isNavItemActive(pathname: string, item: ProductNavItem): boolean {
  if (item.match === "prefix") return pathname === item.href || pathname.startsWith(`${item.href}/`);

  return pathname === item.href;
}
