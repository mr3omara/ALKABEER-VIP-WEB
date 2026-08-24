/**
 * ALKABEER VIP WEB — Search & Arabic Normalization Utilities
 */

/**
 * Normalizes Arabic text for tolerant matching:
 * - Unifies Alef variants (أ / إ / آ / ا -> ا)
 * - Unifies Teh Marbuta and Heh (ة -> ه)
 * - Unifies Alef Maqsura and Yeh (ى -> ي)
 * - Removes Tatweel / Kashida (ـ)
 * - Removes Diacritics (Tashkeel)
 */
export function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u064B-\u0652]/g, '') // Remove tashkeel
    .replace(/ـ/g, '') // Remove tatweel
    .replace(/[أإآ]/g, 'ا') // Normalize alef
    .replace(/ة/g, 'ه') // Normalize teh marbuta
    .replace(/ى/g, 'ي') // Normalize alef maqsura
    .trim()
    .toLowerCase();
}

/**
 * Normalizes phone numbers for flexible search:
 * Strips spaces, dashes, parentheses, country codes (+20, 0020).
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  if (cleaned.startsWith('20')) cleaned = cleaned.slice(2);
  if (cleaned.startsWith('0020')) cleaned = cleaned.slice(4);
  return cleaned;
}

/**
 * Smart multi-field fuzzy matcher:
 * Checks whether query matches any target text or phone number.
 */
export function smartMatch(query: string, ...targets: (string | undefined | null)[]): boolean {
  if (!query || !query.trim()) return true;

  const normQuery = normalizeArabic(query);
  const cleanPhoneQuery = normalizePhone(query);

  return targets.some((target) => {
    if (!target) return false;

    // Direct Arabic normalized check
    const normTarget = normalizeArabic(target);
    if (normTarget.includes(normQuery)) return true;

    // Phone number normalized check
    if (cleanPhoneQuery.length >= 2) {
      const cleanTargetPhone = normalizePhone(target);
      if (cleanTargetPhone.includes(cleanPhoneQuery)) return true;
    }

    return false;
  });
}
