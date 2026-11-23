/* Requested interface access only; this does not replace backend authorization. */
(() => {
  'use strict';
  const SESSION='gourmandise.interface-role.v1';
  const config=window.ERP_CONFIG.management;
  const status=document.getElementById('previewStatus');
  let busy=false;
  function remember(role){try{if(role)sessionStorage.setItem(SESSION,role);else sessionStorage.removeItem(SESSION);}catch{}}
  function open(role){
    remember(role);activeRole=role;tab=role==='employee'?'Move':'Products';loginMessage='';render();
    document.getElementById('v').inert=true;document.getElementById('nav').inert=true;document.getElementById('user').disabled=true;
    status.textContent='Loading shared bakery records…';
    const script=document.createElement('script');script.src='preview.js';
    script.onerror=()=>{status.textContent='The shared connection could not load. Refresh and try again.';};
    document.body.append(script);
  }
  async function signIn(){
    if(busy)return;busy=true;
    const username=document.getElementById('loginEmail').value.trim(),input=document.getElementById('loginPassword'),password=input.value;input.value='';
    window.ERPAccess.usernameDraft=username;
    const button=document.getElementById('managementSignIn');button.disabled=true;
    try{
      const salt=Uint8Array.from(config.salt.match(/../g),part=>parseInt(part,16));
      const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
      const bytes=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:config.iterations,hash:'SHA-256'},key,256);
      const hash=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
      let difference=hash.length^config.passwordHash.length;
      for(let i=0;i<hash.length;i++)difference|=hash.charCodeAt(i)^(config.passwordHash.charCodeAt(i)||0);
      if(username.toLowerCase()!==config.username.toLowerCase()||difference!==0)throw Error('Username or password is incorrect.');
      open('management');
    }catch(error){loginMessage='<span class="bad">'+esc(error.message)+'</span>';render();}
    finally{busy=false;}
  }
  function employee(){if(!busy)open('employee');}
  function signOut(){
    if(window.ERPPreview?.canSignOut&&!window.ERPPreview.canSignOut()){
      alert('Wait for changes to finish saving. If a save failed, download your unsaved copy and reload before signing out.');return;
    }
    remember(null);location.reload();
  }
  window.ERPAccess={signIn,employee,signOut,usernameDraft:''};
  let role='';try{role=sessionStorage.getItem(SESSION)||'';}catch{}
  if(['management','employee'].includes(role))open(role);else status.textContent='Choose management sign-in or continue as an employee.';
})();
