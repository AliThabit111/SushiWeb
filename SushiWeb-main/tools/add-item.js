#!/usr/bin/env node
/**
 * add-item.js — إضافة / تعديل / حذف صنف في مكان واحد.
 *
 * بيعدّل الملفين مع بعض عشان مايحصلش اختلاف بين اللي العميل يشوفه
 * واللي السيرفر يسجله:
 *    1) includes-assets/js/app.js        → MENU (العرض والسعر للعميل)
 *    2) google-apps-script-code.gs       → SERVER_ITEMS (السعر المعتمد)
 *
 * أمثلة:
 *   node tools/add-item.js --id r10 --name "Salmon Roll" --price 15 --cat rolls \
 *        --desc "أرز السوشي – ورق نوري – سلمون" --img includes-assets/images/Cal.jpg
 *
 *   node tools/add-item.js --list
 *   node tools/add-item.js --id r10 --price 17           (تعديل السعر)
 *   node tools/add-item.js --id r10 --delete
 *
 * التصنيفات: noodles | rolls | burgers | sauces | signature
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'includes-assets', 'js', 'app.js');
const GS = path.join(ROOT, 'google-apps-script-code.gs');

/* ---------- قراءة الأرجومنتس ---------- */
const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].slice(0, 2) === '--') {
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.slice(0, 2) === '--') opt[key] = true;
    else { opt[key] = next; i++; }
  }
}

const CATS = {
  noodles: 'نودلز', rolls: 'سوشي رولز', burgers: 'سوشي برجر',
  sauces: 'الصوصات والمقبلات', signature: 'SIGNATURE (الكروت الفاخرة)'
};

function die(msg) { console.error('\n❌ ' + msg + '\n'); process.exit(1); }

function help() {
  console.log(`
إضافة صنف جديد
──────────────────────────────────────────────────────────
  node tools/add-item.js --id <معرّف> --name "<الاسم>" --price <السعر> \\
       --cat <التصنيف> [--desc "<الوصف>"] [--img <مسار الصورة>]

  التصنيفات المتاحة:
${Object.entries(CATS).map(([k, v]) => '    ' + k.padEnd(11) + v).join('\n')}

عمليات تانية
──────────────────────────────────────────────────────────
  --list                    عرض كل الأصناف الحالية
  --id X --price 20         تعديل سعر صنف موجود
  --id X --name "اسم جديد"  تعديل الاسم
  --id X --delete           حذف صنف

ملاحظات
──────────────────────────────────────────────────────────
  • المعرّف (id) لازم يكون فريد. الأنماط المستخدمة:
      n=نودلز  r=رولز  b=برجر  s=صوصات  z=signature
  • بعد أي تعديل: ارفع app.js على GitHub + انشر الإسكربت
    (Deploy → Manage deployments → ✏️ → New version → Deploy)
  • الصنف مش هيتقبل على السيرفر غير بعد النشر — لو نسيت،
    الطلب هيترفض برسالة واضحة بدل ما يتسجل بإجمالي ناقص.
`);
}

/* ---------- استخراج الأصناف الحالية ---------- */
function extractBlock(src, name) {
  const m = new RegExp('(?:const|var|let)\\s+' + name + '\\s*=\\s*').exec(src);
  if (!m) die('لم أجد ' + name);
  const open = src.indexOf(name === 'SERVER_ITEMS' ? '{' : '[', m.index + m[0].length - 1);
  const openCh = src[open], closeCh = openCh === '[' ? ']' : '}';
  let depth = 0, end = -1;
  for (let j = open; j < src.length; j++) {
    if (src[j] === openCh) depth++;
    else if (src[j] === closeCh) { depth--; if (depth === 0) { end = j; break; } }
  }
  return { start: open, end, text: src.slice(open, end + 1) };
}

function loadCatalog() {
  const app = fs.readFileSync(APP, 'utf8');
  const gs = fs.readFileSync(GS, 'utf8');
  const MENU = vm.runInNewContext('(' + extractBlock(app, 'MENU').text + ')');
  const SIG = vm.runInNewContext('(' + extractBlock(app, 'SIGNATURE_ITEMS').text + ')');
  const SERVER = vm.runInNewContext('(' + extractBlock(gs, 'SERVER_ITEMS').text + ')');
  return { app, gs, MENU, SIG, SERVER };
}

function allFrontItems(MENU, SIG) {
  const out = [];
  MENU.forEach(c => c.items.forEach(i => out.push(Object.assign({ cat: c.key }, i))));
  SIG.forEach(i => out.push(Object.assign({ cat: 'signature' }, i)));
  return out;
}

