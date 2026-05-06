/**
 * DUMMY DB CONNECT
 * Database connection is handled globally in index.ts for the main-server.
 * This file exists to maintain compatibility with migrated services.
 */
export default async function dbConnect() {
  return Promise.resolve();
}
