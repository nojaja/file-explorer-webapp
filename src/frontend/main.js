// ...ファイル一覧取得・描画・操作UIの雛形...
const fileTable = document.getElementById('file-table');
const fileList = document.getElementById('file-list');
const errorDiv = document.getElementById('error');
const logoutBtn = document.getElementById('logout-btn');
const authArea = document.getElementById('auth-area');
let loginStatusSpan;
let currentPath = '';
let userPermissions = null; // ユーザー権限情報を保存

async function fetchFiles(path = '') {
  try {
    const res = await fetch(path ? `/api/list?path=${encodeURIComponent(path)}` : '/api/list');
    if (!res.ok) throw new Error('ファイル一覧取得に失敗しました');
    const data = await res.json();
    currentPath = path;
    renderFiles(data.files || []);
    renderBreadcrumb(path ? path.split('/').filter(Boolean) : []); // ルート
    renderParentButton();
    fileTable.style.display = '';
    errorDiv.style.display = 'none';
  } catch (e) {
    errorDiv.textContent = e.message;
    errorDiv.style.display = '';
    fileTable.style.display = 'none';
  }
}

function renderFiles(files) {
  fileList.innerHTML = '';
  files.forEach(f => {
    const tr = document.createElement('tr');
    const isDir = f.type === 'dir';
    
    // 削除ボタンの表示制御
    const canDelete = userPermissions?.canDelete ?? true;
    const deleteButton = canDelete 
      ? `<button class="icon-btn" title="削除" onclick="deleteFile('${f.path}')"><span class="material-icons">delete</span></button>`
      : '';
    
    tr.innerHTML = `
      <td>${
        isDir ? '<span class="material-icons" style="vertical-align:middle;color:#ffa000;">folder</span> '
              : '<span class="material-icons" style="vertical-align:middle;color:#1976d2;">insert_drive_file</span> '
      }
        ${
          isDir ? `<span style='cursor:pointer;color:#1976d2;text-decoration:underline;' onclick='changeDir("${f.path}")'>${f.name}</span>`
                : f.name
        }
      </td>
      <td>${isDir ? 'フォルダ' : 'ファイル'}</td>
      <td>${f.size ?? ''}</td>
      <td>${f.mtime ?? ''}</td>
      <td class="actions">
        ${
          isDir 
          ? `<a class="icon-btn" title="zipダウンロード" href="/api/download/folder?path=${encodeURIComponent(f.path)}" download><span class="material-icons">archive</span></a>` 
          : `<a class="download-link icon-btn" title="ダウンロード" href="/api/download/file?path=${encodeURIComponent(f.path)}" download><span class="material-icons">download</span></a>`
        }
        ${deleteButton}
      </td>
    `;
    fileList.appendChild(tr);
  });
}

function renderBreadcrumb(pathArr) {
  const bc = document.getElementById('breadcrumb');
  if (!bc) return;
  bc.innerHTML = '';
  let path = '';
  pathArr.forEach((p, i) => {
    path += (i > 0 ? '/' : '') + p;
    const jumppath = String(path);
    const span = document.createElement('span');
    span.textContent = p || 'root';
    span.className = 'breadcrumb-item';
    span.onclick = () => changeDir(jumppath);
    bc.appendChild(span);
    if (i < pathArr.length - 1) bc.appendChild(document.createTextNode(' / '));
  });
}

