import { randomBytes, randomUUID } from 'node:crypto';
import { banks } from './fixtures.js';

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function createStore(config) {
  const signingKeys = new Map();

  const store = {
    balance: 10000.5,
    availableBalance: 10000.5,
    pin: {
      configured: true,
      locked: false,
      pinVersion: 1,
    },
    notifications: [
      {
        id: 'notif-001',
        title: 'Login Alert',
        subtitle: 'New sign-in detected on your account',
        type: 'security',
        isRead: false,
        createdAt: isoDaysAgo(0),
      },
      {
        id: 'notif-002',
        title: 'Statement Ready',
        subtitle: 'Your monthly account statement is available',
        type: 'statement',
        isRead: false,
        createdAt: isoDaysAgo(1),
      },
      {
        id: 'notif-003',
        title: 'Transfer Received',
        subtitle: 'You received ZMW 500.50 from John Doe',
        type: 'payment',
        amount: '+ZMW 500.50',
        isPositive: true,
        isRead: true,
        createdAt: isoDaysAgo(3),
      },
    ],
    beneficiaries: [
      {
        id: '1',
        accountNumber: '1234567890',
        accountName: 'Test Beneficiary 1',
        nickname: 'Test',
        bankId: banks[0].id,
        bankName: banks[0].bankName,
        branchId: banks[0].branches[0].id,
        branchName: banks[0].branches[0].branchName,
        internalAccount: false,
      },
    ],
    history: [
      {
        coreTransactionId: 'FT1001',
        reference: 'FT1001',
        fromAccountNumber: config.accountNumber,
        toAccountNumber: '1234567890',
        beneficiaryName: 'Test Beneficiary 1',
        bankName: banks[0].bankName,
        branchName: banks[0].branches[0].branchName,
        amount: 100.5,
        currency: 'ZMW',
        type: 'DEBIT',
        status: 'COMPLETED',
        narration: 'Test Transaction 1',
        createdAt: isoDaysAgo(0),
      },
      {
        coreTransactionId: 'FT1002',
        reference: 'FT1002',
        fromAccountNumber: '1234567890',
        toAccountNumber: config.accountNumber,
        beneficiaryName: 'Test User',
        bankName: 'BANK OF ZAMBIA',
        branchName: 'HEAD OFFICE',
        amount: 200.25,
        currency: 'ZMW',
        type: 'CREDIT',
        status: 'COMPLETED',
        narration: 'Test Transaction 2',
        createdAt: isoDaysAgo(1),
      },
    ],
    signingKey(deviceId) {
      const id = String(deviceId || 'reviewer-device');
      if (!signingKeys.has(id)) {
        signingKeys.set(id, {
          deviceId: id,
          keyId: `key-${id}`,
          algorithm: 'HMAC-SHA256',
          secretBase64: randomBytes(32).toString('base64'),
        });
      }
      return signingKeys.get(id);
    },
    rotateSigningKey(deviceId) {
      signingKeys.delete(String(deviceId || 'reviewer-device'));
      return store.signingKey(deviceId);
    },
    recordTransfer(body) {
      const amount = Number(body.amount ?? 0);
      const safeAmount = Number.isFinite(amount) ? amount : 0;
      if (safeAmount > 0) {
        store.availableBalance = Math.max(0, store.availableBalance - safeAmount);
        store.balance = store.availableBalance;
      }
      const transactionId = `FT${Date.now()}`;
      store.history.unshift({
        coreTransactionId: transactionId,
        reference: transactionId,
        fromAccountNumber: config.accountNumber,
        toAccountNumber: String(body.beneficiaryAccountNumber ?? body.toAccountNumber ?? ''),
        beneficiaryName: String(body.beneficiaryName ?? 'Test Beneficiary'),
        bankName: String(body.bankName ?? ''),
        branchName: String(body.branchName ?? ''),
        amount: safeAmount === 0 ? 0.01 : safeAmount,
        currency: 'ZMW',
        type: 'DEBIT',
        status: 'COMPLETED',
        narration: String(body.narration ?? ''),
        createdAt: new Date().toISOString(),
      });
      return {
        transactionId,
        status: 'COMPLETED',
        message: '',
        success: true,
        isSuccess: true,
        amount: safeAmount,
      };
    },
    addBeneficiary(body) {
      const beneficiary = {
        id: randomUUID(),
        accountNumber: String(body.accountNumber ?? ''),
        accountName: String(body.accountName ?? ''),
        nickname: String(body.nickname ?? ''),
        bankId: body.bankId ?? '',
        bankName: body.bankName ?? '',
        branchId: body.branchId ?? '',
        branchName: body.branchName ?? '',
        internalAccount: Boolean(body.internalAccount),
      };
      store.beneficiaries.push(beneficiary);
      return beneficiary;
    },
  };

  return store;
}
