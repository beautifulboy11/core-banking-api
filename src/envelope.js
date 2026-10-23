export function ok(payload, message = 'Request successful') {
  return {
    success: true,
    message,
    payload,
  };
}

export function fail(res, status, message) {
  return res.status(status).json({
    success: false,
    message,
    error: message,
  });
}
