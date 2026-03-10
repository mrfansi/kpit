/** Abstract data visualization graphic for title slide */
export function illustrationHero(): string {
  return `<svg width="300" height="200" viewBox="0 0 300 200" fill="none">
    <rect x="20" y="120" width="30" height="60" rx="4" fill="rgba(34,197,94,0.3)"/>
    <rect x="60" y="80" width="30" height="100" rx="4" fill="rgba(34,197,94,0.5)"/>
    <rect x="100" y="100" width="30" height="80" rx="4" fill="rgba(59,130,246,0.4)"/>
    <rect x="140" y="60" width="30" height="120" rx="4" fill="rgba(59,130,246,0.6)"/>
    <rect x="180" y="90" width="30" height="90" rx="4" fill="rgba(168,85,247,0.4)"/>
    <rect x="220" y="40" width="30" height="140" rx="4" fill="rgba(168,85,247,0.6)"/>
    <polyline points="35,115 75,75 115,95 155,55 195,85 235,35"
      stroke="rgba(255,255,255,0.6)" stroke-width="2" stroke-linecap="round" fill="none"/>
    <circle cx="35" cy="115" r="3" fill="white"/>
    <circle cx="75" cy="75" r="3" fill="white"/>
    <circle cx="115" cy="95" r="3" fill="white"/>
    <circle cx="155" cy="55" r="3" fill="white"/>
    <circle cx="195" cy="85" r="3" fill="white"/>
    <circle cx="235" cy="35" r="3" fill="white"/>
  </svg>`;
}

/** Sanitize a CSS color value */
function sanitizeColor(color: string): string {
  if (/^#[0-9a-fA-F]{3,8}$/.test(color)) return color;
  if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/.test(color)) return color;
  if (/^[a-zA-Z]+$/.test(color)) return color;
  return "#64748b";
}

/** Chart-themed illustration for domain slides */
export function illustrationDomain(color: string): string {
  const safe = sanitizeColor(color);
  return `<svg width="80" height="80" viewBox="0 0 80 80" fill="none" role="img" aria-hidden="true">
    <rect x="8" y="45" width="12" height="27" rx="3" fill="${safe}" opacity="0.4"/>
    <rect x="24" y="30" width="12" height="42" rx="3" fill="${safe}" opacity="0.6"/>
    <rect x="40" y="35" width="12" height="37" rx="3" fill="${safe}" opacity="0.5"/>
    <rect x="56" y="15" width="12" height="57" rx="3" fill="${safe}" opacity="0.8"/>
    <line x1="4" y1="72" x2="76" y2="72" stroke="${safe}" stroke-width="1" opacity="0.3"/>
  </svg>`;
}

/** Warning-themed illustration for attention slide */
export function illustrationAttention(): string {
  return `<svg width="80" height="80" viewBox="0 0 80 80" fill="none">
    <path d="M40 12L72 68H8L40 12Z" stroke="rgba(239,68,68,0.5)" stroke-width="2" fill="rgba(239,68,68,0.1)"/>
    <line x1="40" y1="30" x2="40" y2="50" stroke="rgba(239,68,68,0.7)" stroke-width="3" stroke-linecap="round"/>
    <circle cx="40" cy="58" r="2" fill="rgba(239,68,68,0.7)"/>
  </svg>`;
}

/** Target/goal illustration for closing slide */
export function illustrationGoal(): string {
  return `<svg width="120" height="120" viewBox="0 0 120 120" fill="none">
    <circle cx="60" cy="60" r="50" stroke="rgba(34,197,94,0.2)" stroke-width="2"/>
    <circle cx="60" cy="60" r="35" stroke="rgba(34,197,94,0.3)" stroke-width="2"/>
    <circle cx="60" cy="60" r="20" stroke="rgba(34,197,94,0.5)" stroke-width="2"/>
    <circle cx="60" cy="60" r="6" fill="rgba(34,197,94,0.8)"/>
    <line x1="20" y1="30" x2="55" y2="58" stroke="rgba(59,130,246,0.4)" stroke-width="1.5"/>
    <polygon points="55,58 50,50 58,54" fill="rgba(59,130,246,0.4)"/>
  </svg>`;
}
