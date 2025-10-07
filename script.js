/**
 * progress_tree Main Script - Clean Version
 * 論理・順序整理＋詳細コメント
 */

/* ===============================
   1. グローバル変数定義
   =============================== */
let csvFiles = new Map();      // ファイル名→データのMap
let currentZoom = 1;           // ズーム倍率
let currentFile = null;        // 現在表示中ファイル
let viewMode = "pc";           // ユーザ閲覧モード: "pc" or "sp"

/* ===============================
   2. DOM要素取得
   =============================== */
const uploadArea       = document.getElementById('upload-area');
const csvInput         = document.getElementById('csv-input');
const errorMessage     = document.getElementById('error-message');
const tabsContainer    = document.getElementById('tabs-container');
const tabs             = document.getElementById('tabs');
const treeContainer    = document.getElementById('tree-container');
const treeCanvas       = document.getElementById('tree-canvas');
const controls         = document.getElementById('controls');
const zoomInBtn        = document.getElementById('zoom-in');
const zoomOutBtn       = document.getElementById('zoom-out');
const resetZoomBtn     = document.getElementById('reset-zoom');
const modeSwitchBtn    = document.getElementById('mode-switch-btn');
const currentModeLabel = document.getElementById('current-mode-label');
const shareUrlContainer= document.getElementById('share-url-container');
const shareUrlInput    = document.getElementById('share-url');
const copyUrlBtn       = document.getElementById('copy-url-btn');
const urlInfo          = document.getElementById('url-info');

/* ===============================
   3. 初期化＆イベントリスナー設定
   =============================== */
document.addEventListener('DOMContentLoaded', () => {
  resetZoom();
  checkUrlParameters();
});

modeSwitchBtn.addEventListener('click', () => {
  viewMode = (viewMode === 'pc') ? 'sp' : 'pc';
  modeSwitchBtn.textContent = (viewMode === 'pc') ? 'スマホモードにする' : 'パソコンモードにする';
  currentModeLabel.textContent = (viewMode === 'pc') ? '[PCモード]' : '[スマホモード]';
  if (currentFile) displayTree(csvFiles.get(currentFile));
});

uploadArea.addEventListener('click', () => csvInput.click());
uploadArea.addEventListener('dragover', handleDragOver);
uploadArea.addEventListener('dragleave', handleDragLeave);
uploadArea.addEventListener('drop', handleDrop);
csvInput.addEventListener('change', e => processFiles(e.target.files));

zoomInBtn.addEventListener('click', () => zoom(1.2));
zoomOutBtn.addEventListener('click', () => zoom(0.8));
resetZoomBtn.addEventListener('click', resetZoom);

window.addEventListener('resize', () => {
  if (currentFile && window.innerWidth <= 768 && currentZoom > 0.8) {
    currentZoom = 0.8;
    applyZoom();
  }
});

if (copyUrlBtn) {
  copyUrlBtn.addEventListener('click', () => {
    shareUrlInput.select();
    try {
      document.execCommand('copy');
      copyUrlBtn.innerText = 'コピー完了!';
      setTimeout(() => { copyUrlBtn.innerText = 'コピー'; }, 900);
    } catch {
      copyUrlBtn.innerText = '手動でコピー';
    }
  });
}

/* ===============================
   4. ファイル処理系関数
   =============================== */
function processFiles(files) {
  const dataFiles = [];
  for (let file of files) {
    if (file.type === 'text/csv' || file.type === 'text/tab-separated-values' ||
        file.name.endsWith('.csv') || file.name.endsWith('.tsv')) {
      dataFiles.push(file);
    }
  }
  if (dataFiles.length === 0) {
    showError('CSV/TSVファイルを選択してください。');
    return;
  }
  dataFiles.forEach(file => readDataFile(file));
}

function handleDragOver(e) {
  e.preventDefault();
  uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
  e.preventDefault();
  uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
  e.preventDefault();
  uploadArea.classList.remove('dragover');
  processFiles(e.dataTransfer.files);
}

function readDataFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const content = e.target.result;
    const name = file.name.replace(/\.(csv|tsv)$/, '');
    const isCSV = file.name.endsWith('.csv');
    try {
      const parsed = parseDataFile(content, isCSV);
      csvFiles.set(name, parsed);
      updateTabs();
      if (csvFiles.size === 1) switchTab(name);
      updateShareUrl(name);
    } catch (err) {
      showError(`${file.name} の読み込みに失敗: ${err.message}`);
    }
  };
  reader.onerror = () => showError(`${file.name} の読み込み中にエラーが発生しました。`);
  reader.readAsText(file, 'UTF-8');
}

/* ===============================
   5. データ解析・変換系
   =============================== */
