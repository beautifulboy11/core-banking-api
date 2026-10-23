import { Router } from 'express';
import { isReviewerIdentity, isReviewerStaff } from './config.js';
import { fail, ok } from './envelope.js';
import { banks, ddacTypes, deviceInfo, serviceProviders } from './fixtures.js';
import {
  issueSession,
  passwordsMatch,
  readAccessToken,
  readRefreshToken,
} from './tokens.js';

function maskIdentifier(value) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return '';
  }
  if (raw.includes('@')) {
    const [name, domain] = raw.split('@');
    return `${name.slice(0, 1)}***@${domain}`;
  }
  if (raw.length <= 4) {
    return '****';
  }
  return `${raw.slice(0, 3)}***${raw.slice(-2)}`;
}

function reviewerOtp(config, body) {
  const otp = String(body.otp ?? body.oneTimePassword ?? '').trim();
  if (!config.otp || otp !== config.otp) {
    return false;
  }
  return (
    isReviewerIdentity(config, body.email) ||
    isReviewerIdentity(config, body.phoneNumber) ||
    isReviewerIdentity(config, body.identifier)
  );
}

function otpPayload(config, body) {
  const identifier = body.email || body.phoneNumber || body.identifier || config.email;
  return {
    success: true,
    validForSeconds: 180,
    identifier: maskIdentifier(identifier),
    message: 'OTP sent successfully',
  };
}

function statementRows(store) {
  const today = new Date().toISOString();
  return [
    {
      valueDate: today,
      bookingDateRaw: today,
      reference: 'TXN1',
      description: 'Test Transaction 1',
      debit: 100.5,
      credit: 0,
      runningBalance: store.balance,
      creditRecord: false,
    },
    {
      valueDate: today,
      bookingDateRaw: today,
      reference: 'TXN2',
      description: 'Test Transaction 2',
      debit: 0,
      credit: 200.25,
      runningBalance: store.balance + 200.25,
      creditRecord: true,
    },
  ];
}

