const API_BASE = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL + '/public' : '/api/v1/public';

/**
 * Fetch wrapper with structured error handling.
 * Parses backend JSON error responses and attaches error codes.
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;

  const config = {
    credentials: 'include', // Send HttpOnly cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: 'request_failed' }));
    const err = new Error(errorBody.message || errorBody.error || `HTTP ${response.status}`);
    err.errorCode = errorBody.error || null;
    err.fields = errorBody.fields || null;
    err.status = response.status;
    err.attemptsRemaining = errorBody.attemptsRemaining ?? null;
    throw err;
  }

  return response.json();
}

// ── Content ──
export function getContent() {
  return request('/content');
}

// ── Donations ──
export function createSubscription(data) {
  return request('/donations/subscribe', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function createOneTimeDonation(data) {
  return request('/donations/one-time', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── Auth ──
export function signup(data) {
  return request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function login(data) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function verifyOtp(data) {
  return request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function googleLogin(data) {
  return request('/auth/google', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function logout() {
  return request('/auth/logout', { method: 'POST' });
}

export function getMe() {
  return request('/auth/me');
}

// ── Settings ──
export function requestPasswordOtp() {
  return request('/auth/settings/password-otp', { method: 'POST' });
}

export function changePassword(data) {
  return request('/auth/settings/change-password', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function requestEmailOtp(data) {
  return request('/auth/settings/email-otp', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function changeEmail(data) {
  return request('/auth/settings/change-email', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function changeName(data) {
  return request('/auth/settings/change-name', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── Subscriptions ──
export function updateSubscription(data) {
  return request('/subscriptions/update', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function cancelSubscription() {
  return request('/subscriptions/cancel', { method: 'POST' });
}

export function cancelScheduledSubscription() {
  return request('/subscriptions/cancel-scheduled', { method: 'POST' });
}

/**
 * Manually triggers a mock billing cycle rollover.
 * Restricted to MOCK_MODE only — returns 403 in production.
 * Used by the dev "Simulate Rollover" button and integration tests.
 */
export function simulateRollover() {
  return request('/subscriptions/simulate-rollover', { method: 'POST' });
}

// ── Milestones ──
export function claimMilestone(data) {
  return request('/milestones/claim', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── Danger Zone ──
export function requestDeleteOtp() {
  return request('/auth/settings/delete-otp', { method: 'POST' });
}

export function deleteAccount(data) {
  return request('/auth/settings/delete-account', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function cancelUserTier(tierId) {
  return request(`/subscriptions/tiers/${tierId}`, { method: 'DELETE' });
}

