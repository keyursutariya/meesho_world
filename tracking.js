/* ================================================================
   tracking.js  —  Meesho World  |  Click & Page-Visit Tracking
   Pixel ID : 1511058947312930
   Version  : 3.0  (dedup + localStorage event store + dashboard)

   Rules:
   • Additive only. Zero changes to any existing code.
   • Uses fbq('trackCustom', ...) for all custom events.
   • Every handler debounced (300ms) + dedup window (2s).
   • ALL events saved to localStorage under key 'mw_events'
     → visible in track-dashboard.html
   • TEST_MODE auto-enables on localhost / ?mw_test=1
================================================================ */

(function () {
  'use strict';

  if (window.__mwTrackingV3) return;
  window.__mwTrackingV3 = true;

  /* ── CONFIG ── */
  var PIXEL_ID     = '1511058947312930';
  var DEBOUNCE_MS  = 300;
  var DEDUP_MS     = 2000;
  var STORE_KEY    = 'mw_events';
  var MAX_STORED   = 500;   // keep latest 500 events in localStorage

  var TEST_MODE = (
    /localhost|127\.0\.0\.1|file:\/\//.test(window.location.href) ||
    new URLSearchParams(window.location.search).get('mw_test') === '1'
  );

  /* ================================================================
     EVENT STORE — persists ALL events to localStorage
     Each entry: { event, data, page, ts, session_id }
  ================================================================ */
  var SESSION_ID = (function() {
    try {
      var s = sessionStorage.getItem('mw_session_id');
      if (!s) {
        s = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        sessionStorage.setItem('mw_session_id', s);
      }
      return s;
    } catch(e) { return 'sess_' + Date.now(); }
  })();

  function storeEvent(eventName, params) {
    try {
      var raw    = localStorage.getItem(STORE_KEY);
      var events = raw ? JSON.parse(raw) : [];
      events.push({
        event:      eventName,
        data:       params,
        page:       window.location.pathname.split('/').pop() || 'index.html',
        full_url:   window.location.href,
        ts:         new Date().toISOString(),
        local_time: new Date().toLocaleTimeString('en-IN', {hour12:true}),
        session:    SESSION_ID
      });
      /* Keep only the latest MAX_STORED events */
      if (events.length > MAX_STORED) events = events.slice(-MAX_STORED);
      localStorage.setItem(STORE_KEY, JSON.stringify(events));
      localStorage.setItem('mw_last_event', JSON.stringify(events[events.length - 1]));
    } catch(e) {}
  }

  /* ================================================================
     TEST-MODE LOGGER
  ================================================================ */
  var _memLog = [];

  function log(eventName, params) {
    if (!TEST_MODE) return;
    _memLog.push({ event: eventName, data: params, at: new Date().toLocaleTimeString() });
    var s = 'background:#9f2089;color:#fff;padding:2px 7px;border-radius:3px;font-weight:700';
    console.groupCollapsed('%c MW Track %c ' + eventName, s, 'color:#9f2089;font-weight:700');
    console.table(params);
    console.groupEnd();
  }

  window.mwTrackLog  = function() { console.table(_memLog); return _memLog; };
  window.mwEventStore = function() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch(e){ return []; }
  };
  window.mwClearEvents = function() {
    localStorage.removeItem(STORE_KEY);
    localStorage.removeItem('mw_last_event');
    console.log('[MW Track] Event store cleared.');
  };

  /* ================================================================
     DEDUP MAP
  ================================================================ */
  var _dedupMap = {};
  function isDuplicate(key) {
    var now = Date.now();
    if (_dedupMap[key] && (now - _dedupMap[key]) < DEDUP_MS) {
      if (TEST_MODE) console.warn('[MW Track] DEDUP blocked:', key);
      return true;
    }
    _dedupMap[key] = now;
    return false;
  }

  /* ================================================================
     FIRE — pixel + store + log
  ================================================================ */
  function fire(eventName, params, dedupKey) {
    var key = dedupKey || eventName;
    if (isDuplicate(key)) return;

    log(eventName, params);
    storeEvent(eventName, params);

    try {
      if (typeof window.fbq === 'function') {
        window.fbq('trackCustom', eventName, params || {});
      }
    } catch(e) {}
  }

  /* ================================================================
     HELPERS
  ================================================================ */
  function path() { return window.location.pathname + window.location.search; }
  function ts()   { return new Date().toISOString(); }

  function utmParams() {
    try {
      var p = new URLSearchParams(window.location.search);
      var u = {};
      ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'].forEach(function(k){
        var v = p.get(k); if (v) u[k] = v;
      });
      return u;
    } catch(e) { return {}; }
  }

  /* ================================================================
     DELEGATED CLICK LISTENER with per-element debounce
  ================================================================ */
  var _lastClick = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

  function onDelegate(selectorFn, handler) {
    document.addEventListener('click', function(e) {
      try {
        var el = e.target, found = null;
        for (var i = 0; i < 8; i++) {
          if (!el || el === document) break;
          if (selectorFn(el)) { found = el; break; }
          el = el.parentElement;
        }
        if (!found) return;
        var now = Date.now();
        if (_lastClick) {
          var last = _lastClick.get(found) || 0;
          if (now - last < DEBOUNCE_MS) return;
          _lastClick.set(found, now);
        }
        handler(found, e);
      } catch(err) {}
    }, { capture: true, passive: true });
  }

  /* ================================================================
     UTM CAPTURE
  ================================================================ */
  (function() {
    try {
      var p = new URLSearchParams(window.location.search);
      ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid'].forEach(function(k){
        var v = p.get(k);
        if (v) { try { sessionStorage.setItem('mw_'+k, v); } catch(e){} }
      });
      var utm = utmParams();
      if (Object.keys(utm).length > 0) {
        fire('UTMCapture', Object.assign({ page: path(), ts: ts() }, utm), 'UTMCapture_'+path());
      }
    } catch(e) {}
  })();

  /* ================================================================
     PAGE VIEW (tracks navigations between static HTML pages)
  ================================================================ */
  fire('PageVisit', {
    page_name:  document.title || path(),
    page:       path(),
    referrer:   document.referrer ? document.referrer.split('/').pop() : 'direct',
    session:    SESSION_ID,
    ts:         ts()
  }, 'PageVisit_' + path());

  /* ================================================================
     CLICK TRACKERS  (27 events)
  ================================================================ */

  /* 1. Product card */
  onDelegate(
    function(el){ return !!(el.classList && el.classList.contains('product-card')); },
    function(el){
      var href = el.getAttribute('href') || '';
      var m    = href.match(/[?&]id=([^&]+)/);
      fire('ClickProductCard', {
        product_id: m ? decodeURIComponent(m[1]) : '',
        label:      el.getAttribute('aria-label') || '',
        page: path(), ts: ts()
      }, 'ClickProductCard_'+(m?m[1]:href));
    }
  );

  /* 2. Hero carousel slide */
  onDelegate(
    function(el){ return !!(el.classList && el.classList.contains('carousel-item')); },
    function(el){
      var idx = 0;
      if (el.parentElement) {
        var s = el.parentElement.querySelectorAll('.carousel-item');
        for (var i=0;i<s.length;i++){if(s[i]===el){idx=i;break;}}
      }
      fire('ClickBannerCarousel',{slide_index:idx,page:path(),ts:ts()},'ClickBannerCarousel_'+idx);
    }
  );

  /* 3. Marquee bar */
  onDelegate(
    function(el){ return !!(el.classList&&(el.classList.contains('top-marquee-bar')||el.classList.contains('marquee__inner'))); },
    function(){ fire('ClickMarqueeBanner',{page:path(),ts:ts()},'ClickMarqueeBanner'); }
  );

  /* 4. Search input focus + query */
  (function(){
    var ready=false;
    function attach(){
      var inp=document.getElementById('search-input');
      if(!inp||ready)return; ready=true;
      var ff=false;
      inp.addEventListener('focus',function(){
        if(ff)return; ff=true;
        fire('ClickSearchInput',{page:path(),ts:ts()},'ClickSearchInput_focus');
        setTimeout(function(){ff=false;},5000);
      },{passive:true});
      var qf=false;
      inp.addEventListener('input',function(){
        if(!qf&&this.value.length>2){qf=true;fire('SearchQuery',{query_length:this.value.length,page:path(),ts:ts()},'SearchQuery');}
        if(this.value.length===0)qf=false;
      },{passive:true});
    }
    if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',attach);}
    else{attach();}
    setTimeout(attach,600);
  })();

  /* 5. Size pill */
  onDelegate(
    function(el){ return !!(el.classList&&el.classList.contains('size-pill-btn'))||(el.dataset&&el.dataset.size!==undefined&&el.dataset.size!==''); },
    function(el){
      var size=(el.dataset&&el.dataset.size)||el.textContent.trim();
      fire('ClickSizeSelect',{size:size,page:path(),ts:ts()},'ClickSizeSelect_'+size);
    }
  );

  /* 6. Check Delivery */
  onDelegate(
    function(el){ return el.tagName==='BUTTON'&&(el.getAttribute('onclick')||'').includes('checkDelivery'); },
    function(){ fire('ClickCheckDelivery',{page:path(),ts:ts()},'ClickCheckDelivery'); }
  );

  /* 7. Add to Cart */
  onDelegate(
    function(el){ return el.id==='add-to-cart-btn'; },
    function(el){ fire('ClickAddToCart',{label:el.textContent.trim().slice(0,40),page:path(),ts:ts()},'ClickAddToCart'); }
  );

  /* 8. Buy Now */
  onDelegate(
    function(el){ return el.id==='buy-now-btn'; },
    function(el){ fire('ClickBuyNow',{label:el.textContent.trim().slice(0,40),page:path(),ts:ts()},'ClickBuyNow'); }
  );

  /* 9. Wishlist */
  onDelegate(
    function(el){ return (el.getAttribute('aria-label')||'').toLowerCase().includes('wishlist'); },
    function(el){ fire('ClickWishlist',{label:el.getAttribute('aria-label')||'',page:path(),ts:ts()},'ClickWishlist_'+path()); }
  );

  /* 10. Cart icon header */
  onDelegate(
    function(el){ return el.tagName==='A'&&(el.getAttribute('href')||'')==='cart.html'; },
    function(){ fire('ClickCartIcon',{page:path(),ts:ts()},'ClickCartIcon_'+path()); }
  );

  /* 11. Cart Continue */
  onDelegate(
    function(el){ return el.tagName==='A'&&(el.getAttribute('href')||'')==='address.html'; },
    function(el){ fire('ClickCartContinue',{label:el.textContent.trim().slice(0,40),destination:'address.html',page:path(),ts:ts()},'ClickCartContinue'); }
  );

  /* 12. Remove from cart */
  onDelegate(
    function(el){
      var txt=el.textContent.trim().toLowerCase();
      var oc=el.getAttribute('onclick')||'';
      return txt==='remove'||oc.includes('removeItem')||oc.includes('Cart.removeItem');
    },
    function(){ fire('ClickRemoveFromCart',{page:path(),ts:ts()},'ClickRemoveFromCart_'+Date.now()); }
  );

  /* 13. Payment app */
  onDelegate(
    function(el){ return !!(el.classList&&el.classList.contains('payment-app-label')); },
    function(el){
      var appId=(el.id||'').replace('app-label-','');
      var sp=el.querySelector('span[style*="font-weight:600"],span[style*="font-weight: 600"]');
      fire('ClickPaymentApp',{app_id:appId,app_label:sp?sp.textContent.trim():appId,page:path(),ts:ts()},'ClickPaymentApp_'+appId);
    }
  );

  /* 14. Proceed to Pay */
  onDelegate(
    function(el){ return el.id==='proceed-btn'; },
    function(){
      var t=document.getElementById('footer-total');
      fire('ClickProceedToPay',{amount:t?t.textContent.trim():'',page:path(),ts:ts()},'ClickProceedToPay');
    }
  );

  /* 15. Yes I Paid */
  onDelegate(
    function(el){ return el.tagName==='BUTTON'&&(el.getAttribute('onclick')||'').includes('handleConfirmPaid'); },
    function(){ fire('ClickConfirmPaid',{page:path(),ts:ts()},'ClickConfirmPaid'); }
  );

  /* 16. Not Yet */
  onDelegate(
    function(el){ return el.tagName==='BUTTON'&&(el.getAttribute('onclick')||'').includes('handleNotPaid'); },
    function(){ fire('ClickPaymentNotYet',{page:path(),ts:ts()},'ClickPaymentNotYet'); }
  );

  /* 17. Install PhonePe */
  onDelegate(
    function(el){ return el.id==='install-phonepe-btn'; },
    function(){ fire('ClickInstallPhonePe',{page:path(),ts:ts()},'ClickInstallPhonePe'); }
  );

  /* 18. QR tools */
  onDelegate(
    function(el){ var oc=el.getAttribute('onclick')||''; return el.tagName==='BUTTON'&&(oc.includes('copyUpi')||oc.includes('downloadQr')||oc.includes('copyUpiString')); },
    function(el){ fire('ClickQrTool',{action:el.textContent.trim().slice(0,30),page:path(),ts:ts()},'ClickQrTool_'+el.textContent.trim().slice(0,10)); }
  );

  /* 19. Bottom nav */
  onDelegate(
    function(el){ return !!(el.closest&&el.closest('.bottom-nav')); },
    function(el){
      var ni=el.closest('a,button'); if(!ni)return;
      var sp=ni.querySelector('span');
      var label=sp?sp.textContent.trim():'';
      fire('ClickBottomNav',{tab:label,destination:ni.getAttribute('href')||'',page:path(),ts:ts()},'ClickBottomNav_'+label);
    }
  );

  /* 20. Continue Shopping */
  onDelegate(
    function(el){ return el.textContent.trim().toLowerCase().includes('continue shopping'); },
    function(el){ fire('ClickContinueShopping',{label:el.textContent.trim().slice(0,40),page:path(),ts:ts()},'ClickContinueShopping_'+path()); }
  );

  /* 21. Home logo */
  onDelegate(
    function(el){ return el.tagName==='A'&&(el.getAttribute('href')||'').replace('./','').replace('../','').includes('index.html')&&!!(el.closest&&el.closest('.site-header,header')); },
    function(){ fire('ClickHomeLogo',{page:path(),ts:ts()},'ClickHomeLogo_'+path()); }
  );

  /* 22. Save Address */
  onDelegate(
    function(el){ return el.tagName==='BUTTON'&&el.type==='submit'; },
    function(el){
      if(!window.location.pathname.includes('address'))return;
      fire('ClickSaveAddress',{label:el.textContent.trim().slice(0,40),page:path(),ts:ts()},'ClickSaveAddress');
    }
  );

  /* 23. Proceed to Payment (review page) */
  onDelegate(
    function(el){ return el.tagName==='A'&&(el.getAttribute('href')||'').includes('checkout.html'); },
    function(){ fire('ClickProceedToPayment',{destination:'checkout.html',page:path(),ts:ts()},'ClickProceedToPayment'); }
  );

  /* 24. Go Home (order confirmation) */
  onDelegate(
    function(el){ return el.textContent.trim().toLowerCase()==='go home'||el.textContent.trim().toLowerCase().includes('go home'); },
    function(){ fire('ClickGoHome',{page:path(),ts:ts()},'ClickGoHome'); }
  );

  /* 25. Similar products */
  onDelegate(
    function(el){ return !!(el.closest&&el.closest('#similar-grid'))&&el.tagName==='A'; },
    function(el){
      var href=el.getAttribute('href')||'';
      var m=href.match(/[?&]id=([^&]+)/);
      fire('ClickSimilarProduct',{product_id:m?decodeURIComponent(m[1]):'',destination:href,page:path(),ts:ts()},'ClickSimilarProduct_'+(m?m[1]:href));
    }
  );

  /* 26. View Cart drawer */
  onDelegate(
    function(el){ var t=el.textContent.trim().toLowerCase(); return el.tagName==='A'&&(t.includes('view cart')||t.includes('checkout')); },
    function(el){ fire('ClickViewCart',{label:el.textContent.trim().slice(0,40),destination:el.getAttribute('href')||'cart.html',page:path(),ts:ts()},'ClickViewCart_'+path()); }
  );

  /* 27. View Price Details */
  onDelegate(
    function(el){ var t=el.textContent.trim().toLowerCase(); return el.tagName==='BUTTON'&&(t.includes('view price')||t.includes('price detail')); },
    function(){ fire('ClickViewPriceDetails',{page:path(),ts:ts()},'ClickViewPriceDetails'); }
  );

  /* ================================================================
     TEST-MODE BOOT MESSAGE
  ================================================================ */
  if (TEST_MODE) {
    var s='background:#9f2089;color:#fff;padding:4px 10px;border-radius:4px;font-size:13px';
    console.log('%c[MW Tracking v3] Test mode ACTIVE — events log + saved to localStorage.\nRun  mwTrackLog()  → in-memory log\nRun  mwEventStore()  → full localStorage history\nRun  mwClearEvents()  → clear history\nOpen  track-dashboard.html  to see visual dashboard.',s);
    console.log('[MW Tracking] Page:', path(), '| Session:', SESSION_ID);
  }

})();
/* ── End tracking.js v3 ── */
