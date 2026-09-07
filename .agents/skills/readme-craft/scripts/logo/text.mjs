export const CASE_VARIANTS = {
  upper: word => word.toUpperCase(),
  title: word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
};

export function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function resolveWords(name) {
  return name
    .split(/[\s_-]+/)
    .map(part => part.trim())
    .filter(Boolean);
}

export function applyCase(words, caseKey) {
  const transform = CASE_VARIANTS[caseKey];
  if (!transform) throw new Error(`Unknown case variant: ${caseKey}`);
  return words.map(transform);
}
