/* ==========================================================
   PENTING:
   GANTI URL DI BAWAH DENGAN URL WEB APP APPS SCRIPT ANDA.
   HARUS BERAKHIR DENGAN /exec
   ========================================================== */
const API_URL = 'https://script.google.com/macros/s/AKfycbw7SrE0gygQ_CgALMF0CmV4DS4DXpCvRCfuicAcRMEuus1UFDt41Z87ltIS6LUraHJ-kg/exec';

let state = {
  user: null,
  customers: [],
  packages: [],
  invoices: []
};

function rupiah(n){
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}
function esc(v){
  return String(v ?? '').replace(/[&<>"']/g,m=>(
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]
  ));
}

function formatTanggal(v){
  if (!v) return '-';

  const s = String(v).trim();

  // Format ISO: 2026-10-20 atau 2026-10-20T00:00:00
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return `${m[3]}-${m[2]}-${m[1]}`;
  }

  const d = new Date(v);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  return s;
}

function currentMonth(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
}

function currentMonth(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
}
function toast(msg){
  const el=document.getElementById('toast');
  el.textContent=msg; el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),3000);
}
function showError(err){
  console.error(err);
  toast(err.message || String(err));
}
async function api(action, data={}){
  if(API_URL.includes('GANTI_DENGAN_URL')){
    throw new Error('API_URL belum diisi. Masukkan URL Web App Apps Script yang berakhir /exec di index.html.');
  }
  const body = Object.assign({action}, data);
  const res = await fetch(API_URL,{
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify(body)
  });
  const text = await res.text();
  let json;
  try{ json=JSON.parse(text); }catch(e){ throw new Error('Respons server bukan JSON: '+text.slice(0,300)); }
  if(!json.ok && json.error) throw new Error(json.message || json.error);
  return json;
}