/* ---------- عرض القائمة ---------- */
if (opt.list) {
  const { MENU, SIG, SERVER } = loadCatalog();
  const items = allFrontItems(MENU, SIG);
  console.log('\n  الأصناف الحالية (' + items.length + ')');
  console.log('  ' + '─'.repeat(72));
  let lastCat = '';
  for (const it of items) {
    if (it.cat !== lastCat) {
      console.log('\n  ▸ ' + (CATS[it.cat] || it.cat));
      lastCat = it.cat;
    }
    const s = SERVER[it.id];
    let flag = '';
    if (!s) flag = '  ⚠ مش على السيرفر';
    else if (s.price !== it.price) flag = `  ⚠ السعر مختلف (سيرفر: ${s.price})`;
    else if (s.name !== it.name) flag = '  ⚠ الاسم مختلف';
    console.log('    ' + it.id.padEnd(5) + String(it.price).padStart(4) + ' ج.م   ' + it.name + flag);
  }
  const orphans = Object.keys(SERVER).filter(id => !items.some(i => i.id === id));
  if (orphans.length) console.log('\n  ⚠ على السيرفر بس مش معروضة: ' + orphans.join(', '));
  console.log('');
  process.exit(0);
}

if (opt.help || !opt.id) { help(); process.exit(opt.id ? 0 : 1); }

/* ---------- التحقق ---------- */
const id = String(opt.id).trim();
if (!/^[a-z][a-z0-9_]{0,15}$/i.test(id)) die('المعرّف لازم حروف وأرقام إنجليزية فقط (مثال: r10)');

let { app, gs, MENU, SIG, SERVER } = loadCatalog();
const existing = allFrontItems(MENU, SIG).find(i => i.id === id);

