/**
 * محاكي محلي لـ Google Apps Script — لاختبار منطق الباك إند قبل النشر.
 * بيعمل stub لكل خدمات جوجل المستخدمة (Sheet / Properties / Lock / Mail / Utilities)
 * وينفذ سيناريوهات حقيقية على الكود الأصلي بدون أي تعديل عليه.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GS_PATH = path.join(__dirname, '..', 'google-apps-script-code.gs');
const src = fs.readFileSync(GS_PATH, 'utf8');

/* ---------- Fake Sheet ---------- */
function makeSheet(name, rows) {
  const s = {
    _name: name,
    _rows: rows ? rows.map(r => r.slice()) : [],
    _numFormats: {},
    getName: () => s._name,
    getLastRow: () => s._rows.length,
    getLastColumn: () => (s._rows.length ? s._rows[0].length : 0),
    appendRow: r => { s._rows.push(r.slice()); },
    deleteRow: n => { s._rows.splice(n - 1, 1); },
    deleteRows: (start, count) => { s._rows.splice(start - 1, count); },
    getRange: (row, col, numRows, numCols) => ({
      getValue: () => {
        const r = s._rows[row - 1];
        return r ? r[col - 1] : '';
      },
      setValue: v => {
        while (s._rows.length < row) s._rows.push([]);
        s._rows[row - 1][col - 1] = v;
      },
      getValues: () => {
        const out = [];
        for (let i = 0; i < (numRows || 1); i++) {
          const r = s._rows[row - 1 + i] || [];
          const line = [];
          for (let j = 0; j < (numCols || 1); j++) line.push(r[col - 1 + j]);
          out.push(line);
        }
        return out;
      },
      setNumberFormat: f => { s._numFormats[row + ':' + col] = f; }
    }),
    getParent: () => spreadsheet
  };
  return s;
}

const HEADER = ["التاريخ والوقت","رقم الطلب","حالة الطلب","اسم العميل","رقم الهاتف","العنوان",
  "رابط اللوكيشن GPS","طريقة الدفع","الأصناف المطلوبة","قيمة الخصم","الإجمالي المطلوب","ملاحظات"];

let ordersSheet = makeSheet('Orders', [HEADER]);
let secondSheet = makeSheet('ملاحظات', [['تاب تاني ملوش علاقة بالطلبات']]);
let activeIndex = 1; // مهم: التاب "النشط" هو التاب الغلط — لاختبار عيب getActiveSheet

const spreadsheet = {
  getName: () => 'Tokyo Sushi Orders',
  getId: () => 'FAKE_SHEET_ID',
  getSheets: () => [ordersSheet, secondSheet],
  getActiveSheet: () => spreadsheet.getSheets()[activeIndex],
  getSheetByName: n => spreadsheet.getSheets().find(x => x.getName() === n) || null
};

/* ---------- Fake services ---------- */
const propsStore = {};
const sentEmails = [];
let lockHeld = false;

