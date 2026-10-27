// Explicitly enforce isolated SQLite test database
process.env.USE_SQLITE = 'true';
process.env.DATABASE_PATH = 'server/data/isolated_test_system.db';
delete process.env.DATABASE_URL;
delete process.env.SUPABASE_DB_URL;
delete process.env.NEON_DB_URL;
process.env.PORT = '5001';

console.log('[Isolated HOD Server] Starting on port 5001 with isolated database:', process.env.DATABASE_PATH);

// Import the real main express app
await import('./index.js');
