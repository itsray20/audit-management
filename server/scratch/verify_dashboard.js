const http = require('http');

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, {
      headers: {
        'x-user-role': 'Admin'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP Error ${res.statusCode}: ${data}`));
          } else {
            resolve(JSON.parse(data));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function verify() {
  try {
    const url = `http://localhost:5055/api/audits/24/dashboard`;
    console.log(`Trying URL: ${url}`);
    const metrics = await getJSON(url);
    console.log('--- RECEIVED METRICS FROM LOCAL SERVER (PORT 5055) ---');
    console.log('Total Stock Value:', metrics.totalStockValue);
    console.log('Total Excess Value:', metrics.totalExcessValue);
    console.log('Total Shortage Value:', metrics.totalShortageValue);
    console.log('Extra Found Value:', metrics.extraFoundValue || metrics.extraFoundVal);
    console.log('Net Audit Variance:', metrics.netAuditDifference);
    console.log('Total Perfect Match:', metrics.totalPerfectMatchValue);
    console.log('Total System Expiry:', metrics.totalSystemExpiryValue);
    console.log('Total Physical Expiry:', metrics.totalPhysicalExpiryValue);
  } catch (err) {
    console.log(`Failed for port 5055: ${err.message}`);
  }
}

verify();
