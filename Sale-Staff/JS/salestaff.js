 
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money = n => '$' + Number(n).toFixed(2);
const todayStr = () => new Date().toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
const KEY = 'uo_sales_session_v3';

const seed = () => ({
  profile: {name:'Maya Reyes', email:'maya.reyes@unitedoptic.com', role:'Sales Associate', photo:null},
  n: 10483, cust: null,
  customers: [
    {id:'CUS-3391', name:'David Kim', phone:'(415) 555-0198', email:'david.kim@mail.com', rxStatus:'Verified', rx:'OD -2.25 / OS -2.00, PD 63 mm'},
    {id:'CUS-3388', name:'Priya Nair', phone:'(415) 555-0212', email:'priya.n@mail.com', rxStatus:'Pending Review', rx:''},
    {id:'CUS-3374', name:'Marcus Lee', phone:'(415) 555-0330', email:'marcus.lee@mail.com', rxStatus:'Verified', rx:'OD -1.00 / OS -1.25, PD 65 mm'},
    {id:'CUS-3360', name:'Sofia Ruiz', phone:'(415) 555-0119', email:'sofia.ruiz@mail.com', rxStatus:'Expired', rx:''}
  ],
  products: [
    {id:'P1', brand:'Warby Parker', name:'Aria Round Acetate', sku:'WP-AR-102', price:145, stock:32, cat:'Frame', frame:'Round', lens:''},
    {id:'P2', brand:'Oakley', name:'Meridian Titanium', sku:'OK-MT-556', price:268, stock:6, cat:'Frame', frame:'Rectangle', lens:''},
    {id:'P3', brand:'Ray-Ban', name:'Classic Wayfarer', sku:'RB-CW-214', price:189, stock:0, cat:'Sunglasses', frame:'Aviator', lens:'Polarized'},
    {id:'P4', brand:'Zeiss', name:'Halo Blue-Light Lens', sku:'ZS-HL-330', price:96, stock:58, cat:'Lens', frame:'', lens:'Blue-Light'},
    {id:'P5', brand:'Gucci', name:'Nimbus Cat-Eye', sku:'GU-NC-771', price:412, stock:4, cat:'Frame', frame:'Cat-Eye', lens:''},
    {id:'P6', brand:'Nike Vision', name:'ProGuard Sport Wrap', sku:'NV-PS-408', price:134, stock:21, cat:'Sunglasses', frame:'Wrap', lens:'Polarized'},
    {id:'P7', brand:'Silhouette', name:'Featherlite Rimless', sku:'SI-FR-903', price:356, stock:15, cat:'Frame', frame:'Rimless', lens:''},
    {id:'P8', brand:'Johnson & Johnson', name:'Acuvue Oasys Monthly', sku:'JJ-AO-220', price:42, stock:0, cat:'Contact Lens', frame:'', lens:'Single Vision'}
  ],
  cart: [], reserved: {},
  orders: [{id:'SO-10482', cust:'CUS-3391', date:'Jul 27, 2026', status:'Draft', items:[{pid:'P1', qty:1}, {pid:'P4', qty:1}]}],
  appts: [
    {id:'A1', cust:'CUS-3391', doctor:'Dr. Elena Cho', type:'Eye exam', date:'2026-10-02', time:'09:00', status:'Confirmed'},
    {id:'A2', cust:'CUS-3360', doctor:'Dr. Elena Cho', type:'Follow-up', date:'2026-10-03', time:'10:00', status:'Scheduled'}
  ],
  read: false
});
let S; try { S = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch (e) { S = seed(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const API = 'API/workspace.php';
async function api(action, payload = {}) { const response=await fetch(API,action?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload})}:{});const data=await response.json();if(!response.ok||data.error)throw new Error(data.error||'Database request failed');return data; }
function applyData(d) { S.customers=d.customers;S.products=d.products;S.appts=d.appointments;S.orders=d.orders;S.doctors=d.doctors||[];S.appointmentTypeEnabled=Boolean(d.features?.appointmentType);S.n=Math.max(1,...S.orders.map(o=>Number(o.id.replace('SO-',''))+1));S.cart=S.cart.filter(i=>S.products.some(p=>p.id===i.pid));S.cust=S.customers.some(c=>c.id===S.cust)?S.cust:null;save(); }
async function refreshData() { try{applyData(await api());render();}catch(e){$('view').innerHTML=`<section class="panel db-error"><h2>Could not load sales data</h2><p>${esc(e.message)}</p><button class="btn pri" onclick="refreshData()">Try again</button></section>`;} }

