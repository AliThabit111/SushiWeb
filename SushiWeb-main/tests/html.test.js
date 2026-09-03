/**
 * فحص سلامة index.html:
 *  - كل دالة في onclick/onchange موجودة فعلاً في app.js
 *  - كل id بيستخدمه app.js موجود في الـ HTML (للعناصر الحرجة)
 *  - الملفات المرتبطة موجودة على القرص
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'includes-assets', 'js', 'app.js'), 'utf8');
const shader = fs.readFileSync(path.join(root, 'includes-assets', 'js', 'shader.js'), 'utf8');
const allJs = app + '\n' + shader;

let pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}

console.log('\n1) دوال الـ onclick/onchange موجودة');
const handlers = new Set();
const reAttr = /\bon(?:click|change|error|submit|input)\s*=\s*"([^"]*)"/g;
let m;
while ((m = reAttr.exec(html)) !== null) {
  // (^|[^.\w]) عشان نستثني نداءات الميثودز زي e.preventDefault() و this.style
  const re2 = /(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g;
  let f;
  while ((f = re2.exec(m[1])) !== null) handlers.add(f[2]);
}
const builtin = new Set(['alert', 'confirm', 'if', 'this', 'return', 'setTimeout', 'Notification']);
const declared = new Set();
const reFn = /function\s+([A-Za-z_$][\w$]*)\s*\(/g;
while ((m = reFn.exec(allJs)) !== null) declared.add(m[1]);

const missing = [...handlers].filter(h => !builtin.has(h) && !declared.has(h));
check('لقيت ' + handlers.size + ' دالة في الـ HTML', handlers.size > 15, handlers.size);
check('كل دالة معرّفة في app.js', missing.length === 0, missing);
check('serverDiag (الزر الجديد) معرّفة', declared.has('serverDiag'));
check('pingServer معرّفة', declared.has('pingServer'));

console.log('\n2) العناصر الحرجة موجودة في الـ HTML');
const criticalIds = ['couponCode', 'couponMsg', 'custName', 'custPhone', 'custAddress',
  'deliveryZone', 'payMethod', 'custNotes', 'gpsCoords', 'hp_check', 'sendBtn',
  'cartItems', 'drawerFoot', 'checkoutFields', 'subtotalVal', 'deliveryVal', 'discountVal',
  'cartTotal', 'adminOrdersContainer', 'serverStatusNote', 'adminToastContainer',
  'toggleStatusBtn', 'trackTimeRemaining', 'trackOrderId', 'step1', 'step2', 'step3', 'step4',
  'admStatusText', 'admStatusDot', 'admOrdersCount', 'menu-start', 'catNav'];
const missingIds = criticalIds.filter(id => html.indexOf('id="' + id + '"') === -1);
check('كل العناصر اللي app.js بيدور عليها موجودة', missingIds.length === 0, missingIds);

console.log('\n3) الملفات المرتبطة موجودة');
const refs = [];
const reSrc = /(?:src|href)="(?!https?:|data:|#|mailto:)([^"]+)"/g;
while ((m = reSrc.exec(html)) !== null) refs.push(m[1]);
const missingFiles = refs.filter(r => !fs.existsSync(path.join(root, r.split('?')[0])));
check('كل الملفات المحلية موجودة (' + refs.length + ' مرجع)', missingFiles.length === 0, missingFiles);

console.log('\n4) صور القائمة موجودة');
const imgs = [];
const reImg = /img:\s*"([^"]+)"/g;
while ((m = reImg.exec(app)) !== null) imgs.push(m[1]);
const missingImgs = imgs.filter(i => i && !fs.existsSync(path.join(root, i)));
check('كل صور الأصناف موجودة (' + imgs.length + ' صورة)', missingImgs.length === 0, missingImgs);

console.log('\n5) الـ manifest');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest', 'manifest.json'), 'utf8'));
const mDir = path.join(root, 'manifest');
check('start_url بيوصل لملف موجود', fs.existsSync(path.resolve(mDir, manifest.start_url)), manifest.start_url);
const badIcons = manifest.icons.filter(i => !fs.existsSync(path.resolve(mDir, i.src)));
check('كل أيقونات الـ PWA موجودة', badIcons.length === 0, badIcons.map(i => i.src));
check('فيه أيقونة maskable (مطلوبة لأندرويد)', manifest.icons.some(i => i.purpose === 'maskable'));

console.log('\n6) sw.js');
const swExists = fs.existsSync(path.join(root, 'sw.js'));
const swRegisteredActive = /^\s*(?!\/\/)[^\n]*serviceWorker\.register/m.test(app);
check('مفيش تسجيل فعّال لـ sw.js وهو غير موجود', swExists || !swRegisteredActive,
  { swExists, swRegisteredActive });

console.log('\n7) أمان الواجهة');
check('مفيش كلمة مرور الأدمن في index.html', html.indexOf('TokyoAdmin2026') === -1);
check('مفيش كلمة مرور الأدمن في app.js', app.indexOf('TokyoAdmin2026') === -1);
check('مفيش مفاتيح Firebase', app.indexOf('firebaseio.com') === -1 && html.indexOf('firebaseio.com') === -1);
check('lang/dir مضبوطين للعربي', /<html[^>]+lang="ar"/.test(html) && /<html[^>]+dir="rtl"/.test(html));
check('charset UTF-8 معلن', /<meta\s+charset="UTF-8"/i.test(html));

console.log('\n8) إمكانية الوصول (a11y) للأزرار الأساسية');
const iconOnlyNoLabel = [];
const reBtn = /<button\b[^>]*>(\s*<i\b[^>]*><\/i>\s*)<\/button>/g;
while ((m = reBtn.exec(html)) !== null) {
  const tag = m[0];
  if (tag.indexOf('aria-label') === -1 && tag.indexOf('title') === -1) iconOnlyNoLabel.push(tag.slice(0, 90));
}
check('الأزرار الأيقونية ليها aria-label أو title', iconOnlyNoLabel.length === 0, iconOnlyNoLabel);

console.log('\n' + '='.repeat(52));
console.log(`النتيجة: ${pass} ناجح / ${fail} فاشل`);
console.log('='.repeat(52));
process.exit(fail ? 1 : 0);
