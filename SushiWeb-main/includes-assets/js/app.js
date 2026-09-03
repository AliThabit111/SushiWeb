const RESTAURANT_PHONE = "201150275016";
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw66MkfXoP7luci88HhhllP5aqGA-4chFdFYlYHarIIUqQHVbOQWnAtjWYhc7nEEIKhhQ/exec";

// إصدار الباك إند المطلوب — زر "فحص" بيقارن بيه النسخة المنشورة فعلاً
const REQUIRED_SERVER_VERSION = "3.0.0";

// معدلات التحديث (ميلي ثانية) — Apps Script عنده كوتة يومية، فمنخفضة عن قصد
const POLL_NEW_ORDERS_MS   = 30000;  // طلبات جديدة (الأدمن فقط)
const POLL_STORE_STATE_MS  = 120000; // حالة المطعم
const POLL_TRACKER_MS      = 20000;  // تتبع الطلب أثناء فتح النافذة
const POLL_PENDING_MS      = 60000;  // إعادة إرسال الطلبات المعلقة

let sessionAdminPassword = null;
let isStoreGloballyOpen = true;
let serverVersionOk = false;

const DELIVERY_ZONES = [
  { name: "ابو خضير", fee: 15 },
  { name: "الساحه", fee: 15 },
  { name: "الموقف القديم", fee: 15 },
  { name: "عاشاور وسلام", fee: 15 },
  { name: "عماره البن", fee: 15 },
  { name: "نادي المعلمين", fee: 15 },
  { name: "ابو حماد", fee: 20 },
  { name: "الموقف الجديد", fee: 20 },
  { name: "عمليه المايه", fee: 25 },
  { name: "فهميه", fee: 25 },
  { name: "عزبه السلام", fee: 25 },
  { name: "الجزيره", fee: 35 },
  { name: "القبابات", fee: 160 },
  { name: "اطفيح", fee: 200 },
  { name: "منطقة أخرى (سيتم تحديد سعر التوصيل عبر الواتساب)", fee: 0 }
];

const MENU = [
  {key:"noodles", label:"نودلز", en:"Noodles", jp:"麺類", items:[
    {id:"n1", name:"White Sauce Shrimp", desc:"مكرونة فيتوتشيني – جمبري – لبن – كريمة طهي", price:160, img:"includes-assets/images/white.png"},
    {id:"n2", name:"Chicken Strips Sweet & Sour", desc:"مكرونة فيتوتشيني – خضار – صوص سويت أند ساور – ستربس", price:125, img:"includes-assets/images/sweet.png"},
  ]},
  {key:"rolls", label:"سوشي رولز", en:"Sushi Rolls", jp:"巻き寿司", items:[
    {id:"r1", name:"California Roll", desc:"أرز السوشي – ورق نوري – كراب استيك – سمسم", price:11, img:"includes-assets/images/Cal.jpg"},
    {id:"r2", name:"Crispy Roll", desc:"أرز السوشي – ورق نوري – جمبري – بانكو المقرمش", price:13, img:"includes-assets/images/Crispy.jpg"},
    {id:"r3", name:"Mega Roll", desc:"ارز سوشي – ورق نوري – كراب استيك – سلمون – جبنة كريمي", price:13, img:"includes-assets/images/Mega.jpg"},
    {id:"r4", name:"Shrimp Roll", desc:"أرز السوشي – ورق نوري – جمبري – جبنة كريمي", price:13, img:"includes-assets/images/shrimp.jpg"},
    {id:"r5", name:"Dragon Roll", desc:"ارز سوشي – ورق نوري – كراب استيك – كافيار – جبنة كريمي", price:13, img:"includes-assets/images/a.png"},
    {id:"r6", name:"Spicy Lemon Roll", desc:"ارز سوشي – سلمون مفروم – بانكو المقرمش – سبايسي صوص", price:13, img:"includes-assets/images/spicy_lemon.jpg"},
    {id:"r7", name:"Tuna Roll", desc:"أرز السوشي – ورق نوري – تونه – كراب استيك", price:13, img:"includes-assets/images/Tuna.jpg"},
    {id:"r8", name:"Shrimp Tempura Roll", desc:"أرز السوشي – ورق نوري – جمبري – مقلي بخليط التامبورا", price:13, img:"includes-assets/images/shrimp_tampora.jpg"},
    {id:"r9", name:"Chicken Roll", desc:"أرز السوشي – ورق نوري – ستربس – جبنة كريمي", price:13, img:"includes-assets/images/Chicken.jpg"},
  ]},
  {key:"burgers", label:"سوشي برجر", en:"Sushi Burger", jp:"バーガー", items:[
    {id:"b1", name:"سلمون برجر (Salmon Burger)", desc:"ارز سوشي – ورق نوري – كراب استيك – سلمون – جبنة كريمي", price:70, img:"includes-assets/images/Burger.jpg"},
    {id:"b2", name:"جمبرى برجر (Shrimp Burger)", desc:"أرز السوشي – ورق نوري – جمبري – جبنة كريمي", price:80, img:"includes-assets/images/Burger.jpg"},
    {id:"b3", name:"تونه برجر (Tuna Burger)", desc:"أرز السوشي – ورق نوري – تونة – كراب استيك", price:75, img:"includes-assets/images/Burger.jpg"},
    {id:"b4", name:"كابوريا برجر (Crab Burger)", desc:"ارز سوشي – ورق نوري – كراب استيك – جبنة كريمي", price:50, img:"includes-assets/images/Burger.jpg"},
  ]},
  {key:"sauces", label:"الصوصات والمقبلات", en:"Sauces & Extras", jp:"ソース", items:[
    {id:"s1", name:"الصويا المالحة", desc:"صوص صويا ياباني كلاسيك", price:5, img:"includes-assets/images/Soya.jpg"},
    {id:"s2", name:"الترياكي الحلو", desc:"صوص ترياكي ياباني مميز", price:5, img:"includes-assets/images/triacy.jpg"},
    {id:"s3", name:"المايونيز الحار", desc:"سبايسي مايو خاص", price:5, img:"includes-assets/images/mayoniez.jpg"},
  ]},
];

// أصناف SIGNATURE المستقلة (أسعارها وأسماؤها كما تظهر في الكروت — ليست من المنيو العادي)
const SIGNATURE_ITEMS = [
  {id:"z1", name:"White Sauce Shrimp", desc:"مكرونة فيتوتشيني - جمبري - لبن - كريمة طهي", price:160, img:"includes-assets/images/white.png"},
  {id:"z2", name:"Crimson Roll", desc:"Spicy tuna, cucumber, topped with سلمون حار.", price:13, img:"includes-assets/images/spicy_lemon.jpg"},
  {id:"z3", name:"Shogun Selection", desc:"A masterclass in traditional California nigiri.", price:11, img:"includes-assets/images/Cal.jpg"},
];

let cart = {};
let discountAmount = 0;
let appliedCouponCode = "";
let deliveryFee = 0;
let selectedZoneName = "";

function escapeHTML(str) {
  if (!str) return "";
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function generateSecureOrderId() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = 'TK-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function renderNav(){
  const nav = document.getElementById('catNav');
  if(!nav) return;
  nav.innerHTML = MENU.map((c,i)=>
    `<button class="cat-pill${i===0?' active':''}" onclick="scrollToCat('${c.key}', this)">${c.label}</button>`
  ).join('');
}

function renderDeliveryZones(){
  const sel = document.getElementById('deliveryZone');
  if(!sel) return;
  sel.innerHTML = '<option value="" data-fee="0">-- اختر المنطقة لتحديد سعر التوصيل --</option>' +
    DELIVERY_ZONES.map(z => `<option value="${z.name}" data-fee="${z.fee}">${z.name} ${z.fee > 0 ? `(+${z.fee} ج.م)` : ''}</option>`).join('');
}

function onZoneChange(){
  const sel = document.getElementById('deliveryZone');
  if(!sel) return;
  const opt = sel.options[sel.selectedIndex];
  selectedZoneName = opt.value;
  deliveryFee = parseInt(opt.getAttribute('data-fee') || '0');
  renderCartDrawer();
}

