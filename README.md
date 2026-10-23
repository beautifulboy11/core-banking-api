# Core banking API

Reviewer stand-in for the Core Banking API. It serves the same paths and `{ success, message, payload }` envelope the app already parses. It does not talk to the core banking host, and it must not be used as the production `API_URL`.

Repository: https://github.com/beautifulboy11/core-banking-api

## Run

```bash
cp .env.example .env
# Set REVIEWER_PASSWORD and REVIEWER_OTP in .env
npm install
npm start
```

The process listens on `0.0.0.0:3000`. `GET /health` returns 200. API routes are mounted at `/` and `/v1`, because the app strips a trailing `v1/` when it checks health and keeps it for other calls.

Point a non-production mobile build at this process:

```text
API_URL=http://10.0.2.2:3000/v1/
```

Use `10.0.2.2` from the Android emulator, `localhost` from an iOS simulator on the same machine, and the computer's LAN address from a physical device.

## Docs

Swagger UI is at http://localhost:3000/docs. The OpenAPI document is at http://localhost:3000/openapi.json.

Call `POST /oauth/token`, then use **Authorize** with the `access_token` for routes that require a session.

## Reviewer identity

Login accepts the configured email or phone with `grant_type=password`. OTP routes accept the configured OTP only when the body also carries that email or phone. Other identities receive `401` or `400` with `invalid_grant`.

The password and OTP are environment variables. They are not committed.

## What a logged-in session can do

Account, statement, transfer history, banks, transfer limits, internal and external transfers, DDAC types and providers, beneficiaries, customer lookup, device info, device signing key, notifications, PIN, service requests, and indemnity. A signed request is accepted without checking the signature. The signing-key route still returns an HMAC secret so the app can build the header.

Any other authenticated path returns a success envelope so a screen that calls an unlisted route still opens. Data is kept in memory and resets when the process restarts.

## Test

```bash
npm test
```
