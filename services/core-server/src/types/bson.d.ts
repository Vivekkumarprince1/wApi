declare module 'bson' {
  export interface ObjectIdLike {
    id: string | Uint8Array;
    toHexString(): string;
  }

  export type ObjectIdInput =
    | string
    | number
    | Uint8Array
    | ObjectId
    | ObjectIdLike;

  export class ObjectId {
    constructor(inputId?: ObjectIdInput);
    static isValid(input: unknown): boolean;
    static createFromHexString(hexString: string): ObjectId;
    toHexString(): string;
    toString(): string;
    equals(otherId: string | ObjectId | ObjectIdLike): boolean;
  }

  export class BSONValue {}
  export class Binary extends BSONValue {}
  export class BSONRegExp extends BSONValue {}
  export class BSONSymbol extends BSONValue {}
  export class Code extends BSONValue {}
  export class DBRef extends BSONValue {}
  export class Decimal128 extends BSONValue {}
  export class Double extends BSONValue {}
  export class Int32 extends BSONValue {}
  export class Long extends BSONValue {}
  export class MaxKey extends BSONValue {}
  export class MinKey extends BSONValue {}
  export class Timestamp extends BSONValue {}
  export class UUID extends BSONValue {}
  export class BSONError extends Error {}
  export class BSONRuntimeError extends BSONError {}

  export type BSONType = string;
  export type Document = Record<string, any>;
  export type DeserializeOptions = Record<string, unknown>;
  export type SerializeOptions = Record<string, unknown>;

  export const BSON: unknown;
  export const EJSON: unknown;

  export function calculateObjectSize(object: unknown): number;
  export function serialize(object: unknown, options?: SerializeOptions): Uint8Array;
  export function deserialize(buffer: Uint8Array, options?: DeserializeOptions): Document;
}
