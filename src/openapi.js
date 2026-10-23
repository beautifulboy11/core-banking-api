const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

function op(operationId, summary, fields) {
  return { operationId, summary, ...fields };
}

function ok(description, payload, message = 'Request successful') {
  return {
    description,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['success', 'message', 'payload'],
          properties: {
            success: { type: 'boolean', enum: [true] },
            message: { type: 'string', example: message },
            payload,
          },
        },
      },
    },
  };
}

function jsonBody(schema) {
  return {
    required: true,
    content: {
      'application/json': { schema },
    },
  };
}

const invalidGrant = { $ref: '#/components/responses/InvalidGrant' };
const notFound = { $ref: '#/components/responses/NotFound' };
const unauthorized = { 401: invalidGrant };

const publicAccess = { security: [] };

const pageParams = [
  { $ref: '#/components/parameters/Page' },
  { $ref: '#/components/parameters/Size' },
];

const generateOtp = {
  tags: ['OTP'],
  description:
    'Accepts the reviewer email or phone and returns a masked OTP challenge. The code is `REVIEWER_OTP` and is not included in the response. Any other identity returns 400 `invalid_grant`.',
  ...publicAccess,
  requestBody: jsonBody(ref('ReviewerContact')),
  responses: {
    200: ok('OTP challenge created', ref('OtpChallenge'), 'OTP generated successfully'),
    400: invalidGrant,
  },
};

const verifyOtp = {
  tags: ['OTP'],
  description:
    'Checks `otp` or `oneTimePassword` against `REVIEWER_OTP`. The body must also carry the reviewer email, phone, or `identifier`. A mismatch returns 400 `invalid_grant`.',
  ...publicAccess,
  requestBody: jsonBody(ref('OtpVerifyRequest')),
  responses: {
    200: ok('OTP matched the reviewer identity', ref('OtpVerification'), 'OTP verified successfully'),
    400: invalidGrant,
  },
};

