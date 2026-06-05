import type { Schema } from "mongoose";

/**
 * The Mongoose `Schema` constructor as provided by the consumer. We accept it
 * as a parameter (rather than importing a bundled mongoose) so that each
 * service/app compiles schemas with its OWN mongoose instance — sidestepping
 * the Mongoose 8 (core-server) vs 9.6 (other services) version split.
 */
export type SchemaCtor = typeof Schema;
