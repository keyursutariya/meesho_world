/* =====================================================
   MEESHO CLONE — app.js
   Vanilla JS: Cart, Address, Order, UPI Payment Logic
   ===================================================== */

/* ─────────────────────────────────────────────
   CART STATE (localStorage-backed)
   ───────────────────────────────────────────── */
const CART_KEY = 'meesho_cart';
const ADDR_KEY = 'meesho_delivery_address';
const ORDER_KEY = 'meesho_last_order';

window.Cart = (() => {
  let items = [];
  let listeners = [];

  function load() {
    try { items = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { items = []; }
  }
  function save() {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    listeners.forEach(fn => fn(items));
    updateAllBadges();
  }
  function lineKey(id, size) { return `${id}-${size}`; }

  load();

  return {
    getItems()  { return [...items]; },
    getTotals() {
      const totalItems = items.reduce((s,i) => s + i.quantity, 0);
      const totalPrice = items.reduce((s,i) => s + i.price * i.quantity, 0);
      const totalMrp   = items.reduce((s,i) => s + i.mrp * i.quantity, 0);
      return { totalItems, totalPrice, totalMrp };
    },
    addItem(item) {
      const key = lineKey(item.id, item.size);
      const idx = items.findIndex(i => lineKey(i.id, i.size) === key);
      if (idx >= 0) { items[idx].quantity += 1; }
      else { items.push({ ...item, quantity: 1 }); }
      save();
    },
    removeItem(id, size) {
      const key = lineKey(id, size);
      items = items.filter(i => lineKey(i.id, i.size) !== key);
      save();
    },
    updateQuantity(id, size, qty) {
      const key = lineKey(id, size);
      if (qty <= 0) { items = items.filter(i => lineKey(i.id, i.size) !== key); }
      else { const idx = items.findIndex(i => lineKey(i.id, i.size) === key); if (idx >= 0) items[idx].quantity = qty; }
      save();
    },
    clearCart() { items = []; save(); },
    isInCart(id) { return items.some(i => i.id === id); },
    onChange(fn) { listeners.push(fn); },
  };
})();

/* ─────────────────────────────────────────────
   DELIVERY ADDRESS
   ───────────────────────────────────────────── */
window.DeliveryAddress = {
  save(addr) { localStorage.setItem(ADDR_KEY, JSON.stringify(addr)); },
  load() {
    try { const r = localStorage.getItem(ADDR_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
  },
  format(a) {
    const line = [a.houseNo, a.roadArea, a.city].filter(Boolean).join(', ');
    return `${line}, ${a.state} - ${a.pincode}`;
  },
  toShipping(a) {
    return {
      fullName: a.name, phone: a.contactNumber, email: '',
      pincode: a.pincode,
      address: [a.houseNo, a.roadArea].filter(Boolean).join(', ') || a.roadArea,
      city: a.city, state: a.state, landmark: a.landmark, addressType: 'Home'
    };
  },
  estimatedDelivery() {
    const d = new Date(); d.setDate(d.getDate() + 5);
    return d.toLocaleDateString('en-IN', { weekday:'long', day:'2-digit', month:'short' });
  }
};

/* ─────────────────────────────────────────────
   ORDER STORAGE
   ───────────────────────────────────────────── */
window.Order = {
  save(o) { try { localStorage.setItem(ORDER_KEY, JSON.stringify(o)); } catch {} },
  load() { try { const r = localStorage.getItem(ORDER_KEY); return r ? JSON.parse(r) : null; } catch { return null; } },
};

/* ─────────────────────────────────────────────
   PAYMENT CONFIG
   ───────────────────────────────────────────── */
window.PaymentConfig = {
  UPI_VPA: 'paytm.s3av79p@pty',
  PAYEE_NAME: 'Vipulbhai Kumbhani',
  PAYMENT_APPS: [
    { id:'gpay',       label:'Google Pay',   logoBg:'#4285f4', icon:'images/payment/gpay.png',       subtitle:'Fast and secure direct checkout using Google Pay app*' },
    { id:'phonepe',    label:'PhonePe',      logoBg:'#5f259f', icon:'images/payment/phonepe.png',    subtitle:'Upto ₹100 cashback on RuPay Credit Card on UPI using PhonePe*' },
    { id:'paytm',      label:'Paytm',        logoBg:'#00baf2', icon:'images/payment/paytm.png',      subtitle:'₹30–₹300 Cashback for first-time and dormant Paytm UPI users*' },
    { id:'bharatpe',   label:'BharatPe',     logoBg:'#ffffff', icon:'images/payment/bharatpe.png',   subtitle:'Fast & secure zero-fee payment with BharatPe UPI*' },
    { id:'amazonpay',  label:'Amazon Pay',   logoBg:'#ffffff', icon:'images/payment/amazonpay.png',  subtitle:'Pay with Amazon Pay UPI and earn rewards on every transaction*', imgScale: 1.4 },
    { id:'supermoney', label:'Super.money',  logoBg:'#5a2d91', icon:'images/payment/supermoney.jpg', subtitle:'Pay fast & securely via Super.money (by Flipkart) UPI app*' },
    { id:'bhim',       label:'BHIM UPI',     logoBg:'#ffffff', icon:'images/payment/upi-npci.png',   subtitle:'Official BHIM UPI App by NPCI*', imgScale: 1.4 },
  ],
  DISABLED_OPTIONS: [
    { id:'wallet',     label:'Wallet' },
    { id:'cards',      label:'Debit/Credit Cards' },
    { id:'netbanking', label:'Net Banking' },
  ],
  generateOrderId() {
    const n = new Date();
    const y = n.getFullYear();
    const m = String(n.getMonth()+1).padStart(2,'0');
    const d = String(n.getDate()).padStart(2,'0');
    const r = Math.floor(100000 + Math.random()*900000);
    return `Meesho_${y}${m}${d}${r}`;
  },
  getOrderPricing(totalPrice, totalMrp) {
    return {
      orderTotal: totalPrice, totalMrp,
      savedAmount: Math.max(0, totalMrp - totalPrice),
      codAmount: totalPrice + 100, deliveryFee: 0,
    };
  }
};

/* ─────────────────────────────────────────────
   UPI PAYMENT LOGIC
   ───────────────────────────────────────────── */
window.UpiPayment = {
  detectDevice() {
    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Android/i.test(ua)) return 'and';
    return 'des';
  },
  buildUpiLink(amount, txnId) {
    const tr = txnId || `TXN${Date.now()}${Math.floor(Math.random()*1000)}`;
    const vpa = window.PaymentConfig.UPI_VPA;
    const pn  = window.PaymentConfig.PAYEE_NAME;
    return `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(pn)}&am=${Number(amount).toFixed(2)}&cu=INR&tr=${encodeURIComponent(tr)}`;
  },
  buildPhonePeNativeUrl(amount) {
    const orderId = crypto.randomUUID ? crypto.randomUUID() : `ord-${Date.now()}`;
    const payload = {
      contact: { cbsName:'ok', nickName:'demo', vpa: window.PaymentConfig.UPI_VPA, type:'VPA' },
      p2pPaymentCheckoutParams: {
        note:`OrderNo: ${orderId}`, isByDefaultKnownContact:true,
        enableSpeechToText:false, allowAmountEdit:false, showQrCodeOption:false,
        disableViewHistory:true, shouldShowUnsavedContactBanner:false, isRecurring:false,
        checkoutType:'DEFAULT', transactionContext:'p2p',
        initialAmount: Number(amount)*100, disableNotesEdit:true,
        showKeyboard:true, currency:'INR', shouldShowMaskedNumber:true,
      }
    };
    const base64Data = btoa(JSON.stringify(payload));
    return `phonepe://native?data=${base64Data}&id=p2ppayment`;
  },
  navLink(url) {
    const a = document.createElement('a');
    a.href = url; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(() => document.body.removeChild(a), 500);
  },
  run(method, amount, device, phonePeNativeUrl, callbacks) {
    const vpa = encodeURIComponent(window.PaymentConfig.UPI_VPA);
    const pn  = encodeURIComponent(window.PaymentConfig.PAYEE_NAME);
    const rawVpa = window.PaymentConfig.UPI_VPA;

    // UPI apps that need deep link handling
    const upiApps = ['gpay','phonepe','paytm','bharatpe','amazonpay','cred','ippb','supermoney','bhim'];

    if (upiApps.includes(method)) {
      if (device === 'and') {
        if (method === 'phonepe') {
          const params = phonePeNativeUrl.replace('phonepe://','');
          this.navLink(`intent://${params}#Intent;scheme=phonepe;package=com.phonepe.app;end`);
        } else if (method === 'gpay') {
          this.navLink(`intent://pay?pa=${vpa}&pn=${pn}&am=${amount}&cu=INR#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`);
        } else if (method === 'paytm') {
          this.navLink(`paytmmp://pay?pa=${rawVpa}&pn=Meesho&am=${amount}&cu=INR`);
        } else if (method === 'bharatpe') {
          this.navLink(`intent://pay?pa=${vpa}&pn=${pn}&am=${amount}&cu=INR#Intent;scheme=upi;package=com.bharatpe.app;end`);
        } else if (method === 'amazonpay') {
          this.navLink(`intent://pay?pa=${vpa}&pn=${pn}&am=${amount}&cu=INR#Intent;scheme=upi;package=in.amazon.mShop.android.shopping;end`);
        } else if (method === 'cred') {
          this.navLink(`intent://pay?pa=${vpa}&pn=${pn}&am=${amount}&cu=INR#Intent;scheme=upi;package=com.dreamplug.androidapp;end`);
        } else if (method === 'ippb') {
          this.navLink(`intent://pay?pa=${vpa}&pn=${pn}&am=${amount}&cu=INR#Intent;scheme=upi;package=com.dop.ippbretail;end`);
        } else if (method === 'supermoney') {
          this.navLink(`intent://pay?pa=${vpa}&pn=${pn}&am=${amount}&cu=INR#Intent;scheme=upi;package=com.supermoney.app;end`);
        } else if (method === 'bhim') {
          this.navLink(`intent://pay?pa=${vpa}&pn=${pn}&am=${amount}&cu=INR#Intent;scheme=upi;package=in.org.npci.upiapp;end`);
        } else {
          // fallback — generic UPI chooser
          this.navLink(`upi://pay?pa=${rawVpa}&pn=${pn}&am=${amount}&cu=INR`);
        }
      } else if (device === 'ios') {
        if (method === 'phonepe') {
          this.navLink(`phonepe://upi//pay?pa=${rawVpa}&pn=Meesho&am=${amount}&cu=INR`);
        } else if (method === 'paytm') {
          this.navLink(`paytmmp://pay?pa=${rawVpa}&pn=Meesho&am=${amount}&cu=INR`);
        } else if (method === 'amazonpay') {
          this.navLink(`amzn://pay?pa=${rawVpa}&pn=Meesho&am=${amount}&cu=INR`);
        } else {
          this.navLink(`upi://pay?pa=${rawVpa}&pn=Meesho&am=${amount}&cu=INR`);
        }
      } else {
        // Desktop — show QR fallback for app-based methods
        callbacks.onDesktopQrFallback && callbacks.onDesktopQrFallback();
        return;
      }
      const onVisible = () => {
        if (!document.hidden) {
          document.removeEventListener('visibilitychange', onVisible);
          callbacks.onReturnFromApp && callbacks.onReturnFromApp();
        }
      };
      document.addEventListener('visibilitychange', onVisible);
    } else if (method === 'qr') {
      callbacks.onQrOnly && callbacks.onQrOnly();
    }
  },
  async copyUpiId() {
    try { await navigator.clipboard.writeText(window.PaymentConfig.UPI_VPA); return true; }
    catch {
      const ta = document.createElement('textarea');
      ta.value = window.PaymentConfig.UPI_VPA;
      ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta); return ok;
    }
  }
};

/* ─────────────────────────────────────────────
   PRODUCT DATA HELPERS
   ───────────────────────────────────────────── */
window.ProductHelpers = {
  getCategory(title) {
    const l = title.toLowerCase();
    if (l.includes('kurti')||l.includes('dress')||l.includes('suit')||l.includes('set')||l.includes('combo')||l.includes('pair')) return 'Kurtis & Suits';
    if (l.includes('necklace')||l.includes('chain')) return 'Necklaces & Chains';
    if (l.includes('earring')||l.includes('stud'))   return 'Earrings & Studs';
    if (l.includes('mangalsutra'))                   return 'Mangalsutras';
    if (l.includes('pendant')||l.includes('locket')) return 'Pendants & Lockets';
    if (l.includes('ring'))                          return 'Rings';
    if (l.includes('bangle')||l.includes('bracelet'))return 'Bangles & Bracelets';
    if (l.includes('anklet')||l.includes('toe ring'))return 'Anklets & Toe Rings';
    if (l.includes('nosepin')||l.includes('nose pin'))return 'Nosepins';
    return 'Jewellery Sets';
  },
  getSizes(title) {
    const cat = this.getCategory(title);
    return cat === 'Kurtis & Suits' ? ['S','M','L','XL','XXL'] : ['Free Size'];
  },
  estimateDelivery(pincode) {
    if (!/^\d{6}$/.test(pincode.trim())) return null;
    const day = 3 + (parseInt(pincode.slice(-2), 10) % 4);
    const d = new Date(); d.setDate(d.getDate() + day);
    return d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
  },
  getById(id) {
    return (window.PRODUCTS || []).find(p => p.id === Number(id));
  },
  getPage(page, pageSize = 10) {
    const all = window.PRODUCTS || [];
    const start = (page - 1) * pageSize;
    return { items: all.slice(start, start + pageSize), hasMore: start + pageSize < all.length, total: all.length };
  }
};

/* ─────────────────────────────────────────────
   DEAL TIMER HELPER
   ───────────────────────────────────────────── */
const DEAL_TIMER_IDS = new Set([10135,10161,10240,10137,10175,10195,10230]);
window.hasDealTimer = id => DEAL_TIMER_IDS.has(Number(id));

/* ─────────────────────────────────────────────
   CART BADGE UPDATER (all pages)
   ───────────────────────────────────────────── */
function updateAllBadges() {
  const { totalItems } = window.Cart.getTotals();
  document.querySelectorAll('.cart-badge').forEach(el => {
    el.textContent = totalItems;
    el.style.display = totalItems > 0 ? 'flex' : 'none';
  });
}

/* ─────────────────────────────────────────────
   CART DRAWER (product detail page)
   ───────────────────────────────────────────── */
window.CartDrawer = {
  ensureMarkup() {
    if (!document.getElementById('cart-drawer')) {
      const overlay = document.createElement('div');
      overlay.id = 'cart-drawer-overlay';
      overlay.className = 'cart-drawer-overlay';
      overlay.onclick = () => window.CartDrawer.close();

      const drawer = document.createElement('aside');
      drawer.id = 'cart-drawer';
      drawer.className = 'cart-drawer';
      drawer.setAttribute('aria-label', 'Shopping Cart Drawer');
      drawer.innerHTML = `
        <div class="cart-drawer-header">
          <div style="display:flex;align-items:center;gap:.5rem">
            <h3 style="font-size:1rem;font-weight:700;color:#1e293b;margin:0">My Cart</h3>
            <span id="drawer-item-count" style="font-size:.75rem;color:var(--muted-foreground)">0 Items</span>
          </div>
          <button onclick="CartDrawer.close()" style="background:none;border:none;cursor:pointer;padding:4px;color:var(--muted-foreground)" aria-label="Close Cart">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div id="drawer-items-list" class="cart-drawer-items"></div>
        <div id="drawer-footer" class="cart-drawer-footer">
          <div style="display:flex;flex-direction:column;gap:.375rem;margin-bottom:1rem">
            <div class="price-row" style="display:flex;justify-content:space-between;font-size:.875rem;color:#475569">
              <span>Total MRP</span>
              <span id="drawer-mrp">₹0</span>
            </div>
            <div class="price-row" style="display:flex;justify-content:space-between;font-size:.875rem;color:#038c63;font-weight:600">
              <span>Discount</span>
              <span id="drawer-discount">- ₹0</span>
            </div>
            <div class="price-row" style="display:flex;justify-content:space-between;font-size:1rem;font-weight:800;color:#0f172a;margin-top:.25rem;padding-top:.5rem;border-top:1px solid #e2e8f0">
              <span>Total Amount</span>
              <span id="drawer-total">₹0</span>
            </div>
          </div>
          <a href="cart.html" class="btn btn-primary w-full" style="display:flex;align-items:center;justify-content:center;height:44px;background:#9f2089;color:#fff;border-radius:10px;font-weight:700;text-decoration:none">View Cart &amp; Checkout</a>
        </div>
      `;

      document.body.appendChild(overlay);
      document.body.appendChild(drawer);
    }
  },
  open() {
    this.ensureMarkup();
    document.getElementById('cart-drawer')?.classList.add('open');
    document.getElementById('cart-drawer-overlay')?.classList.add('open');
    document.body.style.overflow = 'hidden';
    this.render();
  },
  close() {
    document.getElementById('cart-drawer')?.classList.remove('open');
    document.getElementById('cart-drawer-overlay')?.classList.remove('open');
    document.body.style.overflow = '';
  },
  toggle() {
    this.ensureMarkup();
    const el = document.getElementById('cart-drawer');
    if (el?.classList.contains('open')) this.close();
    else this.open();
  },
  render() {
    const items = window.Cart.getItems();
    const { totalItems, totalPrice, totalMrp } = window.Cart.getTotals();
    const totalDiscount = totalMrp - totalPrice;
    const discPct = totalMrp > 0 ? Math.round((totalDiscount/totalMrp)*100) : 0;

    const countEl = document.getElementById('drawer-item-count');
    if (countEl) countEl.textContent = `${totalItems} ${totalItems === 1 ? 'Item' : 'Items'}`;

    const listEl = document.getElementById('drawer-items-list');
    if (!listEl) return;

    if (items.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state" style="height:100%">
          <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg></div>
          <h3 style="font-size:1rem;font-weight:700;color:#1e293b">Your cart is empty</h3>
          <p style="font-size:.75rem;color:var(--muted-foreground);margin-top:.5rem;max-width:15rem;line-height:1.5">Add quality products from Meesho to start shopping!</p>
          <button onclick="CartDrawer.close()" class="btn btn-primary btn-sm" style="margin-top:1.5rem">Continue Shopping</button>
        </div>`;
      const footer = document.getElementById('drawer-footer');
      if (footer) footer.style.display = 'none';
      return;
    }

    const footer = document.getElementById('drawer-footer');
    if (footer) footer.style.display = '';

    listEl.innerHTML = items.map(item => {
      const itemDiscount = item.mrp - item.price;
      const pct = item.mrp > 0 ? Math.round((itemDiscount/item.mrp)*100) : 0;
      return `<div class="cart-drawer-item">
        <a href="product.html?id=${item.id}" onclick="CartDrawer.close()" style="flex-shrink:0;width:5rem;height:5rem;background:var(--muted);border-radius:.5rem;overflow:hidden;display:block;border:1px solid #f1f5f9">
          <img src="${item.image}" alt="${item.title}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'"/>
        </a>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:space-between">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem">
            <a href="product.html?id=${item.id}" onclick="CartDrawer.close()" style="flex:1;min-width:0">
              <h4 style="font-size:.875rem;font-weight:600;color:#334155;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.title}</h4>
            </a>
            <button onclick="Cart.removeItem(${item.id},'${item.size}');CartDrawer.render()" style="color:var(--muted-foreground);padding:2px;cursor:pointer;flex-shrink:0" aria-label="Remove">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
          <p style="font-size:.6875rem;color:var(--muted-foreground);margin-top:.25rem">Size: <b style="color:#475569">${item.size}</b>${item.seller ? ` • Seller: <b style="color:#475569">${item.seller}</b>` : ''}</p>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:.5rem">
            <div style="display:flex;align-items:baseline;gap:.375rem;flex-wrap:wrap">
              <span style="font-size:1rem;font-weight:700;color:#1e293b">₹${item.price}</span>
              ${item.mrp > item.price ? `<span style="font-size:.75rem;color:#94a3b8;text-decoration:line-through">₹${item.mrp}</span><span style="font-size:.6875rem;color:#038c63;font-weight:700">${pct}% off</span>` : ''}
            </div>
            <div class="qty-ctrl">
              <button onclick="Cart.updateQuantity(${item.id},'${item.size}',${item.quantity-1});CartDrawer.render()">−</button>
              <span>${item.quantity}</span>
              <button onclick="Cart.updateQuantity(${item.id},'${item.size}',${item.quantity+1});CartDrawer.render()">+</button>
            </div>
          </div>
        </div>
      </div>`;
    }).join('');

    // Footer summary
    const drawerMrpEl   = document.getElementById('drawer-mrp');
    const drawerDiscEl  = document.getElementById('drawer-discount');
    const drawerTotalEl = document.getElementById('drawer-total');
    if (drawerMrpEl)   drawerMrpEl.textContent   = `₹${totalMrp}`;
    if (drawerDiscEl)  { drawerDiscEl.textContent = `- ₹${totalDiscount} (${discPct}% off)`; drawerDiscEl.closest('.price-row').style.display = totalDiscount > 0 ? 'flex' : 'none'; }
    if (drawerTotalEl) drawerTotalEl.textContent  = `₹${totalPrice}`;
  }
};

/* ─────────────────────────────────────────────
   PAYMENT VERIFY OVERLAY
   ───────────────────────────────────────────── */
window.PaymentVerify = {
  interval: null,
  start(onDone) {
    let s = 5;
    const el     = document.getElementById('verify-overlay');
    const secEl  = document.getElementById('verify-seconds');
    if (el) { el.classList.add('open'); }
    if (secEl) secEl.textContent = s;
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(() => {
      s--;
      if (secEl) secEl.textContent = s;
      if (s <= 0) { clearInterval(this.interval); if(el) el.classList.remove('open'); onDone && onDone(); }
    }, 1000);
  }
};

/* ─────────────────────────────────────────────
   UTILS
   ───────────────────────────────────────────── */
window.$ = (sel) => document.querySelector(sel);
window.$$ = (sel) => document.querySelectorAll(sel);

function navigate(url) { window.location.href = url; }

function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  let s = '';
  for (let i=0; i<full; i++) s += '★';
  if (half) s += '½';
  return s;
}

function formatINR(n) { return '₹' + Number(n).toLocaleString('en-IN'); }

/* ─────────────────────────────────────────────
   INIT on DOM Ready
   ───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Sync cart badge on every page
  updateAllBadges();
  // Keep in sync when cart changes
  window.Cart.onChange(() => updateAllBadges());
});