const recordTransfer = {
  tags: ['Transfers'],
  description:
    'Records a completed debit in memory and reduces the account balance when `amount` is greater than zero. The three transfer paths share this behavior. The request signature is not checked.',
  requestBody: jsonBody(ref('TransferRequest')),
  responses: {
    200: ok('Transfer recorded', ref('TransferResult')),
    ...unauthorized,
  },
};

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Core Banking API',
    version: '1.0.0',
    description: [
      'Reviewer stand-in for the Core Banking staff banking mobile app.',
      'Every API response uses `{ success, message, payload }`. Failures also include `error`.',
      '',
      'The mobile app calls these routes under `/v1`. The same routes are mounted at `/`. `GET /health` is only on the server root.',
      '',
      'Login, logout, KYC, and OTP routes are public. Every other route requires `Authorization: Bearer <access_token>` from `POST /oauth/token`. A refresh token is rejected as a bearer token.',
      '',
      'Password login succeeds only for `REVIEWER_EMAIL` or `REVIEWER_PHONE` with `REVIEWER_PASSWORD`. OTP routes accept `REVIEWER_OTP` only for that same identity.',
      '',
      'An authenticated request to any path that is not listed returns `{ endpoint, method, status: "success" }` inside the envelope. State is kept in memory and resets when the process restarts.',
    ].join('\n'),
  },
  servers: [
    { url: '/v1', description: 'Prefix used by the mobile app' },
    { url: '/', description: 'Same routes without the version prefix' },
  ],
  tags: [
    { name: 'Health', description: 'Process liveness. Not an API-envelope response.' },
    { name: 'Auth', description: 'Password and refresh-token sessions.' },
    { name: 'KYC', description: 'Reviewer onboarding. Public routes.' },
    { name: 'OTP', description: 'Reviewer one-time passwords. Public routes.' },
    { name: 'Account', description: 'Staff savings account for the signed-in reviewer.' },
    { name: 'Transactions', description: 'Statement lines and transfer history held in memory.' },
    { name: 'Transfers', description: 'Limits and in-memory transfers. Signatures are not verified.' },
    { name: 'DDAC', description: 'Direct debit types, providers, and transfers.' },
    {
      name: 'Beneficiaries',
      description: 'In-memory beneficiary book. The list is nested at `payload.payload`.',
    },
    { name: 'Customers', description: 'Account name lookup.' },
    {
      name: 'Devices',
      description: 'Device profile and HMAC-SHA256 signing keys. Request signatures are not checked.',
    },
    { name: 'Notifications', description: 'In-memory alerts.' },
    {
      name: 'PIN',
      description: 'In-memory PIN state. Request bodies are accepted and ignored. Verify always succeeds.',
    },
    {
      name: 'Service requests',
      description: 'Creates a request id. Created requests are not stored; the list stays empty.',
    },
    { name: 'Indemnity', description: 'Static reviewer indemnity copy.' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token from `POST /oauth/token`. Refresh tokens are rejected.',
      },
    },
    parameters: {
      Page: {
        name: 'page',
        in: 'query',
        schema: { type: 'integer', minimum: 0, example: 0 },
        description: 'Accepted and ignored. The full list is returned.',
      },
      Size: {
        name: 'size',
        in: 'query',
        schema: { type: 'integer', minimum: 1, example: 32 },
        description: 'Accepted and ignored. The full list is returned.',
      },
    },
    responses: {
      InvalidGrant: {
        description: 'Identity, password, OTP, or bearer token was rejected.',
        content: {
          'application/json': {
            schema: ref('ErrorEnvelope'),
            example: {
              success: false,
              message: 'invalid_grant',
              error: 'invalid_grant',
            },
          },
        },
      },
      NotFound: {
        description: 'No beneficiary exists with this id.',
        content: {
          'application/json': {
            schema: ref('ErrorEnvelope'),
            example: {
              success: false,
              message: 'Beneficiary not found',
              error: 'Beneficiary not found',
            },
          },
        },
      },
    },
    schemas: {
      ErrorEnvelope: {
        type: 'object',
        required: ['success', 'message', 'error'],
        properties: {
          success: { type: 'boolean', enum: [false] },
          message: { type: 'string', example: 'invalid_grant' },
          error: { type: 'string', example: 'invalid_grant' },
        },
      },
      SuccessEnvelope: {
        type: 'object',
        required: ['success', 'message', 'payload'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          message: { type: 'string', example: 'Request successful' },
          payload: { type: 'object' },
        },
      },
      TokenRequest: {
        type: 'object',
        required: ['grant_type'],
        properties: {
          grant_type: {
            type: 'string',
            enum: ['password', 'refresh_token'],
            description: '`password` logs in. `refresh_token` exchanges a refresh token.',
          },
          username: {
            type: 'string',
            description: 'Reviewer email or phone. Used for the password grant. `email` is an alias.',
            example: 'review@boz.zm',
          },
          email: { type: 'string', description: 'Alias of `username` for the password grant.' },
          password: {
            type: 'string',
            format: 'password',
            description: 'Must match `REVIEWER_PASSWORD` for the password grant.',
          },
          refresh_token: {
            type: 'string',
            description: 'Required for the refresh grant. Must be a refresh token, not an access token.',
          },
          deviceId: { type: 'string', description: 'Accepted and ignored.' },
        },
      },
      Session: {
        type: 'object',
        required: ['access_token', 'refresh_token', 'expires_in', 'refresh_expires_in', 'session_state'],
        properties: {
          access_token: { type: 'string' },
          refresh_token: { type: 'string' },
          expires_in: { type: 'integer', example: 86400, description: 'Access token lifetime in seconds.' },
          refresh_expires_in: {
            type: 'integer',
            example: 604800,
            description: 'Refresh token lifetime in seconds.',
          },
          session_state: { type: 'string', example: 'mock_session_1710000000000' },
        },
      },
      ReviewerContact: {
        type: 'object',
        properties: {
          email: { type: 'string', example: 'review@boz.zm' },
          phoneNumber: { type: 'string', example: '+260770828570' },
        },
        description: 'At least one of `email` or `phoneNumber` must be the reviewer identity.',
      },
      KycSubmitRequest: {
        allOf: [
          ref('ReviewerContact'),
          {
            type: 'object',
            properties: {
              staffNumber: {
                type: 'string',
                example: '1000',
                description:
                  'Matches `REVIEWER_STAFF_NUMBER`. Enough on its own when email and phone are omitted.',
              },
            },
          },
        ],
      },
      OtpVerifyRequest: {
        allOf: [
          ref('ReviewerContact'),
          {
            type: 'object',
            properties: {
              otp: {
                type: 'string',
                example: '0000',
                description: 'Must match `REVIEWER_OTP`.',
              },
              oneTimePassword: { type: 'string', description: 'Alias of `otp`.' },
              identifier: {
                type: 'string',
                description: 'Reviewer email or phone, used when email and phoneNumber are omitted.',
              },
            },
          },
        ],
      },
      OtpChallenge: {
        type: 'object',
        required: ['success', 'validForSeconds', 'identifier', 'message'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          validForSeconds: { type: 'integer', example: 180 },
          identifier: { type: 'string', example: 'r***@boz.zm', description: 'Masked email or phone.' },
          message: { type: 'string', example: 'OTP sent successfully' },
        },
      },
      KycSubmission: {
        type: 'object',
        required: ['registrationReferenceKey', 'otpResponse'],
        properties: {
          registrationReferenceKey: { type: 'string', example: 'mock_registration_reference_key' },
          otpResponse: ref('OtpChallenge'),
        },
      },
      OtpVerification: {
        type: 'object',
        required: ['verified', 'message'],
        properties: {
          verified: { type: 'boolean', enum: [true] },
          message: { type: 'string', example: 'OTP verification successful' },
        },
      },
      OnboardingState: {
        type: 'object',
        required: ['accountStatus', 'mode'],
        properties: {
          accountStatus: { type: 'string', enum: ['ACTIVE', 'UNKNOWN'] },
          mode: { type: 'string', enum: ['FULLY_ONBOARDED', 'NOT_STARTED'] },
        },
      },
      Account: {
        type: 'object',
        required: [
          'id',
          'accountNumber',
          'customerName',
          'balance',
          'availableBalance',
          'currency',
          'accountType',
        ],
        properties: {
          id: { type: 'string', example: 'reviewer-account' },
          accountNumber: { type: 'string', example: '0012062080023' },
          customerName: { type: 'string', example: 'Test User' },
          balance: { type: 'number', example: 10000.5 },
          availableBalance: { type: 'number', example: 10000.5 },
          currency: { type: 'string', example: 'ZMW' },
          accountType: { type: 'string', example: 'STAFF SAVINGS' },
        },
      },
      StatementRow: {
        type: 'object',
        properties: {
          valueDate: { type: 'string', format: 'date-time' },
          bookingDateRaw: { type: 'string', format: 'date-time' },
          reference: { type: 'string', example: 'TXN1' },
          description: { type: 'string', example: 'Test Transaction 1' },
          debit: { type: 'number', example: 100.5 },
          credit: { type: 'number', example: 0 },
          runningBalance: { type: 'number', example: 10000.5 },
          creditRecord: { type: 'boolean', example: false },
        },
      },
      TransferRecord: {
        type: 'object',
        properties: {
          coreTransactionId: { type: 'string', example: 'FT1001' },
          reference: { type: 'string', example: 'FT1001' },
          fromAccountNumber: { type: 'string' },
          toAccountNumber: { type: 'string' },
          beneficiaryName: { type: 'string' },
          bankName: { type: 'string' },
          branchName: { type: 'string' },
          amount: { type: 'number', example: 100.5 },
          currency: { type: 'string', example: 'ZMW' },
          type: { type: 'string', enum: ['DEBIT', 'CREDIT'] },
          status: { type: 'string', example: 'COMPLETED' },
          narration: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Branch: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          branchCode: { type: 'string', example: '020001' },
          branchName: { type: 'string', example: 'HEAD OFFICE' },
          bankCode: { type: 'string', example: '02' },
          mappedBankName: { type: 'string' },
          active: { type: 'boolean', example: true },
        },
      },
      Bank: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          bankCode: { type: 'string', example: '02' },
          bankName: { type: 'string', example: 'ABSA BANK ZAMBIA PLC' },
          shortName: { type: 'string', example: 'ABSA' },
          swiftCode: { type: 'string', example: 'BARCZMXXXX' },
          routingNumber: { type: 'string', example: '020000' },
          shortCode: { type: 'string', example: '02' },
          branches: { type: 'array', items: ref('Branch') },
        },
      },
      TransferLimits: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '1' },
          accountId: { type: 'string', example: '0012062080023' },
          transferThreshold: { type: 'number', example: 100000 },
          dailyLimit: { type: 'number', example: 100000 },
          monthlyLimit: { type: 'number', example: 120000 },
          minTransferAmount: { type: 'number', example: 100 },
          maxTransferAmount: { type: 'number', example: 10000 },
        },
      },
      TransferTypeLimit: {
        type: 'object',
        properties: {
          transferType: { type: 'string', enum: ['INTRA', 'INTER', 'DDAC'] },
          minTransferAmount: { type: 'number', example: 1 },
          maxTransferAmount: { type: 'number', example: 500000 },
        },
      },
      TransferGuard: {
        type: 'object',
        required: ['open'],
        properties: {
          open: { type: 'boolean', example: true },
        },
      },
      TransferRequest: {
        type: 'object',
        properties: {
          amount: {
            type: 'number',
            example: 100.5,
            description: 'Debited from the in-memory balance when greater than zero.',
          },
          beneficiaryAccountNumber: { type: 'string', example: '1234567890' },
          toAccountNumber: {
            type: 'string',
            description: 'Used when `beneficiaryAccountNumber` is omitted.',
          },
          beneficiaryName: { type: 'string', example: 'Test Beneficiary 1' },
          bankName: { type: 'string' },
          branchName: { type: 'string' },
          narration: { type: 'string', example: 'Test transfer' },
        },
      },
      TransferResult: {
        type: 'object',
        properties: {
          transactionId: { type: 'string', example: 'FT1710000000000' },
          status: { type: 'string', example: 'COMPLETED' },
          message: { type: 'string', example: '' },
          success: { type: 'boolean', enum: [true] },
          isSuccess: { type: 'boolean', enum: [true] },
          amount: { type: 'number', example: 100.5 },
        },
      },
      DdacType: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'ddac-type-1' },
          name: { type: 'string', example: 'Salary' },
          code: { type: 'string', example: 'SALARY' },
        },
      },
      ServiceProvider: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'provider-1' },
          name: { type: 'string', example: 'Reviewer Provider' },
          code: { type: 'string', example: 'REVIEWER' },
        },
      },
      Beneficiary: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '1' },
          accountNumber: { type: 'string', example: '1234567890' },
          accountName: { type: 'string', example: 'Test Beneficiary 1' },
          nickname: { type: 'string', example: 'Test' },
          bankId: { type: 'string' },
          bankName: { type: 'string' },
          branchId: { type: 'string' },
          branchName: { type: 'string' },
          internalAccount: { type: 'boolean', example: false },
        },
      },
      BeneficiaryWrite: {
        type: 'object',
        properties: {
          accountNumber: { type: 'string', example: '1234567890' },
          accountName: { type: 'string', example: 'Test Beneficiary 1' },
          nickname: { type: 'string', example: 'Test' },
          bankId: { type: 'string' },
          bankName: { type: 'string' },
          branchId: { type: 'string' },
          branchName: { type: 'string' },
          internalAccount: { type: 'boolean', example: false },
        },
      },
      AccountLookupRequest: {
        type: 'object',
        properties: {
          accountNumber: {
            type: 'string',
            example: '0012062080023',
            description:
              'The reviewer account number resolves as an internal Core Banking account. Any other number resolves as the first fixture bank.',
          },
        },
      },
      CustomerLookup: {
        type: 'object',
        properties: {
          accountNumber: { type: 'string' },
          accountName: { type: 'string', example: 'Test User' },
          bankId: { type: 'string' },
          bankName: { type: 'string', example: 'Core Banking' },
          branchId: { type: 'string' },
          branchName: { type: 'string', example: 'HEAD OFFICE' },
          internalAccount: { type: 'boolean' },
        },
      },
      DeviceInfo: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          platform: { type: 'string', example: 'android' },
          model: { type: 'string', example: 'Reviewer device' },
          osVersion: { type: 'string', example: '14' },
          fingerPrint: { type: 'string', example: 'reviewer' },
          status: { type: 'string', example: 'ACTIVE' },
        },
      },
      SigningKey: {
        type: 'object',
        properties: {
          deviceId: { type: 'string' },
          keyId: { type: 'string', example: 'key-device-1' },
          algorithm: { type: 'string', example: 'HMAC-SHA256' },
          secretBase64: { type: 'string', description: '32 random bytes, base64-encoded.' },
        },
      },
      Notification: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'notif-001' },
          title: { type: 'string', example: 'Login Alert' },
          subtitle: { type: 'string' },
          type: { type: 'string', example: 'security' },
          isRead: { type: 'boolean', example: false },
          createdAt: { type: 'string', format: 'date-time' },
          amount: { type: 'string', example: '+ZMW 500.50', description: 'Present on payment alerts.' },
          isPositive: { type: 'boolean', description: 'Present on payment alerts.' },
        },
      },
      PinStatus: {
        type: 'object',
        properties: {
          configured: { type: 'boolean', example: true },
          status: { type: 'string', enum: ['ACTIVE', 'LOCKED'] },
          locked: { type: 'boolean', example: false },
          lockedUntil: { type: 'string', format: 'date-time', nullable: true, example: null },
          pinVersion: { type: 'integer', example: 1 },
        },
      },
      PinVerification: {
        type: 'object',
        properties: {
          verified: { type: 'boolean', enum: [true] },
          pinVersion: { type: 'integer', example: 1 },
        },
      },
      PinRecovery: {
        type: 'object',
        properties: {
          success: { type: 'boolean', enum: [true] },
          identifier: { type: 'string', example: 'r***@boz.zm' },
          validForSeconds: { type: 'integer', example: 180 },
          message: { type: 'string', example: 'Recovery code sent' },
        },
      },
      StatusPayload: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', example: 'success' },
        },
      },
      StatementQueued: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'success' },
          message: { type: 'string', example: 'Statement queued' },
        },
      },
      ServiceRequest: {
        type: 'object',
        required: ['id', 'status'],
        description: 'The request body is copied onto this object. Nothing is stored.',
        properties: {
          id: { type: 'string', example: 'sr-1710000000000' },
          status: { type: 'string', example: 'OPEN' },
        },
        additionalProperties: true,
      },
      ServiceRequestBody: {
        type: 'object',
        additionalProperties: true,
        description: 'Any JSON object. Fields are echoed on the created request and then discarded.',
        example: { type: 'GENERAL', narration: 'Reviewer request' },
      },
      Indemnity: {
        type: 'object',
        properties: {
          title: { type: 'string', example: 'Indemnity' },
          body: { type: 'string', example: 'Reviewer mock indemnity text.' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': {
      get: op('health', 'Liveness', {
        tags: ['Health'],
        description: 'Returns 200 when the process is up. This route is not mounted under `/v1`.',
        servers: [{ url: '/', description: 'Server root' }],
        ...publicAccess,
        responses: {
          200: {
            description: 'Process is up',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status'],
                  properties: { status: { type: 'string', example: 'ok' } },
                },
              },
            },
          },
        },
      }),
    },
    '/oauth/token': {
      post: op('issueToken', 'Issue an access token', {
        tags: ['Auth'],
        description: [
          'Password grant: `username` or `email` is the reviewer email or phone, and `password` matches `REVIEWER_PASSWORD`. Otherwise 401 `invalid_grant`.',
          'Refresh grant: `refresh_token` is a refresh token from an earlier login. An access token or any other value returns 401 `invalid_grant`.',
          'Accepts JSON or form-urlencoded bodies.',
        ].join('\n'),
        ...publicAccess,
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: ref('TokenRequest') },
            'application/x-www-form-urlencoded': { schema: ref('TokenRequest') },
          },
        },
        responses: {
          200: ok('Session issued', ref('Session'), 'Login successful'),
          401: invalidGrant,
        },
      }),
    },
    '/oauth/logout': {
      post: op('logout', 'Log out', {
        tags: ['Auth'],
        description: 'Always succeeds. The access token is not revoked.',
        ...publicAccess,
        responses: {
          200: ok('Logged out', ref('StatusPayload'), 'Logged out'),
        },
      }),
    },
    '/kyc/submit': {
      post: op('submitKyc', 'Submit KYC', {
        tags: ['KYC'],
        description:
          'Accepts the reviewer email, phone, or staff number. Any other identity returns 400 `invalid_grant`.',
        ...publicAccess,
        requestBody: jsonBody(ref('KycSubmitRequest')),
        responses: {
          200: ok('KYC accepted', ref('KycSubmission'), 'KYC submitted successfully'),
          400: invalidGrant,
        },
      }),
    },
    '/kyc/onboarding/state': {
      get: op('getOnboardingState', 'Read onboarding state', {
        tags: ['KYC'],
        description:
          'The reviewer email returns `ACTIVE` / `FULLY_ONBOARDED`. Any other value, including a missing email, returns `UNKNOWN` / `NOT_STARTED` with HTTP 200.',
        ...publicAccess,
        parameters: [
          {
            name: 'email',
            in: 'query',
            schema: { type: 'string', example: 'review@boz.zm' },
            description: 'Reviewer email.',
          },
        ],
        responses: {
          200: ok('Onboarding state', ref('OnboardingState')),
        },
      }),
    },
    '/kyc/complete': {
      post: op('completeKyc', 'Complete KYC', {
        ...verifyOtp,
        tags: ['KYC', 'OTP'],
        description: `${verifyOtp.description} Completing KYC uses this same check.`,
      }),
    },
    '/verification/email': {
      post: op('generateEmailOtp', 'Generate an email OTP', generateOtp),
    },
    '/verification/email/verify': {
      post: op('verifyEmailOtp', 'Verify an email OTP', verifyOtp),
    },
    '/otp/generate': {
      post: op('generateOtp', 'Generate an OTP', generateOtp),
    },
    '/otp/generate-token': {
      post: op('generateOtpToken', 'Generate an OTP token', generateOtp),
    },
    '/otp/verify': {
      post: op('verifyOtp', 'Verify an OTP', verifyOtp),
    },
    '/account': {
      get: op('getAccount', 'Get the staff account', {
        tags: ['Account'],
        responses: {
          200: ok('Current in-memory account', ref('Account')),
          ...unauthorized,
        },
      }),
    },
    '/transactions': {
      get: op('listTransactions', 'List statement lines', {
        tags: ['Transactions'],
        description: 'Two fixed statement rows. `runningBalance` follows the current in-memory balance.',
        responses: {
          200: ok('Statement lines', {
            type: 'object',
            required: ['transactions', 'total'],
            properties: {
              transactions: { type: 'array', items: ref('StatementRow') },
              total: { type: 'integer', example: 2 },
            },
          }),
          ...unauthorized,
        },
      }),
    },
    '/transactions/history': {
      get: op('listTransferHistory', 'List transfer history', {
        tags: ['Transactions'],
        parameters: pageParams,
        responses: {
          200: ok('Transfer history, newest first', {
            type: 'object',
            required: ['items', 'total'],
            properties: {
              items: { type: 'array', items: ref('TransferRecord') },
              total: { type: 'integer', example: 2 },
            },
          }),
          ...unauthorized,
        },
      }),
    },
    '/transactions/statement/pdf': {
      get: op('queueStatementPdf', 'Queue a statement PDF', {
        tags: ['Transactions'],
        description: 'Acknowledges the request. No PDF is generated.',
        responses: {
          200: ok('Statement queued', ref('StatementQueued')),
          ...unauthorized,
        },
      }),
    },
    '/banks': {
      get: op('listBanks', 'List banks', {
        tags: ['Transfers'],
        parameters: pageParams,
        responses: {
          200: ok('Fixture banks and branches', {
            type: 'object',
            required: ['items'],
            properties: { items: { type: 'array', items: ref('Bank') } },
          }),
          ...unauthorized,
        },
      }),
    },
    '/transfer-limits': {
      get: op('getTransferLimits', 'Get account transfer limits', {
        tags: ['Transfers'],
        responses: {
          200: ok('Account limits', ref('TransferLimits')),
          ...unauthorized,
        },
      }),
    },
    '/transfer-limits/type-limits': {
      get: op('getTransferTypeLimits', 'Get limits by transfer type', {
        tags: ['Transfers'],
        responses: {
          200: ok('Per-type limits', {
            type: 'object',
            required: ['items'],
            properties: { items: { type: 'array', items: ref('TransferTypeLimit') } },
          }),
          ...unauthorized,
        },
      }),
    },
    '/transfers/guard-open': {
      get: op('getTransferGuard', 'Check whether transfers are open', {
        tags: ['Transfers'],
        responses: {
          200: ok('Transfers are open', ref('TransferGuard')),
          ...unauthorized,
        },
      }),
    },
    '/transfers/intra': {
      post: op('createIntraTransfer', 'Create an internal transfer', recordTransfer),
    },
    '/transfers/inter': {
      post: op('createInterTransfer', 'Create an external transfer', recordTransfer),
    },
    '/ddac/transfer': {
      post: op('createDdacTransfer', 'Create a DDAC transfer', {
        ...recordTransfer,
        tags: ['Transfers', 'DDAC'],
      }),
    },
    '/ddac/types': {
      get: op('listDdacTypes', 'List DDAC types', {
        tags: ['DDAC'],
        responses: {
          200: ok('DDAC types', {
            type: 'object',
            required: ['items'],
            properties: { items: { type: 'array', items: ref('DdacType') } },
          }),
          ...unauthorized,
        },
      }),
    },
    '/ddac/providers': {
      get: op('listDdacProviders', 'List DDAC providers', {
        tags: ['DDAC'],
        responses: {
          200: ok('Service providers', {
            type: 'object',
            required: ['items'],
            properties: { items: { type: 'array', items: ref('ServiceProvider') } },
          }),
          ...unauthorized,
        },
      }),
    },
    '/beneficiaries': {
      get: op('listBeneficiaries', 'List beneficiaries', {
        tags: ['Beneficiaries'],
        description: 'The beneficiary array is at `payload.payload`, which is what the mobile client reads.',
        responses: {
          200: ok('Saved beneficiaries', {
            type: 'object',
            required: ['payload'],
            properties: {
              payload: { type: 'array', items: ref('Beneficiary') },
            },
          }),
          ...unauthorized,
        },
      }),
      post: op('createBeneficiary', 'Create a beneficiary', {
        tags: ['Beneficiaries'],
        requestBody: jsonBody(ref('BeneficiaryWrite')),
        responses: {
          200: ok('Beneficiary saved', ref('Beneficiary')),
          ...unauthorized,
        },
      }),
    },
    '/beneficiaries/{id}': {
      put: op('updateBeneficiary', 'Update a beneficiary', {
        tags: ['Beneficiaries'],
        description: 'Merges the body onto the saved beneficiary. The path id is kept.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: jsonBody(ref('BeneficiaryWrite')),
        responses: {
          200: ok('Beneficiary updated', ref('Beneficiary')),
          404: notFound,
          ...unauthorized,
        },
      }),
      delete: op('deleteBeneficiary', 'Delete a beneficiary', {
        tags: ['Beneficiaries'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: ok('Beneficiary deleted', ref('StatusPayload')),
          404: notFound,
          ...unauthorized,
        },
      }),
    },
    '/customer/lookup': {
      post: op('lookupCustomer', 'Look up an account', {
        tags: ['Customers'],
        requestBody: jsonBody(ref('AccountLookupRequest')),
        responses: {
          200: ok('Account name resolved', ref('CustomerLookup')),
          ...unauthorized,
        },
      }),
    },
    '/devices/info': {
      get: op('getDeviceInfo', 'Get device info', {
        tags: ['Devices'],
        responses: {
          200: ok('Reviewer device', ref('DeviceInfo')),
          ...unauthorized,
        },
      }),
    },
    '/devices/{deviceId}/signing-key': {
      get: op('getSigningKey', 'Get the device signing key', {
        tags: ['Devices'],
        description: 'Creates a key for this device on first read and returns the same key until it is rotated.',
        parameters: [
          { name: 'deviceId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: ok('Signing key', ref('SigningKey')),
          ...unauthorized,
        },
      }),
    },
    '/devices/{deviceId}/signing-key/rotate': {
      post: op('rotateSigningKey', 'Rotate the device signing key', {
        tags: ['Devices'],
        parameters: [
          { name: 'deviceId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: ok('New signing key', ref('SigningKey')),
          ...unauthorized,
        },
      }),
    },
    '/notifications': {
      get: op('listNotifications', 'List notifications', {
        tags: ['Notifications'],
        responses: {
          200: ok('Notifications', {
            type: 'object',
            required: ['items'],
            properties: { items: { type: 'array', items: ref('Notification') } },
          }),
          ...unauthorized,
        },
      }),
    },
    '/notifications/read-all': {
      put: op('markAllNotificationsRead', 'Mark every notification read', {
        tags: ['Notifications'],
        responses: {
          200: ok('All notifications marked read', ref('StatusPayload'), 'Notification updated'),
          ...unauthorized,
        },
      }),
    },
    '/notifications/{id}/read': {
      put: op('markNotificationRead', 'Mark a notification read', {
        tags: ['Notifications'],
        description: 'An unknown id still returns success.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', example: 'notif-001' } },
        ],
        responses: {
          200: ok('Notification marked read', ref('StatusPayload'), 'Notification updated'),
          ...unauthorized,
        },
      }),
    },
    '/pin/status': {
      get: op('getPinStatus', 'Get PIN status', {
        tags: ['PIN'],
        responses: {
          200: ok('PIN status', ref('PinStatus')),
          ...unauthorized,
        },
      }),
    },
    '/pin/setup': {
      post: op('setupPin', 'Set up a PIN', {
        tags: ['PIN'],
        description: 'Marks the PIN configured and increments `pinVersion`. The body is ignored.',
        responses: {
          200: ok('PIN configured', ref('PinVerification')),
          ...unauthorized,
        },
      }),
    },
    '/pin/verify': {
      post: op('verifyPin', 'Verify the PIN', {
        tags: ['PIN'],
        description: 'Always returns verified. The body is ignored.',
        responses: {
          200: ok('PIN accepted', ref('PinVerification')),
          ...unauthorized,
        },
      }),
    },
    '/pin/change': {
      post: op('changePin', 'Change the PIN', {
        tags: ['PIN'],
        description: 'Increments `pinVersion`. The body is ignored.',
        responses: {
          200: ok('PIN changed', ref('PinVerification')),
          ...unauthorized,
        },
      }),
    },
    '/pin/forgot': {
      post: op('forgotPin', 'Start PIN recovery', {
        tags: ['PIN'],
        description: 'Returns a masked reviewer email. No message is sent. The body is ignored.',
        responses: {
          200: ok('Recovery challenge', ref('PinRecovery')),
          ...unauthorized,
        },
      }),
    },
    '/pin/reset': {
      post: op('resetPin', 'Reset the PIN', {
        tags: ['PIN'],
        description: 'Clears the lock and increments `pinVersion`. The body is ignored.',
        responses: {
          200: ok('PIN reset', ref('PinVerification')),
          ...unauthorized,
        },
      }),
    },
    '/service-requests': {
      get: op('listServiceRequests', 'List service requests', {
        tags: ['Service requests'],
        description: 'Always an empty list. Created requests are not stored.',
        responses: {
          200: ok('No stored service requests', {
            type: 'object',
            required: ['items'],
            properties: { items: { type: 'array', items: ref('ServiceRequest'), maxItems: 0 } },
          }),
          ...unauthorized,
        },
      }),
      post: op('createServiceRequest', 'Create a service request', {
        tags: ['Service requests'],
        requestBody: jsonBody(ref('ServiceRequestBody')),
        responses: {
          200: ok('Request accepted and discarded', ref('ServiceRequest')),
          ...unauthorized,
        },
      }),
    },
    '/indemnity': {
      get: op('getIndemnity', 'Get the indemnity text', {
        tags: ['Indemnity'],
        responses: {
          200: ok('Indemnity copy', ref('Indemnity')),
          ...unauthorized,
        },
      }),
    },
  },
};
