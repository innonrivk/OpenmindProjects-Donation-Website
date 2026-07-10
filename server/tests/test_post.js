async function test() {
  const TEST_PORT = '3002';
  const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

  console.log('Logging in admin...');
  const loginRes = await fetch(`${BASE_URL}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@openmindprojects.org',
      password: process.env.SEED_ADMIN_PASSWORD || '12345678',
    }),
  });

  const loginData = await loginRes.json();
  const token = loginData.accessToken;
  console.log('Admin token retrieved:', token ? 'YES' : 'NO');

  if (!token) return;

  console.log('Sending POST template request...');
  const res = await fetch(`${BASE_URL}/admin/communications/templates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: `Manual Post Test ${Date.now()}`,
      subject: 'Subject',
      bodyHtml: '<p>Body</p>',
    }),
  });

  console.log('Response status:', res.status);
  const data = await res.json();
  console.log('Response data:', data);
}

test();
