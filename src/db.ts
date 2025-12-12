import { sql } from "@vercel/postgres";
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Test the database connection
 * @returns Promise<boolean> - true if connection is successful
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await sql`SELECT NOW() as current_time`;
    console.log('Database connected successfully at:', result.rows[0].current_time);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

/**
 * Execute a raw SQL query
 * @param query - SQL query string
 * @returns Query result
 */
export async function query<T>(queryText: string): Promise<T[]> {
  const result = await sql.query(queryText);
  return result.rows as T[];
}

// Export the sql template literal for direct use
export { sql };
