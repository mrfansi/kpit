/**
 * Sanitize user input before interpolating into AI prompts.
 * Strips newlines and limits length to prevent prompt injection.
 */
export function sanitizeInput(input: string, maxLength: number): string {
  return input.replace(/[\r\n]+/g, " ").trim().slice(0, maxLength);
}

/**
 * Clean AI output: strip markdown formatting and common prefix patterns.
 */
export function cleanAIOutput(text: string): string {
  let cleaned = text;

  // Strip markdown bold/italic asterisks
  cleaned = cleaned.replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1");

  // Strip markdown headers
  cleaned = cleaned.replace(/^#{1,3}\s+/gm, "");

  // Remove common meta-text opening patterns (Indonesian)
  cleaned = cleaned.replace(
    /^(Berikut|Di bawah ini|Ini adalah|Deskripsi\s*:|KPI ini\s+|Indikator ini\s+)[^\n]*:?\s*\n*/i,
    ""
  );

  return cleaned.trim();
}
