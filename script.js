// グローバル変数
let csvFiles = new Map();
let currentZoom = 1;
let currentFile = null;

// DOM要素の取得
const uploadArea = document.getElementById('upload-area');
const csvInput = document.getElementById('csv-input');
const errorMessage = document.getElementById('error-message');
const tabsContainer = document.getElementById('tabs-container');
const tabs = document.getElementById('tabs');
const treeContainer = document.getElementById('tree-container');
const treeCanvas = document.getElementById('tree-canvas');
const controls = document.getElementById('controls');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const resetZoomBtn = document.getElementById('reset-zoom');

// イベントリスナーの設定
uploadArea.addEventListener('click', () => csvInput.click());
uploadArea.addEventListener('dragover', handleDragOver);
uploadArea.addEventListener('dragleave', handleDragLeave);
uploadArea.addEventListener('drop', handleDrop);
csvInput.addEventListener('change', (e) => processFiles(e.target.files));

// ズーム機能
zoomInBtn.addEventListener('click', () => zoom(1.2));
zoomOutBtn.addEventListener('click', () => zoom(0.8));
resetZoomBtn.addEventListener('click', resetZoom);

// タッチイベントの追加
let touchStartX = 0;
let touchStartY = 0;

treeCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
treeCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });

function handleTouchStart(e) {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
}

function handleTouchMove(e) {
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStartX;
        const deltaY = touch.clientY - touchStartY;
        
        treeCanvas.scrollLeft -= deltaX;
        treeCanvas.scrollTop -= deltaY;
        
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
    }
}

// ドラッグ&ドロップ処理
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

// ファイル処理
function processFiles(files) {
    const dataFileList = [];
    
    // CSV/TSVファイルのみフィルタリング
    for (let file of files) {
        if (file.type === 'text/csv' || file.type === 'text/tab-separated-values' || 
            file.name.endsWith('.csv') || file.name.endsWith('.tsv')) {
            dataFileList.push(file);
        }
    }
    
    if (dataFileList.length === 0) {
        showError('CSV/TSVファイルを選択してください。');
        return;
    }
    
    // ファイルを読み込み
    dataFileList.forEach(file => {
        readDataFile(file);
    });
}

// CSV/TSVファイル読み込み
function readDataFile(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const fileContent = e.target.result;
        const fileName = file.name.replace(/\.(csv|tsv)$/, '');
        const isCSV = file.name.endsWith('.csv');
        
        try {
            const parsedData = parseDataFile(fileContent, isCSV);
            csvFiles.set(fileName, parsedData);
            updateTabs();
            
            // 最初のファイルを自動で選択
            if (csvFiles.size === 1) {
                switchTab(fileName);
            }
        } catch (error) {
            showError(`${file.name}の読み込みに失敗しました: ${error.message}`);
        }
    };
    
    reader.onerror = function() {
        showError(`${file.name}の読み込み中にエラーが発生しました。`);
    };
    
    reader.readAsText(file, 'UTF-8');
}

// CSV/TSVファイルパーサー
function parseDataFile(fileContent, isCSV = true) {
    const lines = fileContent.trim().split('\n');
    if (lines.length < 2) {
        throw new Error('ファイルが空か、ヘッダー行がありません。');
    }
    
    // ヘッダー行を解析
    const headers = parseDataLine(lines[0], isCSV);
    const expectedHeaders = ['目標ID', '親目標ID', '目標名', '説明', 'アイコンURL', 'URL', 'X座標', 'Y座標'];
    
    // ヘッダーチェック（部分一致でも許可）
    const hasRequiredHeaders = expectedHeaders.slice(0, 6).every(header => 
        headers.some(h => h.includes(header.replace('URL', '')) || header.includes(h))
    );
    
    if (!hasRequiredHeaders) {
        throw new Error('ファイルのヘッダーが正しくありません。必要な列: ' + expectedHeaders.join(', '));
    }
    
    // データ行を解析
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '') continue;
        
        const values = parseDataLine(lines[i], isCSV);
        if (values.length >= 6) {
            data.push({
                id: values[0] || '',
                parentId: values[1] || '',
                name: values[2] || '',
                description: values[3] || '',
                iconUrl: values[4] || '',
                url: values[5] || '',
                x: parseInt(values[6]) || 0,
                y: parseInt(values[7]) || 0
            });
        }
    }
    
    return data;
}

