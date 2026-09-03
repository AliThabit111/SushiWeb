/**
 * اختبار منطق الواجهة (app.js) بدون متصفح.
 * بنعمل stub لـ document / localStorage / fetch ونشغّل الملف الأصلي كما هو،
 * وبعدين نختبر الدوال الحرجة: الطابور، الكوبون، فحص الإصدار، أوامر الأدمن.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = path.join(__dirname, '..', 'includes-assets', 'js', 'app.js');
const src = fs.readFileSync(APP, 'utf8');

/* ---------- DOM بسيط ---------- */
function el(id) {
  return {
    id, value: '', textContent: '', innerHTML: '', href: '', disabled: false,
    style: { cssText: '' }, dataset: {}, options: [], selectedIndex: 0,
    className: '', _cls: new Set(),
    classList: {
      add(c) { this._o._cls.add(c); }, remove(c) { this._o._cls.delete(c); },
      contains(c) { return this._o._cls.has(c); }, toggle(c, f) { f ? this._o._cls.add(c) : this._o._cls.delete(c); }
    },
    appendChild() {}, remove() {}, insertAdjacentHTML() {},
    addEventListener() {}, querySelectorAll: () => [], querySelector: () => null,
    getAttribute: () => '0', closest: () => null,
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 100, height: 100 })
  };
}
const nodes = {};
function node(id) {
  if (!nodes[id]) { const e = el(id); e.classList._o = e; nodes[id] = e; }
  return nodes[id];
}

const store = {};
const fetchCalls = [];
let fetchHandler = null;

const doc = {
  hidden: false,
  title: '',
  documentElement: { dir: 'rtl' },
  getElementById: id => node(id),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: (ev, fn) => { doc._events = doc._events || {}; doc._events[ev] = fn; },
  createElement: () => el('tmp'),
  body: el('body')
};

const timers = [];
const sandbox = {
  console,
  document: doc,
  window: {
    addEventListener() {}, matchMedia: () => ({ matches: false }),
    scrollTo() {}, open(u) { sandbox.window._opened = u; }, scrollY: 0, innerHeight: 800,
    Notification: undefined, AudioContext: undefined
  },
  navigator: { geolocation: null, vibrate: null, serviceWorker: undefined },
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  },
  location: { href: 'https://sushi-web-eta.vercel.app/' },
  setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
  clearTimeout: () => {},
  setInterval: (fn, ms) => { timers.push({ fn, ms, interval: true }); return timers.length; },
  requestAnimationFrame: () => 0,
  alert: m => { sandbox._alerts.push(m); },
  confirm: () => true,
  prompt: () => 'pw',
  _alerts: [],
  URLSearchParams: URLSearchParams,
  AbortController: AbortController,
  crypto: require('crypto').webcrypto,
  TextEncoder: TextEncoder,
  Date: Date, JSON: JSON, Math: Math, Object: Object, Array: Array, String: String,
  Number: Number, parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, Set: Set,
  Promise: Promise, encodeURIComponent: encodeURIComponent, escape: escape,
  fetch: (url, opts) => {
    const call = { url: String(url), opts: opts || {} };
    if (call.opts.body) call.body = Object.fromEntries(new URLSearchParams(String(call.opts.body)));
    fetchCalls.push(call);
    return Promise.resolve(fetchHandler ? fetchHandler(call) : { json: () => Promise.resolve({}) });
  }
};
sandbox.window.document = doc;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

// let/const في أعلى الملف بيعملوا lexical bindings مش خصائص على الـ global،
// فمش بنقدر نقراهم من الـ sandbox مباشرة. الـ probe ده بيوصلنا للقيم الحقيقية
// بدون أي تعديل على app.js نفسه.
const PROBE = `
;globalThis.__probe = {
  get cart(){ return cart; },                 set cart(v){ cart = v; },
  get discountAmount(){ return discountAmount; },
  get appliedCouponCode(){ return appliedCouponCode; },
  get deliveryFee(){ return deliveryFee; },   set deliveryFee(v){ deliveryFee = v; },
  get serverVersionOk(){ return serverVersionOk; },
  get isStoreGloballyOpen(){ return isStoreGloballyOpen; },
  set isStoreGloballyOpen(v){ isStoreGloballyOpen = v; },
  get sessionAdminPassword(){ return sessionAdminPassword; },
  set sessionAdminPassword(v){ sessionAdminPassword = v; },
  get REQUIRED_SERVER_VERSION(){ return REQUIRED_SERVER_VERSION; },
  get POLL_NEW_ORDERS_MS(){ return POLL_NEW_ORDERS_MS; },
  get POLL_STORE_STATE_MS(){ return POLL_STORE_STATE_MS; },
  get hasSha256(){ return typeof sha256; }
};
`;
vm.runInContext(src + PROBE, sandbox, { filename: 'app.js' });
const P = sandbox.__probe;

