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
    // 1. Default sorting (should be by id ascending)
    let url = `http://localhost:5055/api/audits/24/items?page=1&limit=5`;
    let res = await getJSON(url);
    console.log('--- DEFAULT SORTING (by id asc) ---');
    res.items.forEach(i => console.log(`ID: ${i.id}, Name: ${i.item_name}, Batch: ${i.batch_no}`));

    // 2. Sorting by item_name ascending
    url = `http://localhost:5055/api/audits/24/items?page=1&limit=5&sortBy=item_name&sortOrder=asc`;
    res = await getJSON(url);
    console.log('\n--- SORT BY item_name ASC ---');
    res.items.forEach(i => console.log(`ID: ${i.id}, Name: ${i.item_name}`));

    // 3. Sorting by differenceValue descending
    url = `http://localhost:5055/api/audits/24/items?page=1&limit=5&sortBy=differenceValue&sortOrder=desc`;
    res = await getJSON(url);
    console.log('\n--- SORT BY differenceValue DESC ---');
    res.items.forEach(i => console.log(`ID: ${i.id}, Name: ${i.item_name}, Diff Value: ${i.differenceValue}`));

    // 4. Verification of sorted columns
    url = `http://localhost:5055/api/audits/24/members`;
    const members = await getJSON(url);
    console.log('\n--- MEMBERS COLUMNS SORTED ---');
    members.forEach(m => console.log(`ID/Name: ${m.user_name}, Role: ${m.user_role}, Virtual: ${!!m.is_virtual}`));

  } catch (err) {
    console.error('Failed to verify:', err.message);
  }
}

verify();
