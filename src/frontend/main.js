// ...ファイル一覧取得・描画・操作UIの雛形...
const fileTable = document.getElementById('file-table');
const fileList = document.getElementById('file-list');
const errorDiv = document.getElementById('error');
const logoutBtn = document.getElementById('logout-btn');
const authArea = document.getElementById('auth-area');
let loginStatusSpan;

async function fetchFiles() {
  try {
    const res = await fetch('/api/list');
    if (!res.ok) throw new Error('ファイル一覧取得に失敗しました');
    const data = await res.json(); // データの形式は { files: [{ name: 'file1.txt', type: 'file', size: 1234, mtime: '2023-10-01T12:00:00Z' }, ...] }
    renderFiles(data.files || []);
    renderBreadcrumb([]); // ルート
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
    tr.innerHTML = `
      <td>${isDir ? '<span class="material-icons" style="vertical-align:middle;color:#ffa000;">folder</span> ' : '<span class="material-icons" style="vertical-align:middle;color:#1976d2;">insert_drive_file</span> '}
        ${isDir ? `<span style='cursor:pointer;color:#1976d2;text-decoration:underline;' onclick='changeDir("${f.name}")'>${f.name}</span>` : f.name}
      </td>
      <td>${isDir ? 'フォルダ' : 'ファイル'}</td>
      <td>${f.size ?? ''}</td>
      <td>${f.mtime ?? ''}</td>
      <td class="actions">
        ${isDir 
          ? `<button class="icon-btn" title="zipダウンロード" onclick="downloadZip('${f.name}')"><span class="material-icons">archive</span></button>` 
          : `<a class="download-link icon-btn" title="ダウンロード" href="/api/download/file?path=${encodeURIComponent(f.name)}" download><span class="material-icons">download</span></a>`}
        <button class="icon-btn" title="削除" onclick="deleteFile('${f.name}')"><span class="material-icons">delete</span></button>
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
    const span = document.createElement('span');
    span.textContent = p || 'root';
    span.className = 'breadcrumb-item';
    span.onclick = () => changeDir(path);
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
    renderFiles(data.files || []);
    renderBreadcrumb(path.split('/').filter(Boolean));
    fileTable.style.display = '';
    errorDiv.style.display = 'none';
  } catch (e) {
    errorDiv.textContent = e.message;
    errorDiv.style.display = '';
    fileTable.style.display = 'none';
  }
};

window.downloadFile = async function(name) {
  window.location = `/api/download?name=${encodeURIComponent(name)}`;
};

window.downloadZip = async function(name) {
  window.location = `/api/download?name=${encodeURIComponent(name)}&zip=1`;
};

window.deleteFile = async function(name) {
  if (!confirm(`${name} を削除しますか？`)) return;
  const res = await fetch(`/api/delete?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
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
    if (!loginStatusSpan) {
      loginStatusSpan = document.createElement('span');
      loginStatusSpan.id = 'login-status';
      loginStatusSpan.style.marginLeft = '1em';
      loginStatusSpan.style.fontWeight = 'bold';
      authArea.appendChild(loginStatusSpan);
    }
    if (data.authenticated) {
      loginStatusSpan.textContent = `ログイン中: ${data.name || ''}`;
      // ログインボタン非表示、ログアウトボタン表示
      document.querySelectorAll('.login-btn.github, .login-btn.gitlab, .login-btn.hydra').forEach(btn => btn.style.display = 'none');
      logoutBtn.style.display = '';
      fetchFiles();
    } else {
      loginStatusSpan.textContent = '未ログイン';
      document.querySelectorAll('.login-btn.github, .login-btn.gitlab, .login-btn.hydra').forEach(btn => btn.style.display = '');
      logoutBtn.style.display = 'none';
      fileTable.style.display = 'none';
    }
  } catch (e) {
    if (loginStatusSpan) loginStatusSpan.textContent = '認証状態取得失敗';
  }
}

window.onload = () => {
  updateLoginStatus();
};
