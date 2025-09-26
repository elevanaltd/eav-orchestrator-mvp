/**
 * Direct SmartSuite Projects API Test
 * Test the exact API call being made by our code
 */

const API_KEY = 'c9aa49f9b94dfc8b6bc88299f4dffad7f179618c';
const WORKSPACE_ID = 's3qnmox1';
const PROJECTS_TABLE_ID = '68a8ff5237fde0bf797c05b3';

async function testProjectsAPI() {
  console.log('Testing Projects API...\n');
  console.log('Table ID:', PROJECTS_TABLE_ID);
  console.log('Workspace:', WORKSPACE_ID);

  try {
    // Test 1: Simple records list (minimal request)
    console.log('\n=== Test 1: Minimal Request ===');
    const response1 = await fetch(`https://app.smartsuite.com/api/v1/applications/${PROJECTS_TABLE_ID}/records/list/`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${API_KEY}`,
        'ACCOUNT-ID': WORKSPACE_ID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    console.log('Status:', response1.status, response1.statusText);

    if (response1.ok) {
      const data1 = await response1.json();
      console.log('✅ SUCCESS!');
      console.log('Total records:', data1.items?.length || 0);
      if (data1.items && data1.items.length > 0) {
        console.log('First record fields:', Object.keys(data1.items[0]));
        console.log('Sample record:', JSON.stringify(data1.items[0], null, 2));
      }
    } else {
      const errorText1 = await response1.text();
      console.log('❌ FAILED:', errorText1);
    }

    // Test 2: With sort (our current request)
    console.log('\n=== Test 2: With Sort (Current Request) ===');
    const response2 = await fetch(`https://app.smartsuite.com/api/v1/applications/${PROJECTS_TABLE_ID}/records/list/`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${API_KEY}`,
        'ACCOUNT-ID': WORKSPACE_ID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sort: [{ field_id: 'title', direction: 'asc' }]
      })
    });

    console.log('Status:', response2.status, response2.statusText);

    if (response2.ok) {
      const data2 = await response2.json();
      console.log('✅ SUCCESS with sort!');
      console.log('Total records:', data2.items?.length || 0);
    } else {
      const errorText2 = await response2.text();
      console.log('❌ FAILED with sort:', errorText2);
    }

    // Test 3: Check table structure first
    console.log('\n=== Test 3: Table Structure ===');
    const response3 = await fetch(`https://app.smartsuite.com/api/v1/applications/${PROJECTS_TABLE_ID}/`, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${API_KEY}`,
        'ACCOUNT-ID': WORKSPACE_ID,
        'Content-Type': 'application/json'
      }
    });

    console.log('Status:', response3.status, response3.statusText);

    if (response3.ok) {
      const structure = await response3.json();
      console.log('✅ Table structure retrieved');
      console.log('Table name:', structure.name);
      console.log('Field count:', structure.structure?.length || 0);

      if (structure.structure) {
        console.log('\nField names:');
        structure.structure.forEach(field => {
          console.log(`- ${field.slug} (${field.field_type}): "${field.label}"`);
        });
      }
    } else {
      const errorText3 = await response3.text();
      console.log('❌ FAILED to get structure:', errorText3);
    }

  } catch (error) {
    console.log('💥 ERROR:', error.message);
  }
}

testProjectsAPI().catch(console.error);