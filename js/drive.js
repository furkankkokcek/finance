// Google Drive backup (Capacitor).
//
// Sign in with Google and store/restore the app's JSON backup in a private
// app-data folder (drive.appdata scope — backups are NOT visible in the user's
// normal Drive, only to this app). Auth via @codetrix-studio/capacitor-google-auth;
// Drive access via the REST API with fetch.
//
// Native-only; no-op on web/PWA and until the Google OAuth client is configured
// (see DRIVE-SETUP.md). All entry points fail gracefully with a user message.

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

function getGoogleAuth(){ return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.GoogleAuth) || null; }
function driveIsNative(){
  return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform==='function'
    && window.Capacitor.isNativePlatform());
}
function driveAvailable(){
  return !!(driveIsNative() && getGoogleAuth());
}
// Distinct message per failure: web (PWA) vs native build missing the GoogleAuth
// plugin (needs npm install + npx cap sync + rebuild). Returns true if unavailable.
function driveUnavailableMsg(){
  if(!driveIsNative()){ alert(t('drive.notAvailable')); return true; }
  if(!getGoogleAuth()){ alert(t('drive.pluginMissing')); return true; }
  return false;
}

let _googleAuthInited=false;
async function initGoogleAuth(){
  const GA=getGoogleAuth();
  if(!GA || _googleAuthInited) return;
  try{ await GA.initialize({ scopes:[DRIVE_SCOPE], grantOfflineAccess:false }); _googleAuthInited=true; }catch(e){}
}

// Returns an OAuth access token with the drive.appdata scope, or null. On a
// successful sign-in the account email is cached so the settings UI can show the
// connection status without prompting again.
async function driveAccessToken(){
  const GA=getGoogleAuth();
  if(!GA) return null;
  await initGoogleAuth();
  try{
    const user=await GA.signIn();
    if(user && user.email) localStorage.setItem('ft_driveEmail', user.email);
    return (user && user.authentication && user.authentication.accessToken) || null;
  }catch(e){ return null; }
}

// --- Connection status (shown in Settings; no ads here) ---

function driveConnectedEmail(){ return localStorage.getItem('ft_driveEmail') || ''; }

// Explicitly connect (sign in) from the settings button.
async function driveConnect(){
  if(driveUnavailableMsg()) return;
  const token=await driveAccessToken();
  if(!token){ alert(t('drive.signInFailed')); return; }
  renderDriveStatus();
}

// Disconnect (sign out) and forget the cached account.
async function driveDisconnect(){
  const GA=getGoogleAuth();
  try{ if(GA) await GA.signOut(); }catch(e){}
  localStorage.removeItem('ft_driveEmail');
  _googleAuthInited=false;
  renderDriveStatus();
}

function driveToggleConnect(){
  if(driveConnectedEmail()) driveDisconnect();
  else driveConnect();
}

// Reflect the current Drive connection state into the settings UI.
function renderDriveStatus(){
  const el=document.getElementById('drive-status');
  const btn=document.getElementById('drive-connect-btn');
  if(!el) return;
  if(!driveIsNative()){
    el.textContent=t('drive.notAvailable');
    el.style.color='var(--muted)';
    if(btn) btn.style.display='none';
    return;
  }
  const email=driveConnectedEmail();
  if(email){
    el.textContent='✓ '+t('drive.connectedAs',{email});
    el.style.color='var(--green, #2ecc71)';
    if(btn){ btn.style.display=''; btn.textContent=t('drive.disconnect'); }
  }else{
    el.textContent=t('drive.notConnected');
    el.style.color='var(--muted)';
    if(btn){ btn.style.display=''; btn.textContent=t('drive.connect'); }
  }
}

// Upload the current state as a timestamped JSON into the app-data folder.
async function driveBackup(){
  if(driveUnavailableMsg()) return;
  const token=await driveAccessToken();
  if(!token){ alert(t('drive.signInFailed')); return; }
  const now=new Date();
  const pad=n=>String(n).padStart(2,'0');
  const name=`fintrack_${todayStr()}_${pad(now.getHours())}-${pad(now.getMinutes())}.json`;
  const meta={ name, parents:['appDataFolder'] };
  const boundary='ftboundary';
  const body=
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`+JSON.stringify(meta)+
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`+JSON.stringify(S)+
    `\r\n--${boundary}--`;
  try{
    const res=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',{
      method:'POST',
      headers:{ 'Authorization':'Bearer '+token, 'Content-Type':`multipart/related; boundary=${boundary}` },
      body
    });
    if(!res.ok) throw new Error(await res.text());
    S.settings.changeCount=0; saveS();
    alert(t('drive.backupOk'));
  }catch(e){ alert(t('drive.backupFail')); }
}

// Restore the most recent backup from the app-data folder.
async function driveRestore(){
  if(driveUnavailableMsg()) return;
  const token=await driveAccessToken();
  if(!token){ alert(t('drive.signInFailed')); return; }
  try{
    const listRes=await fetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&orderBy=modifiedTime%20desc&pageSize=10&fields=files(id,name,modifiedTime)',{
      headers:{ 'Authorization':'Bearer '+token }
    });
    const data=await listRes.json();
    const files=(data && data.files)||[];
    if(!files.length){ alert(t('drive.noBackups')); return; }
    const latest=files[0];
    if(!confirm(t('drive.restoreConfirm',{name:latest.name}))) return;
    const dlRes=await fetch('https://www.googleapis.com/drive/v3/files/'+latest.id+'?alt=media',{
      headers:{ 'Authorization':'Bearer '+token }
    });
    const json=await dlRes.json();
    if(!json || !json.settings){ alert(t('settings.invalidFile')); return; }
    S=json;
    if(!S.cards||!S.settings.customHolidays) migrateToV4(S);
    saveS();
    applyTheme(S.settings.theme||'dark');
    closeModal('overlay-settings');
    document.getElementById('year-btn').textContent=S.settings.currentYear;
    applyLocale();
    renderPage(currentPage);
    alert(t('drive.restoreOk'));
  }catch(e){ alert(t('drive.restoreFail')); }
}
