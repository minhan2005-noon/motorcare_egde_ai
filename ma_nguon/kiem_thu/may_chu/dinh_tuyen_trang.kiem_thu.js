const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../../may_chu/ung_dung');
const authService = require('../../may_chu/dich_vu/xac_thuc.dich_vu');
const appConfig = require('../../may_chu/cau_hinh/ung_dung.cau_hinh');

async function withServer(callback) {
  const server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const address = server.address();
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('opening the application link always starts at the main login page', async () => {
  const registration = await authService.register({
    email: `page-route-${Date.now()}@example.com`,
    name: 'Page Route Test',
    password: 'Secret123!',
  });
  const cookie = `${appConfig.sessionCookieName}=${registration.token}`;

  await withServer(async (baseUrl) => {
    const rootResponse = await fetch(`${baseUrl}/`, {
      headers: { cookie },
      redirect: 'manual',
    });
    assert.equal(rootResponse.status, 302);
    assert.equal(rootResponse.headers.get('location'), '/login');

    const loginResponse = await fetch(`${baseUrl}/login`, {
      headers: { cookie },
      redirect: 'manual',
    });
    assert.equal(loginResponse.status, 200);
    assert.match(await loginResponse.text(), /id="loginForm"/);

    const dashboardResponse = await fetch(`${baseUrl}/dashboard`, {
      redirect: 'manual',
    });
    assert.equal(dashboardResponse.status, 302);
    assert.equal(
      dashboardResponse.headers.get('location'),
      '/login?returnTo=%2Fdashboard',
    );

    const healthResponse = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthResponse.status, 200);
    assert.match(healthResponse.headers.get('cache-control'), /no-store/);
    assert.equal(healthResponse.headers.get('pragma'), 'no-cache');

    const publicViewResponse = await fetch(`${baseUrl}/view/test-public-token`, {
      redirect: 'manual',
    });
    assert.equal(publicViewResponse.status, 200);
    assert.match(await publicViewResponse.text(), /Public live monitor/);
  });
});
