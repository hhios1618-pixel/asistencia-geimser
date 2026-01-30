type UserLike = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const looksLikeEmail = (value: string) => value.includes('@') && value.includes('.');

const titleCase = (value: string) =>
  value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const nameFromEmail = (email: string) => {
  const local = email.split('@')[0] ?? '';
  const normalized = local.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized ? titleCase(normalized) : '';
};

export const getUserDisplayName = (user: UserLike, fallbackFromDb?: string | null) => {
  const meta = user.user_metadata ?? {};
  const metaFullName = clean(meta.full_name);
  const metaName = clean(meta.name);

  const dbName = clean(fallbackFromDb);
  const email = clean(user.email);

  const metaBest = metaFullName || (metaName && !looksLikeEmail(metaName) && metaName !== email ? metaName : '');
  const dbBest = dbName && !looksLikeEmail(dbName) && dbName !== email ? dbName : '';
  const emailBest = email ? nameFromEmail(email) : '';

  return (metaBest || dbBest || emailBest || 'Colaborador').trim();
};

