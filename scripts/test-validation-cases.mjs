import dotenv from 'dotenv';
dotenv.config();

const prodBase = 'https://aidsportal.vercel.app';

async function testCases() {
  console.log('Authenticating as faculty...');
  const loginRes = await fetch(`${prodBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'tamil1234@gmail.com',
      password: 'aids@avs',
      role: 'FACULTY'
    })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-portal-role': 'FACULTY'
  };

  const testRows = [
    // 1. Valid row
    {
      'Register Number': '620125243146',
      'Student Name': 'SARAN S',
      'Subject Code': 'CS25C08',
      'Marks': 88
    },
    // 2. Invalid Register Number
    {
      'Register Number': 'INVALID_REG_9999',
      'Student Name': 'Someone',
      'Subject Code': 'CS25C08',
      'Marks': 75
    },
    // 3. Incorrect Student Name
    {
      'Register Number': '620125243146',
      'Student Name': 'Wrong Student Name',
      'Subject Code': 'CS25C08',
      'Marks': 80
    },
    // 4. Missing subject mapping (unknown subject code)
    {
      'Register Number': '620125243146',
      'Student Name': 'SARAN S',
      'Subject Code': 'NON_EXISTENT_SUB_999',
      'Marks': 90
    },
    // 5. Invalid marks (negative)
    {
      'Register Number': '620125243146',
      'Student Name': 'SARAN S',
      'Subject Code': 'CS25C08',
      'Marks': -10
    },
    // 6. Invalid marks (> 100)
    {
      'Register Number': '620125243146',
      'Student Name': 'SARAN S',
      'Subject Code': 'CS25C08',
      'Marks': 150
    },
    // 7. Invalid marks (string/non-numeric)
    {
      'Register Number': '620125243146',
      'Student Name': 'SARAN S',
      'Subject Code': 'CS25C08',
      'Marks': 'invalid_mark'
    },
    // 8. Intra-file duplicate row (same reg no & subject code again)
    {
      'Register Number': '620125243146',
      'Student Name': 'SARAN S',
      'Subject Code': 'CS25C08',
      'Marks': 85
    }
  ];

  console.log('\nSending 8 test cases to preview endpoint...');
  const res = await fetch(`${prodBase}/api/faculty/academics/import-preview`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      rows: testRows,
      examType: 'Unit Test 1',
      year: '2nd Year',
      section: 'A'
    })
  });

  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Summary:', data.summary);
  console.log('\nValid rows:');
  console.table(data.validRows);
  console.log('\nInvalid rows:');
  console.table(data.invalidRows);
}

testCases().catch(console.error);