const json = obj => ({ ok: true, status: 200, json: () => Promise.resolve(obj) });

let pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
const section = t => console.log('\n' + t);
const reset = () => { fetchCalls.length = 0; sandbox._alerts.length = 0; };

const PENDING = 'tokyo_pending_orders';
const payload = id => ({ orderId: id, name: 'ع', phone: '01012345678',
  deliveryZone: 'الساحه', address: 'ش', itemsJson: '{"r1":{"name":"x","qty":2}}' });

/* ============================================================ */
section('1) الطلبات المعلقة — المسح بعد تأكيد فعلي فقط');

(async () => {
  reset();
  store[PENDING] = JSON.stringify([payload('TK-OK1')]);
  fetchHandler = () => json({ status: 'success', orderId: 'TK-OK1', finalTotal: 37 });
  let r = await sandbox.flushPendingOrders();
  check('نجاح ⇒ اتشال من الطابور', JSON.parse(store[PENDING]).length === 0, store[PENDING]);
  check('confirmed فيه رقم الطلب', r.confirmed.indexOf('TK-OK1') > -1, r);
  check('POST مش no-cors', fetchCalls[0].opts.mode === undefined, fetchCalls[0].opts.mode);
  check('POST بالطريقة الصح', fetchCalls[0].opts.method === 'POST', fetchCalls[0].opts);
  check('redirect=follow (Apps Script بيعمل 302)', fetchCalls[0].opts.redirect === 'follow');

  reset();
  store[PENDING] = JSON.stringify([payload('TK-ERR1')]);
  fetchHandler = () => json({ status: 'error', error: 'boom' });
  r = await sandbox.flushPendingOrders();
  check('خطأ من السيرفر ⇒ يفضل في الطابور', JSON.parse(store[PENDING]).length === 1, store[PENDING]);
  check('pending=1', r.pending === 1, r);
  check('مش محسوب كمُأكَّد', r.confirmed.length === 0, r);

  reset();
  store[PENDING] = JSON.stringify([payload('TK-BUSY')]);
  fetchHandler = () => json({ status: 'busy' });
  r = await sandbox.flushPendingOrders();
  check('busy ⇒ يفضل في الطابور للإعادة', JSON.parse(store[PENDING]).length === 1, r);

  reset();
  store[PENDING] = JSON.stringify([payload('TK-CLOSED')]);
  fetchHandler = () => json({ status: 'store_closed' });
  r = await sandbox.flushPendingOrders();
  check('مطعم مغلق ⇒ يتشال (تكراره بلا فايدة)', JSON.parse(store[PENDING]).length === 0, r);

  reset();
  store[PENDING] = JSON.stringify([payload('TK-NET')]);
  fetchHandler = () => { throw new Error('network down'); };
  try { r = await sandbox.flushPendingOrders(); } catch (e) { r = null; }
  check('انقطاع الشبكة ⇒ يفضل في الطابور', JSON.parse(store[PENDING]).length === 1, store[PENDING]);

  reset();
  store[PENDING] = JSON.stringify([payload('TK-A'), payload('TK-B'), payload('TK-C')]);
  let i = 0;
  fetchHandler = () => json(++i === 2 ? { status: 'error' } : { status: 'success' });
  r = await sandbox.flushPendingOrders();
  check('3 طلبات: نجح 2 وفضل 1', r.sent === 2 && r.pending === 1, r);
  check('الفاضل هو TK-B', JSON.parse(store[PENDING])[0].orderId === 'TK-B', store[PENDING]);
  delete store[PENDING];

  /* ---------- 2) الكوبون ---------- */
  section('2) الكوبون — الخصم من السيرفر');
  reset();
  node('couponCode').value = 'VVIP9';
  P.cart = { n1: { item: { id: 'n1', price: 160, name: 'X' }, qty: 2 } }; // 320
  fetchHandler = c => {
    check('الطلب فيه verifyCoupon والـ subtotal', c.url.indexOf('action=verifyCoupon') > -1 && c.url.indexOf('subtotal=320') > -1, c.url);
    return json({ status: 'valid', discount: 48, desc: 'خصم 15%' });
  };
  await sandbox.applyCoupon(null);
  check('الخصم من السيرفر = 48 (مش 50 الثابتة)', P.discountAmount === 48, P.discountAmount);
  check('الكود اتسجل', P.appliedCouponCode === 'VVIP9', P.appliedCouponCode);
  check('مفيش أي نداء لـ Firebase', fetchCalls.every(c => c.url.indexOf('firebaseio') === -1));
  check('مفيش PUT (حرق الكوبون من المتصفح)', fetchCalls.every(c => (c.opts.method || 'GET') !== 'PUT'));

  reset();
  fetchHandler = () => json({ status: 'used', message: 'تم استخدام هذا الكوبون مسبقاً' });
  await sandbox.applyCoupon(null);
  check('كوبون محروق ⇒ الخصم صفر', P.discountAmount === 0, P.discountAmount);
  check('الرسالة من السيرفر', node('couponMsg').textContent.indexOf('مسبقاً') > -1, node('couponMsg').textContent);

  reset();
  fetchHandler = () => json({ status: 'min_not_met', message: 'الحد الأدنى لتفعيل الكوبون هو 300 ج.م' });
  await sandbox.applyCoupon(null);
  check('أقل من الحد الأدنى ⇒ صفر + رسالة السيرفر',
    P.discountAmount === 0 && node('couponMsg').textContent.indexOf('300') > -1);

  reset();
  fetchHandler = () => { throw new Error('offline'); };
  await sandbox.applyCoupon(null);
  check('فشل الشبكة ⇒ الخصم صفر (مش بيتطبق غلط)', P.discountAmount === 0);

  reset();
  node('couponCode').value = '';
  await sandbox.applyCoupon(null);
  check('كود فاضي ⇒ صفر بدون أي نداء للسيرفر', P.discountAmount === 0 && fetchCalls.length === 0);

  /* ---------- 3) فحص الإصدار ---------- */
  section('3) زر "فحص" — مقارنة الإصدار');
  reset();
  fetchHandler = () => json({ status: 'success', version: '3.0.0', time: 'x' });
  await sandbox.pingServer(null);
  await new Promise(r => setImmediate(r));
  check('v3.0.0 ⇒ التحذير مخفي', node('serverStatusNote').style.display === 'none', node('serverStatusNote').style.display);
  check('serverVersionOk = true', P.serverVersionOk === true);

  reset();
  fetchHandler = () => json({ status: 'success', version: '2.1.0' });
  await sandbox.pingServer(null);
  await new Promise(r => setImmediate(r));
  check('إصدار قديم ⇒ التحذير ظاهر', node('serverStatusNote').style.display === 'flex');
  check('التحذير بيوضح الإصدارين', node('serverStatusNote').innerHTML.indexOf('2.1.0') > -1 &&
    node('serverStatusNote').innerHTML.indexOf('3.0.0') > -1, node('serverStatusNote').innerHTML.slice(0, 160));
  check('serverVersionOk = false', P.serverVersionOk === false);

  reset();
  fetchHandler = () => json({ status: 'not_found' });   // ده اللي بيحصل حالياً فعلاً
  await sandbox.pingServer(null);
  await new Promise(r => setImmediate(r));
  check('نسخة ما بتعرفش ping ⇒ تعليمات النشر الكاملة',
    node('serverStatusNote').innerHTML.indexOf('Manage deployments') > -1);
  check('serverVersionOk = false', P.serverVersionOk === false);

  /* ---------- 4) أوامر الأدمن ---------- */
  section('4) أوامر الأدمن — POST + fallback');
  reset();
  P.sessionAdminPassword = 'PW';
  fetchHandler = () => json({ status: 'success', deleted: 'TK-1' });
  let res = await sandbox.postAdminAction({ action: 'deleteOrder', orderId: 'TK-1', password: 'PW' });
  check('استخدم POST', fetchCalls[0].opts.method === 'POST', fetchCalls[0].opts.method);
  check('كلمة المرور في الـ body مش في الرابط',
    fetchCalls[0].body.password === 'PW' && fetchCalls[0].url.indexOf('password') === -1, fetchCalls[0].url);
  check('نداء واحد بس (مفيش fallback لما ينجح)', fetchCalls.length === 1, fetchCalls.length);
  check('الرد وصل', res.status === 'success', res);

  reset();
  let calls = 0;
  fetchHandler = c => {
    calls++;
    // النسخة القديمة: doPost مش بيعرف deleteOrder فيروح على منطق الطلب
    if ((c.opts.method || 'GET') === 'POST') return json({ result: 'error', message: 'Empty cart' });
    return json({ status: 'success', deleted: 'TK-2' });
  };
  res = await sandbox.postAdminAction({ action: 'deleteOrder', orderId: 'TK-2', password: 'PW' });
  check('رد غير معروف من POST ⇒ جرّب GET', calls === 2, calls);
  check('الـ fallback نجح', res.status === 'success', res);

  reset();
  fetchHandler = () => json({ status: 'unauthorized' });
  res = await sandbox.postAdminAction({ action: 'clearOrders', password: 'BAD' });
  check('unauthorized رد معروف ⇒ مفيش fallback', fetchCalls.length === 1 && res.status === 'unauthorized', res);

  /* ---------- 5) تحديث الحالة ---------- */
  section('5) تحديث حالة الطلب');
  reset();
  const btn = el('b'); btn._cls = new Set(); btn.classList._o = btn;
  btn.parentElement = { querySelectorAll: () => [] };
  fetchHandler = c => {
    check('POST بالحالة الجديدة', c.body && c.body.newStatus === 'جاري التحضير', c.body);
    check('كلمة المرور مش في الرابط', c.url.indexOf('password=') === -1, c.url);
    return json({ status: 'success', result: 'updated' });
  };
  sandbox.setOrderStatusAdmin('TK-9', 'جاري التحضير', btn);
  await new Promise(r => setImmediate(r));
  check('الزر رجع من حالة التحميل', btn.disabled === false);

  /* ---------- 6) تتبع الطلب ---------- */
  section('6) تأكيد وصول الطلب (checkOrder)');
  reset();
  store['tokyo_active_order_id'] = 'TK-TRK';
  store[PENDING] = JSON.stringify([payload('TK-TRK')]);
  fetchHandler = c => {
    check('checkOrder من غير كلمة مرور', c.url.indexOf('action=checkOrder') > -1 && c.url.indexOf('password') === -1, c.url);
    return json({ status: 'found', orderStatus: 'تم الاستلام' });
  };
  sandbox.verifyOrderDelivery('TK-TRK');
  await new Promise(r => setImmediate(r));
  check('اتأكد ⇒ اتشال من الطابور', JSON.parse(store[PENDING]).length === 0, store[PENDING]);
  delete store[PENDING];

  reset();
  fetchHandler = () => json({ status: 'found', orderStatus: 'خرج للتوصيل' });
  await sandbox.fetchLiveOrderStatus();
  check('التتبع بيحدّث الواجهة', node('trackTimeRemaining').innerHTML.indexOf('الطريق') > -1,
    node('trackTimeRemaining').innerHTML);
  check('cache-buster موجود', fetchCalls[0].url.indexOf('_=') > -1);

  /* ---------- 7) حالة المطعم ---------- */
  section('7) فتح/غلق المطعم');
  reset();
  P.sessionAdminPassword = 'PW';
  P.isStoreGloballyOpen = true;
  fetchHandler = c => {
    check('toggleStore عبر POST', (c.opts.method === 'POST') && c.body.action === 'toggleStore', c.body);
    return json({ status: 'success', storeState: 'CLOSED' });
  };
  sandbox.toggleStoreStatus();
  await new Promise(r => setImmediate(r));
  check('الحالة من رد السيرفر', P.isStoreGloballyOpen === false, P.isStoreGloballyOpen);

  reset();
  P.isStoreGloballyOpen = false;
  fetchHandler = () => json({ status: 'unauthorized' });
  sandbox.toggleStoreStatus();
  await new Promise(r => setImmediate(r));
  check('رفض السيرفر ⇒ الواجهة ترجع لحالتها', P.isStoreGloballyOpen === false, P.isStoreGloballyOpen);

  /* ---------- 8) الأمان والإعدادات ---------- */
  section('8) الإعدادات والأمان');
  check('REQUIRED_SERVER_VERSION = 3.0.0', P.REQUIRED_SERVER_VERSION === '3.0.0');
  check('polling الطلبات ≥ 30 ثانية', P.POLL_NEW_ORDERS_MS >= 30000, P.POLL_NEW_ORDERS_MS);
  check('polling حالة المطعم ≥ دقيقة', P.POLL_STORE_STATE_MS >= 60000, P.POLL_STORE_STATE_MS);
  check('مفيش hash كوبون في الكود', src.indexOf('VALID_COUPON_HASH') === -1);
  check('مفيش رابط Firebase', src.indexOf('firebaseio.com') === -1);
  // نشيل التعليقات الأول عشان الفحص يبص على الكود الفعلي بس
  const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  check('مفيش mode:"no-cors" فعّال', /mode:\s*["']no-cors["']/.test(codeOnly) === false,
    (codeOnly.match(/.{0,40}no-cors.{0,20}/) || ['clean'])[0]);
  check('كلمة مرور الأدمن مش مكتوبة في الفرونت', src.indexOf('TokyoAdmin2026') === -1);
  check('sha256 اتشالت', P.hasSha256 === 'undefined', P.hasSha256);
  check('escapeHTML موجودة للتعقيم', typeof sandbox.escapeHTML === 'function');
  check('escapeHTML بتعقّم فعلاً', sandbox.escapeHTML('<img onerror=x>') === '&lt;img onerror=x&gt;',
    sandbox.escapeHTML('<img onerror=x>'));

  section('9) المؤقتات بتتوقف والتبويب مخفي');
  reset();
  fetchHandler = () => json({ status: 'success', storeState: 'OPEN' });
  const intervals = timers.filter(t => t.interval);
  check('فيه مؤقتات مسجلة', intervals.length >= 4, intervals.length);
  doc.hidden = true;
  const n0 = fetchCalls.length;
  intervals.forEach(t => { try { t.fn(); } catch (e) {} });
  check('التبويب مخفي ⇒ مفيش أي نداء للسيرفر', fetchCalls.length === n0, fetchCalls.length - n0);
  doc.hidden = false;
  store['tokyo_active_order_id'] = 'TK-1';
  P.sessionAdminPassword = 'PW';
  intervals.forEach(t => { try { t.fn(); } catch (e) {} });
  check('التبويب ظاهر ⇒ التحديث رجع', fetchCalls.length > n0, fetchCalls.length - n0);

  section('10) زر "الشيت المتصل" (diag)');
{
  reset();
  P.sessionAdminPassword = 'PW';
  fetchHandler = c => {
    check('diag عبر POST بكلمة المرور في الـ body',
      c.opts.method === 'POST' && c.body.action === 'diag' && c.body.password === 'PW', c.body);
    return json({ status: 'success', version: '3.0.0', spreadsheetName: 'Tokyo Sushi Orders',
      sheetName: 'Orders', sheetTabs: 2, rows: 14, storeState: 'OPEN',
      adminEmail: 'مضبوط', emailQuotaLeft: 96, passwordSource: 'Script Properties',
      serverTime: '2026-09-03 11:40:00' });
  };
  sandbox.serverDiag(null);
  await new Promise(r => setImmediate(r));
  const html = node('serverStatusNote').innerHTML;
  check('بيعرض اسم ملف الشيت', html.indexOf('Tokyo Sushi Orders') > -1, html.slice(0, 120));
  check('بيعرض اسم التاب', html.indexOf('Orders') > -1);
  check('بيعرض عدد الطلبات', html.indexOf('14') > -1);
  check('مفيش تحذيرات لما كله تمام', html.indexOf('محتاج انتباه') === -1);

  reset();
  fetchHandler = () => json({ status: 'success', version: '2.0.0', spreadsheetName: 'شيت تاني',
    sheetName: 'Sheet1', sheetTabs: 1, rows: 0, storeState: 'CLOSED',
    adminEmail: 'غير مضبوط', emailQuotaLeft: 0, passwordSource: 'داخل الكود', serverTime: 'x' });
  sandbox.serverDiag(null);
  await new Promise(r => setImmediate(r));
  const h2 = node('serverStatusNote').innerHTML;
  check('بيحذر من الإصدار القديم', h2.indexOf('انشر نسخة جديدة') > -1);
  check('بيحذر من الإيميل غير المضبوط', h2.indexOf('إيميل الإشعارات غير مضبوط') > -1);
  check('بيحذر من كلمة المرور في الكود', h2.indexOf('Script Properties') > -1);
  check('بيحذر من نفاد رصيد الإيميل', h2.indexOf('رصيد الإيميلات') > -1);

  reset();
  fetchHandler = () => json({ status: 'not_found' });   // النسخة القديمة
  sandbox.serverDiag(null);
  await new Promise(r => setImmediate(r));
  check('نسخة قديمة ⇒ تعليمات النشر',
    node('serverStatusNote').innerHTML.indexOf('Manage deployments') > -1);

  reset();
  P.sessionAdminPassword = null;
  sandbox.serverDiag(null);
  check('بدون تسجيل دخول ⇒ مفيش نداء للسيرفر', fetchCalls.length === 0);
  P.sessionAdminPassword = 'PW';
}

console.log('\n' + '='.repeat(52));
  console.log(`النتيجة: ${pass} ناجح / ${fail} فاشل`);
  console.log('='.repeat(52));
  process.exit(fail ? 1 : 0);
})();
