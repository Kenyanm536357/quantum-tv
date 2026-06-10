/**
 * Cleans and formats IPTV stream/category names.
 * - Replaces ; and | with spaces
 * - Splits CamelCase words (e.g. "AnimationKids" → "Animation Kids")
 * - Collapses multiple spaces
 */
export function cleanName(name = '') {
  return name
    .replace(/[;|]/g, ' ')
    // Insert space before uppercase letters that follow a lowercase letter or digit
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    // Insert space before a sequence of uppercase letters followed by lowercase (e.g. "EPGGuide" → "EPG Guide")
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/\s{2,}/g, ' ')
    .trim();
}