// ディレクトリ遷移
window.changeDir = async function(path) {
  try {
    const res = await fetch(`/api/list?path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error('ディレクトリ取得に失敗しました');
    const data = await res.json();
    currentPath = path;
    renderFiles(data.files || []);
    renderBreadcrumb(path.split('/').filter(Boolean));
    renderParentButton();
    fileTable.style.display = '';
    errorDiv.style.display = 'none';
  } catch (e) {
    errorDiv.textContent = e.message;
    errorDiv.style.display = '';
    fileTable.style.display = 'none';
  }
};

window.deleteFile = async function(path) {
  // 削除権限チェック
  if (userPermissions && !userPermissions.canDelete) {
    alert('削除権限がありません。');
    return;
  }
  
  if (!confirm(`${path} を削除しますか？`)) return;
  const res = await fetch(`/api/delete/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
  if (res.ok) fetchFiles();
  else {
    const err = await res.json();
    errorDiv.textContent = err.error || '削除に失敗しました';
    errorDiv.style.display = '';
  }
};

window.logout = async function() {
  await fetch('/auth/logout');
  location.reload();
};

async function updateLoginStatus() {
  try {
    const res = await fetch('/auth/status');
    const data = await res.json();
    
    // 権限情報をグローバル変数に保存
    userPermissions = data.permissions || null;
    
    // 認証設定を取得
    const authConfig = data.authConfig || {
      github: false,
      gitlab: false,
      hydra: false,
      noAuthRequired: false
    };
    
    // ユーザー情報表示領域を更新
    if (!loginStatusSpan) {
      loginStatusSpan = document.createElement('div');
      loginStatusSpan.id = 'login-status';
      loginStatusSpan.style.marginLeft = '1em';
      loginStatusSpan.style.fontWeight = 'bold';
      loginStatusSpan.style.display = 'flex';
      loginStatusSpan.style.alignItems = 'center';
      loginStatusSpan.style.marginTop = '0.5em';
      loginStatusSpan.style.marginBottom = '0.5em';
      authArea.appendChild(loginStatusSpan);
    }
    
    const oldRefreshBtn = document.getElementById('refresh-list-btn');
    if (oldRefreshBtn) oldRefreshBtn.remove();
    
    // 認証なしモードの場合
    if (authConfig.noAuthRequired) {
      // ログインボタンを全て非表示
      document.querySelectorAll('.login-btn.github, .login-btn.gitlab, .login-btn.hydra, #logout-btn').forEach(btn => btn.style.display = 'none');
      
      // ステータス表示
      loginStatusSpan.innerHTML = `
        <span style="display:flex; align-items:center;">
          認証なしモード
        </span>
      `;
      
      // ファイル一覧の更新ボタンと一覧表示
      const container = document.querySelector('.container');
      const breadcrumb = document.getElementById('breadcrumb');
      const refreshBtn = document.createElement('button');
      refreshBtn.id = 'refresh-list-btn';
      refreshBtn.className = 'refresh-btn';
      refreshBtn.innerHTML = '<span class="material-icons">refresh</span>ファイル一覧を更新する';
      refreshBtn.addEventListener('click', () => fetchFiles(currentPath));
      
      if (breadcrumb && breadcrumb.nextSibling) {
        container.insertBefore(refreshBtn, breadcrumb.nextSibling);
      } else {
        container.appendChild(refreshBtn);
      }
      
      fileTable.style.display = '';
      fetchFiles(currentPath);
      return;
    }
    
    if (data.authenticated) {
      // プロバイダーバッジを追加
      const providerName = data.provider || 'unknown';
      const providerLabel = {
        'github': 'GitHub',
        'gitlab': 'GitLab',
        'hydra': 'Hydra',
        'none': '認証なし',
        'unknown': 'OAuth'
      }[providerName] || 'OAuth';
      
      let avatarHtml = '';
      // GitLab固有のアバター表示
      if (data.avatar) {
        avatarHtml = `<img src="${data.avatar}" alt="User Avatar" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 8px;">`;
      }
      
      // プロバイダーに合わせたバッジスタイル
      const badgeColor = {
        'github': '#333',
        'gitlab': '#fc6d26',
        'hydra': '#009688',
        'none': '#4caf50',
        'unknown': '#757575'
      }[providerName] || '#757575';
        loginStatusSpan.innerHTML = `
        ${avatarHtml}
        <span style="display:flex; align-items:center;">
          ログイン中: ${data.name || ''}
          <span style="background-color: ${badgeColor}; color: white; font-size: 0.7em; padding: 2px 6px; border-radius: 10px; margin-left: 8px;">
            ${providerLabel}
          </span>
          ${userPermissions ? `<span style="background-color: #4caf50; color: white; font-size: 0.7em; padding: 2px 6px; border-radius: 10px; margin-left: 8px;" title="権限レベル: ${userPermissions.description || '不明'}">${userPermissions.level || 'unknown'}</span>` : ''}
        </span>
      `;
      
      // ログインボタンの表示/非表示
      document.querySelectorAll('.login-btn.github, .login-btn.gitlab, .login-btn.hydra').forEach(btn => btn.style.display = 'none');
      if (providerName !== 'none') {
        logoutBtn.style.display = '';
      } else {
        logoutBtn.style.display = 'none';
      }
      
      const container = document.querySelector('.container');
      const breadcrumb = document.getElementById('breadcrumb');
      const refreshBtn = document.createElement('button');
      refreshBtn.id = 'refresh-list-btn';
      refreshBtn.className = 'refresh-btn';
      refreshBtn.innerHTML = '<span class="material-icons">refresh</span>ファイル一覧を更新する';
      refreshBtn.addEventListener('click', () => fetchFiles(currentPath));
      
      if (breadcrumb && breadcrumb.nextSibling) {
        container.insertBefore(refreshBtn, breadcrumb.nextSibling);
      } else {
        container.appendChild(refreshBtn);
      }
      
      fileTable.style.display = '';
      fetchFiles(currentPath);
    } else {
      loginStatusSpan.textContent = '未ログイン';
      
      // 設定された認証方法のみ表示
      document.querySelectorAll('.login-btn.github').forEach(btn => btn.style.display = authConfig.github ? '' : 'none');
      document.querySelectorAll('.login-btn.gitlab').forEach(btn => btn.style.display = authConfig.gitlab ? '' : 'none');
      document.querySelectorAll('.login-btn.hydra').forEach(btn => btn.style.display = authConfig.hydra ? '' : 'none');
      logoutBtn.style.display = 'none';
      
      const oldRefreshBtn2 = document.getElementById('refresh-list-btn');
      if (oldRefreshBtn2) oldRefreshBtn2.remove();
      
      fileTable.style.display = 'none';
    }
  } catch (e) {
    if (loginStatusSpan) loginStatusSpan.textContent = '認証状態取得失敗';
    console.error('認証状態取得エラー:', e);
  }
}

function renderParentButton() {
  let btn = document.getElementById('parent-dir-btn');
  if (btn) btn.remove();
  if (!currentPath || currentPath === '') return;
  const parts = currentPath.split('/').filter(Boolean);
  if (parts.length === 0) return;
  parts.pop();
  const parentPath = parts.join('/');
  btn = document.createElement('button');
  btn.id = 'parent-dir-btn';
  btn.className = 'refresh-btn';
  btn.innerHTML = '<span class="material-icons">arrow_upward</span>親フォルダに戻る';
  btn.onclick = () => changeDir(parentPath);
  const container = document.querySelector('.container');
  const breadcrumb = document.getElementById('breadcrumb');
  if (breadcrumb && breadcrumb.nextSibling) {
    container.insertBefore(btn, breadcrumb.nextSibling);
  } else {
    container.appendChild(btn);
  }
}

// ...existing code...
// fetchFiles, changeDir, updateLoginStatus から renderParentButton を呼ぶように
window.onload = () => {
  updateLoginStatus();
};