function parseDataFile(text, isCSV = true) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) throw new Error('ヘッダー行がありません。');
  const headers = parseDataLine(lines[0], isCSV);
  const expected = ['目標ID','親目標ID','目標名','説明','アイコンURL','URL'];
  if (!expected.every(h => headers.some(x => x.includes(h.replace('URL',''))))) {
    throw new Error('ヘッダー不正。必要列: ' + expected.join(', '));
  }
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = parseDataLine(lines[i], isCSV);
    if (vals.length >= 6) {
      data.push({
        id: vals[0]||'', parentId: vals[1]||'',
        name: vals[2]||'', description: vals[3]||'',
        iconUrl: vals[4]||'', url: vals[5]||'',
        x: parseInt(vals[6])||0, y: parseInt(vals[7])||0
      });
    }
  }
  return data;
}

function parseDataLine(line, isCSV = true) {
  const delim = isCSV ? ',' : '\t';
  const result = [];
  let curr = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i], nx = line[i+1];
    if (ch === '"') {
      if (inQ && nx === '"') { curr += '"'; i++; }
      else inQ = !inQ;
    }
    else if (ch === delim && !inQ) {
      result.push(curr.trim()); curr = '';
    }
    else curr += ch;
  }
  result.push(curr.trim());
  return result;
}

function convertJsonToCsvFormat(jsonData) {
  return jsonData.map(item => ({
    id: item.id||'', parentId: item.parentId||'',
    name: item.name||'', description: item.description||'',
    iconUrl: item.iconUrl||'', url: item.url||'',
    x: parseInt(item.x)||0, y: parseInt(item.y)||0
  }));
}

// 追加: データ構造最適化関数
function optimizeTreeData(treeData) {
  return treeData.map(node => ({
    i: node.id,           // id → i
    p: node.parentId,     // parentId → p
    n: node.name,         // name → n
    d: node.description,  // description → d
    c: node.iconUrl,      // iconUrl → c
    u: node.url,          // url → u
    x: node.x,            // x座標
    y: node.y             // y座標
  }));
}

// 追加: 最適化データの復元関数
function restoreTreeData(optimizedData) {
  return optimizedData.map(node => ({
    id: node.i || '',
    parentId: node.p || '',
    name: node.n || '',
    description: node.d || '',
    iconUrl: node.c || '',
    url: node.u || '',
    x: parseInt(node.x) || 0,
    y: parseInt(node.y) || 0
  }));
}

/* ===============================
   6. UI更新・タブ操作系
   =============================== */
function updateTabs() {
  tabs.innerHTML = '';
  csvFiles.forEach((_, name) => {
    const btn = document.createElement('button');
    btn.className = 'tab';
    btn.textContent = name;
    btn.addEventListener('click', () => switchTab(name));
    btn.addEventListener('touchstart', e => { e.preventDefault(); switchTab(name); });
    tabs.appendChild(btn);
  });
  tabsContainer.style.display = csvFiles.size ? 'block' : 'none';
}

function switchTab(name) {
  currentFile = name;
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.textContent === name);
  });
  displayTree(csvFiles.get(name));
  treeContainer.style.display = 'block';
  controls.style.display = 'block';
  updateShareUrl(name);
}

/* ===============================
   7. URL共有機能
   =============================== */
function checkUrlParameters() {
  const p = new URLSearchParams(window.location.search);
  const data = p.get('data'), nm = p.get('name') || 'URLツリー';
  if (data) {
    showUrlInfo('URLから読み込み中...', 'loading');
    try {
      // LZString圧縮データかどうか判定して処理を分岐
      let arr;
      try {
        // 新形式: LZString圧縮データの復元
        const decompressed = LZString.decompressFromEncodedURIComponent(data);
        if (decompressed) {
          const optimizedData = JSON.parse(decompressed);
          arr = restoreTreeData(optimizedData);
        } else {
          throw new Error('LZString復元失敗');
        }
      } catch {
        // 旧形式: 通常のJSONデータ（後方互換性）
        const decoded = decodeURIComponent(data);
        arr = JSON.parse(decoded);
      }
      
      const parsed = convertJsonToCsvFormat(arr);
      csvFiles.set(nm, parsed);
      updateTabs(); switchTab(nm);
      showUrlInfo(`「${nm}」を読み込みました`, 'success');
      setTimeout(hideUrlInfo, 3000);
    } catch (error) {
      console.error('URLパラメータ復元エラー:', error);
      showUrlInfo('URL読み込み失敗', 'error');
      setTimeout(hideUrlInfo, 5000);
    }
  }
}


function updateShareUrl(name) {
  const data = csvFiles.get(name);
  if (!data) { shareUrlContainer.style.display = 'none'; return; }
  try {
    // 1) データ構造を最適化
    const optimized = optimizeTreeData(data);
    // 2) JSON → LZString圧縮
    const jsonStr = JSON.stringify(optimized);
    const compressed = LZString.compressToEncodedURIComponent(jsonStr);    
    // 3) URL生成
    const url = `${location.origin}${location.pathname}?data=${compressed}&name=${encodeURIComponent(name)}`;
    shareUrlInput.value = url;
    shareUrlContainer.style.display = 'flex';    
  } catch (error) {
    console.error('URL生成エラー:', error);
    shareUrlContainer.style.display = 'none';
  }
}


