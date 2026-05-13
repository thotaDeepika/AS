const BASE = 'http://localhost:3001/api';

async function test() {
  // Login as faculty
  const login = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'faculty.cse@rit.edu', password: 'Admin@123' }),
  });
  const loginData = await login.json();
  const token = loginData.data?.token;
  console.log('Login:', login.status, token ? 'OK' : 'FAIL');

  // Test categories
  console.log('\nTesting GET /applications/categories/list...');
  const catRes = await fetch(`${BASE}/applications/categories/list`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Categories status:', catRes.status);
  const catData = await catRes.json();
  console.log('Categories:', catData.success ? `${catData.data.categories?.length} found` : catData.error);

  // Test create application
  console.log('\nTesting POST /applications...');
  const appRes = await fetch(`${BASE}/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ academic_year: '2026-2027' }),
  });
  console.log('Create status:', appRes.status);
  const appData = await appRes.json();
  console.log('Create result:', appData.success ? appData.data.application.id : appData.error || appData.message);

  // List applications
  console.log('\nTesting GET /applications...');
  const listRes = await fetch(`${BASE}/applications`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('List status:', listRes.status);
  const listData = await listRes.json();
  console.log('Applications:', listData.data?.applications?.length);
}

test().catch(console.error);