// CSV/TSV行をパース（カンマ区切り/タブ区切り、クォート考慮）
function parseDataLine(line, isCSV = true) {
    const delimiter = isCSV ? ',' : '\t';
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // エスケープされたクォート
                current += '"';
                i++; // 次の文字をスキップ
            } else {
                // クォートの開始/終了
                inQuotes = !inQuotes;
            }
        } else if (char === delimiter && !inQuotes) {
            // 区切り文字で分割
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    // 最後のフィールドを追加
    result.push(current.trim());
    return result;
}

// タブ更新
function updateTabs() {
    tabs.innerHTML = '';
    
    csvFiles.forEach((data, fileName) => {
        const tab = document.createElement('button');
        tab.className = 'tab';
        tab.textContent = fileName;
        tab.addEventListener('click', () => switchTab(fileName));
        
        // タッチイベントの追加
        tab.addEventListener('touchstart', (e) => {
            e.preventDefault();
            switchTab(fileName);
        });
        
        tabs.appendChild(tab);
    });
    
    tabsContainer.style.display = csvFiles.size > 0 ? 'block' : 'none';
}

// タブ切り替え
function switchTab(fileName) {
    currentFile = fileName;
    
    // アクティブタブの更新
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.textContent === fileName) {
            tab.classList.add('active');
        }
    });
    
    // ツリー表示
    displayTree(csvFiles.get(fileName));
    treeContainer.style.display = 'block';
    controls.style.display = 'block';
}

// ツリー表示
function displayTree(data) {
    treeCanvas.innerHTML = '';
    
    // 自動配置の場合の処理
    if (data.some(node => node.x === 0 && node.y === 0)) {
        autoPositionNodes(data);
    }
    
    // 接続線を描画
    drawConnections(data);
    
    // ノードを描画
    data.forEach(node => {
        createTreeNode(node);
    });
    
    // モバイル端末での初期ズーム調整
    if (window.innerWidth <= 768) {
        currentZoom = 0.8;
        applyZoom();
    }
}

// 自動配置
function autoPositionNodes(data) {
    const nodeMap = new Map();
    data.forEach(node => nodeMap.set(node.id, node));
    
    // ルートノードを見つける
    const rootNodes = data.filter(node => !node.parentId);
    
    let currentY = 100;
    
    rootNodes.forEach(rootNode => {
        positionNodeAndChildren(rootNode, nodeMap, 100, currentY);
        currentY += 200;
    });
}

function positionNodeAndChildren(node, nodeMap, x, y) {
    node.x = x;
    node.y = y;
    
    // 子ノードを取得
    const children = Array.from(nodeMap.values())
        .filter(child => child.parentId === node.id);
    
    let childY = y;
    children.forEach(child => {
        positionNodeAndChildren(child, nodeMap, x + 250, childY);
        childY += 150;
    });
}

// 接続線の描画
// function drawConnections(data) {
//     const nodeMap = new Map();
//     data.forEach(node => nodeMap.set(node.id, node));
    
//     data.forEach(node => {
//         if (node.parentId) {
//             const parent = nodeMap.get(node.parentId);
//             if (parent) {
//                 drawLine(parent.x + 75, parent.y + 50, node.x + 75, node.y + 50);
//             }
//         }
//     });
// }
// 修正後 drawConnections
function drawConnections(data) {
  const nodeMap = new Map();
  // ノードとアイコンの寸法
  const nodeWidth = 90, nodeHeight = 60;
  const iconSize = 60; // css .tree-node-icon { width: 30px; height: 30px }
  const iconRadius = iconSize / 2;

  data.forEach(node => nodeMap.set(node.id, node));
  data.forEach(node => {
    if (node.parentId) {
      const parent = nodeMap.get(node.parentId);
      if (parent) {
        // ノード中心座標
        const x1 = parent.x + nodeWidth / 2;
        const y1 = parent.y + nodeHeight / 2;
        const x2 = node.x + nodeWidth / 2;
        const y2 = node.y + nodeHeight / 2;
        // 始点→終点ベクトル
        const dx = x2 - x1, dy = y2 - y1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // アイコン半径分両端を短く
        const offsetX = (dx / dist) * iconRadius;
        const offsetY = (dy / dist) * iconRadius;
        // 始点/終点補正
        const startX = x1 + offsetX;
        const startY = y1 + offsetY;
        const endX   = x2 - offsetX;
        const endY   = y2 - offsetY;
        drawLine(startX, startY, endX, endY);
      }
    }
  });
}


// 線を描画
function drawLine(x1, y1, x2, y2) {
    const line = document.createElement('div');
    line.className = 'tree-line';
    
    const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    
    line.style.width = length + 'px';
    line.style.height = '2px';
    line.style.left = x1 + 'px';
    line.style.top = y1 + 'px';
    line.style.transform = `rotate(${angle}rad)`;
    line.style.transformOrigin = '0 0';
    
    treeCanvas.appendChild(line);
}

