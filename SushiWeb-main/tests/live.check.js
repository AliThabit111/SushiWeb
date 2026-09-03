/**
 * فحص حقيقي للسيرفر المنشور (مش محاكي).
 * بيعمل طلب تجريبي كامل، يتأكد إنه اتسجل، يتحقق من كل الأوامر، وينضف بعد نفسه.
 *
 * الاستخدام:
 *   node tests/live.check.js                 → فحص للقراءة فقط
 *   node tests/live.check.js --with-order    → يضيف طلب تجريبي ويحذفه بعد الفحص
 *   node tests/live.check.js --pw "كلمة السر"
 */
const fs = require('fs');
const path = require('path');

const appSrc = fs.readFileSync(path.join(__dirname, '..', 'includes-assets', 'js', 'app.js'), 'utf8');
const URL_ = /GOOGLE_SCRIPT_URL\s*=\s*["']([^"']+)/.exec(appSrc)[1];
const REQ_VER = /REQUIRED_SERVER_VERSION\s*=\s*["']([^"']+)/.exec(appSrc)[1];

const args = process.argv.slice(2);
const WITH_ORDER = args.includes('--with-order');
const pwIdx = args.indexOf('--pw');
const PW = pwIdx > -1 ? args[pwIdx + 1] : process.env.TOKYO_ADMIN_PW || '';

let pass = 0, fail = 0, warn = 0;
const check = (label, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
};
const note = (label, extra) => { warn++; console.log('  ⚠ ' + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); };
const info = (k, v) => console.log('    ' + k.padEnd(22) + v);

const get = (params) => {
  const q = new URLSearchParams(Object.assign({ _: Date.now() }, params)).toString();
  return fetch(`${URL_}?${q}`, { redirect: 'follow' }).then(r => r.json().catch(() => ({ _raw: 'not json' })));
};
const post = (params) => fetch(URL_, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
  body: new URLSearchParams(params).toString(),
  redirect: 'follow'
}).then(r => r.json().catch(() => ({ _raw: 'not json' })));

(async () => {
  console.log('\n' + '═'.repeat(62));
  console.log('  فحص السيرفر المنشور');
  console.log('═'.repeat(62));
  info('الرابط:', '…' + URL_.slice(-28));
  info('الإصدار المطلوب:', REQ_VER);
  info('كلمة المرور:', PW ? 'متوفرة' : 'غير متوفرة (فحص محدود)');

  console.log('\n1) الإصدار والاتصال');
  const ping = await get({ action: 'ping' });
  check('ping بيرد success', ping.status === 'success', ping);
  check(`الإصدار = ${REQ_VER}`, ping.version === REQ_VER, ping.version);
  if (ping.features) {
    const need = ['ping', 'diag', 'deleteOrder', 'clearOrders', 'checkOrder', 'verifyCoupon', 'toggleStore', 'updateStatus', 'email'];
    const miss = need.filter(f => ping.features.indexOf(f) === -1);
    check('كل الميزات معلنة', miss.length === 0, miss);
  }
  if (ping.time) info('وقت السيرفر:', ping.time);

  console.log('\n2) الأوامر المفتوحة');
  const st = await get({ action: 'getStoreStatus' });
  check('getStoreStatus شغال', st.status === 'success', st);
  info('حالة المطعم:', st.storeState === 'OPEN' ? 'مفتوح' : 'مغلق');
  if (st.storeState === 'CLOSED') note('المطعم مغلق — الطلبات الجديدة مرفوضة');

  const cp = await get({ action: 'verifyCoupon', code: 'VVIP9', subtotal: 400 });
  check('verifyCoupon بيرد', ['valid', 'used', 'min_not_met', 'invalid'].indexOf(cp.status) > -1, cp);
  if (cp.status === 'valid') { check('الخصم 15% على 400 = 60', cp.discount === 60, cp.discount); }
  else { note('الكوبون VVIP9 حالته: ' + cp.status + ' — شغّل resetCoupons لو عايز تصفّره'); }

  const badCp = await get({ action: 'verifyCoupon', code: 'DEFINITELY-WRONG', subtotal: 400 });
  check('كود غلط = invalid', badCp.status === 'invalid', badCp);

  const unknown = await get({ action: 'nope-xyz' });
  check('أمر مجهول = not_found (مش كراش)', unknown.status === 'not_found', unknown);

  console.log('\n3) الحماية (كلمة مرور غلط)');
  for (const a of ['diag', 'getAllOrders', 'deleteOrder', 'clearOrders']) {
    const r = await get({ action: a, password: 'WRONG-PW-' + Date.now(), orderId: 'X' });
    check(a + ' محمي', r.status === 'unauthorized', r);
  }
  const upd = await post({ action: 'updateStatus', password: 'WRONG', orderId: 'X', newStatus: 'تم التسليم' });
  check('updateStatus محمي', upd.status === 'unauthorized', upd);
  const tg = await post({ action: 'toggleStore', password: 'WRONG', state: 'CLOSED' });
  check('toggleStore محمي', tg.status === 'unauthorized', tg);

  console.log('\n4) POST وتسجيل الطلبات');
  const empty = await post({ orderId: 'PROBE-' + Date.now(), itemsJson: '{}' });
  check('سلة فاضية مرفوضة', empty.message === 'Empty cart', empty);
  check('POST بيرجع JSON مقروء (CORS تمام)', empty.version === REQ_VER, empty);
  const bot = await post({ orderId: 'PROBE-BOT', itemsJson: '{"r1":{"qty":1}}', hp_check: 'bot' });
  check('honeypot شغال', bot.message === 'Bot detected', bot);
  const fake = await post({ orderId: 'PROBE-FAKE', itemsJson: '{"NOT_A_REAL_ITEM":{"qty":9}}' });
  check('صنف مجهول مرفوض', fake.message === 'Empty cart', fake);

  if (!PW) {
    console.log('\n  ⓘ الأوامر المحمية محتاجة كلمة المرور:  node tests/live.check.js --pw "…"');
  } else {
    console.log('\n5) التشخيص (diag)');
    const d = await get({ action: 'diag', password: PW });
    if (d.status !== 'success') {
      check('diag بكلمة المرور الصحيحة', false, d);
    } else {
      check('diag شغال', true);
      info('ملف الشيت:', d.spreadsheetName);
      info('التاب:', d.sheetName + (d.sheetTabs > 1 ? ` (من ${d.sheetTabs} تابات)` : ''));
      info('عدد الطلبات:', d.rows);
      info('إيميل الإشعارات:', d.adminEmail);
      info('رصيد الإيميل اليوم:', d.emailQuotaLeft);
      info('مصدر كلمة المرور:', d.passwordSource);
      info('المنطقة الزمنية:', d.timeZone);
      check('الشيت فيه بيانات', d.rows > 0, d.rows);
      if (d.adminEmail !== 'مضبوط') note('إيميل الإشعارات غير مضبوط');
      if (d.emailQuotaLeft === 0) note('رصيد الإيميلات اليومي خلص');
      if (d.emailQuotaLeft === -1) note('تعذر قراءة رصيد الإيميل — يبدو إن صلاحية MailApp مش ممنوحة. شغّل testEmail من المحرر');
      if (d.passwordSource !== 'Script Properties') {
        note('كلمة المرور داخل الكود (منشور على GitHub) — شغّل movePasswordToProperties');
      }
    }

    console.log('\n6) قراءة الطلبات');
    const all = await get({ action: 'getAllOrders', password: PW });
    check('getAllOrders شغال', all.status === 'success', all.status);
    if (all.orders) {
      check('فيه طلبات', all.orders.length > 0, all.orders.length);
      info('عدد الطلبات:', all.orders.length);
      const noId = all.orders.filter(o => !o.orderId);
      check('كل طلب له رقم', noId.length === 0, noId.length);
      const badPhone = all.orders.filter(o => o.phone && !/^0\d{10}$/.test(String(o.phone)));
      if (badPhone.length) note('أرقام بصيغة غير متوقعة: ' + badPhone.length, badPhone.slice(0, 3).map(o => o.phone));
      else check('كل الأرقام بصيغة صحيحة (بصفرها)', true);
      if (all.orders[0]) {
        info('أحدث طلب:', '#' + all.orders[0].orderId + ' — ' + all.orders[0].status);
        info('تاريخه:', all.orders[0].date);
        check('التاريخ بأرقام إنجليزية قابلة للترتيب',
          /^\d{4}-\d{2}-\d{2}/.test(String(all.orders[0].date)), all.orders[0].date);
      }
    }

    if (WITH_ORDER) {
      console.log('\n7) دورة كاملة: تسجيل ← تأكيد ← تحديث ← حذف');
      const oid = 'TEST-' + Date.now().toString(36).toUpperCase();
      const body = {
        orderId: oid, name: 'فحص تلقائي (اتجاهل)', phone: '01000000000',
        deliveryZone: 'الساحه', address: 'طلب تجريبي — سيُحذف تلقائياً',
        payment: 'كاش عند الاستلام',
        itemsJson: JSON.stringify({ r1: { name: 'TAMPERED', qty: 2 } }),  // 11×2 = 22
        notes: 'من tests/live.check.js'
      };
      const created = await post(body);
      check('الطلب اتسجل', created.status === 'success', created);
      if (created.status === 'success') {
        info('رقم الطلب:', oid);
        check('الإجمالي = 22 + 15 توصيل = 37', created.finalTotal === 37, created.finalTotal);
        check('السعر من السيرفر (مش من العميل)', created.subtotal === 22, created.subtotal);
        if (created.emailSent) check('الإيميل اتبعت', true);
        else note('الإيميل مبعتش', created.emailError || 'مفيش تفاصيل');

        const dup = await post(body);
        check('إعادة الإرسال مش بتكرر الصف', dup.duplicate === true, dup);

        const chk = await get({ action: 'checkOrder', orderId: oid });
        check('checkOrder لقاه بدون كلمة مرور', chk.status === 'found', chk);
        check('الحالة الابتدائية "تم الاستلام"', chk.orderStatus === 'تم الاستلام', chk.orderStatus);

        const u1 = await post({ action: 'updateStatus', password: PW, orderId: oid, newStatus: 'خرج للتوصيل' });
        check('تحديث الحالة نجح', u1.status === 'success', u1);
        const chk2 = await get({ action: 'checkOrder', orderId: oid });
        check('الحالة اتغيرت فعلاً في الشيت', chk2.orderStatus === 'خرج للتوصيل', chk2.orderStatus);

        const bad = await post({ action: 'updateStatus', password: PW, orderId: oid, newStatus: '=EVIL()' });
        check('حالة غير مسموحة مرفوضة', bad.status === 'error', bad);

        const del = await post({ action: 'deleteOrder', password: PW, orderId: oid });
        check('الحذف نجح', del.status === 'success', del);
        const gone = await get({ action: 'checkOrder', orderId: oid });
        check('الطلب اتشال فعلاً من الشيت', gone.status === 'not_found', gone);
      }
    } else {
      console.log('\n  ⓘ لفحص دورة الطلب الكاملة:  node tests/live.check.js --pw "…" --with-order');
    }
  }

  console.log('\n' + '═'.repeat(62));
  console.log(`  ${pass} ناجح • ${fail} فاشل • ${warn} تنبيه`);
  console.log('═'.repeat(62));
  process.exit(fail ? 1 : 0);
})();
