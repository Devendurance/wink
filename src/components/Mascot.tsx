import { useId } from "react";

export interface MascotDef {
  id: string;
  name: string;
  trait: string;
  colour: string;
  light: string;
  dark: string;
  /** Text colour that stays readable on the candy card. */
  ink: "#fff" | "#0a0a0a";
  shape: "star" | "blob" | "cloud" | "cone" | "bean" | "drop" | "bun" | "moon";
}

/** Eight roster entries, one candy colour each, per DESIGN.md. */
export const MASCOTS: MascotDef[] = [
  { id: "starla", name: "Starla", trait: "A loyal friend", colour: "#C25BF2", light: "#E3A6FF", dark: "#8B2DBF", ink: "#fff", shape: "star" },
  { id: "jellip", name: "Jellip", trait: "A reliable friend", colour: "#FF2E6C", light: "#FF86A8", dark: "#B80F46", ink: "#fff", shape: "blob" },
  { id: "puffa", name: "Puffa", trait: "A fun friend", colour: "#2EC8EE", light: "#9BE8FA", dark: "#1585A8", ink: "#0a0a0a", shape: "cloud" },
  { id: "conyo", name: "Conyo", trait: "A smart friend", colour: "#BEE31A", light: "#E6FA7A", dark: "#86A108", ink: "#0a0a0a", shape: "cone" },
  { id: "bibble", name: "Bibble", trait: "A cheerful friend", colour: "#FF8A3D", light: "#FFC399", dark: "#C9570F", ink: "#0a0a0a", shape: "bean" },
  { id: "dripo", name: "Dripo", trait: "A calm friend", colour: "#4F6BFF", light: "#9CB0FF", dark: "#2339B8", ink: "#fff", shape: "drop" },
  { id: "bunzo", name: "Bunzo", trait: "A cozy friend", colour: "#2FD3B5", light: "#9FF0DF", dark: "#128F78", ink: "#0a0a0a", shape: "bun" },
  { id: "luma", name: "Luma", trait: "A dreamy friend", colour: "#E040C8", light: "#F5A0E8", dark: "#9B1B88", ink: "#fff", shape: "moon" },
];

const SHAPES: Record<MascotDef["shape"], string> = {
  star: "M100 18 C112 52 128 62 176 66 C190 68 192 80 180 90 C150 112 148 128 158 168 C162 182 150 190 138 182 C112 164 96 164 70 182 C56 190 44 180 50 166 C60 126 50 112 22 90 C10 80 14 68 28 66 C70 62 86 50 100 18 Z",
  blob: "M100 26 C150 26 182 62 180 108 C178 158 146 184 100 184 C54 184 22 156 20 108 C18 62 52 26 100 26 Z",
  cloud: "M54 70 C70 38 118 34 138 62 C170 56 192 86 180 116 C190 150 156 182 120 172 C96 190 60 184 52 160 C20 156 12 108 40 94 C38 84 44 76 54 70 Z",
  cone: "M100 14 C112 14 120 26 130 54 C146 98 176 128 176 154 C176 178 144 188 100 188 C56 188 24 178 24 154 C24 128 54 98 70 54 C80 26 88 14 100 14 Z",
  bean: "M58 34 C96 14 160 30 176 78 C190 120 164 176 112 184 C64 192 22 160 26 112 C28 80 36 46 58 34 Z",
  drop: "M100 14 C110 14 118 22 126 38 C152 82 178 108 178 140 C178 172 144 190 100 190 C56 190 22 172 22 140 C22 108 48 82 74 38 C82 22 90 14 100 14 Z",
  bun: "M100 40 C150 38 184 70 184 112 C184 158 150 184 100 184 C50 184 16 158 16 112 C16 70 50 42 100 40 Z",
  moon: "M120 24 C160 36 184 74 180 116 C176 160 140 188 98 184 C56 180 24 148 24 108 C24 72 46 40 80 28 C64 52 66 88 90 108 C108 124 138 120 150 100 C132 96 116 76 120 24 Z",
};

interface Props {
  mascot: MascotDef;
  className?: string;
  /** Hide the face for decorative shapes such as the gift box perch. */
  title?: string;
}

/**
 * Soft clay mascot with three face marks only: glossy oval eyes with two
 * specular dots, tone-on-tone blush, a tiny mouth.
 */
export function Mascot({ mascot, className, title }: Props) {
  const uid = useId().replace(/:/g, "");
  const m = mascot;
  const blush = m.light;
  return (
    <svg viewBox="0 0 200 210" className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <radialGradient id={`g${uid}`} cx="0.3" cy="0.25" r="0.9">
          <stop offset="0" stopColor={m.light} />
          <stop offset="0.5" stopColor={m.colour} />
          <stop offset="1" stopColor={m.dark} />
        </radialGradient>
        <radialGradient id={`s${uid}`}>
          <stop offset="0" stopColor="#000" stopOpacity="0.3" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="198" rx="58" ry="7" fill={`url(#s${uid})`} />
      <path d={SHAPES[m.shape]} fill={`url(#g${uid})`} stroke={m.light} strokeOpacity="0.35" strokeWidth="2" strokeLinejoin="round" />
      <ellipse cx="62" cy="126" rx="15" ry="11" fill={blush} opacity="0.6" />
      <ellipse cx="138" cy="126" rx="15" ry="11" fill={blush} opacity="0.6" />
      <ellipse cx="76" cy="104" rx="9" ry="12" fill="#0a0a0a" />
      <ellipse cx="124" cy="104" rx="9" ry="12" fill="#0a0a0a" />
      <circle cx="79" cy="99" r="3.4" fill="#fff" />
      <circle cx="73" cy="109" r="1.7" fill="#fff" />
      <circle cx="127" cy="99" r="3.4" fill="#fff" />
      <circle cx="121" cy="109" r="1.7" fill="#fff" />
      <path d="M92 128 Q100 135 108 128" stroke="#0a0a0a" strokeWidth="3.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}
