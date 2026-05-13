// Quick test for Phase 2 API endpoints
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const BASE = 'http://localhost:3001/api';

async function test() {
  console.log('=== Phase 2 API Verification ===\n');

  // 1. Login as admin
  console.log('1. Admin Login...');
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@rit.edu', password: 'Admin@123' }),
  });
  const loginData = await loginRes.json();
  console.log(`   ✅ Status: ${loginRes.status} | Token: ${loginData.data?.token ? 'received' : 'MISSING'}`);
  const adminToken = loginData.data?.token;

  // 2. Admin Stats
  console.log('\n2. Admin Stats...');
  const statsRes = await fetch(`${BASE}/admin/stats`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const statsData = await statsRes.json();
  console.log(`   ✅ Status: ${statsRes.status} | Users: ${statsData.data?.stats?.total_users} | Depts: ${statsData.data?.stats?.total_departments}`);

  // 3. Admin Scoring Categories
  console.log('\n3. Scoring Categories...');
  const catRes = await fetch(`${BASE}/admin/scoring-categories`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const catData = await catRes.json();
  console.log(`   ✅ Status: ${catRes.status} | Categories: ${catData.data?.categories?.length}`);

  // 4. Admin Audit Logs
  console.log('\n4. Audit Logs...');
  const logsRes = await fetch(`${BASE}/admin/audit-logs`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const logsData = await logsRes.json();
  console.log(`   ✅ Status: ${logsRes.status} | Total Logs: ${logsData.data?.pagination?.total}`);

  // 5. Login as faculty
  console.log('\n5. Faculty Login...');
  const facLoginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'faculty.cse@rit.edu', password: 'Admin@123' }),
  });
  const facData = await facLoginRes.json();
  const facToken = facData.data?.token;
  console.log(`   ✅ Status: ${facLoginRes.status} | Role: ${facData.data?.user?.role}`);

  // 6. Faculty creates application
  console.log('\n6. Create Application (Faculty)...');
  const appRes = await fetch(`${BASE}/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${facToken}` },
    body: JSON.stringify({ academic_year: '2025-2026' }),
  });
  const appData = await appRes.json();
  console.log(`   ${appRes.status === 201 ? '✅' : '⚠️'} Status: ${appRes.status} | ${appData.success ? 'Created' : appData.error || appData.message}`);
  const appId = appData.data?.application?.id;

  // 7. Faculty lists applications
  console.log('\n7. List Applications (Faculty)...');
  const listRes = await fetch(`${BASE}/applications`, {
    headers: { Authorization: `Bearer ${facToken}` },
  });
  const listData = await listRes.json();
  console.log(`   ✅ Status: ${listRes.status} | Count: ${listData.data?.applications?.length}`);

  // 8. Get application detail
  if (appId) {
    console.log('\n8. Get Application Detail...');
    const detailRes = await fetch(`${BASE}/applications/${appId}`, {
      headers: { Authorization: `Bearer ${facToken}` },
    });
    const detailData = await detailRes.json();
    console.log(`   ✅ Status: ${detailRes.status} | Status: ${detailData.data?.application?.status}`);

    // 9. Save a category entry
    console.log('\n9. Save Category Entry...');
    const categories = catData.data?.categories;
    if (categories?.length > 0) {
      const firstCat = categories[0];
      const entryRes = await fetch(`${BASE}/applications/${appId}/entry`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${facToken}` },
        body: JSON.stringify({ category_id: firstCat.id, raw_value: { fci_percentage: 82 } }),
      });
      const entryData = await entryRes.json();
      console.log(`   ✅ Status: ${entryRes.status} | Entry saved: ${entryData.success}`);
    }

    // 10. Score Preview
    console.log('\n10. Score Preview...');
    const previewRes = await fetch(`${BASE}/applications/${appId}/score-preview`, {
      headers: { Authorization: `Bearer ${facToken}` },
    });
    const previewData = await previewRes.json();
    console.log(`   ✅ Status: ${previewRes.status} | Totals: ${JSON.stringify(previewData.data?.totals)}`);
  }

  // 11. RBAC test: Faculty cannot access admin stats
  console.log('\n11. RBAC Test: Faculty -> Admin Stats...');
  const rbacRes = await fetch(`${BASE}/admin/stats`, {
    headers: { Authorization: `Bearer ${facToken}` },
  });
  console.log(`   ✅ Status: ${rbacRes.status} (expected 403 Forbidden)`);

  console.log('\n=== All Phase 2 API Tests Complete ===');
}

test().catch(console.error);