function renderMenu(){
  const main = document.getElementById('menu-start');
  if(!main) return;
  main.innerHTML = MENU.map(cat => `
    <section class="cat-section fade-in-up" id="cat-${cat.key}">
      <div class="cat-header-modern">
        <div class="cat-header-titles">
          <span class="cat-title-ar">${cat.label}</span>
          <span class="cat-title-en">${cat.en}</span>
        </div>
        <span class="cat-badge-jp">${cat.jp}</span>
      </div>
      <div class="carousel-wrapper">
        <div class="carousel-track" id="carousel-${cat.key}">
          ${cat.items.map(it => `
            <div class="card">
              ${it.img && it.img.trim() !== "" ? `
                <div class="card-img-container">
                  <img src="${it.img}" alt="${escapeHTML(it.name)}" class="card-img" loading="lazy" onerror="this.parentElement.style.display='none'">
                </div>
              ` : ''}
              <div class="card-name">${escapeHTML(it.name)}</div>
              <div class="card-desc">${escapeHTML(it.desc)}</div>
              <div class="card-footer">
                <div class="card-price"><span class="num">${it.price}</span> <span style="font-size:12px; color:var(--stone);">ج.م</span></div>
                <div id="ctrl-${it.id}">
                  <button class="add-btn" onclick="addItem('${it.id}')" aria-label="أضف للسلة"><i class="fa-solid fa-plus"></i></button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `).join('');
  // bind scroll listeners for arrow visibility
  MENU.forEach(cat => {
    const track = document.getElementById('carousel-' + cat.key);
    if(track){
      track.addEventListener('scroll', () => updateCarouselArrows(cat.key), {passive:true});
      updateCarouselArrows(cat.key);
    }
  });
  initFadeInObserver();
}

function findItem(id){
  for(const c of MENU) for(const it of c.items) if(it.id===id) return it;
  return SIGNATURE_ITEMS.find(it=>it.id===id);
}

function addItem(id){
  const item = findItem(id);
  if(!item) return;
  if(!cart[id]) cart[id] = { item: item, qty: 0 };
  cart[id].qty++;
  renderControl(id);
  if(appliedCouponCode) applyCoupon();
  updateCartUI();
  saveCart();
  scheduleFinishModal();
}

function changeQty(id, delta){
  if(!cart[id]) return;
  cart[id].qty += delta;
  if(cart[id].qty <= 0) delete cart[id];
  renderControl(id);
  if(appliedCouponCode) applyCoupon();
  updateCartUI();
  renderCartDrawer();
  saveCart();
  if(delta>0) scheduleFinishModal();
}

function renderControl(id){
  // قد يتكرر id (مثل ctrl-r6 في سينيجر + المنيو) → نحدّث كل النسخ
  const els = document.querySelectorAll('[id="ctrl-' + id + '"]');
  if(!els.length) return;
  const html = cart[id]
    ? `<div class="stepper" role="group" aria-label="تحديد الكمية">
      <button aria-label="إنقاص" onclick="changeQty('${id}',-1)"><i class="fa-solid fa-minus" style="font-size:11px;"></i></button>
      <span class="qty num" title="الكمية">${cart[id].qty}</span>
      <button aria-label="زيادة" onclick="changeQty('${id}',1)"><i class="fa-solid fa-plus" style="font-size:11px;"></i></button>
    </div>`
    : `<button class="add-btn" onclick="addItem('${id}')" aria-label="أضف للسلة"><i class="fa-solid fa-plus"></i></button>`;
  els.forEach(el => { el.innerHTML = html; });
}
function setQtyDirect(id, val){
  const n = parseInt(val,10);
  if(!cart[id]) return;
  if(isNaN(n) || n<=0){ delete cart[id]; } else { cart[id].qty = n; }
  renderControl(id);
  if(appliedCouponCode) applyCoupon();
  updateCartUI();
  renderCartDrawer();
  saveCart();
  if(n>0) scheduleFinishModal();
}

// ===== LocalStorage: حفظ السلة تلقائياً =====
function saveCart(){
  try { localStorage.setItem('tokyo_cart', JSON.stringify(cart)); } catch(e){}
}
function loadCart(){
  try {
    const raw = localStorage.getItem('tokyo_cart');
    if(!raw) return;
    const saved = JSON.parse(raw);
    if(!saved || typeof saved !== 'object') return;
    let valid = false;
    Object.entries(saved).forEach(([id, c])=>{
      if(c && c.item && c.qty > 0){
        cart[id] = { item: c.item, qty: c.qty };
        valid = true;
      }
    });
    if(valid){
      document.querySelectorAll('[id^="ctrl-"]').forEach(el=>{
        renderControl(el.id.replace('ctrl-',''));
      });
      updateCartUI();
    }
  } catch(e){}
}
function clearSavedCart(){
  try { localStorage.removeItem('tokyo_cart'); } catch(e){}
}

function getCartSubtotal(){ return Object.values(cart).reduce((s, c) => s + (c.item.price * c.qty), 0); }
function getCartTotal(){ return Math.max(0, getCartSubtotal() - discountAmount) + deliveryFee; }

function updateCartUI(){
  const count = Object.values(cart).reduce((s, c) => s + c.qty, 0);
  const el = document.getElementById('cartCountTop');
  if(el) el.textContent = count;
  // sync any other cart counters (hero button)
  document.querySelectorAll('.cart-count').forEach(c=>{
    if(c.id !== 'cartCountTop') c.textContent = count;
  });
}

function renderCartDrawer(){
  const wrap = document.getElementById('cartItems');
  const foot = document.getElementById('drawerFoot');
  const fields = document.getElementById('checkoutFields');
  if(!wrap || !foot || !fields) return;
  const entries = Object.entries(cart);

  if(entries.length === 0){
    wrap.innerHTML = '<div style="text-align:center; color:var(--stone); padding:30px;"><i class="fa-solid fa-cart-shopping" style="margin-inline-end:6px;"></i>السلة فارغة حالياً</div>';
    foot.style.display = 'none';
    fields.style.display = 'none';
    return;
  }

  wrap.innerHTML = entries.map(([id, c]) => `
    <div style="display:flex; gap:12px; align-items:center; border-bottom:1px solid rgba(95,63,59,0.14); padding:12px 0;">
      ${c.item.img ? `<img src="${escapeHTML(c.item.img)}" alt="" style="width:56px; height:56px; border-radius:12px; object-fit:cover; border:1px solid rgba(95,63,59,0.18); flex-shrink:0; background:#0e0e0e;" onerror="this.style.display='none'">` : `<div style="width:56px; height:56px; border-radius:12px; background:rgba(255,255,255,0.04); border:1px solid rgba(95,63,59,0.14); display:flex; align-items:center; justify-content:center; flex-shrink:0;"><i class="fa-solid fa-utensils" style="color:var(--stone); opacity:0.55; font-size:16px;"></i></div>`}
      <div style="flex:1; min-width:0;">
        <div style="font-weight:700; font-size:14px; color:#f0e6e2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(c.item.name)} × <span class="num" style="color:#ffb4aa;">${c.qty}</span></div>
        <div style="font-size:12px; color:#b8b2aa; margin-top:2px;"><span class="num" style="color:#ffab91; font-weight:700;">${c.item.price * c.qty}</span> ج.م <span style="opacity:0.45;">•</span> <span class="num" style="opacity:0.65; font-size:11px;">${c.item.price} × ${c.qty}</span></div>
      </div>
      <button onclick="removeItem('${id}')" aria-label="حذف" style="width:32px; height:32px; border-radius:50%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); color:#c6c6c7; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all .18s;"><i class="fa-solid fa-xmark" style="font-size:12px;"></i></button>
    </div>
  `).join('');

  fields.style.display = 'flex';
  foot.style.display = 'block';
  const subEl = document.getElementById('subtotalVal');
  const delEl = document.getElementById('deliveryVal');
  const discEl = document.getElementById('discountVal');
  const totalEl = document.getElementById('cartTotal');
  if(subEl) subEl.textContent = getCartSubtotal();
  if(delEl) delEl.textContent = deliveryFee;
  if(discEl) discEl.textContent = discountAmount;
  if(totalEl) totalEl.textContent = getCartTotal();
}

function removeItem(id){
  delete cart[id];
  renderControl(id);
  if(appliedCouponCode) applyCoupon();
  updateCartUI();
  renderCartDrawer();
  saveCart();
}

function openCart(){
  renderCartDrawer();
  const o = document.getElementById('overlay');
  const d = document.getElementById('drawer');
  if(o) o.classList.add('open');
  if(d) d.classList.add('open');
  // if finish modal was open, close it
  const fm = document.getElementById('finishModal');
  const fo = document.getElementById('finishOverlay');
  if(fm) fm.classList.remove('open');
  if(fo) fo.classList.remove('open');
}
function closeCart(){
  const o = document.getElementById('overlay');
  const d = document.getElementById('drawer');
  if(o) o.classList.remove('open');
  if(d) d.classList.remove('open');
}

// --- Finish selection modal (لا تفتح السلة تلقائياً) ---
let finishModalTimer = null;
let lastFinishModalAt = 0;
function scheduleFinishModal(){
  if(!cart || Object.keys(cart).length===0) return;
  const fm = document.getElementById('finishModal');
  const drawer = document.getElementById('drawer');
  if(fm && fm.classList.contains('open')) return;
  if(drawer && drawer.classList.contains('open')) return;
  if(Date.now() - lastFinishModalAt < 25000) return; // لا تزعج كل شوية
  clearTimeout(finishModalTimer);
  finishModalTimer = setTimeout(()=> openFinishModal(), 900);
}
function openFinishModal(){
  const fm = document.getElementById('finishModal');
  const fo = document.getElementById('finishOverlay');
  if(!fm || !fo) return;
  const totalQty = Object.values(cart).reduce((s,c)=> s + c.qty, 0);
  const cnt = document.getElementById('finishCount');
  if(cnt) cnt.textContent = totalQty;
  fo.classList.add('open');
  fm.classList.add('open');
  lastFinishModalAt = Date.now();
}
function closeFinishModal(goToCart){
  const fm = document.getElementById('finishModal');
  const fo = document.getElementById('finishOverlay');
  if(fm) fm.classList.remove('open');
  if(fo) fo.classList.remove('open');
  clearTimeout(finishModalTimer);
  if(goToCart) openCart();
}


// دالة التحقق من الكوبون عبر Firebase والتشفير
// ===== التحقق من الكوبون عبر السيرفر (Apps Script هو المرجع الوحيد) =====
// قبل كده: كان الهاش والخصم (50 ج.م) مكتوبين في المتصفح والحرق في Firebase عام
// للقراءة والكتابة لأي حد. دلوقتي السيرفر هو اللي بيقرر الخصم وبيحرق الكوبون
// بعد نجاح الطلب فقط.
async function applyCoupon(btn){
  const codeEl = document.getElementById('couponCode');
  const msg = document.getElementById('couponMsg');
  if(!codeEl || !msg) return;
  const code = codeEl.value.trim().toUpperCase();
  const subtotal = getCartSubtotal();

  if(!code){
    discountAmount = 0;
    appliedCouponCode = "";
    msg.textContent = "";
    renderCartDrawer();
    return;
  }

  msg.style.color = "var(--stone)";
  msg.textContent = "جاري التحقق من الكوبون...";
  if(btn) spinnerStart(btn, '');

  try {
    const res = await fetchWithTimeout(
      `${GOOGLE_SCRIPT_URL}?action=verifyCoupon&code=${encodeURIComponent(code)}&subtotal=${subtotal}&_=${Date.now()}`,
      {}, 20000
    );
    const data = await res.json();

    if(data.status === "valid"){
      discountAmount = parseInt(data.discount, 10) || 0;   // الخصم من السيرفر
      appliedCouponCode = code;
      msg.style.color = "var(--green)";
      msg.innerHTML = 'تم تطبيق ' + escapeHTML(data.desc || 'الخصم') + ' (' + discountAmount +
        ' ج.م) <i class="fa-solid fa-circle-check"></i>';
    } else {
      discountAmount = 0;
      appliedCouponCode = "";
      msg.style.color = "var(--coral)";
      msg.textContent = data.message || "الكوبون غير صالح";
    }
  } catch(e) {
    discountAmount = 0;
    appliedCouponCode = "";
    msg.style.color = "var(--coral)";
    msg.textContent = "تعذر التحقق من الكوبون حالياً — جرّب تاني";
  }
  renderCartDrawer();
  if(btn) spinnerStop(btn);
}

function getLocation(){
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const g = document.getElementById('gpsCoords');
        if(g) g.value = `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
        alert('تم تحديد موقعك بنجاح!');
      },
      () => alert('تعذر جلب الموقع تلقائياً.')
    );
  }
}