// ツリーノード作成
function createTreeNode(node) {
    const nodeElement = document.createElement('div');
    nodeElement.className = 'tree-node';
    nodeElement.style.left = node.x + 'px';
    nodeElement.style.top = node.y + 'px';
    
    // 修正後 script.js
    const iconContainer = document.createElement('div');
    iconContainer.className = 'tree-node-icon';
    // 画像はいっぱいに
    iconContainer.style.backgroundImage = node.iconUrl && node.iconUrl.trim() !== ''
    ? (!node.iconUrl.startsWith('http') ? `url(images/${node.iconUrl})` : `url(${node.iconUrl})`)
    : '';
    iconContainer.style.backgroundSize = 'cover';
    iconContainer.style.backgroundPosition = 'center';
    iconContainer.style.backgroundRepeat = 'no-repeat';
    iconContainer.style.backgroundColor  = '#222'; // 見切れ時の余白色

    // ツールチップ部分
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.innerHTML = `<strong>${node.name}</strong><br>${node.description}`;
    // 初期は非表示
    tooltip.style.display = "none";
    iconContainer.appendChild(tooltip);

    // ホバー動作
    iconContainer.addEventListener('mouseenter', () => { tooltip.style.display = 'block'; });
    iconContainer.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });

    nodeElement.appendChild(iconContainer);
    // ※名前、説明はここで追加しない

    
    // クリック/タップイベント
    nodeElement.addEventListener('click', () => {
        if (node.url) {
            window.open(node.url, '_blank');
        }
    });
    
    // タッチイベント
    nodeElement.addEventListener('touchstart', (e) => {
        e.stopPropagation();
    });
    
    nodeElement.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (node.url) {
            window.open(node.url, '_blank');
        }
    });
    
    treeCanvas.appendChild(nodeElement);
}


// ズーム機能
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

// エラーメッセージ表示
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    
    // 5秒後に非表示
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

// 画面リサイズ時の処理
window.addEventListener('resize', () => {
    if (currentFile) {
        // モバイル端末での初期ズーム調整
        if (window.innerWidth <= 768 && currentZoom > 0.8) {
            currentZoom = 0.8;
            applyZoom();
        }
    }
});

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    // 初期状態の設定
    resetZoom();
    // URLパラメータをチェック
    checkUrlParameters();
});

// URLパラメータチェック機能 - 新規追加
function checkUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const jsonData = urlParams.get('data');
    const treeName = urlParams.get('name') || 'URLツリー';
    
    if (jsonData) {
        try {
            showUrlInfo('URLからデータを読み込み中...', 'loading');
            
            // URLデコードしてJSONパース
            const decodedData = decodeURIComponent(jsonData);
            const treeData = JSON.parse(decodedData);
            
            // JSONデータをCSV形式に変換
            const csvData = convertJsonToCsvFormat(treeData);
            
            // データを追加
            csvFiles.set(treeName, csvData);
            updateTabs();
            switchTab(treeName);
            
            showUrlInfo(`「${treeName}」を読み込みました`, 'success');
            setTimeout(() => hideUrlInfo(), 3000);
            
        } catch (error) {
            console.error('URLパラメータの解析エラー:', error);
            showUrlInfo('URLからのデータ読み込みに失敗しました', 'error');
            setTimeout(() => hideUrlInfo(), 5000);
        }
    }
}

// URL情報表示 - 新規追加
function showUrlInfo(message, type = 'loading') {
    const urlInfo = document.getElementById('url-info');
    if (urlInfo) {
        urlInfo.textContent = message;
        urlInfo.className = `url-info ${type}`;
        urlInfo.style.display = 'block';
    }
}

// URL情報非表示 - 新規追加
function hideUrlInfo() {
    const urlInfo = document.getElementById('url-info');
    if (urlInfo) {
        urlInfo.style.display = 'none';
    }
}

// JSONをCSV形式データに変換 - 新規追加
function convertJsonToCsvFormat(jsonData) {
    const csvData = [];
    
    jsonData.forEach(item => {
        csvData.push({
            id: item.id || '',
            parentId: item.parentId || '',
            name: item.name || '',
            description: item.description || '',
            iconUrl: item.iconUrl || '',
            url: item.url || '',
            x: parseInt(item.x) || 0,
            y: parseInt(item.y) || 0
        });
    });
    
    return csvData;
}