let V = 'dashboard';
const F = {q:'', cat:'', brand:'', frame:'', lens:'', price:'', avail:''};
const prod = id => S.products.find(p => p.id === id);
const cust = id => S.customers.find(c => c.id === id);
const stat = p => p.stock <= 0 ? ['Out of Stock','red'] : p.stock <= 6 ? ['Low Stock','amber'] : ['In Stock','green'];
const bd = (t, c) => `<span class="badge b-${c}">${esc(t)}</span>`;
const oc = {Draft:'navy', Pending:'navy', Reserved:'blue', Processing:'amber', 'Ready for Payment':'green', Completed:'green', Cancelled:'red', Refunded:'red'};
const ac = {Scheduled:'blue', Confirmed:'green', Completed:'navy', Cancelled:'red'};
const rc = {Verified:'green', 'Pending Review':'amber', Expired:'red', None:'navy'};
const STATUSES = ['Draft','Reserved','Processing','Ready for Payment','Cancelled'];
const lineTotal = item => Math.max(0, (Number(item.price ?? prod(item.pid)?.price) || 0) - (Number(item.discount) || 0)) * (Number(item.qty) || 0);
const sub = items => items.reduce((total, item) => total + lineTotal(item), 0);
const orderTotal = order => order.total == null || order.total === '' ? sub(order.items) : Number(order.total) || 0;
const productImageUrl = value => {
  const raw = String(value ?? '').trim().replace(/\\/g, '/');
  if (!raw) return '';
  if (/^(?:\.\.\/Admin\/)?Assets\/products\/[A-Za-z0-9._-]+$/.test(raw)) {
    return new URL(`../Admin/${raw.replace(/^(?:\.\.\/Admin\/)?/, '')}`, document.baseURI).href;
  }
  try {
    const url = new URL(raw, document.baseURI);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
};
const isUpcomingAppointment = appointment => {
  const appointmentDate = new Date(`${appointment.date}T${appointment.time}`);
  return !Number.isNaN(appointmentDate.getTime()) && appointmentDate >= new Date();
};
const uniq = k => [...new Set(S.products.map(p => p[k]).filter(Boolean))];
const initials = n => n.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
const toast = m => { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2200); };
const q = () => F.q.toLowerCase();

 
function table(heads, rows, empty = 'Nothing to show.') {
  if (!rows.length) return `<div class="empty">${empty}</div>`;
  return `<div class="sc"><table class="rs"><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${
    rows.map(r => `<tr>${r.map((c, i) => `<td data-l="${esc(heads[i] || '')}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const head = (t, p, actions = '') => `<div class="ph"><div><h1>${t}</h1><p>${p}</p></div><div class="acts">${actions}</div></div>`;
const btn = (label, fn, cls = 'ghost', sm = '') => `<button type="button" class="btn ${cls} ${sm}" onclick="${fn}">${label}</button>`;
function modal(title, html) { $('mTitle').textContent = title; $('mBody').innerHTML = html; $('modal').classList.add('on'); }
const closeM = () => $('modal').classList.remove('on');
const custOptions = sel => S.customers.map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)} (${c.id})</option>`).join('');
const fd = e => { e.preventDefault(); return Object.fromEntries(new FormData(e.target)); };

 
const NAV = [['dashboard','▦','Dashboard'],['customers','☺','Customers'],['products','◧','Products'],['appointments','▤','Appointments'],
  ['orders','▣','Sales Orders'],['cart','🛒','Shopping Cart'],['inventory','▥','Inventory'],['notifications','🔔','Notifications'],['|'],['profile','●','Profile'],['logout','⎋','Logout']];
function buildNav() {
  NAV[0][1] = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="2"></rect><rect x="14" y="3" width="7" height="5" rx="2"></rect><rect x="14" y="12" width="7" height="9" rx="2"></rect><rect x="3" y="16" width="7" height="5" rx="2"></rect></svg>';
  const badge = {appointments: S.appts.filter(a => ['Scheduled','Confirmed'].includes(a.status) && isUpcomingAppointment(a)).length,
    cart: S.cart.reduce((s, i) => s + i.qty, 0), notifications: notifs().filter(n => !S.read).length};
  $('nav').innerHTML = NAV.map(n => n[0] === '|' ? '<div class="lbl">Account</div>' :
    `<div class="ni ${V === n[0] ? 'on' : ''}" onclick="go('${n[0]}')"><i>${n[1]}</i><span>${n[2]}</span>${badge[n[0]] ? `<em>${badge[n[0]]}</em>` : ''}</div>`).join('');
}
function go(v) {
  if (v === 'logout') { fetch('../Admin/Api/auth/logout.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'}).finally(()=>location.replace('../Admin/login.html')); return; }
  V = v; setMenuOpen(false); render(); scrollTo(0, 0);
}
function setMenuOpen(open) {
  document.body.classList.toggle('nav', open);
  $('menuBtn').setAttribute('aria-expanded', String(open));
  $('menuBtn').setAttribute('aria-label', open ? 'Open navigation menu' : 'Open menu');
  if (open) $('drawerClose').focus();
  else $('menuBtn').focus();
}
function render() { $('view').innerHTML = VIEWS[V](); buildNav(); renderProfileBits(); if (V === 'products') wireProductImages($('view')); }
function wireProductImages(root) {
  root.querySelectorAll('[data-product-image]').forEach(image => {
    const fallback = image.dataset.fallback || '👓';
    const showFallback = () => {
      const placeholder = document.createElement('span');
      placeholder.className = 'product-image-fallback';
      placeholder.setAttribute('aria-hidden', 'true');
      placeholder.textContent = fallback;
      image.replaceWith(placeholder);
    };
    image.addEventListener('error', showFallback, {once:true});
    if (image.complete && !image.naturalWidth) showFallback();
  });
}
function renderProfileBits() {
  const p = S.profile, i = initials(p.name);
  $('meName').textContent = p.name; $('meRole').textContent = p.role + ' · United Optic';
  ['meAv','topAv'].forEach(id => { const e = $(id); e.textContent = p.photo ? '' : i; e.style.backgroundImage = p.photo ? `url(${p.photo})` : 'none'; });
  $('today').textContent = new Date().toLocaleDateString('en-US', {weekday:'long', month:'short', day:'numeric'});
}

 
function notifs() {
  const list = S.products.filter(p => p.stock <= 6).map(p => ({t: p.stock ? 'Low stock alert' : 'Out of stock', d: `${p.brand} ${p.name} — ${p.stock} unit(s) left`, c: p.stock ? 'amber' : 'red'}));
  S.orders.filter(o => o.status === 'Reserved').forEach(o => list.push({t:'Reserved order pending pickup', d:`${o.id} for ${cust(o.cust)?.name || 'customer'}`, c:'blue'}));
  S.appts.filter(a => ['Scheduled','Confirmed'].includes(a.status) && isUpcomingAppointment(a)).forEach(a => list.push({t:'Appointment reminder', d:`${cust(a.cust)?.name} · ${a.type} with ${a.doctor} on ${a.date} ${a.time}`, c:'green'}));
  return list;
}
const notifList = list => list.length ? list.map(n => `<div class="ni2 ${S.read ? '' : 'unread'}"><div>${bd('•', n.c)}</div><div><b>${esc(n.t)}</b><p>${esc(n.d)}</p></div></div>`).join('') : '<div class="empty">No notifications.</div>';

 
const orderRows = list => list.map(o => {
  const c = cust(o.cust), tot = orderTotal(o);
  return [`<span class="strong mono">${o.id}</span>`, esc(c?.name || '—'), o.date, `<span class="strong">${money(tot)}</span>`, bd(o.status || 'Unknown', oc[o.status] || 'navy'),
    `<div class="row">${btn('Open',`openOrder('${o.id}')`,'ghost','sm')}${o.status==='Ready for Payment'?btn('Take payment',`paymentModal('${o.id}')`,'pri','sm'):''}${btn('Print',`printOrder('${o.id}')`,'ghost','sm')}</div>`];
});
const OH = ['Order #','Customer','Date','Total','Status',''];
const filteredOrders = () => S.orders.filter(o => !q() || o.id.toLowerCase().includes(q()) || (cust(o.cust)?.name || '').toLowerCase().includes(q()));
function orderStatusChart() {
  const statuses = [...new Set(['Draft','Reserved','Processing','Ready for Payment','Completed','Cancelled',...S.orders.map(order => order.status || 'Unknown')])];
  const counts = statuses.map(status => S.orders.filter(order => order.status === status).length);
  const maxCount = Math.max(1, ...counts);
  const statusClass = status => status.toLowerCase().replaceAll(' ', '-');
  return `<section class="panel order-chart" role="img" aria-label="Order status overview for ${S.orders.length} orders">
    <div class="pheadr"><div><h3>Order Status Overview</h3><span class="sub">${S.orders.length} total orders</span></div></div>
    <div class="order-chart-rows">${statuses.map((status, index) => `<div class="order-chart-row">
      <span class="order-chart-label">${esc(status)}</span>
      <div class="order-chart-track"><span class="order-chart-fill status-${statusClass(status)}" style="width:${counts[index] / maxCount * 100}%"></span></div>
      <b class="order-chart-count">${counts[index]}</b>
    </div>`).join('')}</div>
  </section>`;
}

const VIEWS = {
  dashboard() {
    const open = S.orders.filter(o => !['Completed','Cancelled'].includes(o.status));
    const st = [['Customers', S.customers.length], ['Active Sales Orders', open.length], ['Products', S.products.length], ['Pending Appointments', S.appts.filter(a => ['Scheduled','Confirmed'].includes(a.status) && isUpcomingAppointment(a)).length],
      ['Reserved Orders', S.orders.filter(o => o.status === 'Reserved').length], ['Cart Items', S.cart.reduce((s, i) => s + i.qty, 0)]];
    const qk = [['☺','Register Customer','regCustomer()'],['▣','New Sales Order','newOrder()'],['▤','Book Appointment','bookAppt()'],['◧','Search Product',"go('products')"],['▥','Check Inventory','checkInv()'],['👁','View Active Orders',"go('orders')"]];
    return head(`Good day, ${esc(S.profile.name.split(' ')[0])}`, "Here's what's happening at Riverside Branch today",
      btn('+ New Sales Order','newOrder()') + btn('+ Register Customer','regCustomer()','pri')) +
      `<div class="grid g6">${st.map(s => `<div class="card stat"><b>${s[1]}</b><span>${s[0]}</span></div>`).join('')}</div>
      <div class="grid g6">${qk.map(k => `<button class="card quick" onclick="${k[2]}"><i>${k[0]}</i>${k[1]}</button>`).join('')}</div>
      ${orderStatusChart()}
      <div class="two"><div class="panel"><div class="pheadr"><h3>Active Sales Orders</h3>${btn('View all',"go('orders')",'ghost','sm')}</div>${table(OH, orderRows(open.slice(0, 5)), 'No active orders.')}</div>
      <div class="panel"><div class="pheadr"><h3>Notifications</h3></div>${notifList(notifs().slice(0, 5))}</div></div>`;
  },
  customers() {
    const list = S.customers.filter(c => !q() || [c.name, c.phone, c.id, c.email].some(x => String(x ?? '').toLowerCase().includes(q())));
    return head('Customers', `${list.length} registered customers at this branch`, btn('Search Customer',"$('gsearch').focus()") + btn('+ Register Customer','regCustomer()','pri')) +
      `<div class="panel">${table(['ID','Full name','Phone','Email','Prescription',''], list.map(c => [`<span class="sub mono">${c.id}</span>`, `<span class="strong">${esc(c.name)}</span>`, esc(c.phone), esc(c.email), bd(c.rxStatus, rc[c.rxStatus] || 'navy'),
        `<div class="row">${btn('View',`viewCust('${c.id}')`,'ghost','sm')}${btn('Edit',`regCustomer('${c.id}')`,'ghost','sm')}</div>`]), 'No customers found.')}</div>`;
  },
  products() {
    const sel = (k, l, o) => `<select onchange="F.${k}=this.value;render()"><option value="">${l}</option>${o.map(x => `<option ${F[k] === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`;
    const [lo, hi] = F.price ? F.price.split('-').map(Number) : [0, 1e9];
    const list = S.products.filter(p => (!q() || [p.name, p.brand, p.sku].some(x => String(x ?? '').toLowerCase().includes(q()))) && (!F.cat || p.cat === F.cat) && (!F.brand || p.brand === F.brand) &&
      (!F.frame || p.frame === F.frame) && (!F.lens || p.lens === F.lens) && p.price >= lo && p.price <= hi && (!F.avail || stat(p)[0] === F.avail));
    const icons = {Frame:'👓', Sunglasses:'🕶', Lens:'🔍', 'Contact Lens':'👁'};
    return head('Product Catalog', `${list.length} of ${S.products.length} products`, btn('Check Stock','checkInv()') + btn('Search Product',"$('gsearch').focus()",'pri')) +
      `<div class="filters">${sel('cat','Category',uniq('cat'))}${sel('brand','Brand',uniq('brand'))}${sel('frame','Frame type',uniq('frame'))}${sel('lens','Lens type',uniq('lens'))}
      <select onchange="F.price=this.value;render()"><option value="">Price range</option>${[['0-100','Under $100'],['100-250','$100 – $250'],['250-1000','$250+']].map(r => `<option value="${r[0]}" ${F.price === r[0] ? 'selected' : ''}>${r[1]}</option>`).join('')}</select>
      ${sel('avail','Availability',['In Stock','Low Stock','Out of Stock'])}${btn('Clear',"Object.keys(F).forEach(k=>F[k]='');$('gsearch').value='';render()",'ghost','sm')}</div>
      <div class="pg">${list.map(p => { const s = stat(p), image = productImageUrl(p.image), fallback = icons[p.cat] || '👓'; return `<div class="card pc"><div class="pm">${image ? `<img data-product-image data-fallback="${fallback}" src="${esc(image)}" alt="${esc(p.name)}" loading="lazy" decoding="async">` : `<span class="product-image-fallback" aria-hidden="true">${fallback}</span>`}${bd(s[0], s[1])}</div><div class="pbody"><div class="brandt">${esc(p.brand)}</div><b class="strong">${esc(p.name)}</b>
        <div class="row"><span class="tag">${p.cat}</span><span class="tag">${p.stock} units</span></div><div class="pfoot"><span class="price">${money(p.price)}</span><span class="sub mono">${esc(p.sku)}</span></div>
        <div class="pa">${btn('Details',`details('${p.id}')`,'ghost','sm')}${btn('Reserve',`reserve('${p.id}')`,'soft','sm')}${btn('Add',`addCart('${p.id}')`,'pri','sm')}</div></div></div>`; }).join('') || '<div class="empty">No products match.</div>'}</div>`;
  },
  appointments() {
    const list = [...S.appts].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    return head('Appointments', `${list.length} appointments · 3 optometrists on schedule`, btn('Reschedule','reschedule()') + btn('+ Book Appointment','bookAppt()','pri')) +
      `<div class="panel">${table(['Customer','Doctor','Type','Date','Time','Status',''], list.map(a => [`<span class="strong">${esc(cust(a.cust)?.name || '—')}</span>`, esc(a.doctor), esc(a.type), a.date, a.time, bd(a.status, ac[a.status]),
        `<div class="row">${btn('Reschedule',`reschedule('${a.id}')`,'ghost','sm')}${a.status === 'Cancelled' ? '' : btn('Cancel',`apptStatus('${a.id}','Cancelled')`,'danger','sm')}${['Scheduled','Confirmed'].includes(a.status) ? btn('Done',`apptStatus('${a.id}','Completed')`,'soft','sm') : ''}</div>`]), 'No appointments.')}</div>`;
  },
  orders() {
    const c = cust(S.cust), s = sub(S.cart);
    const ws = `<div class="two"><div class="panel"><div class="info">${c ? `<div class="av">${initials(c.name)}</div><div><span>Customer</span><b>${esc(c.name)}</b></div><div><span>Phone</span><b>${esc(c.phone)}</b></div><div><span>Prescription</span>${bd(c.rxStatus, rc[c.rxStatus] || 'navy')}</div>${btn('View Profile',`viewCust('${c.id}')`,'ghost','sm')}` :
      `<span class="sub">No customer selected.</span> ${btn('Select customer','newOrder()','pri','sm')}`}</div>
      <form class="order-product-entry" onsubmit="addOrderProduct(event)"><label>Product<select name="product" required><option value="">Choose a product</option>${S.products.map(p=>{const inOrder=S.cart.find(i=>i.pid===p.id)?.qty||0;const available=Math.max(0,p.stock-inOrder);return `<option value="${esc(p.id)}" ${available<1?'disabled':''}>${esc(p.name)} · ${esc(p.sku)} · ${available} available · ${money(p.price)}</option>`;}).join('')}</select></label><label>Qty<input name="quantity" type="number" min="1" value="1" required></label><button class="btn pri" type="submit">Add product</button></form>
      ${cartTable()}
      ${c?.rx ? `<div class="pb"><span class="sub">Prescription: </span><b>${esc(c.rx)}</b></div>` : ''}</div>
      <div class="panel"><div class="pheadr"><h3>Order Summary</h3></div><div class="pb"><div class="sr"><span>Subtotal</span><b>${money(s)}</b></div>
      <div class="st"><span>Total</span><span>${money(s)}</span></div><div class="acts" style="flex-direction:column;margin-top:16px">
      ${btn('Save Draft',"saveOrder('Draft')")}${btn('Reserve Product',"saveOrder('Reserved')",'soft')}${btn('Continue to Payment',"saveOrder('Ready for Payment')",'pri')}</div></div></div></div>`;
    return head('Sales Order Workspace', c ? `New order for ${esc(c.name)}` : 'Start a new order', btn('+ New Sales Order','newOrder()') + btn('Update Status','updateStatus()','navy')) + ws +
      `<div class="panel"><div class="pheadr"><h3>Active Orders</h3></div>${table(OH, orderRows(filteredOrders()), 'No orders yet.')}</div>`;
  },
  cart() {
    return head('Shopping Cart', `${S.cart.reduce((s, i) => s + i.qty, 0)} items in current session`, btn('Clear cart',"S.cart=[];save();render()",'ghost') + btn('Create Order','newOrder()','pri')) +
      `<div class="panel">${cartTable()}<div class="pb"><div class="sr"><span>Subtotal</span><b>${money(sub(S.cart))}</b></div></div></div>`;
  },
  inventory() {
    const l = S.products.filter(p => !q() || [p.name, p.brand, p.sku].some(x => String(x ?? '').toLowerCase().includes(q())));
    const rs = p => S.orders.filter(o => o.status === 'Reserved').reduce((s, o) => s + o.items.filter(i => i.pid === p.id).reduce((a, i) => a + i.qty, 0), 0);
    const cards = [['Available Stock', S.products.reduce((s, p) => s + p.stock, 0)], ['Reserved Stock', S.products.reduce((s, p) => s + rs(p), 0)], ['Low Stock', S.products.filter(p => p.stock > 0 && p.stock <= 6).length], ['Out of Stock', S.products.filter(p => !p.stock).length]];
    return head('Inventory Status', 'Riverside Branch stock overview', btn('Check Inventory','checkInv()','pri')) + `<div class="grid g4">${cards.map(c => `<div class="card stat"><b>${c[1]}</b><span>${c[0]}</span></div>`).join('')}</div>
      <div class="panel">${table(['Product','SKU','Category','Available','Reserved','Status'], l.map(p => [`<span class="strong">${esc(p.name)}</span>`, `<span class="mono sub">${esc(p.sku)}</span>`, p.cat, `<b>${p.stock}</b>`, rs(p), bd(...stat(p))]), 'No products.')}</div>`;
  },
  notifications() {
    const n = notifs();
    return head('Notifications', S.read ? 'All caught up' : `${n.length} unread updates`, btn('Mark all as read',"S.read=true;save();render()")) + `<div class="panel">${notifList(n)}</div>`;
  },
  profile() {
    return head('My Profile', 'Your account details and sales activity') + `<div class="profile-layout" data-profile-root><div class="panel profile-identity"><div class="av profile-avatar" data-profile-avatar>--</div><h3 data-profile-name>Loading profile…</h3><div class="sub" data-profile-role>Sales Staff</div><div class="profile-actions"><button class="btn" type="button" data-profile-edit>Edit profile</button><button class="btn ghost" type="button" data-profile-password>Change password</button></div><p class="profile-error" data-profile-error aria-live="polite"></p></div><div class="panel profile-details"><h3>Account Details</h3><div class="profile-info"><span>Email</span><b data-profile-email>—</b></div><div class="profile-info"><span>Phone</span><b data-profile-phone>—</b></div><div class="profile-info"><span>Role</span><b data-profile-role>Sales Staff</b></div></div></div>`;
  }
};
VIEWS.logout = () => '';

 
function cartTable() {
  return table(['Product','Qty','Unit Price','Total',''], S.cart.map(i => { const p = prod(i.pid); return [`<span class="strong">${esc(p.name)}</span><div class="sub">${p.cat} · ${esc(p.brand)}</div>`,
    `<div class="step"><button onclick="qty('${p.id}',-1)">−</button><span>${i.qty}</span><button onclick="qty('${p.id}',1)">+</button></div>`, money(p.price), `<b>${money(p.price * i.qty)}</b>`, btn('Remove',`rmItem('${p.id}')`,'danger','sm')]; }), 'Cart is empty — add products from the catalog.');
}
function addCart(id) {
  const p = prod(id), it = S.cart.find(i => i.pid === id), have = it ? it.qty : 0;
  if (have >= p.stock) return toast(p.stock ? `Only ${p.stock} in stock` : `${p.name} is out of stock`);
  it ? it.qty++ : S.cart.push({pid: id, qty: 1}); save(); buildNav(); toast(`Added ${p.name} to cart`);
}
function qty(id, d) { const it = S.cart.find(i => i.pid === id); if (!it) return; const n = it.qty + d; if (n > prod(id).stock) return toast('Not enough stock'); if (n < 1) return rmItem(id); it.qty = n; save(); render(); }
function rmItem(id) { S.cart = S.cart.filter(i => i.pid !== id); save(); render(); }

 
function newOrder() {
  modal('New Sales Order', `<form onsubmit="startOrder(event)"><div class="f"><label>Customer</label><select name="c">${custOptions(S.cust)}</select></div><div class="acts">${btn('Register new customer','closeM();regCustomer()','ghost')}<button class="btn pri">Start order</button></div></form>`);
}
function startOrder(e) { S.cust = fd(e).c; save(); closeM(); go('orders'); }
function addOrderProduct(e) {
  e.preventDefault();
  const form=e.currentTarget, data=new FormData(form), id=String(data.get('product')||''), qty=Number(data.get('quantity'));
  const product=prod(id), inOrder=S.cart.find(item=>item.pid===id)?.qty||0;
  if(!product)return toast('Choose a product to add.');
  if(!Number.isInteger(qty)||qty<1)return toast('Enter a quantity of at least one.');
  if(inOrder+qty>product.stock)return toast(`Only ${Math.max(0,product.stock-inOrder)} unit(s) of ${product.name} are available.`);
  const item=S.cart.find(entry=>entry.pid===id); item?item.qty+=qty:S.cart.push({pid:id,qty});
  save();toast(`${qty} × ${product.name} added to the order.`);render();
}
async function saveOrder(status) {
  if (!S.cust) return newOrder();
  if (!S.cart.length) return toast('Cart is empty');
  try{const r=await api('order',{customer:Number(S.cust),status,items:S.cart.map(i=>({pid:Number(i.pid),qty:i.qty}))});applyData(r.data);S.cart=[];save();toast(`Order saved as ${status}`);render();if(status==='Ready for Payment'&&S.orders[0])paymentModal(S.orders[0].id);}catch(e){toast(e.message);}
}
function setStatus(id, st) {
  api('status',{id:Number(id.replace('SO-','')),status:st}).then(r=>{applyData(r.data);closeM();toast(`${id} → ${st}`);render();}).catch(e=>toast(e.message));
}
function statusForm(id) {
  const order=S.orders.find(o=>o.id===id);if(order.status==='Completed')return '<p class="sub">Payment recorded. This sale is complete.</p>';const choices=STATUSES;
  return `<form onsubmit="event.preventDefault();setStatus('${id}',this.s.value)"><div class="f"><label>Status</label><select name="s">${choices.map(s => `<option ${order.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>${order.status==='Ready for Payment'?btn('Take payment',`paymentModal('${id}')`,'pri'):''}<button class="btn pri">Update status</button></form>`;
}
function paymentModal(id) { const order=S.orders.find(o=>o.id===id);if(!order)return toast('Order not found');modal(`Take Payment · ${id}`,`<p>Collect <b>${money(sub(order.items))}</b> from ${esc(cust(order.cust)?.name||'customer')}.</p><form onsubmit="payOrder(event,'${id}')"><div class="f"><label>Payment method</label><select name="method" required><option>Cash</option><option>Card</option><option>Mobile payment</option></select></div><button class="btn pri">Record payment</button></form>`); }
function payOrder(e,id) { e.preventDefault();const method=new FormData(e.target).get('method');api('payment',{id:Number(id.replace('SO-','')),method}).then(r=>{applyData(r.data);closeM();toast(`Payment recorded for ${id}`);render();}).catch(err=>toast(err.message)); }
function updateStatus() {
  if (!S.orders.length) return toast('No orders yet');
  modal('Update Status', `<div class="f"><label>Order</label><select onchange="$('sf').innerHTML=statusForm(this.value)">${S.orders.map(o => `<option>${o.id}</option>`).join('')}</select></div><div id="sf">${statusForm(S.orders[0].id)}</div>`);
}
function openOrder(id) {
  const o = S.orders.find(x => x.id === id), c = cust(o.cust), s = sub(o.items);
  modal(`Order ${id}`, `<p><b>${esc(c?.name)}</b> · ${o.date} · ${bd(o.status || 'Unknown', oc[o.status] || 'navy')}</p>${table(['Item','Qty','Total'], o.items.map(i => [esc(prod(i.pid)?.name || 'Product unavailable'), i.qty, money(lineTotal(i))]))}
    <div class="sr"><span>Items subtotal</span><b>${money(s)}</b></div><div class="sr"><span>Order total</span><b>${money(orderTotal(o))}</b></div>${statusForm(id)}<div style="margin-top:10px">${btn('Print Order',`printOrder('${id}')`)}</div>`);
}
function printOrder(id) {
  const o = S.orders.find(x => x.id === id), c = cust(o.cust), s = sub(o.items);
  if (!o) return toast('Order not found.');
  $('printArea').innerHTML = `<article class="print-order"><h1>United Optic — Sales Order ${esc(o.id)}</h1><p>Customer: ${esc(c?.name || 'Customer')} · ${esc(c?.phone)}<br>Date: ${esc(o.date)} · Status: ${esc(o.status)}</p>
    <table><thead><tr><th>Item</th><th>SKU</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>
    ${o.items.map(i => { const p = prod(i.pid); return `<tr><td>${esc(p?.name || 'Product unavailable')}</td><td>${esc(p?.sku || '')}</td><td>${i.qty}</td><td>${money(Number(i.price ?? p?.price) || 0)}</td><td>${money(lineTotal(i))}</td></tr>`; }).join('')}</tbody></table>
    <p class="print-order-total">Items subtotal ${money(s)}<br><b>Order total ${money(orderTotal(o))}</b></p>${c?.rx ? `<p>Prescription: ${esc(c.rx)}</p>` : ''}</article>`;
  closeM();
  requestAnimationFrame(() => window.print());
}

 
function regCustomer(id) {
  const c = id ? cust(id) : {name:'', phone:'', email:'', rxStatus:'None', rx:''};
  modal(id ? 'Edit Customer' : 'Register Customer', `<form onsubmit="saveCust(event,'${id || ''}')"><div class="f"><label>Full name</label><input name="name" required value="${esc(c.name)}"></div>
    <div class="fr"><div class="f"><label>Phone</label><input name="phone" value="${esc(c.phone)}"></div><div class="f"><label>Email</label><input name="email" type="email" value="${esc(c.email)}"></div></div>
    ${id ? `<div class="f"><label>Prescription</label><div class="pb">${bd(c.rxStatus,rc[c.rxStatus]||'navy')} ${esc(c.rx||'No prescription recorded')}</div><small class="sub">Prescription details are maintained by the optometry team.</small></div>` : ''}<button class="btn pri">${id ? 'Save changes' : 'Register'}</button></form>`);
}
function saveCust(e, id) {
  const d = fd(e);
  api('customer',{id:id?Number(id):0,...d}).then(r=>{applyData(r.data);closeM();toast(id?'Customer updated':'Customer registered');render();}).catch(err=>toast(err.message));
}
function viewCust(id) {
  const c = cust(id), os = S.orders.filter(o => o.cust === id), as = S.appts.filter(a => a.cust === id);
  modal(c.name, `<p class="sub mono">${c.id}</p><p>📞 ${esc(c.phone)}<br>✉ ${esc(c.email)}<br>Prescription: ${bd(c.rxStatus, rc[c.rxStatus] || 'navy')} ${esc(c.rx)}</p>
    <p><b>Orders:</b> ${os.map(o => o.id).join(', ') || 'none'}<br><b>Appointments:</b> ${as.map(a => a.date + ' ' + a.time).join(', ') || 'none'}</p>
    <div class="acts">${btn('Edit',`regCustomer('${id}')`)}${btn('Book appointment',`bookAppt('${id}')`)}${btn('New order',`S.cust='${id}';closeM();go('orders')`,'pri')}</div>`);
}

 
function details(id) {
  const p = prod(id), image = productImageUrl(p.image), fallback = ({Frame:'👓',Sunglasses:'🕶',Lens:'🔍','Contact Lens':'👁'})[p.cat] || '👓';
  modal(p.name, `${image ? `<img class="product-detail-image" data-product-image data-fallback="${fallback}" src="${esc(image)}" alt="${esc(p.name)}">` : `<div class="product-detail-fallback" aria-hidden="true">${fallback}</div>`}<p class="brandt">${esc(p.brand)}</p><p>SKU <span class="mono">${esc(p.sku)}</span><br>Category: ${esc(p.cat)}${p.frame ? '<br>Frame: ' + esc(p.frame) : ''}${p.lens ? '<br>Lens: ' + esc(p.lens) : ''}<br>Price: <b>${money(p.price)}</b><br>Stock: ${p.stock} ${bd(...stat(p))}</p>${btn('Add to cart',`addCart('${id}');closeM()`,'pri')}`);
  wireProductImages($('mBody'));
}
function reserve(id) {
  if (!prod(id).stock) return toast('Out of stock');
  modal('Reserve Product', `<form onsubmit="doReserve(event,'${id}')"><p>${esc(prod(id).name)} — 1 unit</p><div class="f"><label>Customer</label><select name="c">${custOptions(S.cust)}</select></div><button class="btn pri">Reserve</button></form>`);
}
function doReserve(e, id) { e.preventDefault();const c=new FormData(e.target).get('c');api('order',{customer:Number(c),status:'Reserved',items:[{pid:Number(id),qty:1}]}).then(r=>{applyData(r.data);closeM();toast('Product reserved');render();}).catch(err=>toast(err.message)); }
function checkInv() {
  modal('Check Inventory', `<div class="f"><label>Product name or SKU</label><input id="ci" oninput="ciRun(this.value)" placeholder="Start typing…"></div><div id="cr">${ciHtml('')}</div>`); setTimeout(() => $('ci')?.focus(), 50);
}
const ciHtml = v => { const l = S.products.filter(p => !v || (p.name + p.sku + p.brand).toLowerCase().includes(v.toLowerCase())); return l.map(p => `<div class="sr"><span>${esc(p.name)} <small class="sub mono">${p.sku}</small></span><span>${p.stock} ${bd(...stat(p))}</span></div>`).join('') || '<div class="empty">No match.</div>'; };
const ciRun = v => $('cr').innerHTML = ciHtml(v);

 
const apptForm = (a, fn) => `<form onsubmit="${fn}(event)">${a.id ? '' : `<div class="f"><label>Customer</label><select name="cust">${custOptions(a.cust)}</select></div>
  <div class="fr"><div class="f"><label>Optometrist</label><select name="doctor"><option value="">Unassigned</option>${(S.doctors||[]).map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select></div>${S.appointmentTypeEnabled?'<div class="f"><label>Type</label><select name="type"><option>Eye exam</option><option>Fitting</option><option>Follow-up</option></select></div>':''}</div>`}
  <div class="fr"><div class="f"><label>Date</label><input type="date" name="date" required value="${a.date || ''}"></div><div class="f"><label>Time</label><input type="time" name="time" required value="${a.time || '09:00'}"></div></div><button class="btn pri">${a.id ? 'Reschedule' : 'Book'}</button></form>`;
function bookAppt(c) { modal('Book Appointment', apptForm({cust: c || S.cust}, 'saveAppt')); }
function saveAppt(e) { e.preventDefault();const d=fd(e);api('appointment',{customer:Number(d.cust),doctor:Number(d.doctor)||null,date:d.date,time:d.time,type:d.type}).then(r=>{applyData(r.data);closeM();toast('Appointment booked');go('appointments');}).catch(err=>toast(err.message)); }
function reschedule(id) {
  if (!S.appts.length) return toast('No appointments to reschedule');
  id = id || S.appts[0].id; const a = S.appts.find(x => x.id === id);
  modal('Reschedule Appointment', `<div class="f"><label>Appointment</label><select onchange="reschedule(this.value)">${S.appts.map(x => `<option value="${x.id}" ${x.id === id ? 'selected' : ''}>${esc(cust(x.cust)?.name)} — ${x.date} ${x.time}</option>`).join('')}</select></div>${apptForm(a, `moveAppt.bind(null,'${id}')`)}`);
}
function moveAppt(id, e) { e.preventDefault();const d=fd(e);api('appointment',{id:Number(id),date:d.date,time:d.time}).then(r=>{applyData(r.data);closeM();toast('Appointment rescheduled');render();}).catch(err=>toast(err.message)); }
function apptStatus(id, st) { api('appointment_status',{id:Number(id),status:st}).then(r=>{applyData(r.data);render();}).catch(err=>toast(err.message)); }

 
function saveProfile(e) { Object.assign(S.profile, fd(e)); save(); toast('Profile updated'); render(); }
function photo(inp) { const f = inp.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { S.profile.photo = r.result; save(); render(); }; r.readAsDataURL(f); }

 
$('menuBtn').onclick = () => setMenuOpen(!document.body.classList.contains('nav'));
$('drawerClose').onclick = () => setMenuOpen(false);
$('scrim').onclick = () => setMenuOpen(false);
$('mClose').onclick = closeM;
$('modal').onclick = e => { if (e.target.id === 'modal') closeM(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeM(); setMenuOpen(false); } });
$('gsearch').oninput = e => { F.q = e.target.value.trim(); if (['dashboard','profile','cart','notifications','appointments'].includes(V)) V = 'products'; render(); };
fetch('../Admin/Api/profile.php',{credentials:'same-origin',cache:'no-store'}).then(r=>r.json()).then(result=>{const p=result.profile;if(!p)return;S.profile.name=p.FullName||p.Username||S.profile.name;S.profile.email=p.Email||'';S.profile.role=p.Role||S.profile.role;renderProfileBits();if(V==='dashboard')render();}).catch(()=>{});
refreshData();