function sendOrder(){
  if (!isStoreGloballyOpen) {
    alert("نعتذر منك، المطعم مغلق حالياً ولا يستقبل أي طلبات جديدة.");
    return;
  }

  const entries = Object.entries(cart);
  if(entries.length === 0) return;

  const hpEl = document.getElementById('hp_check');
  const hp = hpEl ? hpEl.value : "";
  if(hp !== ""){
    return;
  }

  const nameEl = document.getElementById('custName');
  const phoneEl = document.getElementById('custPhone');
  const addressEl = document.getElementById('custAddress');
  const paymentEl = document.getElementById('payMethod');
  const notesEl = document.getElementById('custNotes');
  const gpsEl = document.getElementById('gpsCoords');
  const name = nameEl ? nameEl.value.trim() : "";
  const phone = phoneEl ? phoneEl.value.trim() : "";
  const address = addressEl ? addressEl.value.trim() : "";
  const payment = paymentEl ? paymentEl.value : "";
  const notes = notesEl ? notesEl.value.trim() : "";
  const gps = gpsEl ? gpsEl.value : "";

  if(!name || !phone || !address){
    alert('من فضلك اكتب الاسم، رقم الهاتف، والعنوان بالتفصيل.');
    return;
  }

  const phoneRegex = /^01[0125][0-9]{8}$/;
  if(!phoneRegex.test(phone)){
    alert('من فضلك اكتب رقم موبايل صحيح مكون من 11 رقم يبدأ بـ 01');
    return;
  }

  if(!selectedZoneName){
    alert('من فضلك اختر منطقة التوصيل لحساب الإجمالي بدقة');
    return;
  }

  const orderId = generateSecureOrderId();
  const subtotal = getCartSubtotal();
  const finalTotal = getCartTotal();

  localStorage.setItem('tokyo_name', name);
  localStorage.setItem('tokyo_phone', phone);
  localStorage.setItem('tokyo_address', address);
  localStorage.setItem('tokyo_active_order_id', orderId);

  const itemsJsonPayload = {};
  entries.forEach(([id, c]) => {
    itemsJsonPayload[id] = { name: c.item.name, qty: c.qty };
  });

  const payload = {
    date: new Date().toLocaleString('ar-EG'),
    orderId: orderId,
    name: name,
    phone: phone,
    deliveryZone: selectedZoneName,
    address: address,
    gps: gps || "غير محدد",
    payment: payment,
    itemsJson: JSON.stringify(itemsJsonPayload),
    couponCode: appliedCouponCode,
    notes: notes || "لا يوجد",
    hp_check: hp
  };

  // حفظ الطلب في قايمة محلية + محاولة إرسال فورية (retry تلقائي لو الاتصال قطع)
  queueOrderPayload(payload);
  const sendBtnEl = document.getElementById('sendBtn');
  if(sendBtnEl) spinnerStart(sendBtnEl, 'جاري إرسال الطلب...');
  flushPendingOrders().then(({confirmed, pending})=>{
    if(sendBtnEl) spinnerStop(sendBtnEl);
    if(confirmed.indexOf(orderId) > -1){
      showMiniToast('تم تسجيل طلبك #' + orderId + ' بنجاح ✓', true, 5000);
      return;
    }
    if(pending > 0){
      // الطلب لسه في الطابور: هيتعاد إرساله تلقائياً + نتأكد من الشيت
      showMiniToast('لم يتأكد وصول الطلب للسيرفر بعد — جاري إعادة المحاولة تلقائياً', false, 7000);
      setTimeout(()=> verifyOrderDelivery(orderId), 5000);
    }
  });

  let msg = `*طلب جديد عبر TOKYO SUSHI* 🍣\n`;
  msg += `🔖 *رقم الطلب:* #${orderId}\n`;
  msg += `--------------------------------\n`;
  entries.forEach(([id, c]) => {
    msg += `▪️ ${c.item.name} × ${c.qty} = ${c.item.price * c.qty} ج.م\n`;
  });
  msg += `--------------------------------\n`;
  msg += `💵 *سعر الأصناف:* ${subtotal} ج.م\n`;
  msg += `🛵 *التوصيل (${selectedZoneName}):* ${deliveryFee} ج.م\n`;
  if(discountAmount > 0) msg += `🏷️ *الخصم:* -${discountAmount} ج.م (${appliedCouponCode})\n`;
  msg += `💰 *الإجمالي النهائي:* ${finalTotal} ج.م\n`;
  msg += `💳 *طريقة الدفع:* ${payment}\n\n`;
  msg += `👤 *العميل:* ${name}\n`;
  msg += `📱 *الهاتف:* ${phone}\n`;
  msg += `📍 *العنوان:* ${selectedZoneName} - ${address}\n`;
  if(gps) msg += `🗺️ *GPS:* ${gps}\n`;
  if(notes) msg += `📝 *ملاحظات:* ${notes}\n`;

  const url = `https://wa.me/${RESTAURANT_PHONE}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');

  closeCart();
  cart = {};
  discountAmount = 0;
  appliedCouponCode = "";
  clearSavedCart();
  document.querySelectorAll('[id^="ctrl-"]').forEach(el => {
    const id = el.id.replace('ctrl-', '');
    renderControl(id);
  });
  updateCartUI();
  openTracker();
  resetTrackerToPending(); // طلب جديد: ابدأ من "في انتظار الاستلام" مش حالة الطلب السابق
}

// زر التتبع في الهيدر بيعكس الحالة لايف
function setTrackButton(state){
  const btn = document.getElementById('trackHeaderBtn');
  if(!btn) return;
  const map = {
    pending: { icon:'fa-hourglass-half', label:'تتبع الطلب',  color:'#ffb4aa' },
    prep:    { icon:'fa-utensils',       label:'قيد التحضير', color:'#ffb4aa' },
    onway:   { icon:'fa-motorcycle',     label:'خرج للتوصيل', color:'#ff9a8a' },
    done:    { icon:'fa-circle-check',   label:'تم التسليم',  color:'#81c784' }
  };
  const s = map[state] || map.pending;
  btn.innerHTML = `<i class="fa-solid ${s.icon}"></i> ${s.label}`;
  btn.style.color = s.color;
}

function resetTrackerToPending(){
  // طلب جديد: صفّر الخطوات لـ "في انتظار الاستلام" بدل حالة الطلب القديم
  const s1 = document.getElementById('step1');
  const s2 = document.getElementById('step2');
  const s3 = document.getElementById('step3');
  const s4 = document.getElementById('step4');
  const statusBox = document.getElementById('trackTimeRemaining');
  if(!s1 || !s2 || !s3 || !s4 || !statusBox) return;
  [s1, s2, s3, s4].forEach(s => s.className = 'tracker-step');
  s1.className = 'tracker-step active';
  statusBox.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> في انتظار استلام الطلب وجاري مراجعته';
  setTrackButton('pending');
}

function updateTrackerUIByStatus(statusText){
  const s1 = document.getElementById('step1');
  const s2 = document.getElementById('step2');
  const s3 = document.getElementById('step3');
  const s4 = document.getElementById('step4');
  const statusBox = document.getElementById('trackTimeRemaining');
  if(!s1 || !s2 || !s3 || !s4 || !statusBox) return;

  [s1, s2, s3, s4].forEach(s => s.className = 'tracker-step');
  const text = (statusText || "").trim();

  if(!text){
    // مفيش حالة مسجلة بعد = طلب جديد
    s1.className = 'tracker-step active';
    statusBox.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> في انتظار استلام الطلب وجاري مراجعته';
    setTrackButton('pending');
    return;
  }

  if(text === "تم التسليم" || text === "تم التوصيل"){
    s1.className = 'tracker-step done';
    s2.className = 'tracker-step done';
    s3.className = 'tracker-step done';
    s4.className = 'tracker-step done';
    statusBox.innerHTML = '<i class="fa-solid fa-circle-check"></i> تم تسليم الطلب بنجاح — بالهناء والشفاء!';
    setTrackButton('done');
  } else if(text === "خرج للتوصيل" || text.includes("طريق") || text.includes("توصيل")){
    s1.className = 'tracker-step done';
    s2.className = 'tracker-step done';
    s3.className = 'tracker-step active';
    statusBox.innerHTML = '<i class="fa-solid fa-motorcycle"></i> المندوب في الطريق إليك';
    setTrackButton('onway');
  } else if(text === "جاري التحضير" || text.includes("تحضير")){
    s1.className = 'tracker-step done';
    s2.className = 'tracker-step active';
    statusBox.innerHTML = '<i class="fa-solid fa-utensils"></i> الطلب قيد التحضير في المطبخ الآن';
    setTrackButton('prep');
  } else {
    s1.className = 'tracker-step active';
    statusBox.innerHTML = '<i class="fa-solid fa-file-lines"></i> تم استلام طلبك وجاري مراجعته';
    setTrackButton('prep');
  }
}

async function fetchLiveOrderStatus(){
  const activeId = localStorage.getItem('tokyo_active_order_id');
  const trackBtn = document.getElementById('trackHeaderBtn');
  
  if(!activeId){
    if(trackBtn) trackBtn.style.display = 'none';
    return;
  }

  if(trackBtn) trackBtn.style.display = 'flex';
  const tid = document.getElementById('trackOrderId');
  if(tid) tid.textContent = '#' + activeId;
  // زر واتساب المطعم: رسالة جاهزة برقم الطلب
  const waLink = document.getElementById('waContactLink');
  if(waLink) waLink.href = `https://wa.me/201150275016?text=${encodeURIComponent('مرحباً، أستفسر عن طلب رقم ' + activeId + ' من TOKYO SUSHI — ما هو موقف الطلب؟')}`;

  try {
    // cache-buster عشان المتصفح ما يكاشش الاستجابة القديمة
    const res = await fetchWithTimeout(`${GOOGLE_SCRIPT_URL}?orderId=${encodeURIComponent(activeId)}&_=${Date.now()}`, {}, 10000);
    const data = await res.json();
    if(data.status === "found" && data.orderStatus){
      updateTrackerUIByStatus(data.orderStatus);
    } else {
      // الطلب مش موجود/جديد → في انتظار الاستلام (مش حالة الطلب القديم)
      resetTrackerToPending();
    }
  } catch (err) {
    console.log("Tracker fetch error:", err);
  }
}

function openTracker(){
  const o = document.getElementById('trackerOverlay');
  const m = document.getElementById('trackerModal');
  if(o) o.classList.add('open');
  if(m) m.classList.add('open');
  // مفيش reset هنا — الجلب هيحدث الحالة، ولو فشل نسيب آخر حالة معروضة
  fetchLiveOrderStatus();
}

function closeTracker(){
  const o = document.getElementById('trackerOverlay');
  const m = document.getElementById('trackerModal');
  if(o) o.classList.remove('open');
  if(m) m.classList.remove('open');
}

