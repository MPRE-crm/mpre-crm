export function splitName(full?: string) {
  if (!full) return { first_name: null as string | null, last_name: null as string | null };
  const [first, ...rest] = full.trim().split(/\s+/);
  return { first_name: first || null, last_name: rest.length ? rest.join(' ') : null };
}

export function displayName(first?: string|null, last?: string|null, fallback?: string|null) {
  const n = [first || '', last || ''].join(' ').trim();
  return n || (fallback || '').trim() || '(No Name)';
}
