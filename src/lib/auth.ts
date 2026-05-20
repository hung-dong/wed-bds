import { jwtVerify, SignJWT } from 'jose';

const SECRET_KEY = new TextEncoder().encode('anhhung-erp-super-secret-key-2026');

export type AuthTokenPayload = {
  id: string;
  role: string;
};

export async function signToken(payload: AuthTokenPayload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(SECRET_KEY);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as AuthTokenPayload;
  } catch {
    return null;
  }
}