function showUrlInfo(msg, type='loading') {
  urlInfo.textContent = msg;
  urlInfo.className = `url-info ${type}`;
  urlInfo.style.display = 'block';
}

function hideUrlInfo() {
  urlInfo.style.display = 'none';
}

/* ===============================
   8. ツリー描画系
   =============================== */
function displayTree(data) {
  treeCanvas.innerHTML = '';
  if (data.some(n => n.x === 0 && n.y === 0)) autoPositionNodes(data);
  drawConnections(data);
  data.forEach(createTreeNode);
  if (window.innerWidth <= 768) { currentZoom = 0.8; applyZoom(); }
}

function autoPositionNodes(data) {
  const map = new Map(data.map(n => [n.id, n]));
  const roots = data.filter(n => !n.parentId);
  let y = 100;
  roots.forEach(r => { positionNodeAndChildren(r, map, 100, y); y += 200; });
}

function positionNodeAndChildren(node, map, x, y) {
  node.x = x; node.y = y;
  Array.from(map.values()).filter(c => c.parentId === node.id)
    .forEach((c, i) => positionNodeAndChildren(c, map, x+250, y + i*150));
}

function drawConnections(data) {
  const map = new Map(data.map(n => [n.id, n]));
  const w=90, h=60, ico=60, r=ico/2;
  data.forEach(n => {
    if (!n.parentId) return;
    const p = map.get(n.parentId);
    if (!p) return;
    const x1=p.x+w/2, y1=p.y+h/2, x2=n.x+w/2, y2=n.y+h/2;
    const dx=x2-x1, dy=y2-y1, d=Math.hypot(dx,dy);
    const ox=(dx/d)*r, oy=(dy/d)*r;
    drawLine(x1+ox, y1+oy, x2-ox, y2-oy);
  });
}

function drawLine(x1,y1,x2,y2) {
  const line = document.createElement('div');
  line.className = 'tree-line';
  const len = Math.hypot(x2-x1, y2-y1);
  const ang = Math.atan2(y2-y1, x2-x1);
  Object.assign(line.style, {
    width: `${len}px`, height: '2px',
    left: `${x1}px`, top: `${y1}px`,
    transform: `rotate(${ang}rad)`, transformOrigin: '0 0'
  });
  treeCanvas.appendChild(line);
}

/* ===============================
   9. ノード生成（PC/SP挙動分岐含む）
   =============================== */
function createTreeNode(node) {
  const el = document.createElement('div');
  el.className = 'tree-node';
  el.style.left = `${node.x}px`;
  el.style.top  = `${node.y}px`;

  const icon = document.createElement('div');
  icon.className = 'tree-node-icon';
  if (node.iconUrl) {
    icon.style.backgroundImage = node.iconUrl.startsWith('http')
      ? `url(${node.iconUrl})`
      : `url(images/${node.iconUrl})`;
  }
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip';
  tooltip.innerHTML = `<b>${node.name}</b><br>${node.description}`;
  icon.appendChild(tooltip);

  if (viewMode === 'pc') {
    icon.addEventListener('mouseenter', () => tooltip.style.display = 'block');
    icon.addEventListener('mouseleave', () => tooltip.style.display = 'none');
    icon.addEventListener('click', () => {
      if (node.url) window.open(node.url, '_blank');
    });
  } else {
    let tapped = false;
    icon.addEventListener('click', e => {
      e.stopPropagation();
      if (!tapped) {
        tooltip.style.display = tooltip.style.display === 'block' ? 'none' : 'block';
        tapped = true;
        setTimeout(() => tapped = false, 1000);
      } else {
        tooltip.style.display = 'none';
        if (node.url) window.open(node.url, '_blank');
        tapped = false;
      }
    });
    document.addEventListener('click', e => {
      if (!icon.contains(e.target)) {
        tooltip.style.display = 'none';
        tapped = false;
      }
    });
  }

  el.appendChild(icon);
  treeCanvas.appendChild(el);
}

/* ===============================
   10. ズーム処理
   =============================== */
function zoom(factor) {
  currentZoom *= factor;
  currentZoom = Math.max(0.3, Math.min(currentZoom, 3));
  applyZoom();
}

function resetZoom() {
  currentZoom = window.innerWidth <= 768 ? 0.8 : 1;
  applyZoom();
}

function applyZoom() {
  treeCanvas.style.transform = `scale(${currentZoom})`;
  treeCanvas.style.transformOrigin = '0 0';
}

/* ===============================
   11. エラーハンドリング
   =============================== */
function showError(msg) {
  errorMessage.textContent = msg;
  errorMessage.style.display = 'block';
  setTimeout(() => errorMessage.style.display = 'none', 5000);
}
