import { useId } from "react";

export type BoxColour = "lavender" | "pink" | "lime" | "cyan" | "orange";

/** Colourways from DESIGN.md. body, lid, ribbon, bow, shade. */
export const BOX_COLOURS: Record<BoxColour, { body: string; lid: string; ribbon: string; bow: string; shade: string }> = {
  lavender: { body: "#A98BFF", lid: "#B89DFF", ribbon: "#E4DBFF", bow: "#D5C8FF", shade: "#7C5CE0" },
  pink: { body: "#FF2E6C", lid: "#FF4D82", ribbon: "#FFD6E3", bow: "#FF8FB0", shade: "#C71A52" },
  lime: { body: "#BEE31A", lid: "#CDF03A", ribbon: "#F5FFC9", bow: "#E8FF73", shade: "#8FAE0A" },
  cyan: { body: "#2EC8EE", lid: "#59D6F4", ribbon: "#D3F6FF", bow: "#9BE8FA", shade: "#1A97BA" },
  orange: { body: "#FF8A3D", lid: "#FFA25F", ribbon: "#FFE3CC", bow: "#FFC399", shade: "#D9611A" },
};

interface Props {
  colour: BoxColour;
  /** Lid lifted and bow loosened. Pure presentation. */
  open?: boolean;
  className?: string;
  title?: string;
}

/**
 * Soft clay gift box, lit from the top left. Lid and bow sit in their own
 * group (data-part="lid") so callers can animate them.
 */
export function GiftBox({ colour, open = false, className, title }: Props) {
  const c = BOX_COLOURS[colour];
  const uid = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 240 240"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={`b${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c.lid} />
          <stop offset="0.55" stopColor={c.body} />
          <stop offset="1" stopColor={c.shade} />
        </linearGradient>
        <linearGradient id={`l${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.35" stopColor={c.lid} />
          <stop offset="1" stopColor={c.body} />
        </linearGradient>
        <radialGradient id={`s${uid}`}>
          <stop offset="0" stopColor="#000" stopOpacity="0.35" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="120" cy="222" rx="74" ry="9" fill={`url(#s${uid})`} />
      {/* Body */}
      <rect x="44" y="104" width="152" height="112" rx="26" fill={`url(#b${uid})`} />
      <rect x="104" y="104" width="32" height="112" fill={c.ribbon} opacity="0.95" />
      <rect x="52" y="112" width="40" height="10" rx="5" fill="#fff" opacity="0.28" />
      <g data-part="lid" style={{ transformOrigin: "120px 104px", transform: open ? "translateY(-44px) rotate(-14deg)" : undefined, transition: "transform 400ms cubic-bezier(.3,1.4,.5,1)" }}>
        {/* Lid */}
        <rect x="34" y="74" width="172" height="44" rx="22" fill={`url(#l${uid})`} />
        <rect x="104" y="74" width="32" height="44" fill={c.ribbon} />
        <rect x="44" y="80" width="56" height="9" rx="4.5" fill="#fff" opacity="0.4" />
        {/* Bow */}
        <path d="M120 74 C 88 36, 52 50, 74 74 C 90 86, 112 80, 120 74 Z" fill={c.bow} />
        <path d="M120 74 C 152 36, 188 50, 166 74 C 150 86, 128 80, 120 74 Z" fill={c.bow} />
        <path d="M82 64 C 92 56, 104 62, 108 70" stroke="#fff" strokeOpacity="0.55" strokeWidth="5" strokeLinecap="round" fill="none" />
        <circle cx="120" cy="74" r="13" fill={c.ribbon} />
        <circle cx="116" cy="70" r="4" fill="#fff" opacity="0.6" />
      </g>
    </svg>
  );
}
