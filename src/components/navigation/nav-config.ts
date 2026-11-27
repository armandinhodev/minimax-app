export type ProductAccent = "speech" | "text" | "image" | "music" | "video" | "video-agent" | "library";

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
    description: "Generate speech, transcribe audio and manage voices.",
    matchPaths: ["/tts", "/voices", "/asr"],
    groups: [
      {
        label: "Speech",
        items: [
          { href: "/tts", label: "Generate audio (TTS)", description: "Create speech from text" },
          { href: "/asr", label: "Transcription (ASR)", description: "Turn audio into text and subtitles" },
          { href: "/voices", label: "Voice gallery", description: "Manage reusable voices" },
          { href: "/voices/clone", label: "Clone voice", description: "Create a voice from audio" },
          { href: "/voices/design", label: "Design voice", description: "Build a synthetic voice" },
        ],
      },
    ],
  },
  {
    id: "text",
    label: "Chat",
    shortLabel: "CH",
    href: "/text",
    description: "Converse with a language model.",
    matchPaths: ["/text"],
    groups: [
      {
        label: "Chat",
        items: [{ href: "/text", label: "Chat", description: "Talk to MiniMax M3 models" }],
      },
    ],
  },
  {
    id: "image",
    label: "Image",
    shortLabel: "IM",
    href: "/image",
    description: "Generate and transform images.",
    matchPaths: ["/image"],
    groups: [
      {
        label: "Image",
        items: [
          { href: "/image", label: "Image generation", description: "Generate images from prompts" },
          { href: "/image/image-to-image", label: "Image to image", description: "Transform an existing image" },
        ],
      },
    ],
  },
  {
    id: "music",
    label: "Music",
    shortLabel: "MU",
    href: "/music",
    description: "Compose tracks, lyrics and covers.",
    matchPaths: ["/music"],
    groups: [
      {
        label: "Music",
        items: [
          { href: "/music", label: "Music generation", description: "Create complete tracks" },
          { href: "/music/lyrics", label: "Lyrics", description: "Draft lyrics from a brief" },
          { href: "/music/cover-preprocess", label: "Cover preprocess", description: "Prepare cover voice features" },
        ],
      },
    ],
  },
  {
    id: "video",
    label: "Video",
    shortLabel: "VI",
    href: "/video",
    description: "Render and refine video clips.",
    matchPaths: ["/video"],
    groups: [
      {
        label: "Video",
        items: [
          { href: "/video/generation", label: "Video generation", description: "Create a video from text, images or references" },
          { href: "/video/context-ir", label: "Context-IR", description: "Enrich a prompt with multimodal context" },
          { href: "/video/regeneration", label: "2K regeneration", description: "Re-render a 768P result in 2K" },
          { href: "/video/tasks", label: "Video tasks", description: "Browse and cancel video tasks" },
        ],
      },
    ],
  },
  {
    id: "video-agent",
    label: "Video Agent",
    shortLabel: "VA",
    href: "/video-agent",
    description: "Create clips from templates.",
    matchPaths: ["/video-agent"],
    groups: [
      {
        label: "Video Agent",
        items: [{ href: "/video-agent", label: "Video Agent", description: "Render a video from a MiniMax template" }],
      },
    ],
  },
  {
    id: "library",
    label: "Library",
    shortLabel: "LB",
    href: "/library",
    description: "Browse local assets.",
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
