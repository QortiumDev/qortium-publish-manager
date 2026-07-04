export interface PatternParts {
  service: string;
  name: string;
  identifier: string;
}

// Build a canonical pattern string. Empty or '*' in any part = wildcard for that segment.
// Trailing wildcards are stripped so "VIDEO" is stored instead of "VIDEO" + trailing stars.
export function buildPattern(service: string, name: string, identifier: string | undefined): string {
  const s  = (service    ?? '').trim() || '*';
  const n  = (name       ?? '').trim() || '*';
  const id = (identifier ?? '').trim() || '*';

  if (id === '*') {
    if (n === '*') return s;
    return `${s}/${n}`;
  }
  return `${s}/${n}/${id}`;
}

/**
 * Parse a stored pattern string into its three parts.
 * Always returns all three — absent segments become '*'.
 */
export function parsePattern(pattern: string): PatternParts {
  const [service = '*', name = '*', identifier = '*'] = pattern.split('/');
  return { service, name, identifier };
}

/** Human-readable description of what a pattern matches. */
export function patternLabel(pattern: string): string {
  const { service, name, identifier } = parsePattern(pattern);
  const sAll  = service    === '*';
  const nAll  = name       === '*';
  const idAll = identifier === '*';

  if (sAll && nAll && idAll) return 'All resources';

  if (!sAll && nAll  && idAll)  return `All ${service}`;
  if (sAll  && !nAll && idAll)  return `All content by ${name}`;
  if (!sAll && !nAll && idAll)  return `${service} by ${name}`;
  if (!sAll && nAll  && !idAll) return `${service} · id: ${identifier}`;
  if (sAll  && nAll  && !idAll) return `Any type, any name · id: ${identifier}`;
  if (!sAll && !nAll && !idAll) return `${service} by ${name} · id: ${identifier}`;

  // mixed glob patterns — show raw but with slots labelled
  const parts = [
    sAll  ? '* (type)'       : service,
    nAll  ? '* (name)'       : name,
    idAll ? '* (identifier)' : identifier,
  ];
  return parts.join(' / ');
}

/** How specific the pattern is — useful for UX coloring / sorting. */
export type PatternScope = 'broad' | 'name' | 'resource';

export function patternScope(pattern: string): PatternScope {
  const slashes = (pattern.match(/\//g) ?? []).length;
  if (slashes >= 2) return 'resource';
  if (slashes === 1) return 'name';
  return 'broad';
}

/** Build the three quick-action patterns for a concrete resource. */
export function resourcePatterns(service: string, name: string, identifier: string | undefined) {
  return {
    exact:      buildPattern(service, name, identifier), // this specific resource
    byName:     buildPattern('*', name, ''),             // all content by this name
    byService:  buildPattern(service, '', ''),           // all of this service type
  };
}
