const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const comments = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../cashier-comments.js'), 'utf8') + '\nCashierComments;');
for (const [key, count] of Object.entries({normal:20, points:20, exact:20, empty:5})) {
  const list = comments.lines[key];
  assert.equal(list.length, count);
  assert.equal(new Set(list).size, count);
  for (const line of list) assert(line.length >= 7 && line.length <= 14, line);
}
for (const [result, category] of [
  [{earnedEXP:0}, 'normal'],
  [{earnedEXP:3}, 'points'],
  [{exact:true, earnedEXP:3}, 'exact'],
  [{emptied:true, earnedEXP:3}, 'empty'],
  [{emptied:true, exact:true, earnedEXP:3, emptyBonus:0}, 'empty']
]) {
  assert.equal(comments.category(result), category);
  const list = comments.lines[category];
  for (let i = 0; i < list.length; i++) {
    assert.equal(comments.pick(result, () => (i + .5) / list.length), list[i]);
  }
}
console.log('PASS: 65 comments, lengths, reward priority and all random selection slots');