export function createRouter({ config, store }) {
  const router = Router();

  router.post('/oauth/token', (req, res) => {
    const body = req.body ?? {};
    if (body.grant_type === 'refresh_token') {
      try {
        const payload = readRefreshToken(config, body.refresh_token);
        if (!payload) {
          return fail(res, 401, 'invalid_grant');
        }
        return res.json(ok(issueSession(config), 'Login successful'));
      } catch {
        return fail(res, 401, 'invalid_grant');
      }
    }

    const username = body.username ?? body.email;
    const passwordOk =
      config.password.length > 0 &&
      passwordsMatch(body.password, config.password) &&
      isReviewerIdentity(config, username);

    if (!passwordOk) {
      return fail(res, 401, 'invalid_grant');
    }

    return res.json(ok(issueSession(config), 'Login successful'));
  });

  router.post('/oauth/logout', (_req, res) => {
    res.json(ok({ status: 'success' }, 'Logged out'));
  });

  router.post('/kyc/submit', (req, res) => {
    const body = req.body ?? {};
    const allowed =
      isReviewerIdentity(config, body.email) ||
      isReviewerIdentity(config, body.phoneNumber) ||
      isReviewerStaff(config, body.staffNumber);
    if (!allowed) {
      return fail(res, 400, 'invalid_grant');
    }
    return res.json(
      ok(
        {
          registrationReferenceKey: 'mock_registration_reference_key',
          otpResponse: otpPayload(config, body),
        },
        'KYC submitted successfully',
      ),
    );
  });

  router.post(['/verification/email', '/otp/generate', '/otp/generate-token'], (req, res) => {
    const body = req.body ?? {};
    if (
      !isReviewerIdentity(config, body.email) &&
      !isReviewerIdentity(config, body.phoneNumber)
    ) {
      return fail(res, 400, 'invalid_grant');
    }
    return res.json(ok(otpPayload(config, body), 'OTP generated successfully'));
  });

  router.post(['/otp/verify', '/verification/email/verify', '/kyc/complete'], (req, res) => {
    if (!reviewerOtp(config, req.body ?? {})) {
      return fail(res, 400, 'invalid_grant');
    }
    return res.json(
      ok(
        { verified: true, message: 'OTP verification successful' },
        'OTP verified successfully',
      ),
    );
  });

  router.get('/kyc/onboarding/state', (req, res) => {
    if (!isReviewerIdentity(config, req.query.email)) {
      return res.json(ok({ accountStatus: 'UNKNOWN', mode: 'NOT_STARTED' }));
    }
    return res.json(ok({ accountStatus: 'ACTIVE', mode: 'FULLY_ONBOARDED' }));
  });

  router.use((req, res, next) => {
    try {
      const user = readAccessToken(config, req.get('authorization'));
      if (!user) {
        return fail(res, 401, 'invalid_grant');
      }
      req.user = user;
      return next();
    } catch {
      return fail(res, 401, 'invalid_grant');
    }
  });

  router.get('/account', (_req, res) => {
    res.json(
      ok({
        id: 'reviewer-account',
        accountNumber: config.accountNumber,
        customerName: 'Test User',
        balance: store.balance,
        availableBalance: store.availableBalance,
        currency: 'ZMW',
        accountType: 'STAFF SAVINGS',
      }),
    );
  });

  router.get('/transactions', (_req, res) => {
    const transactions = statementRows(store);
    res.json(ok({ transactions, total: transactions.length }));
  });

  router.get('/transactions/history', (_req, res) => {
    res.json(ok({ items: store.history, total: store.history.length }));
  });

  router.get('/transactions/statement/pdf', (_req, res) => {
    res.json(ok({ status: 'success', message: 'Statement queued' }));
  });

  router.get('/banks', (_req, res) => {
    res.json(ok({ items: banks }));
  });

  router.get('/transfer-limits', (_req, res) => {
    res.json(
      ok({
        id: '1',
        accountId: config.accountNumber,
        transferThreshold: 100000,
        dailyLimit: 100000,
        monthlyLimit: 120000,
        minTransferAmount: 100,
        maxTransferAmount: 10000,
      }),
    );
  });

  router.get('/transfer-limits/type-limits', (_req, res) => {
    res.json(
      ok({
        items: [
          {
            transferType: 'INTRA',
            minTransferAmount: 1,
            maxTransferAmount: 500000,
          },
          {
            transferType: 'INTER',
            minTransferAmount: 100,
            maxTransferAmount: 1000000,
          },
          {
            transferType: 'DDAC',
            minTransferAmount: 1,
            maxTransferAmount: 20000,
          },
        ],
      }),
    );
  });

  router.get('/transfers/guard-open', (_req, res) => {
    res.json(ok({ open: true }));
  });

  router.post(['/transfers/inter', '/transfers/intra', '/ddac/transfer'], (req, res) => {
    res.json(ok(store.recordTransfer(req.body ?? {}), 'Request successful'));
  });

  router.get('/ddac/types', (_req, res) => {
    res.json(ok({ items: ddacTypes }));
  });

  router.get('/ddac/providers', (_req, res) => {
    res.json(ok({ items: serviceProviders }));
  });

  router.get('/beneficiaries', (_req, res) => {
    // The mobile client reads payload['payload'] after the envelope is unwrapped.
    res.json(ok({ payload: store.beneficiaries }));
  });

  router.post('/beneficiaries', (req, res) => {
    res.json(ok(store.addBeneficiary(req.body ?? {})));
  });

  router.put('/beneficiaries/:id', (req, res) => {
    const index = store.beneficiaries.findIndex((item) => item.id === req.params.id);
    if (index === -1) {
      return fail(res, 404, 'Beneficiary not found');
    }
    store.beneficiaries[index] = {
      ...store.beneficiaries[index],
      ...req.body,
      id: req.params.id,
    };
    return res.json(ok(store.beneficiaries[index]));
  });

  router.delete('/beneficiaries/:id', (req, res) => {
    const index = store.beneficiaries.findIndex((item) => item.id === req.params.id);
    if (index === -1) {
      return fail(res, 404, 'Beneficiary not found');
    }
    store.beneficiaries.splice(index, 1);
    return res.json(ok({ status: 'success' }));
  });

  router.post('/customer/lookup', (req, res) => {
    const accountNumber = String(req.body?.accountNumber ?? '');
    const internal = accountNumber === config.accountNumber;
    res.json(
      ok({
        accountNumber,
        accountName: internal ? 'Test User' : 'Test Beneficiary 1',
        bankId: internal ? '' : banks[0].id,
        bankName: internal ? 'BANK OF ZAMBIA' : banks[0].bankName,
        branchId: internal ? '' : banks[0].branches[0].id,
        branchName: internal ? 'HEAD OFFICE' : banks[0].branches[0].branchName,
        internalAccount: internal,
      }),
    );
  });

  router.get('/devices/info', (_req, res) => {
    res.json(ok(deviceInfo));
  });

  router.get('/devices/:deviceId/signing-key', (req, res) => {
    res.json(ok(store.signingKey(req.params.deviceId)));
  });

  router.post('/devices/:deviceId/signing-key/rotate', (req, res) => {
    res.json(ok(store.rotateSigningKey(req.params.deviceId)));
  });

  router.get('/notifications', (_req, res) => {
    res.json(ok({ items: store.notifications }));
  });

  router.put('/notifications/read-all', (_req, res) => {
    for (const item of store.notifications) {
      item.isRead = true;
    }
    res.json(ok({ status: 'success' }, 'Notification updated'));
  });

  router.put('/notifications/:id/read', (req, res) => {
    const item = store.notifications.find((entry) => entry.id === req.params.id);
    if (item) {
      item.isRead = true;
    }
    res.json(ok({ status: 'success' }, 'Notification updated'));
  });

  router.get('/pin/status', (_req, res) => {
    res.json(
      ok({
        configured: store.pin.configured,
        status: store.pin.locked ? 'LOCKED' : 'ACTIVE',
        locked: store.pin.locked,
        lockedUntil: null,
        pinVersion: store.pin.configured ? store.pin.pinVersion : 0,
      }),
    );
  });

  router.post('/pin/setup', (_req, res) => {
    store.pin.configured = true;
    store.pin.locked = false;
    store.pin.pinVersion += 1;
    res.json(ok({ verified: true, pinVersion: store.pin.pinVersion }));
  });

  router.post('/pin/verify', (_req, res) => {
    res.json(ok({ verified: true, pinVersion: store.pin.pinVersion }));
  });

  router.post('/pin/change', (_req, res) => {
    store.pin.pinVersion += 1;
    res.json(ok({ verified: true, pinVersion: store.pin.pinVersion }));
  });

  router.post('/pin/forgot', (_req, res) => {
    res.json(
      ok({
        success: true,
        identifier: maskIdentifier(config.email),
        validForSeconds: 180,
        message: 'Recovery code sent',
      }),
    );
  });

  router.post('/pin/reset', (_req, res) => {
    store.pin.pinVersion += 1;
    store.pin.locked = false;
    res.json(ok({ verified: true, pinVersion: store.pin.pinVersion }));
  });

  router.get('/service-requests', (_req, res) => {
    res.json(ok({ items: [] }));
  });

  router.post('/service-requests', (req, res) => {
    res.json(ok({ id: `sr-${Date.now()}`, ...req.body, status: 'OPEN' }));
  });

  router.get('/indemnity', (_req, res) => {
    res.json(
      ok({
        title: 'Indemnity',
        body: 'Reviewer mock indemnity text.',
      }),
    );
  });

  router.use((req, res) => {
    res.json(
      ok(
        { endpoint: req.path, method: req.method, status: 'success' },
        'Request successful',
      ),
    );
  });

  return router;
}
