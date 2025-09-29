import { sha256 } from 'js-sha256';

export interface HashPayload {
  personId: string;
  siteId: string;
  eventType: 'IN' | 'OUT';
  eventTs: string;
  clientTs?: string;
  geo?: {
    lat: number;
    lng: number;
    acc?: number;
  };
  deviceId?: string;
  note?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (isRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize(value[key]);
        return acc;
      }, {});
  }
  return value;
};

export const stringifyPayload = (payload: HashPayload): string =>
  JSON.stringify(canonicalize(payload));

export const computeHash = (payload: HashPayload, previousHash: string | null): string => {
  const message = `${previousHash ?? ''}|${stringifyPayload(payload)}`;
  return sha256(message);
};

export const verifyHashChain = (
  payloads: HashPayload[],
  hashes: { prev: string | null; self: string }[]
): boolean => {
  if (payloads.length !== hashes.length) {
    return false;
  }
  return payloads.every((payload, index) => {
    const expected = computeHash(payload, hashes[index].prev);
    return expected === hashes[index].self;
  });
};

