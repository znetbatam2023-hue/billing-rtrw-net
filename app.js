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
  return String(v ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
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
    if(page==='whatsapp') await loadWhatsapp();
  }catch(e){showError(e)}
}

async function loadDashboard(){
  const r=await api('dashboard');
  const d=r.data||{};
  document.getElementById('kTotal').textContent=d.total_pelanggan||0;
  document.getElementById('kActive').textContent=d.aktif||0;
  document.getElementById('kUnpaid').textContent=d.belum_lunas||0;
  document.getElementById('kBillTotal').textContent=rupiah(d.total_tagihan);
  document.getElementById('kRevenue').textContent=rupiah(d.pendapatan);
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
  document.getElementById('customerRows').innerHTML=state.customers.map((c, idx)=>{
    const p=paketMap[String(c.paket_id||'')];
    const paketLabel=p ? `${p.nama || ''}${p.kecepatan ? ' - ' + p.kecepatan : ''}`.trim() : (c.paket_id||'-');
    const hargaPaket=p ? p.harga : c.harga;
    return `
    <tr>
      <td><b>${idx + 1}</b></td>
      <td><b>${esc(c.nama)}</b><br><small>${esc(c.alamat||'')}</small></td>
      <td>${esc(c.username)}</td>
      <td>${esc(c.no_hp)}</td>
      <td>${esc(paketLabel)}</td>
      <td><b>${rupiah(hargaPaket)}</b></td>
      <td><span class="badge ${String(c.status).toLowerCase()==='aktif'?'paid':String(c.status).toLowerCase()==='nonaktif'?'inactive':'unpaid'}">${esc(c.status)}</span></td>
      <td>
        <button class="btn btn-secondary" onclick='openCustomer(${JSON.stringify(c).replace(/'/g,"&#39;")})'>Edit</button>
        <button class="btn btn-danger" onclick='deleteCustomer(${JSON.stringify(c.id).replace(/'/g,"&#39;")}, ${JSON.stringify(c.nama).replace(/'/g,"&#39;")})'>Hapus</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="8">Belum ada pelanggan.</td></tr>';
}
async function loadPackages(){
  const r=await api('packages'); state.packages=r.data||[];
  document.getElementById('packageRows').innerHTML=state.packages.map(p=>`
    <tr><td><b>${esc(p.nama)}</b></td><td>${esc(p.kecepatan)}</td><td>${rupiah(p.harga)}</td><td>${esc(p.status)}</td>
    <td><button class="btn btn-secondary" onclick='openPackage(${JSON.stringify(p).replace(/'/g,"&#39;")})'>Edit</button></td></tr>`).join('') || '<tr><td colspan="5">Belum ada paket.</td></tr>';
}
function normalizePeriodClient(v){
  const s=String(v??'').trim();
  const m=s.match(/^(\d{4})-(\d{1,2})/);
  return m ? m[1]+'-'+String(m[2]).padStart(2,'0') : s;
}

