(() => {
  const endpoint = new URL('../Api/profile.php', document.currentScript.src).href;
  let root = null;
  let profile = {};
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const initials = value => String(value || '').trim().split(/\s+/).slice(0,2).map(word=>word[0]||'').join('').toUpperCase() || '--';
  async function request(method='GET', body=null) {
    const response=await fetch(endpoint,{method,credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const data=await response.json(); if(!response.ok)throw new Error(data.error||'Could not update profile.'); return data;
  }
  function paint() {
    const name=profile.FullName||profile.Username||'User';
    root?.querySelectorAll('[data-profile-name]').forEach(el=>el.textContent=name);
    root?.querySelectorAll('[data-profile-role]').forEach(el=>el.textContent=profile.Role||'Team member');
    root?.querySelectorAll('[data-profile-email]').forEach(el=>el.textContent=profile.Email||'Not added');
    root?.querySelectorAll('[data-profile-phone]').forEach(el=>el.textContent=profile.Phone||'Not added');
    root?.querySelectorAll('[data-profile-avatar]').forEach(el=>el.textContent=initials(name));
    document.querySelectorAll('.profile-chip .pname,.profile-chip .who .n,#meName').forEach(el=>el.textContent=name);
    window.dispatchEvent(new CustomEvent('uo:profile-updated',{detail:profile}));
  }
  function modal(title, fields, save) {
    document.querySelector('.profile-dialog-backdrop')?.remove();
    const overlay=document.createElement('div'); overlay.className='profile-dialog-backdrop';
    overlay.innerHTML=`<section class="profile-dialog" role="dialog" aria-modal="true"><header><div><h2>${esc(title)}</h2><p>United Optic account</p></div><button type="button" class="profile-dialog-close" aria-label="Close">×</button></header><form>${fields}<footer><button type="button" class="profile-btn profile-btn-muted" data-cancel>Cancel</button><button class="profile-btn" type="submit">Save changes</button></footer><p class="profile-message" aria-live="polite"></p></form></section>`;
    document.body.append(overlay);
    const close=()=>overlay.remove(); overlay.querySelector('.profile-dialog-close').onclick=close; overlay.querySelector('[data-cancel]').onclick=close; overlay.onclick=e=>{if(e.target===overlay)close();};
    overlay.querySelector('form').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{await save(new FormData(e.currentTarget));close();}catch(error){overlay.querySelector('.profile-message').textContent=error.message;button.disabled=false;}};
  }
  function editProfile() {
    modal('Edit Profile',`<label>Full name<input name="name" required maxlength="150" value="${esc(profile.FullName)}"></label><label>Email<input name="email" type="email" maxlength="150" value="${esc(profile.Email)}"></label><label>Phone<input name="phone" maxlength="30" value="${esc(profile.Phone)}"></label>`,async data=>{const result=await request('PUT',{name:data.get('name'),email:data.get('email'),phone:data.get('phone')});profile=result.profile||profile;paint();});
  }
  function changePassword() {
    modal('Change Password','<label>Current password<input name="current" type="password" required autocomplete="current-password"></label><label>New password<input name="new" type="password" minlength="8" required autocomplete="new-password"></label><label>Confirm new password<input name="confirm" type="password" minlength="8" required autocomplete="new-password"></label>',async data=>{if(data.get('new')!==data.get('confirm'))throw new Error('New passwords do not match.');await request('PUT',{action:'password',current:data.get('current'),new:data.get('new')});});
  }
  function initialize() {
    root=document.querySelector('[data-profile-root]');
    if(!root||root.dataset.profileInitialized)return;
    root.dataset.profileInitialized='true';
    root.querySelector('[data-profile-edit]')?.addEventListener('click',editProfile);
    root.querySelector('[data-profile-password]')?.addEventListener('click',changePassword);
    request().then(data=>{profile=data.profile||{};paint();}).catch(error=>{const message=root.querySelector('[data-profile-error]');if(message)message.textContent=error.message;});
  }
  initialize();
  new MutationObserver(initialize).observe(document.body,{childList:true,subtree:true});
})();
