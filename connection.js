(() => {
  const staff=window.ERP_CONFIG?.accessMode==='staff';
  if(staff)document.getElementById('previewStatus')?.remove();
  const script=document.createElement('script');
  script.src=staff?'cloud.js':window.ERP_CONFIG?.accessMode==='shared'?'access.js':window.ERP_CONFIG?.accessMode==='demo'?'demo.js':'preview.js';
  script.onerror=()=>{
    document.getElementById('v').textContent='The shared-storage connection could not load. Refresh before making changes.';
    document.getElementById('nav').inert=true;
  };
  document.body.append(script);
})();