// ===== أداء الأدمن: timeout + كاش الطلبات =====
function fetchWithTimeout(url, options = {}, ms = 15000){
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(()=> clearTimeout(t));
}
function cacheOrders(orders){
  try { localStorage.setItem('tokyo_orders_cache', JSON.stringify({ t: Date.now(), orders })); } catch(e){}
}
function readOrdersCache(){
  try {
    const raw = localStorage.getItem('tokyo_orders_cache');
    if(!raw) return null;
    const p = JSON.parse(raw);
    return (p && Array.isArray(p.orders)) ? p : null;
  } catch(e){ return null; }
}
// بيفلتر الطلبات الوهمية/الفاضية (من غير رقم طلب)
function sanitizeOrders(orders){
  if(!Array.isArray(orders)) return [];
  return orders.filter(o => o && o.orderId && String(o.orderId).trim() !== '' && String(o.orderId).trim() !== 'TK-');
}
function renderOrdersList(orders){
  const container = document.getElementById('adminOrdersContainer');
  if(!container) return;
  orders = sanitizeOrders(orders);
  const countEl = document.getElementById('admOrdersCount');
  if(orders.length > 0){
    if(countEl){ countEl.textContent = orders.length + ' طلب'; countEl.style.display = 'inline-flex'; }
    container.innerHTML = orders.map(o => { const ph = normalizePhone(o.phone); return `
      <div class="adm-order-card">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; font-size:14px; font-weight:700;">
          <span style="color:#ffab91; font-family:'JetBrains Mono',monospace; letter-spacing:0.3px;">#${escapeHTML(o.orderId)}</span>
          <span style="color:#f0e6e2; font-size:13px; font-weight:600; display:inline-flex; align-items:center; gap:8px; min-width:0;">${escapeHTML(o.name || '')} <span style="color:#b8b2aa; font-weight:500; direction:ltr;" dir="ltr">(${escapeHTML(ph.display)})</span>
          ${ph.wa ? `<a href="https://wa.me/${ph.wa}?text=${encodeURIComponent('مرحباً، بخصوص طلبك رقم ' + o.orderId + ' من TOKYO SUSHI')}" target="_blank" rel="noopener" class="wa-cust-btn" title="واتساب العميل" aria-label="واتساب"><i class="fa-brands fa-whatsapp"></i></a>` : ''}
          <button class="adm-del-btn" onclick="deleteOrderAdmin('${escapeHTML(o.orderId)}', this)" title="حذف الطلب" aria-label="حذف الطلب"><i class="fa-solid fa-trash"></i></button>
          </span>
        </div>
        <div style="font-size:13px; color:#b8b2aa; line-height:1.6; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.04); border-radius:10px; padding:10px 12px;">${escapeHTML(o.items)}</div>
        <div style="font-size:12.5px; color:#ffccbc; font-weight:600; display:flex; align-items:center; gap:10px; flex-wrap:wrap;"><span><i class="fa-solid fa-coins" style="margin-inline-end:6px; opacity:0.85;"></i> الإجمالي: ${escapeHTML(o.total)} ج.م</span> <span style="opacity:0.3;">•</span> <span><i class="fa-solid fa-location-dot" style="margin-inline-end:6px; opacity:0.85;"></i> ${escapeHTML(o.address)}</span></div>

        <div class="adm-btns">
          <button class="adm-btn ${o.status==='تم الاستلام'?'active':''}" onclick="setOrderStatusAdmin('${escapeHTML(o.orderId)}', 'تم الاستلام', this)"><i class="fa-solid fa-file-lines"></i> استلام</button>
          <button class="adm-btn ${o.status==='جاري التحضير'?'active':''}" onclick="setOrderStatusAdmin('${escapeHTML(o.orderId)}', 'جاري التحضير', this)"><i class="fa-solid fa-utensils"></i> تحضير</button>
          <button class="adm-btn ${o.status==='خرج للتوصيل'?'active':''}" onclick="setOrderStatusAdmin('${escapeHTML(o.orderId)}', 'خرج للتوصيل', this)"><i class="fa-solid fa-motorcycle"></i> توصيل</button>
          <button class="adm-btn ${o.status==='تم التسليم'?'active':''}" onclick="setOrderStatusAdmin('${escapeHTML(o.orderId)}', 'تم التسليم', this)"><i class="fa-solid fa-circle-check"></i> تم التسليم</button>
        </div>
      </div>
    `;
    }).join('');
  } else {
    if(countEl){ countEl.textContent = '0 طلب'; countEl.style.display = 'inline-flex'; }
    container.innerHTML = '<div style="text-align:center; color:var(--stone); padding:32px 20px; font-size:13px; display:flex; flex-direction:column; align-items:center; gap:10px;"><i class="fa-solid fa-inbox" style="font-size:22px; opacity:0.35;"></i> لا توجد طلبات مسجلة حالياً</div>';
  }
}
const ORDERS_SKELETON = '<div style="display:flex; flex-direction:column; gap:14px;">' +
  Array(3).fill('<div style="height:128px; border-radius:16px; background:linear-gradient(100deg, rgba(255,255,255,0.04) 30%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 70%); background-size:200% 100%; animation: shimmer 1.4s infinite;"></div>').join('') +
  '</div>';

// ===== موثوقية إرسال الطلب: Queue + Retry تلقائي لو الاتصال فاشل =====
const PENDING_KEY = 'tokyo_pending_orders';
function queueOrderPayload(payload){
  try{
    const q = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
    q.push(payload);
    localStorage.setItem(PENDING_KEY, JSON.stringify(q));
  }catch(e){}
}
function removeQueuedPayload(orderId){
  try{
    let q = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
    q = q.filter(p => p.orderId !== orderId);
    localStorage.setItem(PENDING_KEY, JSON.stringify(q));
  }catch(e){}
}
// مهم: بدون mode:"no-cors".
// الـ Apps Script بيرجع Access-Control-Allow-Origin: * فالمتصفح مسموح له يقرا الرد.
// مع no-cors كان الرد "opaque" (مش مقروء) فالكود كان بيفترض النجاح ويمسح الطلب
// من الطابور حتى لو السيرفر رفضه.
function postOrderPayload(payload){
  return fetchWithTimeout(GOOGLE_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams(payload).toString(),
    redirect: "follow"
  }, 25000).then(r => r.json().catch(()=> ({})));
}
async function flushPendingOrders(){
  let q = [];
  try{ q = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); }catch(e){}
  if(!q.length) return { sent: 0, pending: 0, confirmed: [] };
  const confirmed = [];
  let sent = 0;
  for(const payload of q){
    try{
      const res = await postOrderPayload(payload);
      // امسح من الطابور فقط لما السيرفر يقول نجح (أو الطلب مسجل أصلاً)
      if(res && (res.status === 'success' || res.result === 'success')){
        removeQueuedPayload(payload.orderId);
        confirmed.push(payload.orderId);
        sent++;
      } else if(res && (res.status === 'store_closed' || res.result === 'store_closed')){
        removeQueuedPayload(payload.orderId);   // المطعم مغلق: مفيش فايدة من التكرار
        showMiniToast('المطعم مغلق حالياً — لم يتم تسجيل الطلب', false, 7000);
      } else if(res && res.message === 'Empty cart'){
        removeQueuedPayload(payload.orderId);   // بيانات تالفة: التكرار مش هيفيد
      }
      // أي رد تاني (busy / error): يفضل في الطابور ويتجرب تاني
    }catch(e){
      // الاتصال مقطوع: يفضل في الطابور
    }
  }
  let pending = 0;
  try{ pending = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]').length; }catch(e){}
  return { sent, pending, confirmed };
}
// ===== تصحيح رقم العميل (يظهر صح + صالح للواتساب الدولي) =====
function normalizePhone(p){
  if(!p) return { display: 'غير متوفر', wa: '' };
  let d = String(p).replace(/[^\d+]/g, '');
  if(d.startsWith('+')) d = d.slice(1);
  if(d.startsWith('20') && d.length > 11) d = d.slice(2); // 20xxxxxxxxxx → xxxxxxxxx
  let display = d;
  if(d.length === 10 && d.startsWith('1')) display = '0' + d;          // 1552871998 → 01552871998
  else if(d.length === 12 && d.startsWith('20')) display = '0' + d.slice(2);
  const waDigits = display.replace(/^0/, '');
  return { display, wa: waDigits ? '20' + waDigits : '' }; // صيغة دولية للواتساب
}

let adminFetchFails = 0;
let adminAutoRetryTimer = null;
function scheduleAdminAutoRetry(){
  clearTimeout(adminAutoRetryTimer);
  adminAutoRetryTimer = setTimeout(()=>{
    // إعادة محاولة في الخلفية تلقائياً (البانل مفتوح) — من غير ما تدوس أي حاجة
    if(sessionAdminPassword) loadAdminOrders();
  }, 14000);
}
async function loadAdminOrders(btn){
  const container = document.getElementById('adminOrdersContainer');
  if(!container || !sessionAdminPassword) return;
  if(btn) spinnerStart(btn, '');
  container.innerHTML = ORDERS_SKELETON;

  try {
    // مهلة أوسع: الـ Apps Script بيسخّن أحياناً وياخد 15-30 ثانية
    const res = await fetchWithTimeout(`${GOOGLE_SCRIPT_URL}?action=getAllOrders&password=${encodeURIComponent(sessionAdminPassword)}&_=${Date.now()}`, {}, 30000);
    const data = await res.json();
    adminFetchFails = 0;
    clearTimeout(adminAutoRetryTimer);

    if(data.status === "unauthorized"){
      spinnerStop(btn);
      alert("انتهت الجلسة — كلمة المرور غير صحيحة.");
      sessionAdminPassword = null;
      localStorage.removeItem('tokyo_admin_pw');
      updateBellVisibility();
      closeAdmin();
      return;
    }

    if(data.storeState){
      applyStoreStateToUI(data.storeState === "OPEN");
    }

    if(data.status === "success" && Array.isArray(data.orders)){
      const clean = sanitizeOrders(data.orders);
      cacheOrders(clean);
      checkForNewOrders(clean);
      renderOrdersList(clean);
    } else {
      renderOrdersList([]);
    }
  } catch(e) {
    adminFetchFails++;
    if(e && e.name === 'AbortError'){
      showMiniToast('السيرفر بطيء في الرد — جاري إعادة المحاولة', false, 5000);
    }
    const cached = readOrdersCache();
    if(cached){
      renderOrdersList(cached.orders);
      container.insertAdjacentHTML('beforeend', '<div style="text-align:center; color:#e0b088; font-size:12px; padding:10px; background:rgba(224,176,136,0.06); border:1px solid rgba(224,176,136,0.14); border-radius:10px; margin-top:12px;"><i class="fa-solid fa-rotate fa-spin" style="margin-inline-end:6px;"></i> تعذر مؤقتاً في الاتصال بالشيت — <b>جاري إعادة المحاولة تلقائياً</b> كل 14 ثانية وسيتم التحديث فور وصول الاتصال</div>');
    } else {
      container.innerHTML = '<div style="text-align:center; color:var(--coral); padding:20px; font-size:12px;">تعذر الاتصال بالسيرفر — جاري إعادة المحاولة تلقائياً...</div>';
    }
    pingServer(); // فحص النسخة تلقائياً
    scheduleAdminAutoRetry(); // إعادة الاتصال لوحدها
  }
  if(btn) spinnerStop(btn);
}

