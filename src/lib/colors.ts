/** Curated soft pastel color palette for project/domain color assignment */
export const SOFT_PALETTE = [
  "#7C9EF5", // soft blue
  "#F5A27C", // soft orange
  "#7CE0B8", // soft mint
  "#E07CC4", // soft pink
  "#C4A0F5", // soft lavender
  "#F5D87C", // soft gold
  "#7CD0E0", // soft cyan
  "#F57C8E", // soft coral
  "#A0D87C", // soft green
  "#D8A0E0", // soft orchid
  "#7CB8F5", // soft sky
  "#F5C47C", // soft peach
] as const;

/** Returns a random soft pastel color from the curated palette */
export function generateSoftColor(): string {
  return SOFT_PALETTE[Math.floor(Math.random() * SOFT_PALETTE.length)];
}
