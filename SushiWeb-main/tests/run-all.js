/** يشغّل كل الاختبارات ويطبع ملخص واحد */
const { execFileSync } = require('child_process');
const path = require('path');

const suites = [
  ['catalog', 'تطابق الأسعار والمناطق بين الموقع والسيرفر'],
  ['gas', 'منطق الباك إند (Apps Script) بمحاكي كامل'],
  ['app', 'منطق الواجهة (الطابور/الكوبون/الأدمن)'],
  ['html', 'سلامة index.html والملفات والـ PWA']
];

let total = 0, failed = 0;
const results = [];

for (const [name, desc] of suites) {
  const file = path.join(__dirname, name + '.test.js');
  let out = '', ok = true;
  try {
    out = execFileSync(process.execPath, [file], { encoding: 'utf8' });
  } catch (e) {
    ok = false;
    out = (e.stdout || '') + (e.stderr || '');
  }
  const m = /النتيجة:\s*(\d+)\s*ناجح\s*\/\s*(\d+)\s*فاشل/.exec(out);
  const p = m ? +m[1] : 0, f = m ? +m[2] : 1;
  total += p + f;
  failed += f;
  results.push({ name, desc, p, f, ok, out });
  if (!ok || f) console.log(out);
}

console.log('\n' + '═'.repeat(60));
console.log('  ملخص اختبارات TOKYO SUSHI');
console.log('═'.repeat(60));
for (const r of results) {
  const icon = r.f === 0 && r.ok ? '✅' : '❌';
  console.log(`  ${icon} ${r.name.padEnd(9)} ${String(r.p).padStart(3)} ناجح  ${r.f} فاشل   ${r.desc}`);
}
console.log('─'.repeat(60));
console.log(`  الإجمالي: ${total - failed}/${total} فحص ناجح`);
console.log('═'.repeat(60));
process.exit(failed ? 1 : 0);
