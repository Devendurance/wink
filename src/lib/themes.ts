import type { BoxColour } from "@/components/GiftBox";
import type { GiftTheme } from "./metadata";

export interface ThemeDef {
  id: GiftTheme;
  label: string;
  blurb: string;
  /** CSS class for the card/stage background. */
  surface: string;
  box: BoxColour;
  ink: string;
  swatch: string;
}

/** Each box colour contrasts with its surface, per DESIGN.md. */
export const THEMES: Record<GiftTheme, ThemeDef> = {
  sunrise: {
    id: "sunrise",
    label: "Sunrise",
    blurb: "Warm and bright, for good news.",
    surface: "grad-ember",
    box: "lavender",
    ink: "#0a0a0a",
    swatch: "linear-gradient(180deg,#fff,#ff8a4c 60%,#ff4f6e)",
  },
  confetti: {
    id: "confetti",
    label: "Confetti",
    blurb: "Loud and joyful, for celebrations.",
    surface: "grad-violet",
    box: "lime",
    ink: "#0a0a0a",
    swatch: "linear-gradient(160deg,#4b6bff,#8b5cf6 45%,#ff8a5c)",
  },
  "night-sky": {
    id: "night-sky",
    label: "Night sky",
    blurb: "Quiet and sparkly, for heartfelt notes.",
    surface: "stage-navy",
    box: "cyan",
    ink: "#ffffff",
    swatch: "linear-gradient(180deg,#13165f,#0a0b2e 50%,#03030c)",
  },
};
