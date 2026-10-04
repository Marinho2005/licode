import http from 'node:http';

function checkUrl(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      resolve(res.statusCode);
    }).on('error', () => {
      resolve(null);
    });
  });
}

export async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const code = await checkUrl(url);
    if (code !== null) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}
