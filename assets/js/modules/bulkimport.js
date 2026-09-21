// bulk-import.js — CSV bulk import of households/residents, including
// the drag-and-drop file picker.

function handleFile(inp) {
  if(inp.files.length){qs('#selFileName').textContent=inp.files[0].name;qs('#selFile').style.display='flex';qs('#fileDrop').style.display='none';}
}
function clearFile(){qs('#csvFile').value='';qs('#selFile').style.display='none';qs('#fileDrop').style.display='block';}

function doBulkImport() {
  const fi=qs('#csvFile'),re=qs('#importResult'),btn=qs('#importBtn');
  if(!fi.files.length){alert('Select a CSV file first.');return;}
  const fd=new FormData();fd.append('csv_file',fi.files[0]);
  btn.disabled=true;btn.textContent='Importing...';re.style.display='none';
  fetch(`${API}?action=bulk_import`,{method:'POST',body:fd}).then(r=>r.json()).then(r=>{
    btn.disabled=false;btn.textContent='Import Data';
    re.className='import-result '+(r.error?'error':'success');
    re.textContent=r.error?'❌ '+r.error:'✅ '+r.message;
    re.style.display='block';
    if(!r.error){loadMapData();loadStats();loadStreetSidebar();}
  }).catch(()=>{btn.disabled=false;btn.textContent='Import Data';re.className='import-result error';re.textContent='❌ Network error.';re.style.display='block';});
}

// Drag & drop CSV
document.addEventListener('DOMContentLoaded',()=>{
  const fd=qs('#fileDrop');
  if(fd){
    fd.addEventListener('dragover',e=>{e.preventDefault();fd.style.borderColor='#2563eb';});
    fd.addEventListener('dragleave',()=>{fd.style.borderColor='';});
    fd.addEventListener('drop',e=>{e.preventDefault();fd.style.borderColor='';if(e.dataTransfer.files.length){qs('#csvFile').files=e.dataTransfer.files;handleFile(qs('#csvFile'));}});
  }
});

