/**
 * Test corrected sort syntax
 */

const API_KEY = 'c9aa49f9b94dfc8b6bc88299f4dffad7f179618c';
const WORKSPACE_ID = 's3qnmox1';
const PROJECTS_TABLE_ID = '68a8ff5237fde0bf797c05b3';

async function testCorrectedSort() {
  console.log('Testing corrected sort syntax...\n');

  try {
    const response = await fetch(`https://app.smartsuite.com/api/v1/applications/${PROJECTS_TABLE_ID}/records/list/`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${API_KEY}`,
        'ACCOUNT-ID': WORKSPACE_ID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sort: [{ field: 'title', direction: 'asc' }]  // CORRECTED: use "field" not "field_id"
      })
    });

    console.log('Status:', response.status, response.statusText);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ SUCCESS with corrected sort!');
      console.log('Total records:', data.items?.length || 0);

      if (data.items && data.items.length > 0) {
        console.log('\nFirst 3 projects:');
        data.items.slice(0, 3).forEach((project, i) => {
          console.log(`${i + 1}. ${project.title} (${project.eavcode}) - ${project.client_filter}`);
        });
      }
    } else {
      const errorText = await response.text();
      console.log('❌ FAILED:', errorText);
    }

  } catch (error) {
    console.log('💥 ERROR:', error.message);
  }
}

testCorrectedSort().catch(console.error);