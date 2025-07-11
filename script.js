// グローバル変数
let goalsData = [];
let lines = [];
let currentTab = null;
let csvFiles = new Map(); // ファイル名とデータのマップ

// DOM読み込み完了時の処理
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// アプリ初期化
function initializeApp() {
    const uploadArea = document.getElementById('upload-area');
    const csvInput = document.getElementById('csv-input');
    
    // ドラッグ&ドロップイベント
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    
    // ファイル選択イベント
    csvInput.addEventListener('change', handleFileSelect);
    
    // クリックでファイル選択
    uploadArea.addEventListener('click', function() {
        csvInput.click();
    });
}

// ドラッグオーバー処理
function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
}

// ドラッグリーブ処理
function handleDragLeave(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
}

// ドロップ処理
function handleDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    processFiles(files);
}

// ファイル選択処理
function handleFileSelect(event) {
    const files = event.target.files;
    processFiles(files);
}

// ファイル処理
function processFiles(files) {
    const csvFileList = [];
    
    // CSVファイルのみフィルタリング
    for (let file of files) {
        if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
            csvFileList.push(file);
        }
    }
    
    if (csvFileList.length === 0) {
        showError('CSVファイルを選択してください。');
        return;
    }
    
    // ファイルを読み込み
    csvFileList.forEach(file => {
        readCSVFile(file);
    });
}

// CSVファイル読み込み
function readCSVFile(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const csvContent = e.target.result;
        const fileName = file.name.replace('.csv', '');
        
        try {
            const parsedData = parseCSV(csvContent);
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

// シンプルなCSVパーサー
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
        throw new Error('CSVファイルが空か、ヘッダー行がありません。');
    }
    
    // ヘッダー行を解析
    const headers = parseCSVLine(lines[0]);
    const expectedHeaders = ['目標ID', '親目標ID', '目標名', '説明', 'アイコンURL', 'URL', 'X座標', 'Y座標'];
    
    // ヘッダーチェック（部分一致でも許可）
    const hasRequiredHeaders = expectedHeaders.slice(0, 6).every(header => 
        headers.some(h => h.includes(header.replace('URL', '')) || header.includes(h))
    );
    
    if (!hasRequiredHeaders) {
        throw new Error('CSVファイルのヘッダーが正しくありません。必要な列: ' + expectedHeaders.join(', '));
    }
    
    // データ行を解析
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '') continue;
        
        const values = parseCSVLine(lines[i]);
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

// CSV行をパース（カンマ区切り、クォート考慮）
function parseCSVLine(line) {
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
        } else if (char === ',' && !inQuotes) {
            // カンマで区切り
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

// タブを更新
function updateTabs() {
    const tabContainer = document.getElementById('tab-container');
    const tabButtons = document.getElementById('tab-buttons');
    
    if (csvFiles.size === 0) {
        tabContainer.style.display = 'none';
        return;
    }
    
    // タブボタンをクリア
    tabButtons.innerHTML = '';
    
    // 各CSVファイルのタブを作成
    csvFiles.forEach((data, fileName) => {
        const tabButton = document.createElement('button');
        tabButton.classList.add('tab-button');
        tabButton.textContent = fileName;
        tabButton.setAttribute('data-tab', fileName);
        
        tabButton.addEventListener('click', function() {
            switchTab(fileName);
        });
        
        tabButtons.appendChild(tabButton);
    });
    
    tabContainer.style.display = 'block';
}

// タブ切り替え処理
function switchTab(fileName) {
    // 既存の線をすべて削除
    if (lines && lines.length > 0) {
        lines.forEach(line => line.remove());
        lines = [];
    }
    
    // アクティブなタブのスタイルを更新
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    const clickedButton = document.querySelector(`.tab-button[data-tab="${fileName}"]`);
    if (clickedButton) {
        clickedButton.classList.add('active');
    }
    
    // 現在のタブを更新
    currentTab = fileName;
    
    // データを表示
    const data = csvFiles.get(fileName);
    if (data) {
        displayGoals(data);
    }
}

// 目標を表示
function displayGoals(goals) {
    goalsData = goals;
    const container = document.getElementById('tree-container');
    
    container.innerHTML = '';
    
    // データが空の場合の表示
    if (goals.length === 0) {
        container.innerHTML = '<div class="loading">このCSVファイルにはデータがありません。</div>';
        return;
    }
    
    goals.forEach(goal => {
        const iconElement = document.createElement('div');
        iconElement.classList.add('goal-icon');
        iconElement.setAttribute('data-id', goal.id);
        
        // アイコン画像の設定
        if (goal.iconUrl) {
            // ローカル画像パス（images/フォルダ）または外部URLに対応
            if (!goal.iconUrl.startsWith('http')) {
                iconElement.style.backgroundImage = `url(images/${goal.iconUrl})`;
            } else {
                iconElement.style.backgroundImage = `url(${goal.iconUrl})`;
            }
        }
        
        iconElement.style.left = `${goal.x}px`;
        iconElement.style.top = `${goal.y}px`;
        
        // ツールチップ表示イベント
        iconElement.addEventListener('mouseover', function(e) {
            showTooltip(e, goal);
        });
        
        iconElement.addEventListener('mouseout', function() {
            hideTooltip();
        });
        
        // クリックでURLに遷移
        iconElement.addEventListener('click', function() {
            if (goal.url && goal.url.trim() !== '') {
                window.open(goal.url, '_blank');
            }
        });
        
        container.appendChild(iconElement);
    });
    
    // 少し待ってから線を描画
    setTimeout(drawLines, 100);
}

// 線を描画
function drawLines() {
    // 既存の線を削除
    lines.forEach(line => line.remove());
    lines = [];
    
    // 親子関係に基づいて線を描画
    goalsData.forEach(goal => {
        if (goal.parentId && goal.parentId.trim() !== '') {
            const parentIcon = document.querySelector(`.goal-icon[data-id="${goal.parentId}"]`);
            const childIcon = document.querySelector(`.goal-icon[data-id="${goal.id}"]`);
            
            if (parentIcon && childIcon) {
                try {
                    const line = new LeaderLine(
                        parentIcon,
                        childIcon,
                        {
                            color: '#888',
                            size: 2,
                            path: 'grid',
                            startPlugOutline: true,
                            endPlugOutline: true,
                            endPlugSize: 1.5
                        }
                    );
                    lines.push(line);
                } catch (error) {
                    console.warn('線の描画に失敗:', error);
                }
            }
        }
    });
}

// ツールチップを表示
function showTooltip(event, goal) {
    const tooltip = document.getElementById('tooltip');
    tooltip.innerHTML = `
        <h3>${goal.name}</h3>
        <p>${goal.description}</p>
    `;
    
    // ツールチップの位置を設定
    const x = event.pageX + 10;
    const y = event.pageY + 10;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    tooltip.style.display = 'block';
}

// ツールチップを非表示
function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    tooltip.style.display = 'none';
}

// エラーメッセージを表示
function showError(message) {
    const container = document.getElementById('tree-container');
    container.innerHTML = `<div class="error-message">${message}</div>`;
}

// ウィンドウリサイズ時の線再描画
window.addEventListener('resize', function() {
    if (goalsData.length > 0) {
        setTimeout(drawLines, 100);
    }
});