function setOrderStatusAdmin(orderId, newStatus, btn){
  if(!sessionAdminPassword) return;

  const btns = btn.parentElement.querySelectorAll('.adm-btn');
  btns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  spinnerStart(btn, '');

  postScript({
    action: "updateStatus",
    orderId: orderId,
    newStatus: newStatus,
    password: sessionAdminPassword
  }).then((res) => {
    spinnerStop(btn);
    const ok = res && (res.status === 'success' || res.result === 'updated');
    if(ok){
      showMiniToast('تم تحديث حالة #' + orderId + ' إلى "' + newStatus + '" ✓', true, 3500);
      if(localStorage.getItem('tokyo_active_order_id') === orderId){
        updateTrackerUIByStatus(newStatus);
      }
    } else if(res && res.status === 'unauthorized'){
      showMiniToast('كلمة المرور غير صحيحة — أعد تسجيل الدخول', false, 6000);
    } else {
      // فشل الحفظ: رجّع الزر النشط للحالة الفعلية من السيرفر
      showMiniToast('السيرفر لم يؤكد حفظ الحالة — اضغط "فحص"', false, 7000);
      loadAdminOrders();
    }
  }).catch(()=>{
    spinnerStop(btn);
    showMiniToast('تعذر حفظ الحالة — تأكد من الاتصال بالإنترنت', false, 6000);
    loadAdminOrders();
  });
}
// ===== أوامر الأدمن: POST (مش GET) عشان كلمة المرور ما تتسجلش في سجلات الروابط =====
function postScript(params, ms){
  return fetchWithTimeout(GOOGLE_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams(params).toString(),
    redirect: "follow"
  }, ms || 25000).then(r => r.json().catch(() => ({})));
}
// GET احتياطي: لو النسخة المنشورة قديمة ومش بتتعامل مع الأمر في doPost
function getScript(params, ms){
  const q = new URLSearchParams(params).toString();
  return fetchWithTimeout(`${GOOGLE_SCRIPT_URL}?${q}&_=${Date.now()}`, {}, ms || 20000)
    .then(r => r.json().catch(() => ({})));
}
function postAdminAction(params){
  return postScript(params).then(res=>{
    // النسخة القديمة كانت بترد بحاجات غريبة على أوامر الحذف (مثلاً status:found)
    const known = res && (res.status === 'success' || res.status === 'notfound' ||
                          res.status === 'unauthorized' || res.status === 'error');
    if(known) return res;
    return getScript(params);
  });
}
function showMiniToast(msg, ok, ms){
  const c = document.getElementById('adminToastContainer');
  if(!c) return;
  const t = document.createElement('div');
  t.style.cssText = 'background:linear-gradient(135deg,#1f2020,#181818); border:1px solid ' + (ok ? 'rgba(129,199,132,0.28)' : 'rgba(224,176,136,0.32)') + '; border-radius:12px; padding:12px 16px; color:' + (ok ? '#a5d6a7' : '#e0b088') + '; font-size:12.5px; font-weight:600; display:flex; gap:9px; align-items:center; pointer-events:auto; animation:slideInToast .35s cubic-bezier(.16,1,.3,1);';
  t.innerHTML = '<i class="fa-solid ' + (ok ? 'fa-circle-check' : 'fa-triangle-exclamation') + '"></i> ' + msg;
  c.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateY(-8px)'; setTimeout(()=>t.remove(), 350); }, ms || 4000);
}
function deleteOrderAdmin(orderId, btn){
  if(!sessionAdminPassword){ alert("انتهت الجلسة، أعد تسجيل الدخول."); return; }
  if(!confirm('هل أنت متأكد من حذف الطلب #' + orderId + '؟')) return;
  if(btn) spinnerStart(btn, '');
  postAdminAction({ action:'deleteOrder', orderId: orderId, password: sessionAdminPassword })
    .then(res=>{
      if(btn) spinnerStop(btn);
      if(res && res.status === 'success'){ showMiniToast('تم حذف الطلب #' + orderId + ' ✓', true); }
      else if(res && res.status === 'notfound'){ showMiniToast('الطلب #' + orderId + ' غير موجود في الشيت', false, 6000); }
      else if(res && res.status === 'unauthorized'){ showMiniToast('كلمة المرور غير صحيحة', false, 6000); }
      else { showMiniToast('السيرفر لم يؤكد الحذف — اضغط زر "فحص" وانشر نسخة جديدة من الإسكربت', false, 8000); }
      loadAdminOrders();
    })
    .catch(()=>{ if(btn) spinnerStop(btn); showMiniToast('تعذر الاتصال بالسيرفر — أعد المحاولة', false); });
}
function deleteAllOrdersAdmin(btn){
  if(!sessionAdminPassword){ alert("انتهت الجلسة، أعد تسجيل الدخول."); return; }
  if(!confirm('هل أنت متأكد من حذف جميع الطلبات نهائياً من الشيت؟ لا يمكن التراجع.')) return;
  if(btn) spinnerStart(btn, '');
  postAdminAction({ action:'clearOrders', password: sessionAdminPassword })
    .then(res=>{
      if(btn) spinnerStop(btn);
      if(res && res.status === 'success'){
        const cnt = (typeof res.removed === 'number') ? res.removed : null;
        showMiniToast(cnt !== null ? ('تم مسح ' + cnt + ' طلب ✓') : 'تم مسح جميع الطلبات ✓', true);
      }
      else if(res && res.status === 'unauthorized'){ showMiniToast('كلمة المرور غير صحيحة', false, 6000); }
      else { showMiniToast('السيرفر لم يؤكد المسح — تأكد من نشر الإسكربت الجديد', false, 8000); }
      loadAdminOrders();
    })
    .catch(()=>{ if(btn) spinnerStop(btn); showMiniToast('تعذر الاتصال بالسيرفر — أعد المحاولة', false); });
}

// ===== فحص نسخة الإسكربت المنشورة (ping) =====
function pingServer(btn){
  if(btn) spinnerStart(btn, '');
  fetchWithTimeout(`${GOOGLE_SCRIPT_URL}?action=ping&_=${Date.now()}`, {}, 15000)
    .then(r => r.json().catch(() => ({})))
    .then(d => {
      if(btn) spinnerStop(btn);
      const note = document.getElementById('serverStatusNote');
      const alive = d && d.status === 'success';
      const versionOk = alive && d.version === REQUIRED_SERVER_VERSION;
      serverVersionOk = !!versionOk;

      if(versionOk){
        if(note){ note.style.display = 'none'; }
        showMiniToast('السيرفر محدث (v' + d.version + ') ✓ — الحذف والإيميل جاهزين', true, 4500);
      } else if(alive){
        // بيستجيب لـ ping بس بإصدار مختلف عن المطلوب
        if(note){
          note.style.display = 'flex';
          note.innerHTML =
            '<div style="font-weight:800;"><i class="fa-solid fa-triangle-exclamation"></i> إصدار الإسكربت المنشور: ' +
            escapeHTML(String(d.version || 'غير معروف')) + ' — المطلوب: ' + REQUIRED_SERVER_VERSION + '</div>' +
            '<div>انشر آخر نسخة: Apps Script → Deploy → Manage deployments → ✏️ Edit → Version: <b>New version</b> → Deploy</div>';
        }
        showMiniToast('الإصدار المنشور مختلف — انشر نسخة جديدة', false, 7000);
      } else {
        if(note){
          note.style.display = 'flex';
          note.innerHTML =
            '<div style="font-weight:800;"><i class="fa-solid fa-triangle-exclamation"></i> نسخة الإسكربت المنشورة قديمة — الحذف/التأكيد/الإيميل مش شغالة</div>' +
            '<div>اعمل 4 خطوات بالترتيب:<br>' +
            '1️⃣ افتح مشروع الإسكربت: <b>من جوجل شيت: Extensions → Apps Script</b> (أو script.google.com وافتح نفس المشروع اللي ليك عليه) — المشروع الصح هو اللي بيحفظ طلباتك<br>' +
            '2️⃣ افتح ملف <b style="direction:ltr; unicode-bidi:embed;">code.gs</b> والصق مكانه كامل محتوى<br>' +
            '<b style="direction:ltr; unicode-bidi:embed; color:#e0b088;">github.com/AliThabit111/SushiWeb → SushiWeb-main/google-apps-script-code.gs</b><br>' +
            '3️⃣ زر Save ثم <b>Deploy → Manage deployments → Edit → New version → Deploy</b><br>' +
            '4️⃣ ارجع للموقع واضغط زر <b>فحص</b> — هيظهر "محدث ✓" وكل حاجة تشتغل</div>';
        }
        showMiniToast('السيرفر بيستجيب بس بنسخة قديمة — حدّث الإسكربت', false, 7000);
      }
    })
    .catch(()=>{ if(btn) spinnerStop(btn); showMiniToast('تعذر الوصول للسيرفر — تأكد من الاتصال بالإنترنت', false); });
}
// ===== تشخيص: إيه الشيت اللي الإسكربت شغال عليه فعلاً؟ =====
// ده بيجاوب على سؤال "الموقع مربوط بأنهي داتا بيز؟" — لو الاسم مش اسم شيت
// الطلبات بتاعك، يبقى فتحت مشروع Apps Script غلط.
function serverDiag(btn){
  if(!sessionAdminPassword){ showMiniToast('سجّل الدخول كأدمن الأول', false); return; }
  if(btn) spinnerStart(btn, '');
  const note = document.getElementById('serverStatusNote');
  postScript({ action: 'diag', password: sessionAdminPassword })
    .then(d => {
      if(btn) spinnerStop(btn);
      if(!note) return;
      note.style.display = 'flex';

      if(d && d.status === 'success'){
        const warn = [];
        if(d.version !== REQUIRED_SERVER_VERSION){
          warn.push('الإصدار المنشور ' + escapeHTML(String(d.version || '؟')) +
                    ' والمطلوب ' + REQUIRED_SERVER_VERSION + ' — انشر نسخة جديدة');
        }
        if(d.adminEmail !== 'مضبوط') warn.push('إيميل الإشعارات غير مضبوط');
        if(d.passwordSource !== 'Script Properties'){
          warn.push('كلمة المرور مكتوبة داخل الكود المنشور على GitHub — انقلها لـ Script Properties');
        }
        if(typeof d.emailQuotaLeft === 'number' && d.emailQuotaLeft <= 0){
          warn.push('رصيد الإيميلات اليومي خلص — الإيميل مش هيوصل لبكرة');
        }

        note.innerHTML =
          '<div style="font-weight:800; color:#a5d6a7;"><i class="fa-solid fa-circle-check"></i> الموقع متصل بالشيت الصح</div>' +
          '<div>📊 ملف الشيت: <b>' + escapeHTML(String(d.spreadsheetName || '؟')) + '</b></div>' +
          '<div>📑 التاب: <b>' + escapeHTML(String(d.sheetName || '؟')) + '</b>' +
            (d.sheetTabs > 1 ? ' <span style="opacity:0.7;">(من ' + d.sheetTabs + ' تابات)</span>' : '') + '</div>' +
          '<div>🧾 عدد الطلبات المسجلة: <b>' + escapeHTML(String(d.rows)) + '</b></div>' +
          '<div>🏪 حالة المطعم: <b>' + (d.storeState === 'OPEN' ? 'مفتوح' : 'مغلق') + '</b></div>' +
          '<div>📧 إيميل الإشعارات: <b>' + escapeHTML(String(d.adminEmail)) + '</b>' +
            (typeof d.emailQuotaLeft === 'number' && d.emailQuotaLeft >= 0
              ? ' <span style="opacity:0.7;">(متاح اليوم: ' + d.emailQuotaLeft + ')</span>' : '') + '</div>' +
          '<div>🔐 كلمة المرور من: <b>' + escapeHTML(String(d.passwordSource || '؟')) + '</b></div>' +
          '<div>⚙️ إصدار الإسكربت: <b>' + escapeHTML(String(d.version || '؟')) + '</b>' +
            ' • 🕐 وقت السيرفر: ' + escapeHTML(String(d.serverTime || '؟')) + '</div>' +
          (warn.length
            ? '<div style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(224,176,136,0.25);">' +
              '<b>⚠️ محتاج انتباه:</b><br>• ' + warn.join('<br>• ') + '</div>'
            : '');
        showMiniToast('الشيت المتصل: ' + (d.spreadsheetName || '؟'), warn.length === 0, 6000);

      } else if(d && d.status === 'unauthorized'){
        note.innerHTML = '<div style="font-weight:800;"><i class="fa-solid fa-lock"></i> كلمة المرور غير صحيحة</div>';
        showMiniToast('كلمة المرور غير صحيحة', false, 6000);
      } else {
        // النسخة القديمة مش عارفة أمر diag
        note.innerHTML =
          '<div style="font-weight:800;"><i class="fa-solid fa-triangle-exclamation"></i> النسخة المنشورة قديمة — التشخيص غير متاح</div>' +
          '<div>انشر آخر نسخة الأول: Apps Script → Deploy → Manage deployments → ✏️ Edit → Version: <b>New version</b> → Deploy</div>';
        showMiniToast('التشخيص محتاج إصدار ' + REQUIRED_SERVER_VERSION, false, 7000);
      }
    })
    .catch(()=>{
      if(btn) spinnerStop(btn);
      showMiniToast('تعذر الوصول للسيرفر — تأكد من الاتصال', false, 6000);
    });
}

