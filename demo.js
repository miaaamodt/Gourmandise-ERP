/* Presentation gate only. These public demo credentials do not secure Supabase. */
(() => {
  'use strict';
  const SESSION='gourmandise.presentation-login.v1';
  const EMAIL='demo@gourmandise.test',PASSWORD='bakery-demo';
  const note='Demo login only. Shared testing data remains publicly accessible.';
  const status=document.getElementById('previewStatus');
  function remember(value){try{if(value)sessionStorage.setItem(SESSION,'signed-in');else sessionStorage.removeItem(SESSION);}catch{}}
  function openDemo(){
    activeRole='management';loginMessage='';render();
    document.getElementById('v').inert=true;
    document.getElementById('nav').inert=true;
    document.getElementById('user').disabled=true;
    status.textContent='Opening shared testing data… '+note;
    const script=document.createElement('script');script.src='preview.js';
    script.onerror=()=>{status.textContent='Shared testing could not load. Refresh and try again. '+note;};
    document.body.append(script);
  }
  function signIn(){
    const email=document.getElementById('loginEmail').value.trim().toLowerCase();
    const passwordInput=document.getElementById('loginPassword'),password=passwordInput.value;
    passwordInput.value='';
    if(email!==EMAIL||password!==PASSWORD){
      loginMessage='<span class="bad">Use the demonstration email and password supplied for this preview.</span>';
      render();status.textContent=note;return;
    }
    remember(true);openDemo();
  }
  function signOut(){
    if(window.ERPPreview?.canSignOut&&!window.ERPPreview.canSignOut()){
      alert('Wait for changes to finish saving. If a save failed, download your unsaved copy and reload before signing out.');return;
    }
    remember(false);location.reload();
  }
  window.ERPDemo={signIn,signOut};
  let remembered=false;try{remembered=sessionStorage.getItem(SESSION)==='signed-in';}catch{}
  if(remembered)openDemo();else status.textContent=note;
})();