async function login(){
  const user=document.getElementById('loginUser').value.trim();
  const pin=document.getElementById('loginPin').value.trim();
  const msg=document.getElementById('loginMsg');
  msg.textContent='Memeriksa...';
  try{
    const r=await api('login',{username:user,pin:pin});
    if(!r.ok) throw new Error(r.message || 'Login gagal');
    state.user=r.user;
    localStorage.setItem('rtrw_user',JSON.stringify(r.user));
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('appPage').classList.remove('hidden');
    showPage('dashboard');
    msg.textContent='';
  }catch(e){msg.textContent=e.message;showError(e);}
}
function logout(){
  localStorage.removeItem('rtrw_user');
  location.reload();
}
function boot(){
  document.getElementById('invoicePeriod').value=currentMonth();
  document.getElementById('reportPeriod').value=currentMonth();
  const saved=localStorage.getItem('rtrw_user');
  if(saved){
    try{
      state.user=JSON.parse(saved);
      document.getElementById('loginPage').classList.add('hidden');
      document.getElementById('appPage').classList.remove('hidden');
      showPage('dashboard');
    }catch(e){localStorage.removeItem('rtrw_user')}
  }
}
async function showPage(page){
  document.querySelectorAll('.page').forEach(x=>x.classList.add('hidden'));
  const target=document.getElementById('page-'+page);
  if(target) target.classList.remove('hidden');
  document.querySelectorAll('[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===page));
  try{
    if(page==='dashboard') await loadDashboard();
    if(page==='customers') await loadCustomers();
    if(page==='invoices') await loadInvoices();
    if(page==='packages') await loadPackages();
    if(page==='report') await loadReport();
    if(page==='settings') await loadSettings();
    if(page==='whatsapp') await loadWhatsApp();
  }catch(e){showError(e)}
}

async function loadDashboard(){
  const r=await api('dashboard');
  const d=r.data||{};
  document.getElementById('kTotal').textContent=d.total_pelanggan||0;
  document.getElementById('kActive').textContent=d.aktif||0;
  document.getElementById('kUnpaid').textContent=d.belum_lunas||0;
  document.getElementById('kRevenue').textContent=rupiah(d.uang_belum_bayar ?? d.pendapatan);
  document.getElementById('kCash').textContent=rupiah(d.cash ?? d.total_cash);
  document.getElementById('kTransfer').textContent=rupiah(d.transfer ?? d.total_transfer);
}

async function loadCustomers(){
  const q=document.getElementById('customerSearch').value;
  const status=document.getElementById('customerStatus').value;
  const [r,pkg] = await Promise.all([
    api('customers',{q,status}),
    api('packages')
  ]);
  state.customers=r.data||[];
  state.packages=pkg.data||[];
  const paketMap=Object.fromEntries(state.packages.map(p=>[String(p.id),p]));
  document.getElementById('customerRows').innerHTML=state.customers.map(c=>{
    const p=paketMap[String(c.paket_id||'')];
    const paketLabel=p ? `${p.nama} - ${p.kecepatan}` : (c.paket_id||'-');
    return `
    <tr>
      <td><b>${esc(c.nama)}</b><br><small>${esc(c.alamat||'')}</small></td>
      <td>${esc(c.username)}</td><td>${esc(c.no_hp)}</td><td>${esc(paketLabel)}</td>
      <td><span class="badge ${String(c.status).toLowerCase()==='aktif'?'paid':String(c.status).toLowerCase()==='nonaktif'?'inactive':'unpaid'}">${esc(c.status)}</span></td>
      <td><button class="btn btn-secondary" onclick='openCustomer(${JSON.stringify(c).replace(/'/g,"&#39;")})'>Edit</button></td>
    </tr>`;
  }).join('') || '<tr><td colspan="6">Belum ada pelanggan.</td></tr>';
}
async function loadPackages(){
  const r=await api('packages'); state.packages=r.data||[];
  document.getElementById('packageRows').innerHTML=state.packages.map(p=>`
    <tr><td><b>${esc(p.nama)}</b></td><td>${esc(p.kecepatan)}</td><td>${rupiah(p.harga)}</td><td>${esc(p.status)}</td>
    <td><button class="btn btn-secondary" onclick='openPackage(${JSON.stringify(p).replace(/'/g,"&#39;")})'>Edit</button></td></tr>`).join('') || '<tr><td colspan="5">Belum ada paket.</td></tr>';
}
function normalizePeriodClient(v){
  if(v instanceof Date && !isNaN(v.getTime())) return v.getFullYear()+'-'+String(v.getMonth()+1).padStart(2,'0');
  const s=String(v??'').trim();
  const m=s.match(/(\d{4})[-\/](\d{1,2})/);
  if(m) return m[1]+'-'+String(m[2]).padStart(2,'0');
  const d=new Date(s);
  return !isNaN(d.getTime()) ? d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0') : s;
}
async function loadInvoices(){
  const periode=document.getElementById('invoicePeriod').value||currentMonth();
  const status=document.getElementById('invoiceStatus').value;
  // Ambil semua data lalu normalisasi periode di frontend. Ini menjaga tabel tetap tampil
  // walaupun Google Sheets menyimpan periode sebagai tanggal 01 atau timestamp.
  const r=await api('invoices',{status});
  let rows=Array.isArray(r.data)?r.data:[];
  rows=rows.filter(i=>normalizePeriodClient(i.periode)===periode);

rows = rows.filter(i =>
  String(i.status || '').trim().toLowerCase() !== 'digabung'
);

if(status) rows=rows.filter(i =>
  String(i.status||'').trim().toLowerCase()===status.trim().toLowerCase()
);
  if(status) rows=rows.filter(i=>String(i.status||'').trim().toLowerCase()===status.trim().toLowerCase());
  state.invoices=rows;
  document.getElementById('invoiceRows').innerHTML=state.invoices.map(i=>`
    <tr><td><b>${esc(i.nama)}</b><br><small>${esc(i.no_hp)}</small></td><td>${formatTanggal(i.periode)}</td>
    <td><b>${rupiah(i.nominal)}</b></td><td>${formatTanggal(i.jatuh_tempo)}</td>
    <td><span class="badge ${String(i.status).toLowerCase()==='lunas'?'paid':String(i.status).toLowerCase()==='digabung'?'inactive':'unpaid'}">${esc(i.status)}</span></td>
    <td>${String(i.status).toLowerCase()==='belum lunas'?`<button class="btn btn-primary" onclick='payInvoice(${JSON.stringify(i).replace(/'/g,"&#39;")})'>Bayar</button>`:'-'}</td></tr>`).join('') || '<tr><td colspan="6">Belum ada tagihan.</td></tr>';
}
async function generateInvoices(){
  const periode=document.getElementById('invoicePeriod').value||currentMonth();
  if(!confirm('Buat tagihan periode '+periode+'?')) return;
  try{const r=await api('generate',{periode});toast(r.message||'Tagihan dibuat');await loadInvoices();await loadDashboard();}catch(e){showError(e)}
}
async function loadReport(){
  const periode=document.getElementById('reportPeriod').value||currentMonth();
  const r=await api('report',{periode}); const d=r.data||{};
  document.getElementById('rBill').textContent=rupiah(d.total_tagihan);
  document.getElementById('rPaid').textContent=d.lunas||0;
  document.getElementById('rUnpaid').textContent=d.belum_lunas||0;
  document.getElementById('rPay').textContent=rupiah(d.total_pembayaran);
  document.getElementById('rCash').textContent=rupiah(d.cash);
  document.getElementById('rTransfer').textContent=rupiah(d.transfer);
}
async function loadSettings(){
  const r=await api('settings'); const d=r.data||{};
  document.getElementById('sNama').value=d.NAMA_USAHA||'';
  document.getElementById('sTelepon').value=d.TELEPON_USAHA||'';
  document.getElementById('sAlamat').value=d.ALAMAT_USAHA||'';
  document.getElementById('sDue').value=d.JATUH_TEMPO_DEFAULT||10;
  document.getElementById('sMerge').value=d.AUTO_GABUNG_TUNGGAKAN||'YA';
}
async function saveSettings(){
  try{
    const r=await api('settings_save',{
      NAMA_USAHA:document.getElementById('sNama').value,
      TELEPON_USAHA:document.getElementById('sTelepon').value,
      ALAMAT_USAHA:document.getElementById('sAlamat').value,
      JATUH_TEMPO_DEFAULT:document.getElementById('sDue').value,
      AUTO_GABUNG_TUNGGAKAN:document.getElementById('sMerge').value
    });
    toast(r.message||'Tersimpan');
  }catch(e){showError(e)}
}