async function loadInvoices(){
  const periode=normalizePeriodClient(document.getElementById('invoicePeriod').value||currentMonth());
  const status=document.getElementById('invoiceStatus').value;
  const tbody=document.getElementById('invoiceRows');
  tbody.innerHTML='<tr><td colspan="6">Memuat data tagihan...</td></tr>';
  // Kirim periode ke backend DAN filter ulang di browser. Dengan begitu versi backend lama
  // maupun backend baru tetap bisa menampilkan data yang sama.
  const r=await api('invoices',{periode:periode});
  let rows=Array.isArray(r.data)?r.data:(Array.isArray(r.invoices)?r.invoices:[]);
  rows=rows.filter(i=>normalizePeriodClient(i.periode)===periode);
  if(status) rows=rows.filter(i=>String(i.status||'').trim().toLowerCase()===String(status).trim().toLowerCase());
  state.invoices=rows;
  if(!rows.length){
    let extra='';
    try{
      const d=await api('invoice_debug');
      if(d && d.data) extra=`<br><small style="color:#666">Data di Sheet: ${Number(d.data.total||0)} baris. Periode terbaca: ${esc(d.data.periods||'-')}.</small>`;
    }catch(_e){}
    tbody.innerHTML='<tr><td colspan="6">Belum ada tagihan untuk periode '+esc(periode)+'.'+extra+'</td></tr>';
    return;
  }
  tbody.innerHTML=state.invoices.map(i=>`
    <tr><td><b>${esc(i.nama||i.pelanggan||'')}</b><br><small>${esc(i.no_hp||'')}</small></td><td>${esc(normalizePeriodClient(i.periode))}</td>
    <td><b>${rupiah(i.nominal)}</b></td><td>${esc(i.jatuh_tempo||'-')}</td>
    <td><span class="badge ${String(i.status).toLowerCase()==='lunas'?'paid':String(i.status).toLowerCase()==='digabung'?'inactive':'unpaid'}">${esc(i.status||'-')}</span></td>
    <td>${String(i.status).toLowerCase()==='belum lunas'?`<button class="btn btn-primary" onclick='payInvoice(${JSON.stringify(i).replace(/'/g,"&#39;")})'>Bayar</button>`:'-'}</td></tr>`).join('');
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

async function loadWhatsapp(){
  const period=document.getElementById('waPeriod');
  if(period && !period.value) period.value=currentMonth();
  try{
    const [cfg,auto]=await Promise.all([
      api('whatsapp_config'),
      api('get_whatsapp_auto')
    ]);
    const c=cfg.data||{};
    document.getElementById('waConfigured').textContent=c.configured?'AKTIF / TERHUBUNG':'BELUM DIATUR';
    document.getElementById('waConfigured').className=c.configured?'wa-ok':'wa-off';
    document.getElementById('waConfigInfo').textContent=c.configured
      ? `Phone Number ID: ${c.phoneNumberId || '-'} • Template: ${c.templateName || '-'} • API: ${c.apiVersion || '-'}`
      : 'Isi Access Token dan Phone Number ID pada pengaturan di bawah.';
    document.getElementById('waPhoneNumberId').value=c.phoneNumberId||'';
    document.getElementById('waApiVersion').value=c.apiVersion||'v24.0';
    document.getElementById('waTemplateName').value=c.templateName||'tagihan_internet';
    document.getElementById('waTemplatePreview').value=c.templateName||'tagihan_internet';
    document.getElementById('waTemplateLanguage').value=c.templateLanguage||'id';
    document.getElementById('waDelayMs').value=c.delayMs ?? 1500;
    const a=auto||{};
    document.getElementById('waAutoEnabled').checked=!!a.enabled;
    document.getElementById('waAutoDay').value=String(a.day||1);
  }catch(e){showError(e)}
}

async function saveWhatsappConfig(){
  try{
    const body={
      phoneNumberId:document.getElementById('waPhoneNumberId').value.trim(),
      apiVersion:document.getElementById('waApiVersion').value.trim() || 'v24.0',
      templateName:document.getElementById('waTemplateName').value.trim() || 'tagihan_internet',
      templateLanguage:document.getElementById('waTemplateLanguage').value.trim() || 'id',
      delayMs:document.getElementById('waDelayMs').value || 1500
    };
    const token=document.getElementById('waAccessToken').value.trim();
    if(token) body.accessToken=token;
    const r=await api('save_whatsapp_config',body);
    document.getElementById('waAccessToken').value='';
    toast(r.message||'Pengaturan WhatsApp tersimpan');
    await loadWhatsapp();
  }catch(e){showError(e)}
}