const sandbox = {
  console,
  SpreadsheetApp: {
    getActiveSpreadsheet: () => spreadsheet,
    openById: () => spreadsheet,
    flush: () => {}
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: k => (k in propsStore ? propsStore[k] : null),
      setProperty: (k, v) => { propsStore[k] = String(v); },
      deleteProperty: k => { delete propsStore[k]; },
      getProperties: () => Object.assign({}, propsStore)
    })
  },
  LockService: {
    getScriptLock: () => ({
      tryLock: () => { if (lockHeld) return false; lockHeld = true; return true; },
      releaseLock: () => { lockHeld = false; }
    })
  },
  MailApp: {
    sendEmail: o => { sentEmails.push(o); },
    getRemainingDailyQuota: () => 97
  },
  ContentService: {
    MimeType: { JSON: 'application/json' },
    createTextOutput: t => ({ _t: t, setMimeType() { return this; }, getContent() { return this._t; } })
  },
  Utilities: {
    formatDate: (d, tz, fmt) => {
      const p = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
             `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    }
  },
  Logger: { log: m => logs.push(String(m)) }
};
const logs = [];
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'google-apps-script-code.gs' });

/* ---------- Test harness ---------- */
const GET = p => JSON.parse(sandbox.doGet({ parameter: p }).getContent());
const POST = p => JSON.parse(sandbox.doPost({ parameter: p, postData: null }).getContent());
const PW = 'TokyoAdmin2026@Secure';

let pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
function section(t) { console.log('\n' + t); }

const cart = JSON.stringify({ r1: { name: 'HACKED', qty: 2 }, r2: { name: 'x', qty: 1 } }); // 11*2+13 = 35

section('1) ping / version');
{
  const r = GET({ action: 'ping' });
  check('ping يرجع success', r.status === 'success', r);
  check('ping فيه version', r.version === '3.0.0', r);
  check('ping بيعلن الميزات', Array.isArray(r.features) && r.features.indexOf('deleteOrder') > -1, r);
}

section('2) الوصول للتاب الصح (مش التاب النشط)');
{
  const r = GET({ action: 'diag', password: PW });
  check('diag شغال', r.status === 'success', r);
  check('اختار تاب Orders مش التاب النشط الغلط', r.sheetName === 'Orders', r.sheetName);
}

section('3) تسجيل طلب — الأسعار من السيرفر');
{
  const r = POST({ orderId: 'TK-AAA111', name: 'علي', phone: '01012345678',
    deliveryZone: 'الساحه', address: 'ش 1', payment: 'كاش عند الاستلام',
    itemsJson: cart, notes: '' });
  check('نجح التسجيل', r.status === 'success', r);
  check('الإجمالي = 35 + 15 توصيل = 50', r.finalTotal === 50, r);
  check('الصف اتكتب في تاب Orders', ordersSheet._rows.length === 2, ordersSheet._rows.length);
  check('التاب التاني ما اتلمسش', secondSheet._rows.length === 1, secondSheet._rows.length);
  const row = ordersSheet._rows[1];
  check('التاريخ بأرقام إنجليزية', /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(row[0]), row[0]);
  check('اسم الصنف من السيرفر مش من العميل (HACKED مرفوض)',
    row[8].indexOf('HACKED') === -1 && row[8].indexOf('California Roll') > -1, row[8]);
  check('الهاتف محفوظ نص بصفره', row[4] === '01012345678', row[4]);
  check('الإيميل اتبعت', sentEmails.length === 1, sentEmails.length);
  check('emailSent=true في الرد', r.emailSent === true, r.emailSent);
}

section('4) idempotency — إعادة إرسال نفس الطلب');
{
  const before = ordersSheet._rows.length;
  const r = POST({ orderId: 'TK-AAA111', name: 'علي', phone: '01012345678',
    deliveryZone: 'الساحه', address: 'ش 1', itemsJson: cart });
  check('رد نجاح مع duplicate=true', r.status === 'success' && r.duplicate === true, r);
  check('مفيش صف مكرر اتضاف', ordersSheet._rows.length === before, ordersSheet._rows.length);
  check('مفيش إيميل تاني اتبعت', sentEmails.length === 1, sentEmails.length);
}

section('5) checkOrder بدون كلمة مرور');
{
  const r = GET({ action: 'checkOrder', orderId: 'TK-AAA111' });
  check('لقى الطلب من غير password', r.status === 'found', r);
  check('رجّع الحالة', r.orderStatus === 'تم الاستلام', r);
  const r2 = GET({ action: 'checkOrder', orderId: 'TK-NOPE' });
  check('طلب غير موجود = not_found', r2.status === 'not_found', r2);
}

section('6) تتبع الطلب بالصيغة القديمة ?orderId=');
{
  const r = GET({ orderId: 'TK-AAA111' });
  check('التوافق مع النسخة القديمة شغال', r.status === 'found' && r.orderStatus === 'تم الاستلام', r);
}

section('7) الكوبون — سيرفر فقط');
{
  const v1 = GET({ action: 'verifyCoupon', code: 'VVIP9', subtotal: '400' });
  check('VVIP9 على 400 = خصم 60 (15%)', v1.status === 'valid' && v1.discount === 60, v1);
  const v2 = GET({ action: 'verifyCoupon', code: 'VVIP9', subtotal: '100' });
  check('أقل من الحد الأدنى = min_not_met', v2.status === 'min_not_met', v2);
  const v3 = GET({ action: 'verifyCoupon', code: 'WRONG', subtotal: '400' });
  check('كود غلط = invalid', v3.status === 'invalid', v3);

  check('الكوبون لسه ما اتحرقش بمجرد الفحص', !('COUPON_USED_VVIP9' in propsStore), propsStore);

  const big = JSON.stringify({ n1: { qty: 2 } }); // 320
  const r = POST({ orderId: 'TK-BBB222', name: 'سارة', phone: '01198765432',
    deliveryZone: 'الجزيره', address: 'ش 2', itemsJson: big, couponCode: 'vvip9' });
  check('الخصم اتحسب على السيرفر = 48', r.discount === 48, r);
  check('الإجمالي = 320-48+35 = 307', r.finalTotal === 307, r);
  check('الكوبون اتحرق بعد نجاح الطلب', propsStore.COUPON_USED_VVIP9 === 'true', propsStore);

  const v4 = GET({ action: 'verifyCoupon', code: 'VVIP9', subtotal: '400' });
  check('بعد الحرق = used', v4.status === 'used', v4);

  const r2 = POST({ orderId: 'TK-CCC333', name: 'محمد', phone: '01234567890',
    deliveryZone: 'الساحه', address: 'ش 3', itemsJson: big, couponCode: 'VVIP9' });
  check('كوبون محروق = مفيش خصم', r2.discount === 0 && r2.finalTotal === 335, r2);

  const n = sandbox.resetCoupons();
  check('resetCoupons صفّرت الكوبون', n === 1 && !('COUPON_USED_VVIP9' in propsStore), propsStore);
}

section('8) الحماية — كلمة مرور غلط');
{
  check('deleteOrder', GET({ action: 'deleteOrder', password: 'BAD', orderId: 'TK-AAA111' }).status === 'unauthorized');
  check('clearOrders', GET({ action: 'clearOrders', password: 'BAD' }).status === 'unauthorized');
  check('getAllOrders', GET({ action: 'getAllOrders', password: 'BAD' }).status === 'unauthorized');
  check('updateStatus', POST({ action: 'updateStatus', password: 'BAD', orderId: 'TK-AAA111', newStatus: 'جاري التحضير' }).status === 'unauthorized');
  check('toggleStore', POST({ action: 'toggleStore', password: 'BAD', state: 'CLOSED' }).status === 'unauthorized');
  check('diag', GET({ action: 'diag', password: 'BAD' }).status === 'unauthorized');
  check('الصفوف لسه موجودة بعد المحاولات الفاشلة', ordersSheet._rows.length === 4, ordersSheet._rows.length);
}

section('9) الحذف — GET و POST');
{
  const r = GET({ action: 'deleteOrder', password: PW, orderId: 'TK-CCC333' });
  check('حذف بـ GET نجح', r.status === 'success' && r.deleted === 'TK-CCC333', r);
  check('الصف اتشال فعلاً', ordersSheet._rows.length === 3, ordersSheet._rows.length);
  check('مش بيرجع {status:found} غلط', r.status !== 'found', r);

  const r2 = POST({ action: 'deleteOrder', password: PW, orderId: 'TK-BBB222' });
  check('حذف بـ POST نجح', r2.status === 'success', r2);
  check('الصفوف = 2', ordersSheet._rows.length === 2, ordersSheet._rows.length);

  const r3 = POST({ action: 'deleteOrder', password: PW, orderId: 'TK-GHOST' });
  check('طلب غير موجود = notfound', r3.status === 'notfound', r3);
  check('الهيدر لسه موجود', ordersSheet._rows[0][1] === 'رقم الطلب', ordersSheet._rows[0]);
}

section('10) updateStatus');
{
  const r = POST({ action: 'updateStatus', password: PW, orderId: 'TK-AAA111', newStatus: 'خرج للتوصيل' });
  check('التحديث نجح', r.status === 'success' && r.result === 'updated', r);
  check('اتكتب في العمود الصح', ordersSheet._rows[1][2] === 'خرج للتوصيل', ordersSheet._rows[1][2]);
  const bad = POST({ action: 'updateStatus', password: PW, orderId: 'TK-AAA111', newStatus: '=CMD()' });
  check('حالة غير مسموحة مرفوضة', bad.status === 'error', bad);
  check('الحالة ما اتغيرتش', ordersSheet._rows[1][2] === 'خرج للتوصيل', ordersSheet._rows[1][2]);
  const nf = POST({ action: 'updateStatus', password: PW, orderId: 'TK-XXX', newStatus: 'تم التسليم' });
  check('طلب غير موجود = not_found', nf.status === 'not_found', nf);
}

section('11) حالة المطعم');
{
  const c = POST({ action: 'toggleStore', password: PW, state: 'CLOSED' });
  check('الإغلاق نجح', c.status === 'success' && c.storeState === 'CLOSED', c);
  check('getStoreStatus = CLOSED', GET({ action: 'getStoreStatus' }).storeState === 'CLOSED');
  const blocked = POST({ orderId: 'TK-DDD444', name: 'ز', phone: '01000000000',
    deliveryZone: 'الساحه', address: 'ش', itemsJson: cart });
  check('الطلب مرفوض والمطعم مغلق', blocked.status === 'store_closed', blocked);
  POST({ action: 'toggleStore', password: PW, state: 'OPEN' });
  check('الفتح رجع تاني', GET({ action: 'getStoreStatus' }).storeState === 'OPEN');
}

section('12) حالات حدية');
{
  check('سلة فاضية مرفوضة', POST({ orderId: 'TK-E1', itemsJson: '{}' }).message === 'Empty cart');
  check('JSON مكسور مرفوض', POST({ orderId: 'TK-E2', itemsJson: '{{{' }).message === 'Empty cart');
  check('بدون رقم طلب مرفوض', POST({ itemsJson: cart }).message === 'رقم الطلب مفقود');
  const fake = POST({ orderId: 'TK-E3', itemsJson: JSON.stringify({ HACK: { qty: 5 } }) });
  check('صنف مش موجود في السيرفر مرفوض', fake.message === 'Empty cart' && fake.unknownItems === 'HACK', fake);
  const neg = POST({ orderId: 'TK-E4', itemsJson: JSON.stringify({ r1: { qty: -5 } }) });
  check('كمية سالبة مرفوضة', neg.message === 'Empty cart', neg);
  const huge = POST({ orderId: 'TK-E5', name: 'ك', phone: '01000000000', deliveryZone: 'الساحه',
    address: 'ش', itemsJson: JSON.stringify({ r1: { qty: 99999 } }) });
  check('الكمية مسقوفة عند 99 (11*99+15=1104)', huge.finalTotal === 1104, huge);
  const bot = POST({ orderId: 'TK-E6', itemsJson: cart, hp_check: 'i-am-a-bot' });
  check('البوت (honeypot) مرفوض', bot.message === 'Bot detected', bot);
  const zone = POST({ orderId: 'TK-E7', name: 'ن', phone: '01000000000',
    deliveryZone: 'منطقة مش موجودة', address: 'ش', itemsJson: cart });
  check('منطقة مجهولة: توصيل 0 + تحذير', zone.deliveryFee === 0 && zone.unknownZone === true, zone);
  check('أمر غير معروف = not_found', GET({ action: 'nope' }).status === 'not_found');
}

section('13) Formula Injection');
{
  POST({ orderId: 'TK-INJ1', name: '=HYPERLINK("http://evil","اضغط")', phone: '01000000000',
    deliveryZone: 'الساحه', address: '@SUM(A:A)', notes: '-2+3', itemsJson: cart });
  const row = ordersSheet._rows[ordersSheet._rows.length - 1];
  check('الاسم اتعطل بـ apostrophe', row[3].charAt(0) === "'", row[3]);
  check('الملاحظات اتعطلت', row[11].charAt(0) === "'", row[11]);
  check('العنوان مع منطقة = نص عادي بدون apostrophe في الوسط',
    row[5] === 'الساحه - @SUM(A:A)', row[5]);

  // الخطر الحقيقي: عنوان بيبدأ بصيغة من غير منطقة
  POST({ orderId: 'TK-INJ3', name: 'ع', phone: '01000000000',
    deliveryZone: '', address: '=IMPORTXML("http://evil","//x")', itemsJson: cart });
  const row3 = ordersSheet._rows[ordersSheet._rows.length - 1];
  check('عنوان بيبدأ بـ = اتعطل', row3[5].charAt(0) === "'", row3[5]);

  const esc = POST({ orderId: 'TK-INJ2', name: '<script>alert(1)</script>', phone: '01000000000',
    deliveryZone: 'الساحه', address: 'ش', itemsJson: cart });
  check('الطلب اتقبل', esc.status === 'success', esc);
  const mail = sentEmails[sentEmails.length - 1];
  check('الإيميل مفيهوش سكربت خام (HTML escaped)',
    mail.htmlBody.indexOf('<script>alert') === -1 && mail.htmlBody.indexOf('&lt;script&gt;') > -1);
}

section('14) getAllOrders');
{
  const r = GET({ action: 'getAllOrders', password: PW });
  check('نجح', r.status === 'success', r.status);
  check('عدد الطلبات مطابق للصفوف', r.orders.length === ordersSheet._rows.length - 1, r.orders.length);
  check('الأحدث أولاً', r.orders[0].orderId === 'TK-INJ2', r.orders[0].orderId);
  check('كل طلب له رقم', r.orders.every(o => o.orderId), r.orders.map(o => o.orderId));
  check('الهاتف بصفره', r.orders.every(o => /^01\d{9}$/.test(o.phone)), r.orders.map(o => o.phone));
  check('فيه storeState', r.storeState === 'OPEN', r.storeState);
}

section('15) الهاتف لو اتحول لرقم في الشيت');
{
  ordersSheet._rows.push(['2026-01-01 10:00:00', 'TK-NUM1', 'تم الاستلام', 'رقم',
    1012345678, 'الساحه - ش', '', 'كاش', 'California Roll x1', 0, 26, 'لا يوجد']);
  const r = GET({ action: 'getAllOrders', password: PW });
  const o = r.orders.find(x => x.orderId === 'TK-NUM1');
  check('الصفر المفقود اترجع', o.phone === '01012345678', o.phone);
}

section('16) clearOrders');
{
  const before = ordersSheet._rows.length - 1;
  const r = GET({ action: 'clearOrders', password: PW });
  check('نجح مع عدد المحذوف', r.status === 'success' && r.removed === before, r);
  check('الهيدر محفوظ', ordersSheet._rows.length === 1 && ordersSheet._rows[0][1] === 'رقم الطلب');
  const again = GET({ action: 'clearOrders', password: PW });
  check('مسح على شيت فاضي مش بيكسر', again.status === 'success' && again.removed === 0, again);
  check('getAllOrders على شيت فاضي = []', GET({ action: 'getAllOrders', password: PW }).orders.length === 0);
}

section('17) كلمة المرور من Script Properties');
{
  sandbox.movePasswordToProperties();
  check('اتحفظت', propsStore.ADMIN_PASSWORD === PW);
  propsStore.ADMIN_PASSWORD = 'NEW-STRONG-PW-123';
  check('الجديدة شغالة', GET({ action: 'diag', password: 'NEW-STRONG-PW-123' }).status === 'success');
  check('القديمة (اللي في الكود) اتعطلت', GET({ action: 'diag', password: PW }).status === 'unauthorized');
  check('diag بيقول إن المصدر Script Properties',
    GET({ action: 'diag', password: 'NEW-STRONG-PW-123' }).passwordSource === 'Script Properties');
  delete propsStore.ADMIN_PASSWORD;
}

section('18) قفل متزامن (Lock)');
{
  lockHeld = true;
  const r = POST({ orderId: 'TK-LOCK', itemsJson: cart, deliveryZone: 'الساحه' });
  check('السيرفر مشغول = رد واضح مش كراش', r.status === 'busy', r);
  lockHeld = false;
  check('القفل اتحرر بعد الفشل', lockHeld === false);
}

section('19) الردود كلها JSON صالح وفيها version');
{
  const all = [
    GET({ action: 'ping' }), GET({ action: 'getStoreStatus' }),
    GET({ action: 'verifyCoupon', code: 'X', subtotal: '1' }),
    GET({ action: 'checkOrder', orderId: 'X' }), GET({ action: 'diag', password: PW }),
    GET({ action: 'getAllOrders', password: PW }), POST({ orderId: 'TK-Z', itemsJson: '{}' }),
    GET({ action: 'unknown' })
  ];
  check('كل الردود فيها version', all.every(r => r.version === '3.0.0'));
  check('كل الردود فيها status', all.every(r => typeof r.status === 'string'), all.map(r => r.status));
}

section('20) testSetup / testEmail');
{
  const out = sandbox.testSetup();
  check('testSetup لقى الشيت الصح', out.indexOf('Orders') > -1, out);
  const n = sentEmails.length;
  sandbox.testEmail();
  check('testEmail بعت إيميل', sentEmails.length === n + 1);
  check('الإيميل للعنوان الصح', sentEmails[sentEmails.length - 1].to === 'alimth3015@gmail.com');
}

console.log('\n' + '='.repeat(52));
console.log(`النتيجة: ${pass} ناجح / ${fail} فاشل`);
console.log('='.repeat(52));
process.exit(fail ? 1 : 0);