/* ---------- حذف ---------- */
if (opt.delete) {
  if (!existing) die('الصنف "' + id + '" غير موجود');
  const reFront = new RegExp('^\\s*\\{\\s*id:\\s*"' + id + '".*\\},?\\s*$\\n?', 'm');
  if (!reFront.test(app)) die('مش قادر أحدد سطر الصنف في app.js — عدّله يدوي');
  app = app.replace(reFront, '');
  const reGs = new RegExp('^\\s*"' + id + '":\\s*\\{[^}]*\\},?\\s*$\\n?', 'm');
  gs = gs.replace(reGs, '');
  // لو الصنف كان الأخير في SERVER_ITEMS، شيل الكومة الزايدة من السطر اللي قبله
  gs = gs.replace(/,(\s*\n\s*)\};/, '$1};');
  fs.writeFileSync(APP, app, 'utf8');
  fs.writeFileSync(GS, gs, 'utf8');
  console.log('\n🗑️  اتحذف: ' + id + ' — ' + existing.name);
  if (existing.cat === 'signature') {
    console.log('   ⚠ الكارت بتاعه لسه في index.html — امسحه يدوي (ابحث عن ctrl-' + id + ')');
  }
} else if (existing) {
  /* ---------- تعديل ---------- */
  const changes = [];
  const newPrice = opt.price !== undefined ? parseInt(opt.price, 10) : existing.price;
  const newName = opt.name !== undefined ? String(opt.name) : existing.name;
  if (opt.price !== undefined) {
    if (!(newPrice > 0)) die('السعر لازم رقم أكبر من صفر');
    if (newPrice !== existing.price) changes.push(`السعر: ${existing.price} → ${newPrice}`);
  }
  if (opt.name !== undefined && newName !== existing.name) changes.push(`الاسم: ${existing.name} → ${newName}`);
  if (!changes.length) die('مفيش تغيير مطلوب. استخدم --price أو --name أو --delete');

  const reLine = new RegExp('(\\{\\s*id:\\s*"' + id + '"[^\\n]*?)\\}', 'm');
  const mLine = reLine.exec(app);
  if (!mLine) die('مش قادر أحدد سطر الصنف في app.js');
  let line = mLine[1];
  line = line.replace(/name:\s*"(?:[^"\\]|\\.)*"/, 'name:"' + newName.replace(/"/g, '\\"') + '"');
  line = line.replace(/price:\s*\d+/, 'price:' + newPrice);
  app = app.slice(0, mLine.index) + line + '}' + app.slice(mLine.index + mLine[0].length);

  const reGs = new RegExp('("' + id + '":\\s*\\{)[^}]*(\\})');
  if (!reGs.test(gs)) die('مش قادر ألاقي الصنف في SERVER_ITEMS');
  gs = gs.replace(reGs, '$1 price: ' + newPrice + ', name: "' + newName.replace(/"/g, '\\"') + '" $2');

  fs.writeFileSync(APP, app, 'utf8');
  fs.writeFileSync(GS, gs, 'utf8');
  console.log('\n✏️  اتعدّل: ' + id);
  changes.forEach(c => console.log('   • ' + c));
  if (existing.cat === 'signature') {
    console.log('   ⚠ الكارت في index.html فيه السعر مكتوب يدوي — حدّثه (ابحث عن ctrl-' + id + ')');
  }
} else {
  /* ---------- إضافة ---------- */
  if (!opt.name) die('محتاج --name');
  if (opt.price === undefined) die('محتاج --price');
  const price = parseInt(opt.price, 10);
  if (!(price > 0)) die('السعر لازم رقم أكبر من صفر');
  const cat = String(opt.cat || '').trim();
  if (!CATS[cat]) die('--cat لازم يكون واحد من: ' + Object.keys(CATS).join(' | '));

  const name = String(opt.name);
  const desc = String(opt.desc || '');
  let img = String(opt.img || '');
  if (img) {
    img = img.replace(/\\/g, '/');
    if (!fs.existsSync(path.join(ROOT, img))) {
      console.log('\n⚠️  الصورة "' + img + '" غير موجودة — الكارت هيظهر بدون صورة.');
      console.log('   حطّ الصورة في includes-assets/images/ وشغّل الأمر تاني.');
    }
  }

  const esc = s => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const entry = `    {id:"${id}", name:"${esc(name)}", desc:"${esc(desc)}", price:${price}, img:"${esc(img)}"},`;

  if (cat === 'signature') {
    const blk = extractBlock(app, 'SIGNATURE_ITEMS');
    const lastLine = blk.text.lastIndexOf('\n');
    app = app.slice(0, blk.start + lastLine) + '\n' + entry.trimStart().padStart(0) +
          app.slice(blk.start + lastLine);
    app = app.replace(entry.trimStart(), '  ' + entry.trimStart());
  } else {
    // ندخل قبل السطر "]}," الخاص بالتصنيف المطلوب
    const reCat = new RegExp('(\\{key:"' + cat + '"[\\s\\S]*?)(\\n\\s*\\]\\},)');
    const m = reCat.exec(app);
    if (!m) die('مش قادر ألاقي تصنيف "' + cat + '" في MENU');
    app = app.slice(0, m.index) + m[1] + '\n' + entry + m[2] + app.slice(m.index + m[0].length);
  }

  // SERVER_ITEMS: نضيف قبل القوس الأخير
  const gsBlk = extractBlock(gs, 'SERVER_ITEMS');
  const inner = gsBlk.text.slice(1, -1).replace(/\s+$/, '');
  const newInner = inner + ',\n  "' + id + '": { price: ' + price + ', name: "' + esc(name) + '" }\n';
  gs = gs.slice(0, gsBlk.start) + '{' + newInner + '}' + gs.slice(gsBlk.end + 1);

  fs.writeFileSync(APP, app, 'utf8');
  fs.writeFileSync(GS, gs, 'utf8');

  console.log('\n✅ اتضاف: ' + id + ' — ' + name + ' — ' + price + ' ج.م  (' + CATS[cat] + ')');
  if (cat === 'signature') {
    console.log('\n⚠️  أصناف signature كروتها مكتوبة يدوي في index.html.');
    console.log('   انسخ كارت موجود (ابحث عن ctrl-z1) وغيّر: الاسم، الوصف، السعر، الصورة،');
    console.log('   و addItem(\'' + id + '\') و id="ctrl-' + id + '".');
  }
}

/* ---------- تحقق تلقائي ---------- */
console.log('\n🔍 جاري التحقق...');
try {
  execFileSync(process.execPath, ['--check', APP], { stdio: 'pipe' });
  console.log('  ✓ app.js سليم');
} catch (e) { die('app.js فيه خطأ syntax:\n' + (e.stderr || '')); }

const tmp = path.join(require('os').tmpdir(), 'gs-check-' + Date.now() + '.js');
fs.copyFileSync(GS, tmp);
try {
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
  console.log('  ✓ google-apps-script-code.gs سليم');
} catch (e) { die('الإسكربت فيه خطأ syntax:\n' + (e.stderr || '')); }
finally { try { fs.unlinkSync(tmp); } catch (e) {} }

try {
  execFileSync(process.execPath, [path.join(ROOT, 'tests', 'run-all.js')], { stdio: 'pipe' });
  console.log('  ✓ كل الاختبارات نجحت (الأسعار متطابقة بين الموقع والسيرفر)');
} catch (e) {
  console.log('\n' + (e.stdout || '').toString());
  die('فيه اختبارات فشلت — راجع الناتج فوق');
}

console.log(`
📤 الخطوات الباقية:
   1) ارفع  includes-assets/js/app.js  على GitHub${opt.delete || !CATS[String(opt.cat)] ? '' : ''}
   2) الصق  google-apps-script-code.gs  في code.gs
   3) Deploy → Manage deployments → ✏️ → New version → Deploy
   4) للتأكد:  npm run check:live
`);
