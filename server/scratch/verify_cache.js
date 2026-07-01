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
    const url = `http://127.0.0.1:5055/api/audits/24/items?page=1&limit=5`;
    
    console.log('Hitting first time (should be slow, database fetch)...');
    const start1 = Date.now();
    await getJSON(url);
    const end1 = Date.now();
    console.log(`First hit took: ${end1 - start1}ms`);

    console.log('\nHitting second time (should be fast, cache hit)...');
    const start2 = Date.now();
    await getJSON(url);
    const end2 = Date.now();
    console.log(`Second hit took: ${end2 - start2}ms`);

    console.log('\nHitting third time with filter (should be fast, cache hit)...');
    const start3 = Date.now();
    await getJSON(`${url}&filter=Shortage`);
    const end3 = Date.now();
    console.log(`Third hit (filtered) took: ${end3 - start3}ms`);

  } catch (err) {
    console.error('Failed to verify:', err.message);
  }
}

verify();