function openCustomer(c={}){
  document.getElementById('modalTitle').textContent=c.id?'Edit Pelanggan':'Tambah Pelanggan';
  document.getElementById('modalBody').innerHTML=`
    <div class="field"><label>Nama</label><input id="fNama" value="${esc(c.nama)}"></div>
    <div class="field"><label>Username</label><input id="fUsername" value="${esc(c.username)}"></div>
    <div class="field"><label>Password</label><input id="fPassword" value="${esc(c.password)}"></div>
    <div class="field"><label>No. HP / WhatsApp</label><input id="fHp" value="${esc(c.no_hp)}" placeholder="08xxxxxxxxxx"></div>
    <div class="field"><label>Alamat</label><textarea id="fAlamat">${esc(c.alamat)}</textarea></div>
    <div class="field"><label>Paket</label><select id="fPaket"><option value="">Pilih paket</option>${state.packages.map(p=>`<option value="${esc(p.id)}" ${String(p.id)===String(c.paket_id)?'selected':''}>${esc(p.nama)} - ${rupiah(p.harga)}</option>`).join('')}</select></div>
    <div class="field"><label>Harga Bulanan</label><input id="fHarga" type="number" value="${c.harga||0}"></div>
    <div class="field"><label>Status</label><select id="fStatus"><option ${c.status==='Aktif'?'selected':''}>Aktif</option><option ${c.status==='Isolir'?'selected':''}>Isolir</option><option ${c.status==='Nonaktif'?'selected':''}>Nonaktif</option></select></div>
    <button class="btn btn-primary full" onclick='saveCustomer(${JSON.stringify(c).replace(/'/g,"&#39;")})'>Simpan</button>`;
  document.getElementById('modal').classList.add('show');
}
async function saveCustomer(c){
  try{
    const r=await api('customer_save',{id:c.id||'',nama:fNama.value,username:fUsername.value,password:fPassword.value,no_hp:fHp.value,alamat:fAlamat.value,paket_id:fPaket.value,harga:fHarga.value,status:fStatus.value});
    toast(r.message||'Tersimpan');closeModal();await loadCustomers();
  }catch(e){showError(e)}
}
function openPackage(p={}){
  document.getElementById('modalTitle').textContent=p.id?'Edit Paket':'Tambah Paket';
  document.getElementById('modalBody').innerHTML=`
    <div class="field"><label>Nama Paket</label><input id="pNama" value="${esc(p.nama)}"></div>
    <div class="field"><label>Kecepatan</label><input id="pSpeed" value="${esc(p.kecepatan)}" placeholder="10 Mbps"></div>
    <div class="field"><label>Harga</label><input id="pHarga" type="number" value="${p.harga||0}"></div>
    <div class="field"><label>Deskripsi</label><textarea id="pDesc">${esc(p.deskripsi)}</textarea></div>
    <div class="field"><label>Status</label><select id="pStatus"><option ${p.status!=='Nonaktif'?'selected':''}>Aktif</option><option ${p.status==='Nonaktif'?'selected':''}>Nonaktif</option></select></div>
    <button class="btn btn-primary full" onclick='savePackage(${JSON.stringify(p).replace(/'/g,"&#39;")})'>Simpan</button>`;
  document.getElementById('modal').classList.add('show');
}
async function savePackage(p){
  try{const r=await api('package_save',{id:p.id||'',nama:pNama.value,kecepatan:pSpeed.value,harga:pHarga.value,deskripsi:pDesc.value,status:pStatus.value});toast(r.message||'Tersimpan');closeModal();await loadPackages();}catch(e){showError(e)}
}
function payInvoice(i){
  document.getElementById('modalTitle').textContent='Catat Pembayaran';
  document.getElementById('modalBody').innerHTML=`
    <p><b>${esc(i.nama)}</b><br>Periode ${esc(i.periode)}<br>Total ${rupiah(i.nominal)}</p>
    <div class="field"><label>Nominal Bayar</label><input id="payNominal" type="number" value="${Number(i.nominal)||0}"></div>
    <div class="field"><label>Metode</label><select id="payMetode"><option>Cash</option><option>Transfer</option><option>QRIS</option><option>E-Wallet</option></select></div>
    <div class="field"><label>Catatan</label><input id="payCatatan"></div>
    <button class="btn btn-primary full" onclick='savePayment(${JSON.stringify(i).replace(/'/g,"&#39;")})'>Simpan Pembayaran</button>`;
  document.getElementById('modal').classList.add('show');
}
async function savePayment(i){
  try{const r=await api('pay',{tagihan_id:i.id,pelanggan_id:i.pelanggan_id,nominal:payNominal.value,metode:payMetode.value,catatan:payCatatan.value});toast(r.message||'Pembayaran berhasil');closeModal();await loadInvoices();await loadDashboard();}catch(e){showError(e)}
}
function closeModal(){document.getElementById('modal').classList.remove('show')}
boot();


