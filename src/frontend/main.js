// ...ファイル一覧取得・描画・操作UIの雛形...
const fileTable = document.getElementById('file-table');
const fileList = document.getElementById('file-list');
const errorDiv = document.getElementById('error');
const logoutBtn = document.getElementById('logout-btn');
let loginStatusSpan;
let currentPath = '';
let userPermissions = null; // ユーザー権限情報を保存
let rootPaths = []; // 利用可能なROOT_PATH一覧
let selectedRootPath = null; // 選択中のROOT_PATH
let authConfig = null; // 認証設定
//ファイルが更新されたか確認するためのタイムスタンプ
/**
 * ROOT_PATH一覧を取得
 */
async function fetchRootPaths() {
  try {
    const res = await fetch('/api/rootpaths', { credentials: 'include' });
    if (!res.ok) {
      if (res.status === 401) {
        console.log('[ROOT_PATH] 認証が必要です');
        return;
      }
      throw new Error('ROOT_PATH一覧取得に失敗しました');
    }
    const data = await res.json();
    rootPaths = data.rootPaths || [];
    
    // デフォルトROOT_PATHを設定
    if (rootPaths.length > 0 && !selectedRootPath) {
      const defaultRootPath = data.defaultRootPath || rootPaths[0];
      selectedRootPath = defaultRootPath;
    }
    
    console.log('[ROOT_PATH] 一覧取得完了:', rootPaths);
    renderRootPathList();
  } catch (e) {
    console.error('[ROOT_PATH] 取得エラー:', e);
    // ROOT_PATH取得エラーの場合は非表示にする
  }
}

/**
 * ROOT_PATHを選択
 */
async function selectRootPath(rootPathId) {
  try {
    const res = await fetch('/api/rootpaths/select', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ rootPathId }),
      credentials: 'include'
    });
    
    if (!res.ok) throw new Error('ROOT_PATH選択に失敗しました');
    
    const data = await res.json();
    selectedRootPath = data.selectedRootPath;
    
    console.log('[ROOT_PATH] 選択完了:', selectedRootPath);
    
    // ROOT_PATH一覧の表示を更新
    renderRootPathList();
    
    // ファイル一覧を再取得（ルートディレクトリから）
    currentPath = '';
    await fetchFiles('');
    
  } catch (e) {
    console.error('[ROOT_PATH] 選択エラー:', e);
    errorDiv.textContent = e.message;
    errorDiv.style.display = '';
  }
}

