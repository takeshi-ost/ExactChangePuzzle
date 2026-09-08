// Run with: node tests/run-logic.cjs
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = {textContent:''};
const context = vm.createContext({document:{getElementById:()=>output}});
for (const file of ['wallet-config.js','products.js','game.js']) {
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'), context, {filename:file});
}
const html = fs.readFileSync(path.join(__dirname,'test.html'),'utf8');
const logic = html.match(/<script>([\s\S]*?)<\/script>/)[1];
vm.runInContext(logic, context, {filename:'test.html (logic)'});
vm.runInContext(fs.readFileSync(path.join(__dirname,'growth-tests.js'),'utf8'), context, {filename:'growth-tests.js'});
console.log(output.textContent);
const result = vm.runInContext('({passed,totalTests})',context);
console.log(`${result.passed}/${result.totalTests} logic tests passed`);
process.exitCode = result.passed === result.totalTests ? 0 : 1;
