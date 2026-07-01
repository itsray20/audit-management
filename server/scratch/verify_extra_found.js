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
    // 1. Dashboard Metrics check
    let url = `http://localhost:5055/api/audits/24/dashboard`;
    let metrics = await getJSON(url);
    console.log('--- RECEIVED METRICS FROM LOCAL SERVER (PORT 5055) ---');
    console.log('Extra Found Value:', metrics.extraFoundValue);
    console.log('Extra Found Qty:', metrics.extraFoundQty);
    console.log('Total Physical Expiry:', metrics.totalPhysicalExpiryValue);

    // 2. Extra Found Filter check
    url = `http://localhost:5055/api/audits/24/items?page=1&limit=5&filter=Extra%20Found`;
    let res = await getJSON(url);
    console.log('\n--- EXTRA FOUND ITEMS ---');
    res.items.forEach(i => console.log(`ID: ${i.id}, Name: ${i.item_name}, Qty: ${i.totalPhysical}, Rate: ${i.unit_purchase_rate}, Category: ${i.category}`));

  } catch (err) {
    console.error('Failed to verify:', err.message);
  }
}

verify();
