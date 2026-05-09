/**
 * Returns a promise that resolves once Mongoose is connected.
 *
 * The actual `mongoose.connect(...)` call happens once in `src/index.ts`
 * during server startup. This helper exists for migrated services and
 * workers that historically called `dbConnect()` to ensure a connection
 * was established before issuing queries — instead of being a no-op
 * (which is what it used to be), it now waits for the shared connection
 * to be ready.
 */
import mongoose from 'mongoose';

const READY_STATE_CONNECTED = 1;

export default async function dbConnect(): Promise<void> {
  if (mongoose.connection.readyState === READY_STATE_CONNECTED) {
    return;
  }

  // If a connection attempt is already in progress (state 2), or the
  // socket is reconnecting, wait for either success or failure.
  await new Promise<void>((resolve, reject) => {
    const onConnected = () => {
      cleanup();
      resolve();
    };
    const onError = (err: any) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      mongoose.connection.off('connected', onConnected);
      mongoose.connection.off('error', onError);
    };
    mongoose.connection.once('connected', onConnected);
    mongoose.connection.once('error', onError);

    // Resolve immediately if it became connected between the check and
    // the listener registration.
    if (mongoose.connection.readyState === READY_STATE_CONNECTED) {
      cleanup();
      resolve();
    }
  });
}