async function loadWhatsApp(){
  const period=document.getElementById('waPeriod');
  if(period && !period.value) period.value=currentMonth();
  try{
    const [cfg,auto]=await Promise.all([api('whatsapp_config'),api('get_whatsapp_auto')]);
    const d=(cfg && cfg.data && cfg.data.data) ? cfg.data.data : (cfg && cfg.data ? cfg.data : (cfg||{}));
    const status=document.getElementById('waStatus');
    status.textContent=d.configured?'Fonnte Terhubung':'Fonnte Belum Dikonfigurasi';
    status.className='badge '+(d.configured?'paid':'unpaid');
    document.getElementById('waConfigText').textContent=d.configured ? ('Fonnte • API: '+(d.apiUrl||'https://api.fonnte.com/send')+' • Jeda: '+(d.delayMs||2500)+' ms') : 'Isi FONNTE_TOKEN di Script Properties Apps Script.';
    const a=auto||{};
    document.getElementById('waDay').value=a.day||1;
    document.getElementById('waAuto').checked=!!a.enabled;
  }catch(e){showError(e)}
}

async function sendAllWhatsApp(){
  const periode=document.getElementById('waPeriod').value||currentMonth();
  if(!confirm('Kirim semua tagihan Belum Lunas periode '+periode+' melalui WhatsApp?\n\nPastikan nomor pelanggan sudah benar.')) return;
  const result=document.getElementById('waResult');
  result.textContent='Sedang mengirim. Jangan tutup halaman...';
  try{
    const r=await api('whatsapp_send_all',{periode,status:'Belum Lunas',limit:100});
    result.innerHTML='<b>'+esc(r.message||'Selesai')+'</b>';
    toast(r.message||'Pengiriman selesai');
  }catch(e){result.textContent='Gagal: '+e.message;showError(e)}
}

async function saveWhatsAppAuto(){
  const enabled=document.getElementById('waAuto').checked;
  const day=Number(document.getElementById('waDay').value||1);
  try{
    const r=await api('set_whatsapp_auto',{enabled,day});
    toast(r.message||'Jadwal tersimpan');
    await loadWhatsApp();
  }catch(e){showError(e)}
}
