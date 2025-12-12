import { sql, testConnection } from './db.js';

async function main() {
  // Test the database connection
  const connected = await testConnection();

  if (!connected) {
    console.error('Failed to connect to the database. Please check your .env file.');
    process.exit(1);
  }

  // Example: Create a sample query using the sql template literal
  try {
    const result = await sql`SELECT version()`;
    console.log('PostgreSQL version:', result.rows[0].version);
  } catch (error) {
    console.error('Query error:', error);
  }
}

main();
