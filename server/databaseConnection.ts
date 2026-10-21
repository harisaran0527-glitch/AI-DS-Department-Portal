import type pg from 'pg';

export function resolvePgConnection(connStr: string): {
  effectiveConnStr: string;
  ssl: pg.ConnectionConfig['ssl'];
  provider: 'neon' | 'supabase' | 'postgresql';
  host: string;
  port: number;
} {
  let effective = connStr.trim();
  let host = 'localhost';
  let port = 5432;
  let provider: 'neon' | 'supabase' | 'postgresql' = 'postgresql';

  try {
    const parsed = new URL(effective);
    host = parsed.hostname;
    port = parsed.port ? parseInt(parsed.port, 10) : 5432;
  } catch {
    const match = effective.match(/@([^:/]+)(?::(\d+))?/);
    if (match) {
      host = match[1];
      if (match[2]) port = parseInt(match[2], 10);
    }
  }

  if (host.includes('neon.tech') || effective.includes('neon.tech')) {
    provider = 'neon';
  } else if (host.includes('supabase.co') || host.includes('supabase.com') || effective.includes('supabase')) {
    provider = 'supabase';
  }

  if (provider === 'supabase' && effective.includes('pooler.supabase.com:5432')) {
    effective = effective.replace(':5432', ':6543');
    port = 6543;
  }

  let ssl: pg.ConnectionConfig['ssl'];
  if (provider === 'neon') {
    if (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== undefined &&
        process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'true') {
      throw new Error('Neon connections require certificate and hostname verification.');
    }
    try {
      const parsed = new URL(effective);
      parsed.searchParams.set('sslmode', 'verify-full');
      effective = parsed.toString();
    } catch {
      if (/\bsslmode=\S+/i.test(effective)) {
        effective = effective.replace(/\bsslmode=\S+/i, 'sslmode=verify-full');
      } else {
        effective = `${effective} sslmode=verify-full`;
      }
    }
    ssl = { rejectUnauthorized: true };
  } else if (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== undefined) {
    ssl = { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true' };
  } else if (provider === 'supabase') {
    ssl = { rejectUnauthorized: false };
  } else {
    ssl = effective.includes('sslmode=require') || effective.includes('sslmode=verify')
      ? { rejectUnauthorized: true }
      : { rejectUnauthorized: false };
  }

  return { effectiveConnStr: effective, ssl, provider, host, port };
}
