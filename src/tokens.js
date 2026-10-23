import { timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';

export function passwordsMatch(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length === 0 || a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function issueSession(config) {
  const accessToken = jwt.sign(
    {
      sub: config.email,
      email: config.email,
      name: 'Test User',
      given_name: 'Test',
      family_name: 'User',
      staff_number: config.staffNumber,
      nrc: config.nrc,
      account_number: config.accountNumber,
      phone_number: config.phone,
    },
    config.jwtSecret,
    { expiresIn: '24h' },
  );

  const refreshToken = jwt.sign(
    {
      sub: config.email,
      typ: 'refresh',
    },
    config.jwtSecret,
    { expiresIn: '7d' },
  );

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 86400,
    refresh_expires_in: 604800,
    session_state: `mock_session_${Date.now()}`,
  };
}

export function readAccessToken(config, header) {
  const match = String(header ?? '').match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }
  const payload = jwt.verify(match[1], config.jwtSecret);
  if (payload.typ === 'refresh') {
    return null;
  }
  return payload;
}

export function readRefreshToken(config, token) {
  const payload = jwt.verify(String(token ?? ''), config.jwtSecret);
  if (payload.typ !== 'refresh') {
    return null;
  }
  return payload;
}
