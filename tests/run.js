'use strict';

const testFiles = [
  { name: 'State Machine', path: './test_state_machine.js' },
  { name: 'Data Validation', path: './test_data_validation.js' },
  { name: 'Date Utils', path: './test_date_utils.js' },
  { name: 'Save Prevention', path: './test_save_prevention.js' },
];

let totalPassed = 0;
let totalFailed = 0;
const failures = [];

for (const file of testFiles) {
  console.log(`\n--- ${file.name} (${file.path}) ---`);

  let tests;
  try {
    tests = require(file.path);
  } catch (e) {
    console.log(`  LOAD ERROR: ${e.message}`);
    totalFailed++;
    failures.push({ suite: file.name, test: '(load)', error: e.message });
    continue;
  }

  for (const t of tests) {
    try {
      t.fn();
      console.log(`  PASS: ${t.name}`);
      totalPassed++;
    } catch (e) {
      console.log(`  FAIL: ${t.name}`);
      console.log(`        ${e.message}`);
      totalFailed++;
      failures.push({ suite: file.name, test: t.name, error: e.message });
    }
  }
}

console.log(`\n========================================`);
console.log(`Results: ${totalPassed} passed, ${totalFailed} failed, ${totalPassed + totalFailed} total`);

if (failures.length > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) {
    console.log(`  [${f.suite}] ${f.test}: ${f.error}`);
  }
  process.exit(1);
} else {
  console.log(`\nAll tests passed!`);
  process.exit(0);
}