// تأكيد وصول الطلب للشيت. ملاحظة: checkOrder مش محتاج كلمة مرور في v3
// (النسخة القديمة كانت بتطلبها فالتأكيد كان بيفشل دايماً ويعيد الإرسال بلا داعي).
function verifyOrderDelivery(orderId, attempt){
  attempt = attempt || 0;
  fetchWithTimeout(`${GOOGLE_SCRIPT_URL}?action=checkOrder&orderId=${encodeURIComponent(orderId)}&_=${Date.now()}`, {}, 25000)
    .then(r => r.json().catch(() => ({})))
    .then(d => {
      if(d && d.status === 'found'){
        removeQueuedPayload(orderId);   // اتسجل فعلاً: شيله من الطابور
        return;
      }
      if(attempt < 3){
        setTimeout(()=>{
          try{
            const q = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
            const p = q.find(x => x.orderId === orderId);
            if(p){
              postOrderPayload(p).then(res=>{
                if(res && (res.status === 'success' || res.result === 'success')) removeQueuedPayload(orderId);
              }).catch(()=>{});
            }
          }catch(e){}
          verifyOrderDelivery(orderId, attempt + 1);
        }, 20000);
      } else {
        showMiniToast('لم يتأكد تسجيل الطلب في السيرفر رغم المحاولات — سيُعاد إرساله تلقائياً لاحقاً', false, 9000);
      }
    })
    .catch(()=>{ if(attempt < 3) setTimeout(()=>verifyOrderDelivery(orderId, attempt + 1), 20000); });
}
// ===== Spinner للداشبورد: مؤشر انتظار أثناء أي أكشن =====
function spinnerStart(btn, label){
  if(!btn) return;
  btn.dataset.origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.classList.add('btn-loading');
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-inline-end:6px;"></i>' + (label || '');
}
function spinnerStop(btn){
  if(!btn) return;
  if(btn.dataset.origHtml !== undefined) btn.innerHTML = btn.dataset.origHtml;
  btn.disabled = false;
  btn.classList.remove('btn-loading');
  delete btn.dataset.origHtml;
}

let logoClicks = 0;
let clickTimer = null;

function handleSecretClick(e) {
  e.preventDefault();
  logoClicks++;
  clearTimeout(clickTimer);
  const seal = document.querySelector('.brand .seal');
  const hint = document.getElementById('adminClickHint');
  // feedback بصرية فورية لكل ضغطة
  if(seal){ seal.classList.remove('pulse-once'); void seal.offsetWidth; seal.classList.add('pulse-once'); }
  if(hint){ hint.textContent = logoClicks + '/5'; hint.style.opacity = '1'; hint.style.transform = 'scale(1)'; }

  if (logoClicks >= 5) {
    logoClicks = 0;
    if(hint){ hint.textContent = '✓'; setTimeout(()=>{ hint.style.opacity='0'; hint.style.transform='scale(0.6)'; }, 650); }
    const isLogged = sessionAdminPassword || localStorage.getItem('tokyo_admin_pw');
    if(isLogged){
      openAdminConfirm();
    } else {
      openAdmin();
    }
  } else {
    clickTimer = setTimeout(() => {
      logoClicks = 0;
      if(hint){ hint.style.opacity='0'; hint.style.transform='scale(0.6)'; }
    }, 2200);
  }
}
function openAdminConfirm(){
  const ao = document.getElementById('adminConfirmOverlay');
  const am = document.getElementById('adminConfirmModal');
  if(ao) ao.classList.add('open');
  if(am) am.classList.add('open');
}
function closeAdminConfirm(){
  const ao = document.getElementById('adminConfirmOverlay');
  const am = document.getElementById('adminConfirmModal');
  if(ao) ao.classList.remove('open');
  if(am) am.classList.remove('open');
  const btn = document.getElementById('adminConfirmYes');
  if(btn){ spinnerStop(btn); btn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> نعم، فتح'; }
}
async function confirmOpenAdmin(){
  const btn = document.getElementById('adminConfirmYes');
  spinnerStart(btn, 'جاري الفتح...');
  // فتح سريع
  await new Promise(r=> setTimeout(r, 350));
  closeAdminConfirm();
  if(btn) spinnerStop(btn);
  openAdmin();
}

async function openAdmin(){
  let pass = localStorage.getItem('tokyo_admin_pw');
  if(!pass){
    pass = prompt("أدخل كلمة مرور الإدارة:");
    if(!pass) return;
  }

  // فتح فوري — بدون انتظار السيرفر (تحقق الطلبات يتم داخل loadAdminOrders)
  sessionAdminPassword = pass;
  localStorage.setItem('tokyo_admin_pw', pass);
  updateBellVisibility(); // ظهر الجرس للأدمن
  const ao = document.getElementById('adminOverlay');
  const am = document.getElementById('adminModal');
  if(ao) ao.classList.add('open');
  if(am) am.classList.add('open');

  // كاش فوري ثم تحديث من السيرفر
  const cached = readOrdersCache();
  if(cached) renderOrdersList(cached.orders);
  loadAdminOrders();
  pingServer(); // فحص تلقائي: هل نسخة الإسكربت محدثة؟
  // اطلب إذن الإشعارات عند تسجيل الدخول → الرت للطلبات الجديدة تلقائي
  try { if(window.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch(e){}
}

function closeAdmin(){
  const ao = document.getElementById('adminOverlay');
  const am = document.getElementById('adminModal');
  if(ao) ao.classList.remove('open');
  if(am) am.classList.remove('open');
}

function applyStoreStateToUI(isOpen) {
  isStoreGloballyOpen = isOpen;
  const statusDot = document.querySelector('.status-dot');
  const admDot = document.getElementById('admStatusDot');
  const shopStatusText = document.getElementById('shopStatus');
  const sendBtn = document.getElementById('sendBtn');
  const admStatusText = document.getElementById('admStatusText');
  const toggleBtn = document.getElementById('toggleStatusBtn');

  if (isOpen) {
    if(statusDot){ statusDot.style.background = '#81c784'; statusDot.style.boxShadow = '0 0 0 4px rgba(129,199,132,0.18)'; }
    if(admDot){ admDot.style.background = '#81c784'; admDot.style.boxShadow = '0 0 0 5px rgba(129,199,132,0.14)'; }
    if(shopStatusText) shopStatusText.textContent = 'المطعم متاح لاستقبال الطلبات الآن';
    if(sendBtn) {
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> إرسال وتأكيد الطلب';
      sendBtn.style.opacity = '1';
      sendBtn.style.cursor = 'pointer';
    }
    if(admStatusText) {
      admStatusText.textContent = 'المطعم يستقبل الطلبات • مفتوح';
      admStatusText.style.color = '#a8c5b5';
    }
    if(toggleBtn) {
      toggleBtn.textContent = 'إغلاق المطعم';
      toggleBtn.style.background = 'rgba(192,0,13,0.09)';
      toggleBtn.style.color = '#ff9a8a';
      toggleBtn.style.border = '1px solid rgba(192,0,13,0.18)';
    }
  } else {
    if(statusDot){ statusDot.style.background = '#ef9a9a'; statusDot.style.boxShadow = '0 0 0 4px rgba(239,154,154,0.16)'; }
    if(admDot){ admDot.style.background = '#ef9a9a'; admDot.style.boxShadow = '0 0 0 5px rgba(239,154,154,0.14)'; }
    if(shopStatusText) shopStatusText.textContent = 'المطعم مغلق حالياً ولا يستقبل طلبات';
    if(sendBtn) {
      sendBtn.disabled = true;
      sendBtn.innerHTML = '<i class="fa-solid fa-ban"></i> المطعم مغلق حالياً';
      sendBtn.style.opacity = '0.5';
      sendBtn.style.cursor = 'not-allowed';
    }
    if(admStatusText) {
      admStatusText.textContent = 'المطعم مغلق • لا يستقبل طلبات';
      admStatusText.style.color = '#ef9a9a';
    }
    if(toggleBtn) {
      toggleBtn.textContent = 'فتح المطعم الآن';
      toggleBtn.style.background = 'rgba(56,142,60,0.12)';
      toggleBtn.style.color = '#a5d6a7';
      toggleBtn.style.border = '1px solid rgba(56,142,60,0.20)';
    }
  }
}

async function fetchStoreStatusFromServer() {
  try {
    const res = await fetchWithTimeout(`${GOOGLE_SCRIPT_URL}?action=getStoreStatus`, {}, 10000);
    const data = await res.json();
    if(data.status === "success"){
      applyStoreStateToUI(data.storeState === "OPEN");
    }
  } catch(e) {
    console.log("Could not sync store state:", e);
  }
}

function toggleStoreStatus() {
  if (!sessionAdminPassword) {
    alert("انتهت الجلسة، يرجى تسجيل الدخول مجدداً.");
    closeAdmin();
    return;
  }
  
  const nextState = isStoreGloballyOpen ? "CLOSED" : "OPEN";
  const toggleBtn = document.getElementById('toggleStatusBtn');
  spinnerStart(toggleBtn, '');
  applyStoreStateToUI(nextState === "OPEN"); // تفاؤلي فوري

  postScript({
    action: "toggleStore",
    state: nextState,
    password: sessionAdminPassword
  }).then((res) => {
    spinnerStop(toggleBtn);
    if(res && res.storeState){
      applyStoreStateToUI(res.storeState === "OPEN");   // الحالة الفعلية من السيرفر
      showMiniToast(res.storeState === "OPEN" ? 'المطعم مفتوح الآن ✓' : 'تم إغلاق المطعم ✓', true, 3500);
    } else if(res && res.status === 'unauthorized'){
      applyStoreStateToUI(nextState !== "OPEN");
      showMiniToast('كلمة المرور غير صحيحة', false, 6000);
    } else {
      applyStoreStateToUI(nextState !== "OPEN");
      showMiniToast('السيرفر لم يؤكد تغيير الحالة — اضغط "فحص"', false, 7000);
    }
  }).catch(()=>{
    spinnerStop(toggleBtn);
    applyStoreStateToUI(nextState !== "OPEN"); // رجّع الحالة القديمة
    showMiniToast('تعذر تنفيذ الإجراء — تأكد من الاتصال بالإنترنت', false, 6000);
  });
}

function scrollToCat(key, btn){
  document.querySelectorAll('.cat-pill').forEach(p=>p.classList.remove('active'));
  if(btn) btn.classList.add('active');
  const el = document.getElementById('cat-'+key);
  if(!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - 110;
  if(_lenis){ _lenis.scrollTo(y); } else { window.scrollTo({top:y, behavior:'smooth'}); }
}

// ===== New: Carousel & Animations (isolated, no conflict) =====
function scrollCarousel(catKey, dir){
  const track = document.getElementById('carousel-' + catKey);
  if(!track) return;
  const amount = Math.max(280, track.clientWidth * 0.85);
  const isRTL = document.documentElement.dir === 'rtl';
  // RTL: scrollLeft يبدأ بالسالب، عكس الإشارة ليشتغل السهم في اتجاهه
  track.scrollBy({ left: (isRTL ? -dir : dir) * amount, behavior: 'smooth' });
  setTimeout(()=> updateCarouselArrows(catKey), 380);
}
function updateCarouselArrows(catKey){
  const track = document.getElementById('carousel-' + catKey);
  if(!track) return;
  const wrapper = track.closest('.carousel-wrapper');
  if(!wrapper) return;
  const prev = wrapper.querySelector('.carousel-prev');
  const next = wrapper.querySelector('.carousel-next');
  const sl = Math.abs(track.scrollLeft || 0);
  const max = Math.max(0, track.scrollWidth - track.clientWidth - 4);
  if(prev) prev.style.opacity = sl <= 4 ? '0.35' : '1';
  if(next) next.style.opacity = sl >= max - 4 ? '0.35' : '1';
  if(prev) prev.style.pointerEvents = sl <= 4 ? 'none' : 'auto';
  if(next) next.style.pointerEvents = sl >= max - 4 ? 'none' : 'auto';
  // hide arrows entirely if no scroll needed
  const needScroll = track.scrollWidth > track.clientWidth + 10;
  if(wrapper){
    wrapper.classList.toggle('no-scroll', !needScroll);
  }
}
let _fadeObserver = null;
function initFadeInObserver(){
  if(_fadeObserver) return;
  const els = document.querySelectorAll('.fade-in-up, .slide-in-right');
  if(!els.length) return;
  if(!('IntersectionObserver' in window)){
    els.forEach(e=> e.classList.add('visible'));
    return;
  }
  _fadeObserver = new IntersectionObserver((entries, obs)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('visible');
        obs.unobserve(entry.target);
      }
    });
  }, { root:null, rootMargin:'0px', threshold:0.12 });
  els.forEach(el=> _fadeObserver.observe(el));
  // also observe future cat-sections dynamically
  const main = document.getElementById('menu-start');
  if(main && 'MutationObserver' in window){
    new MutationObserver(()=>{
      document.querySelectorAll('.cat-section.fade-in-up:not(.visible), .slide-in-right:not(.visible)').forEach(el=>{
        if(_fadeObserver) _fadeObserver.observe(el);
      });
    }).observe(main, {childList:true, subtree:true});
  }
}

