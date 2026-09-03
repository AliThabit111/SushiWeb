/**
 * تطابق الكتالوج بين الواجهة (app.js) والسيرفر (google-apps-script-code.gs).
 * أي اختلاف في سعر صنف أو رسوم منطقة = العميل يشوف رقم والشيت يسجل رقم تاني.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const appSrc = fs.readFileSync(path.join(root, 'includes-assets', 'js', 'app.js'), 'utf8');
const gsSrc = fs.readFileSync(path.join(root, 'google-apps-script-code.gs'), 'utf8');

/* ---------- استخراج الكتالوج من الواجهة ---------- */
function grab(src, name, kind) {
  const re = new RegExp('(?:const|var|let)\\s+' + name + '\\s*=\\s*', 'g');
  const m = re.exec(src);
  if (!m) throw new Error('لم أجد ' + name);
  const open = kind === 'array' ? '[' : '{';
  const close = kind === 'array' ? ']' : '}';
  let i = src.indexOf(open, m.index), depth = 0, end = -1;
  for (let j = i; j < src.length; j++) {
    if (src[j] === open) depth++;
    else if (src[j] === close) { depth--; if (depth === 0) { end = j; break; } }
  }
  return vm.runInNewContext('(' + src.slice(i, end + 1) + ')');
}

const MENU = grab(appSrc, 'MENU', 'array');
const SIGNATURE = grab(appSrc, 'SIGNATURE_ITEMS', 'array');
const ZONES = grab(appSrc, 'DELIVERY_ZONES', 'array');
const SERVER_ITEMS = grab(gsSrc, 'SERVER_ITEMS', 'object');
const SERVER_FEES = grab(gsSrc, 'SERVER_DELIVERY_FEES', 'object');

let pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + (extra !== undefined ? '  → ' + JSON.stringify(extra, null, 0) : '')); }
}

console.log('\n1) أصناف الواجهة موجودة في السيرفر بنفس السعر');
const frontItems = [];
MENU.forEach(c => c.items.forEach(i => frontItems.push(i)));
SIGNATURE.forEach(i => frontItems.push(i));

const missing = frontItems.filter(i => !SERVER_ITEMS[i.id]);
check('كل صنف في القائمة له سعر على السيرفر', missing.length === 0, missing.map(i => i.id));

const priceMismatch = frontItems
  .filter(i => SERVER_ITEMS[i.id] && SERVER_ITEMS[i.id].price !== i.price)
  .map(i => ({ id: i.id, front: i.price, server: SERVER_ITEMS[i.id].price }));
check('الأسعار متطابقة', priceMismatch.length === 0, priceMismatch);

console.log('\n2) أصناف السيرفر كلها معروضة في الواجهة');
const frontIds = frontItems.map(i => i.id);
const orphan = Object.keys(SERVER_ITEMS).filter(id => frontIds.indexOf(id) === -1);
check('مفيش أصناف على السيرفر بدون عرض', orphan.length === 0, orphan);
check('عدد الأصناف: ' + frontItems.length, frontItems.length === Object.keys(SERVER_ITEMS).length,
  { front: frontItems.length, server: Object.keys(SERVER_ITEMS).length });

console.log('\n3) مناطق التوصيل');
const zoneMissing = ZONES.filter(z => !(z.name in SERVER_FEES)).map(z => z.name);
check('كل منطقة في القائمة معروفة للسيرفر', zoneMissing.length === 0, zoneMissing);

const feeMismatch = ZONES
  .filter(z => (z.name in SERVER_FEES) && SERVER_FEES[z.name] !== z.fee)
  .map(z => ({ zone: z.name, front: z.fee, server: SERVER_FEES[z.name] }));
check('رسوم التوصيل متطابقة', feeMismatch.length === 0, feeMismatch);

const zoneNames = ZONES.map(z => z.name);
const serverOnlyZones = Object.keys(SERVER_FEES).filter(z => zoneNames.indexOf(z) === -1);
check('مناطق على السيرفر مش معروضة (مسموح): ' + (serverOnlyZones.length || 0), true, serverOnlyZones);

console.log('\n4) أسماء الأصناف — السيرفر هو اللي بيكتبها في الشيت');
const nameMismatch = frontItems
  .filter(i => SERVER_ITEMS[i.id] && SERVER_ITEMS[i.id].name !== i.name)
  .map(i => ({ id: i.id, front: i.name, server: SERVER_ITEMS[i.id].name }));
check('الأسماء متطابقة (الشيت هيطابق اللي العميل شافه)', nameMismatch.length === 0, nameMismatch);

console.log('\n5) الإصدار');
const reqVer = /REQUIRED_SERVER_VERSION\s*=\s*["']([^"']+)/.exec(appSrc);
const gsVer = /SCRIPT_VERSION\s*=\s*["']([^"']+)/.exec(gsSrc);
check('إصدار الواجهة المطلوب = إصدار الإسكربت',
  reqVer && gsVer && reqVer[1] === gsVer[1], { app: reqVer && reqVer[1], gs: gsVer && gsVer[1] });

console.log('\n6) الحالات — أزرار البانل مقبولة على السيرفر');
const allowed = grab(gsSrc, 'ALLOWED_STATUSES', 'array');
const uiStatuses = [];
const reBtn = /setOrderStatusAdmin\('\$\{escapeHTML\(o\.orderId\)\}',\s*'([^']+)'/g;
let mm;
while ((mm = reBtn.exec(appSrc)) !== null) uiStatuses.push(mm[1]);
check('لقيت أزرار الحالة في البانل', uiStatuses.length === 4, uiStatuses);
const badStatus = uiStatuses.filter(s => allowed.indexOf(s) === -1);
check('كل حالة في الأزرار مسموحة على السيرفر', badStatus.length === 0, badStatus);

const trackerHandled = ['تم الاستلام', 'جاري التحضير', 'خرج للتوصيل', 'تم التسليم'];
check('حالات التتبع مغطاة', trackerHandled.every(s => allowed.indexOf(s) > -1));

console.log('\n' + '='.repeat(52));
console.log(`النتيجة: ${pass} ناجح / ${fail} فاشل`);
console.log('='.repeat(52));
process.exit(fail ? 1 : 0);
