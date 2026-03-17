import 'server-only';

import { createHmac, timingSafeEqual } from 'crypto';

export type CrossAppSsoPayload = {
  sub: string;
  email: string;
  role?: string;
  name?: string;
  iat: number;
  exp: number;
  iss?: string;
  aud?: string;
  next?: string;
};

const DEFAULT_SSO_ISSUER = 'geimser-crm';
const DEFAULT_SSO_AUDIENCE = 'asistencia-geimser';
const MAX_TOKEN_LIFETIME_SECONDS = 5 * 60;

const base64UrlEncode = (input: Buffer | string) =>
  Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const base64UrlDecode = (input: string) => {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
};

const getCrossAppSecret = () => {
  const secret = process.env.CROSS_APP_SSO_SECRET;
  if (!secret) {
    throw new Error('CROSS_APP_SSO_SECRET is required for cross-app SSO');
  }
  return secret;
};

export const verifyCrossAppSsoToken = (token: string): CrossAppSsoPayload | null => {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) {
      return null;
    }

    const secret = getCrossAppSecret();
    const content = `${headerB64}.${payloadB64}`;
    const expectedSig = base64UrlEncode(createHmac('sha256', secret).update(content).digest());

    const expectedBuf = Buffer.from(expectedSig);
    const providedBuf = Buffer.from(signatureB64);
    if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
      return null;
    }

    const header = JSON.parse(base64UrlDecode(headerB64)) as { alg?: string; typ?: string };
    if (header.alg !== 'HS256') {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(payloadB64)) as CrossAppSsoPayload;
    if (!payload?.email || !payload?.sub || typeof payload.exp !== 'number' || typeof payload.iat !== 'number') {
      return null;
    }

    const expectedIssuer = process.env.CROSS_APP_SSO_ISSUER?.trim() || DEFAULT_SSO_ISSUER;
    const expectedAudience = process.env.CROSS_APP_SSO_AUDIENCE?.trim() || DEFAULT_SSO_AUDIENCE;
    if (payload.iss !== expectedIssuer || payload.aud !== expectedAudience) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now || payload.iat > now + 30) {
      return null;
    }
    if (payload.exp - payload.iat > MAX_TOKEN_LIFETIME_SECONDS) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};