let lastKnownOrderIds = new Set();
let lastKnownCount = 0;
let bellUnread = 0;
// الجرس يظهر للأدمن المسجل فقط
function updateBellVisibility(){
  const bell = document.getElementById('adminBellBtn');
  if(!bell) return;
  const isAdmin = !!(sessionAdminPassword || localStorage.getItem('tokyo_admin_pw'));
  bell.style.display = isAdmin ? 'flex' : 'none';
  if(!isAdmin){ bellUnread = 0; updateBellBadge(); }
}
function updateBellBadge(){
  const badge = document.getElementById('bellBadge');
  if(!badge) return;
  if(bellUnread > 0){
    badge.textContent = bellUnread > 9 ? '9+' : bellUnread;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}
function ringBell(){
  const bell = document.getElementById('adminBellBtn');
  if(!bell) return;
  bell.classList.remove('ring');
  void bell.offsetWidth;
  bell.classList.add('ring');
}
function handleBellClick(){
  // دخول مباشر للبانل (الجرس يظهر للأدمن بس)
  openAdmin();
  bellUnread = 0;
  updateBellBadge();
}
function showAdminToast(order){
  const container = document.getElementById('adminToastContainer');
  if(!container) return;
  const toast = document.createElement('div');
  toast.style.cssText = 'background:linear-gradient(135deg, #1f2020 0%, #2a1a1a 100%); border:1px solid rgba(255,138,128,0.18); border-radius:14px; padding:14px 16px; display:flex; align-items:center; gap:12px; box-shadow:0 12px 32px rgba(0,0,0,0.45); pointer-events:auto; animation: slideInToast 0.4s cubic-bezier(0.16,1,0.30,1);';
  toast.innerHTML = `
    <div style="width:42px; height:42px; border-radius:11px; background:rgba(192,0,13,0.12); border:1px solid rgba(192,0,13,0.18); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
      <i class="fa-solid fa-bell" style="color:#ff9a8a; font-size:18px;"></i>
    </div>
    <div style="flex:1; min-width:0;">
      <div style="color:#f5ece8; font-size:13px; font-weight:800;">طلب جديد! #${escapeHTML(order.orderId||'')}</div>
      <div style="color:#b8b2aa; font-size:12px; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(order.name||'عميل')} • ${escapeHTML(order.items||'')}</div>
    </div>
    <button onclick="this.parentElement.remove(); openAdmin();" style="background:#b50e18; color:#fff; border:none; border-radius:10px; padding:8px 12px; font-size:11px; font-weight:700; cursor:pointer; flex-shrink:0;">عرض</button>
    <button onclick="this.parentElement.remove()" style="background:transparent; border:none; color:#c6c6c7; cursor:pointer; padding:6px;"><i class="fa-solid fa-xmark"></i></button>
  `;
  container.appendChild(toast);
  // vibration + sound
  try { if(navigator.vibrate) navigator.vibrate([180,100,180]); } catch(e){}
  try {
    const audio = document.getElementById('adminNotifySound');
    if(audio) { audio.currentTime = 0; audio.play().catch(()=>{}); }
    // fallback beep via Web Audio
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type='sine'; o.frequency.value=880; g.gain.value=0.12;
    o.connect(g); g.connect(ctx.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.6); setTimeout(()=>o.stop(),650);
  } catch(e){}
  // browser notification
  try {
    if(window.Notification && Notification.permission==='granted'){
      new Notification('طلب جديد - TOKYO SUSHI', { body:`#${order.orderId} من ${order.name} - ${order.items}` });
    } else if(window.Notification && Notification.permission!=='denied'){
      Notification.requestPermission();
    }
  } catch(e){}
  // ومض عنوان التبويب لو الموقع مفتوح في تبويب تاني
  try {
    document.title = '🔔 طلب جديد! - TOKYO SUSHI';
    clearTimeout(window.__titleTimer);
    window.__titleTimer = setTimeout(()=>{ document.title = 'TOKYO SUSHI — المنصة الرسمية للطلب المباشر'; }, 9000);
  } catch(e){}
  setTimeout(()=>{ toast.style.opacity='0'; toast.style.transform='translateY(-10px)'; setTimeout(()=>toast.remove(), 400); }, 7000);
}
function checkForNewOrders(orders){
  orders = sanitizeOrders(orders);
  if(!orders.length) return;
  const currentIds = orders.map(o=>o.orderId);
  const newOnes = orders.filter(o=> !lastKnownOrderIds.has(o.orderId));
  // init first time - just store
  if(lastKnownCount===0 && lastKnownOrderIds.size===0){
    currentIds.forEach(id=> lastKnownOrderIds.add(id));
    lastKnownCount = orders.length;
    return;
  }
  if(newOnes.length>0){
    newOnes.forEach(o=> showAdminToast(o));
    // update counts badge if admin closed
    const cntEl = document.getElementById('admOrdersCount');
    if(cntEl){ cntEl.textContent = orders.length + ' طلب'; cntEl.style.display='inline-flex'; }
    // جرس الناف بار: عداد + رنّة ذهبية
    bellUnread += newOnes.length;
    updateBellBadge();
    ringBell();
  }
  lastKnownOrderIds = new Set(currentIds);
  lastKnownCount = orders.length;
}
async function pollNewOrders(){
  const pw = sessionAdminPassword || localStorage.getItem('tokyo_admin_pw');
  if(!pw) return;
  try {
    const res = await fetchWithTimeout(`${GOOGLE_SCRIPT_URL}?action=getAllOrders&password=${encodeURIComponent(pw)}&_=${Date.now()}`, {}, 30000);
    const data = await res.json();
    if(data.status==='unauthorized') return;
    if(data.status==='success' && Array.isArray(data.orders)){
      checkForNewOrders(data.orders);
    }
  } catch(e){}
}

let _lenis = null;
function initLenisAndGSAP(){
  // ---- Lenis smooth scroll ----
  try {
    if (typeof Lenis !== 'undefined') {
      _lenis = new Lenis({
        duration: 1.15,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        smoothTouch: false,
        gestureOrientation: 'vertical'
      });
      function raf(time){ _lenis.raf(time); requestAnimationFrame(raf); }
      requestAnimationFrame(raf);
      if (window.gsap && window.ScrollTrigger) {
        _lenis.on('scroll', ScrollTrigger.update);
      }
    }
  } catch(e){ console.log('Lenis init', e); }

  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  try { gsap.registerPlugin(ScrollTrigger); } catch(e){}

  // ---- GSAP: slide + clip reveal for about image (short delay 0.18, calmer) ----
  try {
    gsap.utils.toArray('.slide-in-right').forEach(el=>{
      gsap.fromTo(el,
        { x: 60, clipPath: 'inset(0% 0% 100% 0% round 18px)', autoAlpha: 0 },
        {
          x: 0, clipPath: 'inset(0% 0% 0% 0% round 18px)', autoAlpha: 1,
          duration: 1.2,
          delay: 0.18,
          ease: "power3.out",
          overwrite: "auto",
          scrollTrigger: { trigger: el, start: "top 82%", once: true }
        }
      );
    });
  } catch(e){}

  // ---- Hero image parallax on scroll ----
  try {
    const heroWrap = document.querySelector('.hero-img-wrap');
    if(heroWrap){
      gsap.to(heroWrap, { yPercent: 10, ease: 'none',
        scrollTrigger: { trigger: '.hero-new', start: 'top top', end: 'bottom top', scrub: true } });
    }
  } catch(e){}

  // ---- Hero texts stagger (immediateRender:false = لا يتخبى لو فشل) ----
  try {
    const heroH1 = document.querySelector('.hero-new h1');
    if (heroH1) {
      gsap.timeline({ delay: 0.15, defaults: { immediateRender: false } })
        .from('.hero-new h1', { y: 28, autoAlpha: 0, duration: 1.0, ease: "power3.out" })
        .from('.hero-new p', { y: 18, autoAlpha: 0, duration: 0.9, stagger: 0.11, ease: "power3.out" }, "-=0.7")
        .from('.hero-new a, .hero-new button', { y: 14, autoAlpha: 0, duration: 0.7, stagger: 0.07, ease: "power2.out" }, "-=0.55");
    }
  } catch(e){}

  // ---- About texts ----
  try {
    gsap.utils.toArray('#about-zenith h2, #about-zenith p, #about-zenith .flex span, #about-zenith a').forEach((el,i)=>{
      gsap.from(el, {
        y: 22, autoAlpha: 0, duration: 0.9, delay: i*0.04, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 92%", once: true }
      });
    });
  } catch(e){}

  // ---- Section headers reveal ----
  try {
    gsap.utils.toArray('.cat-header-modern').forEach(h=>{
      gsap.fromTo(h, { y: 22, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.85, ease: "power3.out", immediateRender: false,
          scrollTrigger: { trigger: h, start: "top 92%", once: true } });
    });
  } catch(e){}

  // ---- Cat pills stagger ----
  try {
    const pills = document.querySelectorAll('.cat-pill');
    if(pills.length){
      gsap.fromTo(pills, { y: 12, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.05, ease: "power2.out", immediateRender: false,
          scrollTrigger: { trigger: '.cat-nav', start: 'top 96%', once: true } });
    }
  } catch(e){}

  // ---- Carousel cards & Signature grid ----
  try {
    gsap.utils.toArray('.carousel-track').forEach(track=>{
      const cards = track.querySelectorAll('.card');
      if(!cards.length) return;
      gsap.fromTo(cards,
        { y: 30, scale: 0.96, autoAlpha: 0 },
        { y: 0, scale: 1, autoAlpha: 1, duration: 0.85, stagger: 0.07, ease: "power3.out", immediateRender: false,
          clearProps: "transform",
          scrollTrigger: { trigger: track, start: "top 92%", once: true } }
      );
    });
    const sigSection = document.querySelector('#about-zenith + section');
    const sigCards = sigSection ? sigSection.querySelectorAll('.grid > .group') : [];
    if(sigCards.length){
      // دخول عصري: 3D flip + كشف الصورة من تقيل
      gsap.set(sigSection.querySelector('.grid'), { perspective: 1200 });
      gsap.fromTo(sigCards,
        { y: 44, rotationY: -16, autoAlpha: 0 },
        { y: 0, rotationY: 0, autoAlpha: 1, duration: 1.05, stagger: 0.14, ease: "power3.out", immediateRender: false,
          clearProps: "transform",
          scrollTrigger: { trigger: sigSection, start: "top 82%", once: true } }
      );
      const sigImgs = sigSection.querySelectorAll('.sig-img-wrap img');
      if(sigImgs.length){
        gsap.fromTo(sigImgs,
          { scale: 1.3, autoAlpha: 0.35 },
          { scale: 1, autoAlpha: 1, duration: 1.5, stagger: 0.14, ease: "power2.out", immediateRender: false,
            scrollTrigger: { trigger: sigSection, start: "top 82%", once: true } }
        );
      }
      const badges = sigSection.querySelectorAll('.absolute.top-3 span');
      if(badges.length){
        gsap.fromTo(badges, { scale: 0, autoAlpha: 0 },
          { scale: 1, autoAlpha: 1, duration: 0.5, stagger: 0.15, delay: 0.6, ease: "back.out(2)", immediateRender: false,
            scrollTrigger: { trigger: sigSection, start: "top 82%", once: true } });
      }
    }
  } catch(e){}

  // ---- GSAP 3D Tilt ناعم على الكروت (ديسكتوب فقط) ----
  try {
    if (window.matchMedia('(hover: hover) and (min-width: 769px)').matches) {
      const tiltCards = document.querySelectorAll('.carousel-track .card, #about-zenith + section .group');
      tiltCards.forEach(card=>{
        gsap.set(card, { transformPerspective: 900, force3D: true });
        const rx = gsap.quickTo(card, 'rotationX', { duration: 0.55, ease: 'power3.out' });
        const ry = gsap.quickTo(card, 'rotationY', { duration: 0.55, ease: 'power3.out' });
        const lift = gsap.quickTo(card, 'y', { duration: 0.45, ease: 'power3.out' });
        card.addEventListener('mousemove', (e)=>{
          const r = card.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          ry(px * 5);
          rx(-py * 5);
        });
        card.addEventListener('mouseenter', ()=>{ gsap.set(card, { transformPerspective: 900 }); lift(-6); });
        card.addEventListener('mouseleave', ()=>{ rx(0); ry(0); lift(0); });
      });
    }
  } catch(e){}

  // ---- Footer fade ----
  try {
    const finner = document.querySelector('footer .footer-inner');
    if(finner){
      gsap.fromTo(finner, { y: 24, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.9, ease: "power3.out", immediateRender: false,
          scrollTrigger: { trigger: 'footer', start: 'top 96%', once: true } });
    }
  } catch(e){}

  // refresh ScrollTrigger after Lenis
  try { ScrollTrigger.refresh(); } catch(e){}
}

// PWA: ملف sw.js مش موجود في المشروع، فالتسجيل كان بيفشل دايماً (404 في الكونسول).
// لو ضفته بعدين، فُك التعليق عن الأسطر اللي تحت.
// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('./sw.js').catch(() => {});
//   });
// }

document.addEventListener('DOMContentLoaded', ()=>{
  renderNav();
  renderDeliveryZones();
  renderMenu();
  loadCart(); // استرجاع السلة المحفوظة
  if(localStorage.getItem('tokyo_admin_pw')){
    sessionAdminPassword = localStorage.getItem('tokyo_admin_pw');
    // init last known ids for polling
    pollNewOrders();
  }
  updateBellVisibility(); // الجرس للأدمن فقط
  fetchStoreStatusFromServer();
  fetchLiveOrderStatus();
  initFadeInObserver();
  flushPendingOrders(); // أرسل أي طلبات معلقة من جلسة سابقة
  // Lenis + GSAP calmer animations with 0.18 delay for slide
  try { initLenisAndGSAP(); } catch(e){ console.log('GSAP/Lenis', e); }
  // re-evaluate arrows on resize
  window.addEventListener('resize', ()=>{
    MENU.forEach(c=> updateCarouselArrows(c.key));
  });
  // also init after menu renders with slight delay for GSAP
  setTimeout(()=>{ try{ if(typeof ScrollTrigger!=='undefined') ScrollTrigger.refresh(); }catch(e){} }, 600);
  // Fallback: ensure signature & hero never stay hidden if observer/GSAP fails
  setTimeout(()=>{
    document.querySelectorAll('.fade-in-up:not(.visible), .slide-in-right:not(.visible)').forEach(el=>{
      const rect = el.getBoundingClientRect();
      if(rect.top < window.innerHeight * 1.1) el.classList.add('visible');
    });
    try {
      if(typeof gsap!=='undefined'){
        gsap.utils.toArray('.slide-in-right:not(.visible)').forEach(el=> gsap.set(el, {x:0, autoAlpha:1}));
      }
    } catch(e){}
    // force any stuck-hidden elements visible — بدون المساس بـ transform (GSAP بيديرها)
    document.querySelectorAll('#about-zenith + section .group, .carousel-track .card, .hero-new a, .hero-new button, .hero-new h1, .hero-new p, .cat-header-modern, footer .footer-inner, .cat-pill').forEach(el=>{
      const st = el.style;
      if(st.opacity === '0' || st.visibility === 'hidden' || (st.clipPath && st.clipPath.includes('100%'))){
        st.opacity = '1';
        st.visibility = 'visible';
        st.clipPath = 'none';
        el.classList.add('visible');
      }
    });
  }, 1600);
});
// المؤقتات: بتتوقف لما التبويب يبقى مخفي عشان كوتة Apps Script اليومية.
// (قبل كده كانت 4 مؤقتات شغالة على 8-30 ثانية = آلاف طلبات في الساعة ⇒
//  السيرفر بيرفض والبانل بيقول "تعذر الاتصال").
function tabVisible(){ return !document.hidden; }
setInterval(()=>{ if(tabVisible()) fetchStoreStatusFromServer(); }, POLL_STORE_STATE_MS);
setInterval(()=>{
  if(!tabVisible()) return;
  if(!localStorage.getItem('tokyo_active_order_id')) return;
  fetchLiveOrderStatus();
}, 45000);
// الطلبات المعلقة: إعادة محاولة تلقائية لحد ما توصل
setInterval(()=>{ if(tabVisible()) flushPendingOrders(); }, POLL_PENDING_MS);
// لحظة رجوع الإنترنت: أعد الاتصال فوراً (شيت + طلبات معلقة + طلبات جديدة)
window.addEventListener('online', ()=>{
  if(sessionAdminPassword) loadAdminOrders();
  flushPendingOrders();
  pollNewOrders();
});
// في كل مرة البانل يتفتح نضمن إن فيه محاولة تحديث فورية
document.addEventListener('visibilitychange', ()=>{
  if(!document.hidden && sessionAdminPassword) loadAdminOrders();
});
// أثناء فتح نافذة التتبع: تحديث دوري
setInterval(()=>{
  if(!tabVisible()) return;
  const m = document.getElementById('trackerModal');
  if(m && m.classList.contains('open')) fetchLiveOrderStatus();
}, POLL_TRACKER_MS);
// الطلبات الجديدة (الأدمن فقط)
setInterval(()=>{ if(tabVisible()) pollNewOrders(); }, POLL_NEW_ORDERS_MS);

if(localStorage.getItem('tokyo_name')){
  const el = document.getElementById('custName');
  if(el) el.value = localStorage.getItem('tokyo_name');
}
if(localStorage.getItem('tokyo_phone')){
  const el = document.getElementById('custPhone');
  if(el) el.value = localStorage.getItem('tokyo_phone');
}
if(localStorage.getItem('tokyo_address')){
  const el = document.getElementById('custAddress');
  if(el) el.value = localStorage.getItem('tokyo_address');
}
