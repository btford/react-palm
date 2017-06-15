/*
 * This script runs a flow coverage report
 * against react-palm to ensure that for our tests for flow and our
 * library definition work as expected.
 */

const execSync = require('child_process').execSync;
const output = execSync('flow coverage ./test/flow-typedef/tasks.js').toString();

if (!output.includes('Covered: 100.00%')) {
  throw new Error(`Flow coverage failed: \n${output}`);
}

console.log('Flow: 100% Covered!')
