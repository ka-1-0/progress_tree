let goalsData = [];
let lines = [];
let currentSheet = null;
let availableSheets = ['basic', 'advanced', 'special']; // 利用可能なシート名を定義

document.addEventListener('DOMContentLoaded', function() {
    displayTabs();
});

// タブを表示する
function displayTabs() {
    const tabButtons = document.getElementById('tab-buttons');
    tabButtons.innerHTML = '';
    
    availableSheets.forEach((sheetName, index) => {
        const tabButton = document.createElement('button');
        tabButton.classList.add('tab-button');
        tabButton.textContent = sheetName;
        tabButton.setAttribute('data-sheet', sheetName);
        
        // 最初のタブをアクティブにする
        if (index === 0) {
            tabButton.classList.add('active');
            currentSheet = sheetName;
        }
        
        tabButton.addEventListener('click', function() {
            switchTab(sheetName);
        });
        
        tabButtons.appendChild(tabButton);
    });
    
    // 最初のシートのデータを読み込む
    if (currentSheet) {
        loadGoals(currentSheet);
    }
}

// タブ切り替え処理
function switchTab(sheetName) {
    if (currentSheet === sheetName) return;
    
    // 既存の線をすべて削除
    if (lines && lines.length > 0) {
        lines.forEach(line => line.remove());
        lines = [];
    }
    
    // アクティブなタブのスタイルを更新
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    const clickedButton = document.querySelector(`.tab-button[data-sheet="${sheetName}"]`);
    if (clickedButton) {
        clickedButton.classList.add('active');
    }
    
    // 現在のシートを更新
    currentSheet = sheetName;
    
    // 新しいシートのデータを読み込む
    loadGoals(sheetName);
}

// 指定したシートのデータを読み込む
function loadGoals(sheetName) {
    // 既存の線をすべて削除
    if (lines && lines.length > 0) {
        lines.forEach(line => line.remove());
        lines = [];
    }
    
    // ローディング表示
    const container = document.getElementById('tree-container');
    container.innerHTML = '<div class="loading">読み込み中...</div>';
    
    // Papa Parseを使ってCSVファイルを読み込む
    Papa.parse(`data/${sheetName}.csv`, {
        download: true,
        header: true,
        complete: function(results) {
            if (results.errors.length > 0) {
                handleError(results.errors);
                return;
            }
            
            // データを適切な形式に変換
            const goals = results.data.map(row => {
                return {
                    id: row['目標ID'],
                    parentId: row['親目標ID'],
                    name: row['目標名'],
                    description: row['説明'],
                    iconUrl: row['アイコンURL'],
                    url: row['URL'],
                    x: parseInt(row['X座標']),
                    y: parseInt(row['Y座標'])
                };
            });
            
            displayGoals(goals);
        },
        error: function(error) {
            handleError(error);
        }
    });
}

function handleError(error) {
    console.error('エラーが発生しました:', error);
    const container = document.getElementById('tree-container');
    container.innerHTML = '<div class="loading">データの読み込みに失敗しました。</div>';
}

function displayGoals(goals) {
    goalsData = goals;
    const container = document.getElementById('tree-container');
    
    container.innerHTML = '';
    
    // データが空の場合の表示
    if (goals.length === 0) {
        container.innerHTML = '<div class="loading">このシートにはデータがありません。</div>';
        return;
    }
    
    goals.forEach(goal => {
        const iconElement = document.createElement('div');
        iconElement.classList.add('goal-icon');
        iconElement.setAttribute('data-id', goal.id);
        iconElement.style.backgroundImage = `url(${goal.iconUrl})`;
        iconElement.style.left = `${goal.x}px`;
        iconElement.style.top = `${goal.y}px`;
        
        iconElement.addEventListener('mouseover', function(e) {
            showTooltip(e, goal);
        });
        
        iconElement.addEventListener('mouseout', function() {
            hideTooltip();
        });
        
        iconElement.addEventListener('click', function() {
            if (goal.url && goal.url.trim() !== '') {
                window.open(goal.url, '_blank');
            }
        });
        
        container.appendChild(iconElement);
    });
    
    setTimeout(drawLines, 100);
}

function drawLines() {
    lines.forEach(line => line.remove());
    lines = [];
    
    goalsData.forEach(goal => {
        if (goal.parentId) {
            const parentIcon = document.querySelector(`.goal-icon[data-id="${goal.parentId}"]`);
            const childIcon = document.querySelector(`.goal-icon[data-id="${goal.id}"]`);
            
            if (parentIcon && childIcon) {
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
            }
        }
    });
}

function showTooltip(event, goal) {
    const tooltip = document.getElementById('tooltip');
    tooltip.innerHTML = `
        <h3>${goal.name}</h3>
        <p>${goal.description}</p>
    `;
    
    const x = event.pageX + 10;
    const y = event.pageY + 10;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    tooltip.style.display = 'block';
}

function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    tooltip.style.display = 'none';
}

window.addEventListener('resize', function() {
    if (goalsData.length > 0) {
        setTimeout(drawLines, 100);
    }
});