async function sendWhatsappAll(){
  const periode=document.getElementById('waPeriod').value||currentMonth();
  const status=document.getElementById('waStatus').value||'Belum Lunas';
  const limit=Number(document.getElementById('waLimit').value||100);
  if(status==='Belum Lunas' && !confirm(`Kirim tagihan WhatsApp untuk periode ${periode} kepada pelanggan yang belum bayar?\n\nMaksimal ${limit} pelanggan. Pelanggan yang sudah pernah terkirim untuk invoice yang sama tidak akan dikirim ulang.`)) return;
  try{
    document.getElementById('waResult').textContent='Sedang mengirim... Mohon jangan menutup halaman.';
    const r=await api('whatsapp_send_all',{periode,status,limit});
    const sent=(r.sent||[]).length;
    const failed=(r.failed||[]).length;
    let detail=`${r.message||'Selesai.'}\n\nTerkirim: ${sent}\nGagal: ${failed}`;
    if(failed){
      detail+='\n\nDetail gagal:\n'+r.failed.slice(0,10).map(x=>`• ${x.nama||'-'}: ${x.error||'Gagal'}`).join('\n');
      if(r.failed.length>10) detail+='\n• ...';
    }
    document.getElementById('waResult').textContent=detail;
    toast(r.message||'Pengiriman selesai');
  }catch(e){
    document.getElementById('waResult').textContent='Gagal mengirim: '+e.message;
    showError(e);
  }
}

async function saveWhatsappAuto(){
  try{
    const enabled=document.getElementById('waAutoEnabled').checked;
    const day=Number(document.getElementById('waAutoDay').value||1);
    if(enabled && !confirm(`Aktifkan pengiriman WhatsApp otomatis setiap tanggal ${day} sekitar pukul 08.00?`)) return;
    const r=await api('set_whatsapp_auto',{enabled,day});
    toast(r.message||'Jadwal otomatis tersimpan');
    await loadWhatsapp();
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
async function deleteCustomer(id,nama){
  if(!id) return;
  if(!confirm(`Hapus pelanggan "${nama}"?\n\nData tagihan dan pembayaran yang sudah ada tidak akan dihapus.`)) return;
  try{
    const r=await api('customer_delete',{id});
    toast(r.message||'Pelanggan dihapus');
    await loadCustomers();
    await loadDashboard();
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
  const amount=Number(i.nominal)||0;
  document.getElementById('modalBody').innerHTML=`
    <div style="background:#f5f5f5;border:1px solid #ddd;border-radius:12px;padding:14px;margin-bottom:14px">
      <div style="font-size:18px;font-weight:800">${esc(i.nama||'-')}</div>
      <div class="muted">Periode ${esc(normalizePeriodClient(i.periode))} · Jatuh tempo ${esc(i.jatuh_tempo||'-')}</div>
      <div style="font-size:25px;font-weight:900;margin-top:7px">${rupiah(amount)}</div>
    </div>
    <div class="field"><label>Nominal Bayar</label><input id="payNominal" type="number" min="1" value="${amount}"></div>
    <div class="field"><label>Metode Pembayaran</label><select id="payMetode"><option value="Cash">Cash</option><option value="Transfer">Transfer</option></select></div>
    <div class="field"><label>Tanggal Bayar</label><input id="payTanggal" type="date" value="${todayClient()}"></div>
    <div class="field"><label>Catatan</label><input id="payCatatan" placeholder="Opsional"></div>
    <button class="btn btn-primary full" onclick='savePayment(${JSON.stringify(i).replace(/'/g,"&#39;")})'>✓ Simpan Pembayaran</button>`;
  document.getElementById('modal').classList.add('show');
}
function todayClient(){
  const d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
async function savePayment(i){
  const nominal=Number(document.getElementById('payNominal').value||0);
  const total=Number(i.nominal||0);
  if(nominal<=0){showError(new Error('Nominal pembayaran harus lebih dari 0.'));return}
  if(nominal<total){showError(new Error('Nominal pembayaran harus sama dengan atau lebih besar dari total tagihan.'));return}
  try{
    const r=await api('pay',{tagihan_id:i.id,pelanggan_id:i.pelanggan_id,nominal:nominal,metode:document.getElementById('payMetode').value,tanggal_bayar:document.getElementById('payTanggal').value,catatan:document.getElementById('payCatatan').value});
    toast(r.message||'Pembayaran berhasil');
    closeModal();
    await Promise.all([loadInvoices(),loadDashboard(),loadReport()]);
  }catch(e){showError(e)}
}
function closeModal(){document.getElementById('modal').classList.remove('show')}
boot();
