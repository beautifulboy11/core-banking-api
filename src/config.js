export function createConfig(env = process.env) {
  return {
    port: Number(env.PORT || 3000),
    jwtSecret: env.JWT_SECRET || 'reviewer-mock-secret',
    email: String(env.REVIEWER_EMAIL || 'review@boz.zm')
      .trim()
      .toLowerCase(),
    phone: String(env.REVIEWER_PHONE || '+260770828570').trim(),
    password: String(env.REVIEWER_PASSWORD || ''),
    otp: String(env.REVIEWER_OTP || ''),
    staffNumber: String(env.REVIEWER_STAFF_NUMBER || '1000').trim(),
    nrc: String(env.REVIEWER_NRC || '').trim(),
    accountNumber: String(env.REVIEWER_ACCOUNT_NUMBER || '0012062080023').trim(),
  };
}

export function isReviewerIdentity(config, value) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return false;
  }
  return raw.toLowerCase() === config.email || raw === config.phone;
}

export function isReviewerStaff(config, value) {
  const raw = String(value ?? '').trim();
  return raw.length > 0 && raw === config.staffNumber;
}
