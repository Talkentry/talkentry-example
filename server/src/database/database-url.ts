function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function buildDatabaseUrl(): string {
  const type = requireEnv('DB_TYPE', 'postgresql');
  const username = encodeURIComponent(requireEnv('DB_USERNAME'));
  const password = encodeURIComponent(requireEnv('DB_PASSWORD'));
  const host = requireEnv('DB_HOST');
  const port = requireEnv('DB_PORT');
  const name = requireEnv('DB_NAME');

  return `${type}://${username}:${password}@${host}:${port}/${name}`;
}

export function getAppDatabaseUrl(): string {
  return buildDatabaseUrl();
}

export function getMigrationDatabaseUrl(): string {
  return buildDatabaseUrl();
}