async function fetchFiles(path = '') {
  try {
    let url = '/api/list';
    const params = new URLSearchParams();
    
    if (path) {
      params.append('path', path);
    }
    
    // 選択中のROOT_PATHがある場合はパラメータに追加
    if (selectedRootPath && selectedRootPath.id) {
      params.append('rootPathId', selectedRootPath.id);
    }
    
    if (params.toString()) {
      url += '?' + params.toString();
    }
    
    console.log('[fetchFiles] リクエスト:', url);
    
    const res = await fetch(url, { credentials: 'include' });
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
    
    // ダウンロードURL生成（ROOT_PATHを考慮）
    const rootPathParam = selectedRootPath && selectedRootPath.id ? `&rootPathId=${selectedRootPath.id}` : '';
    const downloadFileUrl = `/api/download/file?path=${encodeURIComponent(f.path)}${rootPathParam}`;
    const downloadFolderUrl = `/api/download/folder?path=${encodeURIComponent(f.path)}${rootPathParam}`;
    
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
          ? `<a class="icon-btn" title="zipダウンロード" href="${downloadFolderUrl}" download><span class="material-icons">archive</span></a>` 
          : `<a class="download-link icon-btn" title="ダウンロード" href="${downloadFileUrl}" download><span class="material-icons">download</span></a>`
        }
        ${deleteButton}
      </td>
    `;
    fileList.appendChild(tr);
  });
  updateFileToolbar();
}

function renderBreadcrumb(pathArr) {
  const bc = document.getElementById('breadcrumb');
  if (!bc) return;
  bc.innerHTML = '';
  
  // ROOT_PATH名を最初に表示
  if (selectedRootPath) {
    const rootSpan = document.createElement('span');
    rootSpan.textContent = selectedRootPath.name || 'root';
    rootSpan.className = 'breadcrumb-item root-path';
    rootSpan.style.fontWeight = 'bold';
    rootSpan.style.color = '#009688';
    rootSpan.onclick = () => changeDir('');
    bc.appendChild(rootSpan);
    
    if (pathArr.length > 0) {
      bc.appendChild(document.createTextNode(' / '));
    }
  }
  
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

/**
 * ROOT_PATH一覧をレンダリング
 */
function renderRootPathList() {
  if (!rootPaths || rootPaths.length === 0) {
    // ROOT_PATHがない場合は非表示
    return;
  }
  
  // containerの取得漏れを修正
  const container = document.getElementById('root-path-list-container');
  if (!container) {
    renderRootPathTree();
    return;
  }
  container.style.display = 'block';
  container.innerHTML = `
    <div style="background: #f5f5f5; padding: 1rem; border-radius: 4px; border: 1px solid #ddd;">
      <h3 style="margin: 0 0 0.5rem 0; color: #333; font-size: 1rem;">
        <span class="material-icons" style="vertical-align: middle; margin-right: 0.3rem; color: #009688;">folder_special</span>
        ROOT_PATH選択
      </h3>
      <div id="root-path-list" style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
        ${rootPaths.map(rp => `
          <button 
            class="root-path-btn ${selectedRootPath && selectedRootPath.id === rp.id ? 'selected' : ''}"
            onclick="selectRootPath('${rp.id}')"
            title="${rp.description || rp.name}"
            style="
              padding: 0.4rem 0.8rem; 
              border: 1px solid ${selectedRootPath && selectedRootPath.id === rp.id ? '#009688' : '#ddd'}; 
              border-radius: 4px; 
              background: ${selectedRootPath && selectedRootPath.id === rp.id ? '#e0f2f1' : '#fff'}; 
              color: ${selectedRootPath && selectedRootPath.id === rp.id ? '#009688' : '#333'}; 
              cursor: pointer; 
              font-size: 0.9rem;
              font-weight: ${selectedRootPath && selectedRootPath.id === rp.id ? '600' : '400'};
              transition: all 0.2s;
            "
          >
            <span class="material-icons" style="vertical-align: middle; margin-right: 0.3rem; font-size: 1rem;">
              ${selectedRootPath && selectedRootPath.id === rp.id ? 'radio_button_checked' : 'radio_button_unchecked'}
            </span>
            ${rp.name}
            <span style="font-size: 0.8rem; color: #666; margin-left: 0.3rem;">(${rp.permission || 'unknown'})</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
  
  renderRootPathTree();
}

/**
 * ROOT_PATHツリーをサイドバーに描画
 */
function renderRootPathTree() {
  // ログイン状態取得
  const isLoggedIn = window.isAuthenticated;
  if (!isLoggedIn) return;
  const container = document.getElementById('root-tree-container');
  if (!container) return;
  container.innerHTML = '';
  // rootPathsが空でもcontainer自体は常に表示
  container.style.display = 'block';
  if (!rootPaths || rootPaths.length === 0) {
    // 空の場合はメッセージ表示
    container.innerHTML = '<div style="color:#888;padding:0.5em 0.2em;">ルートパスがありません</div>';
    return;
  }
  // ルートパス一覧をリスト表示
  const ul = document.createElement('ul');
  ul.style.listStyle = 'none';
  ul.style.padding = '0';
  rootPaths.forEach(rp => {
    const li = document.createElement('li');
    li.className = 'root-tree-item' + (selectedRootPath && selectedRootPath.id === rp.id ? ' selected' : '');

    li.textContent = rp.name || rp.path || String(rp);
    li.style.cursor = 'pointer';
    li.style.padding = '0.3em 0.5em';
    if (selectedRootPath && selectedRootPath.id === rp.id) {
      li.style.background = '#e0f2f1';
      li.style.color = '#009688';
      li.style.fontWeight = 'bold';
    }
    li.onclick = () => selectRootPath(rp.id || rp.path || rp);
    ul.appendChild(li);
  });
  container.appendChild(ul);
}

// ディレクトリ遷移
window.changeDir = async function(path) {
  try {
    let url = '/api/list';
    const params = new URLSearchParams();
    
    if (path) {
      params.append('path', path);
    }
    
    // 選択中のROOT_PATHがある場合はパラメータに追加
    if (selectedRootPath && selectedRootPath.id) {
      params.append('rootPathId', selectedRootPath.id);
    }
    
    if (params.toString()) {
      url += '?' + params.toString();
    }
    
    const res = await fetch(url);
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
  
  let url = '/api/delete/file';
  const params = new URLSearchParams();
  params.append('path', path);
  
  // 選択中のROOT_PATHがある場合はパラメータに追加
  if (selectedRootPath && selectedRootPath.id) {
    params.append('rootPathId', selectedRootPath.id);
  }
  
  url += '?' + params.toString();
  
  const res = await fetch(url, { method: 'DELETE' });
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

// ファイルツールバーのボタン制御
function updateFileToolbar() {
  const parentBtn = document.getElementById('parent-btn');
  if (!parentBtn) return;
  if (!currentPath || currentPath === '' || currentPath === undefined) {
    parentBtn.disabled = true;
    parentBtn.classList.add('disabled');
  } else {
    parentBtn.disabled = false;
    parentBtn.classList.remove('disabled');
  }
}

async function updateLoginStatus() {
  // DOM要素を毎回取得
  const loginStatusSpan = document.getElementById('login-status-span');
  const sidebarAuth = document.getElementById('sidebar-auth');
  try {
    if (!sidebarAuth) {
      console.warn('[DEBUG] sidebarAuth not found. ステータス表示をスキップ');
      return;
    }
    // 認証状態取得
    const res = await fetch('/auth/status');
    const data = await res.json();
    sidebarAuth.innerHTML = '';
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
      
      let loginStatusHtml = `
      ログイン中: <span style="font-weight:bold;">${data.name || ''}</span>
      <span class="badge ${providerName}">${providerLabel}</span>
      `;
      const statusDiv = document.createElement('div');
      statusDiv.id = 'login-status-span';
      statusDiv.innerHTML = loginStatusHtml;
      sidebarAuth.appendChild(statusDiv);
      // ログアウトボタン
      const logoutBtn = document.createElement('button');
      logoutBtn.id = 'logout-btn';
      logoutBtn.textContent = 'ログアウト';
      logoutBtn.className = 'sidebar-btn logout';
      logoutBtn.onclick = async () => {
        await fetch('/auth/logout');
        location.reload();
      };
      sidebarAuth.appendChild(logoutBtn);
      // ログイン時はmain-contentを表示にする
      const mainContent = document.getElementById('main-content');
      mainContent.style.display = '';
      await fetchRootPaths();
      fetchFiles(currentPath);
      window.isAuthenticated = true;
    } else {

      if (loginStatusSpan) {
        loginStatusSpan.innerHTML = '<span style="color:#d32f2f;font-weight:bold;">未ログインです。ログインしてください。</span>';
      }
      // ログインボタンを認証方式ごとに動的生成
      if (authConfig.gitlab) {
        const gitlabBtn = document.createElement('button');
        gitlabBtn.id = 'login-gitlab-btn';
        gitlabBtn.className = 'login-btn';
        gitlabBtn.textContent = 'GitLabでログイン';
        gitlabBtn.onclick = () => { window.location.href = '/auth/gitlab'; };
        sidebarAuth.appendChild(gitlabBtn);
      }
      if (authConfig.hydra) {
        const hydraBtn = document.createElement('button');
        hydraBtn.id = 'hydra-login-btn';
        hydraBtn.className = 'login-btn hydra';
        hydraBtn.textContent = 'Hydraでログイン';
        hydraBtn.onclick = () => { window.location.href = '/auth/hydra'; };
        sidebarAuth.appendChild(hydraBtn);
      }
      if (authConfig.github) {
        const githubBtn = document.createElement('button');
        githubBtn.id = 'login-github-btn';
        githubBtn.className = 'login-btn';
        githubBtn.textContent = 'GitHubでログイン';
        githubBtn.onclick = () => { window.location.href = '/auth/github'; };
        sidebarAuth.appendChild(githubBtn);
      }
      // 未ログイン時はmain-contentを非表示にする
      const mainContent = document.getElementById('main-content');
      mainContent.style.display = 'none';
      window.isAuthenticated = false;
    }
  } catch (e) {
    if (loginStatusSpan) loginStatusSpan.textContent = '認証状態取得失敗';
    const mainContent = document.getElementById('main-content');
    mainContent.style.display = 'none'
    console.error('[DEBUG] 認証状態取得エラー:', e);
    window.isAuthenticated = false;
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
}

// fetchFiles, changeDir, updateLoginStatus から renderParentButton を呼ぶように
window.onload = async function() {
  // authConfigを取得
  try {
    const res = await fetch('/auth/config');
    authConfig = await res.json();
    console.log('[DEBUG] authConfig loaded:', authConfig);
  } catch (e) {
    console.error('[DEBUG] authConfig取得失敗:', e);
    authConfig = null;
  }
  // 認証状態の更新
  await updateLoginStatus();
  renderRootPathTree();
  // ファイルツールバーのボタンイベント
  const parentBtn = document.getElementById('parent-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  if (parentBtn) {
    parentBtn.onclick = () => {
      if (!currentPath) return;
      const parts = currentPath.split('/').filter(Boolean);
      if (parts.length === 0) return;
      parts.pop();
      const parentPath = parts.join('/');
      changeDir(parentPath);
    };
  }
  if (refreshBtn) {
    refreshBtn.onclick = () => fetchFiles(currentPath);
  }
};
