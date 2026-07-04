// 全局变量
let bookmarks = [];
let staticPages = [];
let bookmarkPage = 1;
let staticPage = 1;
const ITEMS_PER_PAGE = 6;
const LIST_ITEMS_PER_PAGE = 24;
let viewMode = 'grid';
let selectedSuggestionApi = 'Baidu'; // 用户选中的搜索联想源
let currentSuggestionsQuery = ''; // 当前联想的查询词，用于防过期
const searchEngines = {
    google: 'https://www.google.com/search?q=',
    bing: 'https://www.bing.com/search?q=',
    baidu: 'https://www.baidu.com/s?wd='
};

// DOM元素
const elements = {
    themeBtn: document.getElementById('theme-btn'),
    searchForm: document.getElementById('search-form'),
    searchInput: document.getElementById('search-input'),
    bookmarksContainer: document.getElementById('bookmarks-container'),
    staticPagesContainer: document.getElementById('static-pages-container'),
    bookmarkModal: document.getElementById('bookmark-modal'),
    modalTitle: document.getElementById('modal-title'),
    bookmarkForm: document.getElementById('bookmark-form'),
    bookmarkId: document.getElementById('bookmark-id'),
    bookmarkName: document.getElementById('bookmark-name'),
    bookmarkUrl: document.getElementById('bookmark-url'),
    bookmarkIcon: document.getElementById('bookmark-icon'),
    closeModal: document.querySelector('.close')
};

// 初始化
async function init() {
    loadBookmarks();
    await scanStaticPages();
    loadTheme();
    loadSettings();
    setupEventListeners();
    renderBookmarks();

    initDragReorder(elements.bookmarksContainer, function() { return bookmarks; }, saveBookmarks, renderBookmarks);
    initDragReorder(elements.staticPagesContainer, function() { return staticPages; }, saveStaticPages, renderStaticPages);

    elements.bookmarksContainer.classList.toggle('list-view', viewMode === 'list');
    elements.staticPagesContainer.classList.toggle('list-view', viewMode === 'list');
    var gridBtn = document.getElementById('view-grid-btn');
    var listBtn = document.getElementById('view-list-btn');
    if (gridBtn) gridBtn.classList.toggle('active', viewMode === 'grid');
    if (listBtn) listBtn.classList.toggle('active', viewMode === 'list');
}

// 加载设置
function loadSettings() {
    const savedSettings = localStorage.getItem('settings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        if (settings.backgroundImage) {
            document.body.style.backgroundImage = `url(${settings.backgroundImage})`;
            document.getElementById('bg-image').value = settings.backgroundImage;
        } else {
            const defaultBgImage = '//';
            document.body.style.backgroundImage = `url(${defaultBgImage})`;
            document.getElementById('bg-image').value = defaultBgImage;
            settings.backgroundImage = defaultBgImage;
            saveSettings(settings);
        }
        if (settings.viewMode) {
            viewMode = settings.viewMode;
        }
        if (settings.suggestionApi) {
            selectedSuggestionApi = settings.suggestionApi;
            const select = document.getElementById('suggestion-api');
            if (select) select.value = selectedSuggestionApi;
        }
    } else {
        const defaultBgImage = '//';
        document.body.style.backgroundImage = `url(${defaultBgImage})`;
        document.getElementById('bg-image').value = defaultBgImage;
        const settings = { backgroundImage: defaultBgImage };
        saveSettings(settings);
    }
}

// 保存设置
function saveSettings(settings) {
    localStorage.setItem('settings', JSON.stringify(settings));
}

// 设置视图模式
function setViewMode(mode) {
    viewMode = mode;
    var settings = JSON.parse(localStorage.getItem('settings') || '{}');
    settings.viewMode = mode;
    saveSettings(settings);

    if (!elements.bookmarksContainer || !elements.staticPagesContainer) return;

    elements.bookmarksContainer.classList.toggle('list-view', mode === 'list');
    elements.staticPagesContainer.classList.toggle('list-view', mode === 'list');

    var gridBtn = document.getElementById('view-grid-btn');
    var listBtn = document.getElementById('view-list-btn');
    if (gridBtn && listBtn) {
        gridBtn.classList.toggle('active', mode === 'grid');
        listBtn.classList.toggle('active', mode === 'list');
    }

    bookmarkPage = 1;
    staticPage = 1;
    renderBookmarks();
    renderStaticPages();
}

// 加载收藏网站
function loadBookmarks() {
    const savedBookmarks = localStorage.getItem('bookmarks');
    if (savedBookmarks) {
        bookmarks = JSON.parse(savedBookmarks);
    } else {
        // 默认收藏网站
        bookmarks = [
            { id: generateId(), name: 'Google', url: 'https://www.google.com', icon: '🌐' },
            { id: generateId(), name: 'GitHub', url: 'https://www.github.com', icon: '💻' },
            { id: generateId(), name: 'YouTube', url: 'https://www.youtube.com', icon: '🎬' }
        ];
        saveBookmarks();
    }
}

// 保存收藏网站
function saveBookmarks() {
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
}

// 扫描静态页面
async function scanStaticPages() {
    // 检查是否在本地文件系统中运行
    const isFileProtocol = window.location.protocol === 'file:';
    let staticFiles = [];
    
    if (isFileProtocol) {
        // 在本地文件系统中运行，使用硬编码的静态页面列表
        console.log('在本地文件系统中运行，使用硬编码的静态页面列表');
        staticFiles = ['static/em.html'];
    } else {
        // 在服务器中运行，从pages.json文件获取静态页面列表
        try {
            // 添加缓存控制，确保获取最新的pages.json文件
            const response = await fetch('static/pages.json?_=' + Date.now());
            if (response.ok) {
                const data = await response.json();
                staticFiles = data.pages || [];
                console.log('获取到的静态页面列表:', staticFiles);
            } else {
                console.error('获取静态页面列表失败:', response.status);
                // 使用默认页面作为 fallback
                staticFiles = ['static/sample.html'];
            }
        } catch (error) {
            console.error('获取静态页面列表失败:', error);
            // 使用默认页面作为 fallback
            staticFiles = ['static/sample.html'];
        }
    }
    
    // 从localStorage加载已有的静态页面配置
    const savedStaticPages = localStorage.getItem('staticPages');
    const savedPages = savedStaticPages ? JSON.parse(savedStaticPages) : [];
    
    // 扫描每个静态文件
    const pages = [];
    for (const filePath of staticFiles) {
        // 检查是否已存在配置
        const existingPage = savedPages.find(p => p.path === filePath);
        if (existingPage) {
            // 使用已有的配置
            pages.push(existingPage);
        } else {
            try {
                // 新文件，获取标题并创建默认配置
                const title = await getStaticPageTitle(filePath);
                pages.push({
                    id: generateId(),
                    name: title,
                    path: filePath,
                    icon: '📄',
                    iconType: 'emoji'
                });
            } catch (error) {
                console.error('处理静态页面失败:', filePath, error);
                // 即使获取标题失败，也添加到列表中
                pages.push({
                    id: generateId(),
                    name: '静态页面',
                    path: filePath,
                    icon: '📄',
                    iconType: 'emoji'
                });
            }
        }
    }
    
    console.log('最终的静态页面列表:', pages);
    staticPages = pages;
    saveStaticPages();
    renderStaticPages();
}

// 保存静态页面
function saveStaticPages() {
    localStorage.setItem('staticPages', JSON.stringify(staticPages));
}

// 从静态页面获取标题
function getStaticPageTitle(path) {
    return new Promise((resolve, reject) => {
        // 检查是否在本地文件系统中运行
        const isFileProtocol = window.location.protocol === 'file:';
        
        if (isFileProtocol) {
            // 在本地文件系统中运行，直接返回默认标题
            console.log('在本地文件系统中运行，使用默认标题');
            resolve('静态页面');
        } else {
            // 在服务器中运行，通过fetch获取页面标题
            fetch(path)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('网络响应错误');
                    }
                    return response.text();
                })
                .then(html => {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    const titleElement = doc.querySelector('title');
                    const title = titleElement ? titleElement.textContent.trim() : '静态页面';
                    resolve(title);
                })
                .catch(error => {
                    console.error('获取静态页面标题失败:', error);
                    resolve('静态页面');
                });
        }
    });
}

// 加载主题
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark');
        elements.themeBtn.textContent = '☀️';
    }
}

// 设置事件监听器
function setupEventListeners() {
    // 主题切换
    elements.themeBtn.addEventListener('click', toggleTheme);
    
    // 搜索表单提交
    elements.searchForm.addEventListener('submit', handleSearch);
    
    // 搜索输入框点击事件 - 有点击内容时触发联想，无内容时显示历史
    elements.searchInput.addEventListener('click', () => {
        if (elements.searchInput.value.trim()) {
            updateSuggestions();
        } else {
            showSearchHistory();
        }
    });
    
    // 搜索输入框输入事件 - 触发搜索联想（同时展示历史 + API）
    elements.searchInput.addEventListener('input', debounce(updateSuggestions, 300));
    
    // 点击页面其他地方隐藏历史记录和搜索联想
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container-with-history')) {
            hideSearchHistory();
            hideSuggestions();
        }
    });
    
    // 添加收藏按钮
    document.getElementById('add-bookmark-btn').addEventListener('click', openAddBookmarkModal);
    
    // 关闭模态框
    elements.closeModal.addEventListener('click', function() {
        // 检查表单是否有未保存的更改
        const name = elements.bookmarkName.value.trim();
        const url = elements.bookmarkUrl.value.trim();
        
        if (name || url) {
            if (confirm('您有未保存的更改，确定要关闭吗？')) {
                closeBookmarkModal();
            }
        } else {
            closeBookmarkModal();
        }
    });
    
    // 阻止模态框内容的事件冒泡，防止选中文字时关闭模态框
    document.querySelector('.modal-content').addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });
    
    document.querySelector('.modal-content').addEventListener('mouseup', (e) => {
        e.stopPropagation();
    });
    
    // 收藏表单提交
    elements.bookmarkForm.addEventListener('submit', handleBookmarkSubmit);
    
    // 图标选择器
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('icon-option')) {
            const icon = e.target.getAttribute('data-icon');
            document.getElementById('bookmark-icon').value = icon;
        }
    });
    
    // 图标类型切换
    document.getElementById('icon-type').addEventListener('change', function() {
        const iconType = this.value;
        if (iconType === 'emoji') {
            document.getElementById('emoji-icon-group').style.display = 'block';
            document.getElementById('url-icon-group').style.display = 'none';
        } else {
            document.getElementById('emoji-icon-group').style.display = 'none';
            document.getElementById('url-icon-group').style.display = 'block';
            // 切换到URL图标时，尝试自动获取favicon
            autoGetFavicon();
        }
    });
    
    // URL输入框变化时尝试自动获取favicon
    document.getElementById('bookmark-url').addEventListener('blur', autoGetFavicon);
    
    // 自动获取favicon函数
    function autoGetFavicon() {
        const url = document.getElementById('bookmark-url').value.trim();
        const iconType = document.getElementById('icon-type').value;
        const iconUrlInput = document.getElementById('bookmark-icon-url');
        
        // 只有当URL不为空且图标类型为URL且图标输入框为空时才尝试获取
        if (url && iconType === 'url' && !iconUrlInput.value.trim()) {
            getFaviconUrl(url).then(function(faviconUrl) {
                // 再次检查输入框是否仍为空，防止覆盖用户手动输入的URL
                if (faviconUrl && !iconUrlInput.value.trim()) {
                    iconUrlInput.value = faviconUrl;
                }
            }).catch(function() {
                // 获取失败，保持输入框为空
            });
        }
    }
    
    // 静态页面模态框关闭
    const staticPageModalClose = document.querySelector('#static-page-modal .close');
    if (staticPageModalClose) {
        staticPageModalClose.addEventListener('click', function() {
            // 检查表单是否有未保存的更改
            const name = document.getElementById('static-page-name').value.trim();
            
            if (name) {
                if (confirm('您有未保存的更改，确定要关闭吗？')) {
                    closeStaticPageModal();
                }
            } else {
                closeStaticPageModal();
            }
        });
    }
    
    // 阻止静态页面模态框内容的事件冒泡，防止选中文字时关闭模态框
    document.querySelector('#static-page-modal .modal-content').addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });
    
    document.querySelector('#static-page-modal .modal-content').addEventListener('mouseup', (e) => {
        e.stopPropagation();
    });
    
    // 静态页面表单提交
    document.getElementById('static-page-form').addEventListener('submit', handleStaticPageSubmit);
    
    // 静态页面图标选择器
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('icon-option')) {
            // 检查是否在静态页面模态框内
            if (e.target.closest('#static-page-modal')) {
                const icon = e.target.getAttribute('data-icon');
                document.getElementById('static-page-icon').value = icon;
            }
        }
    });
    
    // 静态页面图标类型切换
    document.getElementById('static-icon-type').addEventListener('change', function() {
        const iconType = this.value;
        if (iconType === 'emoji') {
            document.getElementById('static-emoji-icon-group').style.display = 'block';
            document.getElementById('static-url-icon-group').style.display = 'none';
        } else {
            document.getElementById('static-emoji-icon-group').style.display = 'none';
            document.getElementById('static-url-icon-group').style.display = 'block';
        }
    });
    
    // 设置按钮
    document.getElementById('settings-btn').addEventListener('click', function() {
        document.getElementById('settings-panel').classList.add('open');
        document.getElementById('overlay').classList.add('show');
    });
    
    // 关闭设置面板
    document.getElementById('close-settings-btn').addEventListener('click', function() {
        document.getElementById('settings-panel').classList.remove('open');
        document.getElementById('overlay').classList.remove('show');
    });
    
    // 点击遮罩关闭设置面板
    document.getElementById('overlay').addEventListener('click', function() {
        document.getElementById('settings-panel').classList.remove('open');
        document.getElementById('overlay').classList.remove('show');
    });
    
    // 搜索联想源切换
    document.getElementById('suggestion-api').addEventListener('change', function() {
        selectedSuggestionApi = this.value;
        var settings = JSON.parse(localStorage.getItem('settings') || '{}');
        settings.suggestionApi = selectedSuggestionApi;
        saveSettings(settings);
    });
    
    // 处理本地图片选择
    document.getElementById('bg-image-file').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const imageUrl = e.target.result;
                document.body.style.backgroundImage = `url(${imageUrl})`;
                document.getElementById('bg-image').value = imageUrl;
                const settings = JSON.parse(localStorage.getItem('settings') || '{}');
                settings.backgroundImage = imageUrl;
                saveSettings(settings);
            };
            reader.readAsDataURL(file);
        }
    });
    
    // 应用背景图片
    document.getElementById('apply-bg-btn').addEventListener('click', function() {
        const bgImage = document.getElementById('bg-image').value.trim();
        if (bgImage) {
            document.body.style.backgroundImage = `url(${bgImage})`;
            const settings = JSON.parse(localStorage.getItem('settings') || '{}');
            settings.backgroundImage = bgImage;
            saveSettings(settings);
        }
    });

    // 视图模式切换
    document.getElementById('view-grid-btn').addEventListener('click', function() {
        setViewMode('grid');
    });
    document.getElementById('view-list-btn').addEventListener('click', function() {
        setViewMode('list');
    });

    // 导出数据
    document.getElementById('export-data-btn').addEventListener('click', exportData);

    // 导入数据 - 点击触发文件选择
    document.getElementById('import-data-btn').addEventListener('click', function() {
        document.getElementById('import-file-input').click();
    });

    // 文件选择后执行导入
    document.getElementById('import-file-input').addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (file) {
            importData(file);
        }
        // 重置 input 以便重复选择同一文件
        this.value = '';
    });

}

// 打开编辑静态页面模态框
function openEditStaticPageModal(page) {
    document.getElementById('static-page-modal-title').textContent = '编辑静态页面';
    document.getElementById('static-page-id').value = page.id;
    document.getElementById('static-page-path').value = page.path;
    document.getElementById('static-page-name').value = page.name;
    
    // 设置图标类型
    const iconType = page.iconType || 'emoji';
    document.getElementById('static-icon-type').value = iconType;
    
    // 显示对应的图标输入框
    if (iconType === 'emoji') {
        document.getElementById('static-emoji-icon-group').style.display = 'block';
        document.getElementById('static-url-icon-group').style.display = 'none';
        document.getElementById('static-page-icon').value = page.icon || '';
    } else {
        document.getElementById('static-emoji-icon-group').style.display = 'none';
        document.getElementById('static-url-icon-group').style.display = 'block';
        document.getElementById('static-page-icon-url').value = page.icon || '';
    }
    
    const staticPageModal = document.getElementById('static-page-modal');
    staticPageModal.style.display = 'block';
    staticPageModal.classList.add('show');
}

// 关闭静态页面模态框
function closeStaticPageModal() {
    const staticPageModal = document.getElementById('static-page-modal');
    staticPageModal.style.display = 'none';
    staticPageModal.classList.remove('show');
}

// 处理静态页面表单提交
function handleStaticPageSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('static-page-id').value;
    const path = document.getElementById('static-page-path').value.trim();
    const name = document.getElementById('static-page-name').value.trim();
    const iconType = document.getElementById('static-icon-type').value;
    let icon;
    
    if (iconType === 'emoji') {
        icon = document.getElementById('static-page-icon').value.trim() || '📄';
    } else {
        icon = document.getElementById('static-page-icon-url').value.trim() || '';
    }
    
    // 编辑现有静态页面
    const index = staticPages.findIndex(p => p.id === id);
    if (index !== -1) {
        staticPages[index] = { id, name, path, icon, iconType };
        saveStaticPages();
        renderStaticPages();
        closeStaticPageModal();
    }
}



// 切换主题
function toggleTheme() {
    const isDark = document.body.classList.toggle('dark');
    elements.themeBtn.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// 保存搜索历史
function saveSearchHistory(query) {
    if (!query) return;
    
    let history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    
    // 移除重复项
    history = history.filter(item => item !== query);
    
    // 添加到开头
    history.unshift(query);
    
    // 限制最多5条
    history = history.slice(0, 5);
    
    localStorage.setItem('searchHistory', JSON.stringify(history));
}

// 显示搜索历史
function showSearchHistory() {
    const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    const historyContainer = document.getElementById('search-history');
    
    historyContainer.innerHTML = '';
    
    if (history.length > 0) {
        history.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'search-history-item';
            historyItem.textContent = item;
            historyItem.addEventListener('click', () => {
                elements.searchInput.value = item;
                hideSearchHistory();
                // 触发搜索
                elements.searchForm.dispatchEvent(new Event('submit'));
            });
            historyContainer.appendChild(historyItem);
        });
        historyContainer.style.display = 'block';
    } else {
        historyContainer.style.display = 'none';
    }
}

// 隐藏搜索历史
function hideSearchHistory() {
    document.getElementById('search-history').style.display = 'none';
}

// ===== 搜索联想功能 =====

// 防抖工具函数
function debounce(fn, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// 转义正则特殊字符
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 从历史记录中模糊匹配搜索联想
function getHistorySuggestions(query) {
    const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    const lowerQuery = query.toLowerCase();
    return history.filter(item => item.toLowerCase().includes(lowerQuery));
}

// 更新搜索联想（点击和输入都调用此函数）
function updateSuggestions() {
    const query = elements.searchInput.value.trim();
    currentSuggestionsQuery = query;

    if (query) {
        hideSearchHistory();

        const container = document.getElementById('search-suggestions');
        container.innerHTML = '';

        const escapedQuery = escapeRegex(query);
        const regex = new RegExp('(' + escapedQuery + ')', 'gi');

        // 收集所有本地匹配项
        const localItems = [];

        // 1. 历史记录匹配
        getHistorySuggestions(query).forEach(item => {
            localItems.push({ display: item, source: 'history' });
        });

        // 2. 收藏网站匹配
        bookmarks.forEach(bm => {
            if (bm.name.toLowerCase().includes(query.toLowerCase())) {
                localItems.push({
                    display: bm.name,
                    source: 'bookmark',
                    onClick: function() {
                        hideSuggestions();
                        hideSearchHistory();
                        window.open(bm.url, '_blank');
                    }
                });
            }
        });

        // 3. 工具页面匹配
        staticPages.forEach(page => {
            if (page.name.toLowerCase().includes(query.toLowerCase())) {
                localItems.push({
                    display: page.name,
                    source: 'page',
                    onClick: function() {
                        hideSuggestions();
                        hideSearchHistory();
                        window.open(page.path, '_blank');
                    }
                });
            }
        });

        // 渲染本地匹配项
        if (localItems.length > 0) {
            localItems.slice(0, 12).forEach(item => {
                container.appendChild(
                    createSuggestionElement(item.display, query, regex, item.source, item.onClick)
                );
            });
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
        }

        // 始终请求 API 联想（有本地项时追加在后面，无时直接填充）
        fetchAndShowSuggestions(query, localItems.length > 0);
    } else {
        hideSuggestions();
        showSearchHistory();
    }
}

// 搜索联想 API 列表（按优先级依次尝试）
const suggestionAPIs = [
    {
        name: 'Baidu',
        buildUrl: (query, cb) => 'https://suggestion.baidu.com/su?wd=' + encodeURIComponent(query) + '&cb=' + cb,
        extract: (data) => data.s || []
    },
    {
        name: 'Bing',
        buildUrl: (query, cb) => 'https://api.bing.com/qsonhs.aspx?type=cb&q=' + encodeURIComponent(query) + '&cb=' + cb,
        extract: (data) => {
            try {
                const results = data?.AS?.Results || [];
                const suggests = [];
                for (const r of results) {
                    if (r?.Suggests) {
                        for (const s of r.Suggests) {
                            if (s?.Txt) suggests.push(s.Txt);
                        }
                    }
                }
                return suggests;
            } catch { return []; }
        }
    },
    {
        name: '360',
        buildUrl: (query, cb) => 'https://sug.so.360.cn/suggest?word=' + encodeURIComponent(query) + '&callback=' + cb,
        extract: (data) => {
            try { return data?.result?.map(r => r.word) || []; }
            catch { return []; }
        }
    }
];

// 通过 JSONP 获取搜索联想建议（支持备用 API）
function fetchAndShowSuggestions(query, append, apiIndex) {
    if (apiIndex === undefined) {
        // 从用户选中的联想源开始尝试
        apiIndex = suggestionAPIs.findIndex(api => api.name === selectedSuggestionApi);
        if (apiIndex === -1) apiIndex = 0;
    }
    if (apiIndex >= suggestionAPIs.length) return;

    // 清理旧请求
    const oldScript = document.getElementById('suggestion-jsonp');
    if (oldScript) oldScript.remove();

    const api = suggestionAPIs[apiIndex];
    let responded = false;

    window.suggestionCallback = function(data) {
        if (responded) return;
        responded = true;
        const suggestions = api.extract(data);
        if (suggestions.length > 0) {
            if (append) {
                appendApiSuggestions(suggestions, query);
            } else {
                renderSuggestions(suggestions, query);
            }
        } else {
            // 当前 API 无结果，尝试下一个
            fetchAndShowSuggestions(query, append, apiIndex + 1);
        }
    };

    const script = document.createElement('script');
    script.id = 'suggestion-jsonp';
    script.src = api.buildUrl(query, 'suggestionCallback');
    document.body.appendChild(script);

    // 超时则尝试下一个 API
    setTimeout(() => {
        if (!responded) {
            responded = true;
            fetchAndShowSuggestions(query, append, apiIndex + 1);
        }
    }, 3000);
}

// 创建单个搜索联想项
function createSuggestionElement(itemDisplay, query, regex, source, onClick) {
    const div = document.createElement('div');
    div.className = 'search-suggestion-item';

    const textSpan = document.createElement('span');
    textSpan.innerHTML = itemDisplay.replace(regex, '<mark>$1</mark>');
    div.appendChild(textSpan);

    const sourceTag = document.createElement('span');
    sourceTag.className = 'suggestion-source';
    sourceTag.textContent =
        source === 'history' ? '来自历史' :
        source === 'bookmark' ? '来自收藏' :
        source === 'page' ? '来自工具' :
        '来自互联网';
    div.appendChild(sourceTag);

    div.addEventListener('click', onClick || function() {
        elements.searchInput.value = typeof itemDisplay === 'string' ? itemDisplay : '';
        hideSuggestions();
        hideSearchHistory();
        elements.searchForm.dispatchEvent(new Event('submit'));
    });
    return div;
}

// 在现有建议后追加 API 联想结果
function appendApiSuggestions(suggestions, query) {
    if (query !== currentSuggestionsQuery) return; // 查询已过期，丢弃

    const container = document.getElementById('search-suggestions');
    const escapedQuery = escapeRegex(query);
    const regex = new RegExp('(' + escapedQuery + ')', 'gi');

    suggestions.slice(0, 8).forEach(item => {
        container.appendChild(createSuggestionElement(item, query, regex, 'api'));
    });

    container.style.display = 'block';
}

// 渲染搜索联想建议（直接填充）
function renderSuggestions(suggestions, query) {
    const container = document.getElementById('search-suggestions');
    container.innerHTML = '';

    if (suggestions.length > 0) {
        const escapedQuery = escapeRegex(query);
        const regex = new RegExp('(' + escapedQuery + ')', 'gi');

        suggestions.slice(0, 8).forEach(item => {
            container.appendChild(createSuggestionElement(item, query, regex, 'api'));
        });

        container.style.display = 'block';
    } else {
        container.style.display = 'none';
    }
}

// 隐藏搜索联想建议
function hideSuggestions() {
    const container = document.getElementById('search-suggestions');
    container.style.display = 'none';
    container.innerHTML = '';
    // 清理 JSONP 脚本和回调
    const script = document.getElementById('suggestion-jsonp');
    if (script) script.remove();
    window.suggestionCallback = null;
}

// 处理搜索
function handleSearch(e) {
    e.preventDefault();
    const query = elements.searchInput.value.trim();
    const engine = 'bing'; // 固定使用bing搜索引擎
    
    if (query) {
        const searchUrl = searchEngines[engine] + encodeURIComponent(query);
        window.open(searchUrl, '_blank');
        saveSearchHistory(query);
        elements.searchInput.value = '';
        hideSearchHistory();
        hideSuggestions();
    }
}

// 打开添加收藏模态框
function openAddBookmarkModal() {
    elements.modalTitle.textContent = '添加收藏';
    elements.bookmarkId.value = '';
    elements.bookmarkName.value = '';
    elements.bookmarkUrl.value = '';
    
    // 重置图标类型和输入框
    document.getElementById('icon-type').value = 'emoji';
    document.getElementById('emoji-icon-group').style.display = 'block';
    document.getElementById('url-icon-group').style.display = 'none';
    elements.bookmarkIcon.value = '';
    document.getElementById('bookmark-icon-url').value = '';
    
    elements.bookmarkModal.style.display = 'block';
    elements.bookmarkModal.classList.add('show');
}

// 打开编辑收藏模态框
function openEditBookmarkModal(bookmark) {
    elements.modalTitle.textContent = '编辑收藏';
    elements.bookmarkId.value = bookmark.id;
    elements.bookmarkName.value = bookmark.name;
    elements.bookmarkUrl.value = bookmark.url;
    
    // 设置图标类型
    const iconType = bookmark.iconType || 'emoji';
    document.getElementById('icon-type').value = iconType;
    
    // 显示对应的图标输入框
    if (iconType === 'emoji') {
        document.getElementById('emoji-icon-group').style.display = 'block';
        document.getElementById('url-icon-group').style.display = 'none';
        elements.bookmarkIcon.value = bookmark.icon || '';
    } else {
        document.getElementById('emoji-icon-group').style.display = 'none';
        document.getElementById('url-icon-group').style.display = 'block';
        document.getElementById('bookmark-icon-url').value = bookmark.icon || '';
    }
    
    elements.bookmarkModal.style.display = 'block';
    elements.bookmarkModal.classList.add('show');
}

// 关闭收藏模态框
function closeBookmarkModal() {
    elements.bookmarkModal.style.display = 'none';
    elements.bookmarkModal.classList.remove('show');
}

// 处理收藏表单提交
function handleBookmarkSubmit(e) {
    e.preventDefault();
    
    const id = elements.bookmarkId.value;
    const name = elements.bookmarkName.value.trim();
    let url = elements.bookmarkUrl.value.trim();
    const iconType = document.getElementById('icon-type').value;
    let icon;
    
    // 自动添加协议
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    
    if (iconType === 'emoji') {
        icon = elements.bookmarkIcon.value.trim() || '🌐';
    } else {
        icon = document.getElementById('bookmark-icon-url').value.trim() || '';
    }
    
    // 尝试自动获取favicon
    if (!icon) {
        getFaviconUrl(url).then(function(faviconUrl) {
            if (faviconUrl && iconType === 'url') {
                document.getElementById('bookmark-icon-url').value = faviconUrl;
                // 更新已保存的bookmark图标
                const targetId = id || (bookmarks.length > 0 ? bookmarks[bookmarks.length - 1].id : null);
                if (targetId) {
                    const bookmark = bookmarks.find(b => b.id === targetId);
                    if (bookmark) {
                        bookmark.icon = faviconUrl;
                        saveBookmarks();
                        renderBookmarks();
                    }
                }
            }
        }).catch(function() {
            // 获取失败，保持默认图标
        });
    }
    
    if (id) {
        // 编辑现有收藏
        const index = bookmarks.findIndex(b => b.id === id);
        if (index !== -1) {
            bookmarks[index] = { id, name, url, icon, iconType };
        }
    } else {
        // 添加新收藏
        const newBookmark = {
            id: generateId(),
            name,
            url,
            icon,
            iconType
        };
        bookmarks.push(newBookmark);
        bookmarkPage = 1;
    }
    
    saveBookmarks();
    renderBookmarks();
    closeBookmarkModal();
}

// 删除收藏
function deleteBookmark(id) {
    const confirmed = confirm('确定要删除这个收藏吗？');
    if (confirmed) {
        bookmarks = bookmarks.filter(b => b.id !== id);
        saveBookmarks();
        renderBookmarks();
    }
}

// 渲染收藏网站
function renderBookmarks() {
    elements.bookmarksContainer.innerHTML = '';

    var itemsPerPage = viewMode === 'list' ? LIST_ITEMS_PER_PAGE - 1 : ITEMS_PER_PAGE - 1;
    var totalPages = Math.max(1, Math.ceil(bookmarks.length / itemsPerPage));
    if (bookmarkPage > totalPages) bookmarkPage = totalPages;

    var startIndex = (bookmarkPage - 1) * itemsPerPage;
    var endIndex = Math.min(startIndex + itemsPerPage, bookmarks.length);
    var pageItems = bookmarks.slice(startIndex, endIndex);

    pageItems.forEach(function(bookmark) {
        var bookmarkItem = document.createElement('div');
        bookmarkItem.className = 'bookmark-item';
        bookmarkItem.setAttribute('data-id', bookmark.id);

        var actionsDiv = document.createElement('div');
        actionsDiv.className = 'bookmark-actions';

        var editBtn = document.createElement('button');
        editBtn.textContent = '编辑';
        editBtn.addEventListener('click', function() { openEditBookmarkModal(bookmark); });

        var deleteBtn = document.createElement('button');
        deleteBtn.textContent = '删除';
        deleteBtn.addEventListener('click', function() { deleteBookmark(bookmark.id); });

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);

        var link = document.createElement('a');
        link.href = bookmark.url;
        link.target = '_blank';

        var iconDiv = document.createElement('div');
        iconDiv.className = 'bookmark-icon';

        if (bookmark.iconType === 'url' && bookmark.icon) {
            var img = document.createElement('img');
            img.src = bookmark.icon;
            img.alt = bookmark.name;
            img.onerror = function() {
                iconDiv.textContent = '🌐';
            };
            iconDiv.appendChild(img);
        } else {
            iconDiv.textContent = bookmark.icon || '🌐';
        }

        var nameDiv = document.createElement('div');
        nameDiv.className = 'bookmark-name';
        nameDiv.textContent = bookmark.name;

        link.appendChild(iconDiv);
        link.appendChild(nameDiv);

        bookmarkItem.appendChild(actionsDiv);
        bookmarkItem.appendChild(link);

        elements.bookmarksContainer.appendChild(bookmarkItem);
    });

    var addBookmarkBtn = document.createElement('div');
    addBookmarkBtn.id = 'add-bookmark-btn';
    addBookmarkBtn.className = 'bookmark-item add-bookmark';

    var dummyActions = document.createElement('div');
    dummyActions.className = 'bookmark-actions';

    var addLink = document.createElement('a');
    addLink.href = 'javascript:void(0)';

    var addIconDiv = document.createElement('div');
    addIconDiv.className = 'bookmark-icon';
    addIconDiv.textContent = '+';

    var addNameDiv = document.createElement('div');
    addNameDiv.className = 'bookmark-name';
    addNameDiv.textContent = '添加';

    addLink.appendChild(addIconDiv);
    addLink.appendChild(addNameDiv);

    addBookmarkBtn.appendChild(dummyActions);
    addBookmarkBtn.appendChild(addLink);
    addBookmarkBtn.addEventListener('click', openAddBookmarkModal);

    elements.bookmarksContainer.appendChild(addBookmarkBtn);

    // 翻页导航
    var existingPagination = document.querySelector('.bookmarks-section > .pagination');
    if (existingPagination) existingPagination.remove();
    var existingDots = document.querySelector('.bookmarks-section > .page-dots');
    if (existingDots) existingDots.remove();

    if (totalPages > 1) {
        var section = elements.bookmarksContainer.closest('.bookmarks-section') || elements.bookmarksContainer.parentElement;

        var pagination = document.createElement('div');
        pagination.className = 'pagination';

        var prevBtn = document.createElement('button');
        prevBtn.className = 'page-btn prev';
        prevBtn.innerHTML = '‹';
        prevBtn.disabled = bookmarkPage <= 1;
        prevBtn.addEventListener('click', function() {
            if (bookmarkPage > 1) {
                bookmarkPage--;
                renderBookmarks();
            }
        });

        var nextBtn = document.createElement('button');
        nextBtn.className = 'page-btn next';
        nextBtn.innerHTML = '›';
        nextBtn.disabled = bookmarkPage >= totalPages;
        nextBtn.addEventListener('click', function() {
            if (bookmarkPage < totalPages) {
                bookmarkPage++;
                renderBookmarks();
            }
        });

        pagination.appendChild(prevBtn);
        pagination.appendChild(nextBtn);
        section.appendChild(pagination);

        var dots = document.createElement('div');
        dots.className = 'page-dots';
        for (var i = 1; i <= totalPages; i++) {
            var dot = document.createElement('span');
            dot.className = 'page-dot';
            if (i === bookmarkPage) dot.classList.add('active');
            dot.addEventListener('click', function() {
                bookmarkPage = Array.from(dots.children).indexOf(this) + 1;
                renderBookmarks();
            });
            dots.appendChild(dot);
        }
        section.appendChild(dots);
    }
}

function renderStaticPages() {
    elements.staticPagesContainer.innerHTML = '';

    if (staticPages.length === 0) {
        elements.staticPagesContainer.innerHTML = '<p class="empty-message">暂无静态页面</p>';
        return;
    }

    var totalPages = Math.max(1, Math.ceil(staticPages.length / (viewMode === 'list' ? LIST_ITEMS_PER_PAGE : ITEMS_PER_PAGE)));
    if (staticPage > totalPages) staticPage = totalPages;

    var pageSize = viewMode === 'list' ? LIST_ITEMS_PER_PAGE : ITEMS_PER_PAGE;
    var startIndex = (staticPage - 1) * pageSize;
    var endIndex = Math.min(startIndex + pageSize, staticPages.length);
    var pageItems = staticPages.slice(startIndex, endIndex);

    pageItems.forEach(function(page) {
        var pageItem = document.createElement('div');
        pageItem.className = 'static-page-item';
        pageItem.setAttribute('data-id', page.id);

        var actionsDiv = document.createElement('div');
        actionsDiv.className = 'bookmark-actions';

        var editBtn = document.createElement('button');
        editBtn.textContent = '编辑';
        editBtn.addEventListener('click', function() { openEditStaticPageModal(page); });

        actionsDiv.appendChild(editBtn);

        var link = document.createElement('a');
        link.href = page.path;
        link.target = '_blank';

        var iconDiv = document.createElement('div');
        iconDiv.className = 'static-page-icon';

        if (page.iconType === 'url' && page.icon) {
            var img = document.createElement('img');
            img.src = page.icon;
            img.alt = page.name;
            img.onerror = function() {
                iconDiv.textContent = '📄';
            };
            iconDiv.appendChild(img);
        } else {
            iconDiv.textContent = page.icon || '📄';
        }

        var nameDiv = document.createElement('div');
        nameDiv.className = 'static-page-name';
        nameDiv.textContent = page.name;

        link.appendChild(iconDiv);
        link.appendChild(nameDiv);

        pageItem.appendChild(actionsDiv);
        pageItem.appendChild(link);

        elements.staticPagesContainer.appendChild(pageItem);
    });

    // 翻页导航
    var existingPagination = document.querySelector('.static-pages-section > .pagination');
    if (existingPagination) existingPagination.remove();
    var existingDots = document.querySelector('.static-pages-section > .page-dots');
    if (existingDots) existingDots.remove();

    if (totalPages > 1) {
        var section = elements.staticPagesContainer.closest('.static-pages-section') || elements.staticPagesContainer.parentElement;

        var pagination = document.createElement('div');
        pagination.className = 'pagination';

        var prevBtn = document.createElement('button');
        prevBtn.className = 'page-btn prev';
        prevBtn.innerHTML = '‹';
        prevBtn.disabled = staticPage <= 1;
        prevBtn.addEventListener('click', function() {
            if (staticPage > 1) {
                staticPage--;
                renderStaticPages();
            }
        });

        var nextBtn = document.createElement('button');
        nextBtn.className = 'page-btn next';
        nextBtn.innerHTML = '›';
        nextBtn.disabled = staticPage >= totalPages;
        nextBtn.addEventListener('click', function() {
            if (staticPage < totalPages) {
                staticPage++;
                renderStaticPages();
            }
        });

        pagination.appendChild(prevBtn);
        pagination.appendChild(nextBtn);
        section.appendChild(pagination);

        var dots = document.createElement('div');
        dots.className = 'page-dots';
        for (var i = 1; i <= totalPages; i++) {
            var dot = document.createElement('span');
            dot.className = 'page-dot';
            if (i === staticPage) dot.classList.add('active');
            dot.addEventListener('click', function() {
                staticPage = Array.from(dots.children).indexOf(this) + 1;
                renderStaticPages();
            });
            dots.appendChild(dot);
        }
        section.appendChild(dots);
    }
}

// 从网页URL自动获取favicon（支持多种常见路径）
function getFaviconUrl(websiteUrl) {
    return new Promise(function(resolve) {
        var fullUrl = websiteUrl;
        if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
            fullUrl = 'https://' + fullUrl;
        }

        var domain;
        try {
            domain = new URL(fullUrl).origin;
        } catch (e) {
            resolve(null);
            return;
        }

        var paths = [
            domain + '/favicon.ico',
            domain + '/favicon.png',
            domain + '/favicon.svg',
            domain + '/favicon-32x32.png',
            domain + '/favicon-16x16.png',
            domain + '/apple-touch-icon.png',
            domain + '/apple-touch-icon-precomposed.png',
            domain + '/favicon-96x96.png',
            domain + '/favicon-192x192.png',
            domain + '/favicon-48x48.png',
            domain + '/favicon-64x64.png',
            domain + '/favicon-128x128.png'
        ];

        testPaths(paths, 0);

        function testPaths(paths, index) {
            if (index >= paths.length) {
                resolve(null);
                return;
            }

            var img = new Image();
            var currentUrl = paths[index];

            var timeout = setTimeout(function() {
                img.src = '';
                testPaths(paths, index + 1);
            }, 5000);

            img.onload = function() {
                clearTimeout(timeout);
                if (img.naturalWidth > 1 && img.naturalHeight > 1) {
                    resolve(currentUrl);
                } else {
                    testPaths(paths, index + 1);
                }
            };

            img.onerror = function() {
                clearTimeout(timeout);
                testPaths(paths, index + 1);
            };

            img.src = currentUrl;
        }
    });
}

// 长按拖拽排序引擎
var dragState = {
    sourceArray: null,
    sourceId: null,
    targetId: null,
    saveFn: null,
    renderFn: null,
    timer: null,
    ready: false
};

function initDragReorder(container, getArray, saveFn, renderFn) {
    var itemsSelector = '.bookmark-item:not(.add-bookmark), .static-page-item';

    function getItem(e) {
        return e.target.closest(itemsSelector);
    }

    function findInArray(id) {
        var arr = getArray();
        for (var i = 0; i < arr.length; i++) {
            if (arr[i].id === id) return { item: arr[i], index: i };
        }
        return null;
    }

    container.addEventListener('mousedown', function(e) {
        var item = getItem(e);
        if (!item) return;
        if (e.target.closest('.bookmark-actions')) return;

        dragState.timer = setTimeout(function() {
            dragState.ready = true;
            item.setAttribute('draggable', 'true');
            item.classList.add('drag-ready');
        }, 400);
    });

    document.addEventListener('mouseup', function() {
        clearTimeout(dragState.timer);
        if (dragState.ready) {
            document.querySelectorAll('.drag-ready').forEach(function(el) {
                el.removeAttribute('draggable');
                el.classList.remove('drag-ready');
            });
            dragState.ready = false;
        }
    });

    container.addEventListener('mouseleave', function() {
        clearTimeout(dragState.timer);
    });

    container.addEventListener('dragstart', function(e) {
        var item = getItem(e);
        if (!item) return;
        if (!dragState.ready) {
            e.preventDefault();
            return;
        }

        dragState.sourceId = item.getAttribute('data-id');
        dragState.saveFn = saveFn;
        dragState.renderFn = renderFn;

        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', dragState.sourceId);
    });

    container.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });

    container.addEventListener('dragenter', function(e) {
        e.preventDefault();
        var item = getItem(e);
        if (!item || item.classList.contains('dragging')) return;
        item.classList.add('drag-over');
    });

    container.addEventListener('dragleave', function(e) {
        var item = getItem(e);
        if (!item) return;
        var related = e.relatedTarget;
        if (related && item.contains(related)) return;
        item.classList.remove('drag-over');
    });

    container.addEventListener('drop', function(e) {
        e.preventDefault();
        var target = getItem(e);
        if (!target || !dragState.sourceId) return;

        var targetId = target.getAttribute('data-id');
        if (targetId === dragState.sourceId) return;

        var arr = getArray();
        var sourceResult = findInArray(dragState.sourceId);
        var targetResult = findInArray(targetId);
        if (!sourceResult || !targetResult) return;

        var movedItem = arr.splice(sourceResult.index, 1)[0];
        arr.splice(targetResult.index, 0, movedItem);

        saveFn();
        renderFn();
    });

    container.addEventListener('dragend', function() {
        document.querySelectorAll('.dragging, .drag-over, .drag-ready').forEach(function(el) {
            el.removeAttribute('draggable');
            el.classList.remove('dragging', 'drag-over', 'drag-ready');
        });
        dragState.sourceId = null;
        dragState.ready = false;
    });

    // Touch support for mobile
    var touchState = { active: false, clone: null, offsetX: 0, offsetY: 0, sourceId: null, longPressTimer: null };

    container.addEventListener('touchstart', function(e) {
        var item = getItem(e);
        if (!item) return;
        if (e.target.closest('.bookmark-actions')) return;

        var touch = e.touches[0];
        touchState.longPressTimer = setTimeout(function() {
            var rect = item.getBoundingClientRect();
            touchState.offsetX = touch.clientX - rect.left;
            touchState.offsetY = touch.clientY - rect.top;
            touchState.sourceId = item.getAttribute('data-id');
            touchState.active = true;

            var clone = item.cloneNode(true);
            clone.className = item.className + ' touch-clone';
            clone.style.position = 'fixed';
            clone.style.width = rect.width + 'px';
            clone.style.height = rect.height + 'px';
            clone.style.left = (touch.clientX - touchState.offsetX) + 'px';
            clone.style.top = (touch.clientY - touchState.offsetY) + 'px';
            clone.style.pointerEvents = 'none';
            clone.style.zIndex = '9999';
            clone.style.transform = 'scale(1.08) rotate(2deg)';
            clone.style.opacity = '0.92';
            clone.style.boxShadow = '0 12px 40px rgba(0,0,0,0.2)';
            document.body.appendChild(clone);
            touchState.clone = clone;

            item.classList.add('dragging');
            item.style.opacity = '0.3';
        }, 400);

        item.setAttribute('data-touch-x', touch.clientX);
        item.setAttribute('data-touch-y', touch.clientY);
    }, { passive: true });

    container.addEventListener('touchmove', function(e) {
        if (!touchState.active) {
            clearTimeout(touchState.longPressTimer);
            return;
        }
        e.preventDefault();

        var touch = e.touches[0];
        if (touchState.clone) {
            touchState.clone.style.left = (touch.clientX - touchState.offsetX) + 'px';
            touchState.clone.style.top = (touch.clientY - touchState.offsetY) + 'px';
        }

        var target = document.elementFromPoint(touch.clientX, touch.clientY);
        if (target) {
            var dropItem = target.closest(itemsSelector);
            document.querySelectorAll('.drag-over').forEach(function(el) { el.classList.remove('drag-over'); });
            if (dropItem && !dropItem.classList.contains('dragging')) {
                dropItem.classList.add('drag-over');
            }
        }
    }, { passive: false });

    container.addEventListener('touchend', function(e) {
        clearTimeout(touchState.longPressTimer);
        if (!touchState.active) return;

        if (touchState.clone) {
            touchState.clone.remove();
            touchState.clone = null;
        }

        document.querySelectorAll('.dragging, .drag-over').forEach(function(el) {
            el.style.opacity = '';
            el.classList.remove('dragging', 'drag-over');
        });

        var touch = e.changedTouches[0];
        if (touch) {
            var target = document.elementFromPoint(touch.clientX, touch.clientY);
            if (target) {
                var dropItem = target.closest(itemsSelector);
                if (dropItem && touchState.sourceId) {
                    var targetId = dropItem.getAttribute('data-id');
                    if (targetId && targetId !== touchState.sourceId) {
                        var arr = getArray();
                        function findInArr(id) {
                            for (var i = 0; i < arr.length; i++) {
                                if (arr[i].id === id) return { index: i };
                            }
                            return null;
                        }
                        var s = findInArr(touchState.sourceId);
                        var t = findInArr(targetId);
                        if (s && t) {
                            var moved = arr.splice(s.index, 1)[0];
                            arr.splice(t.index, 0, moved);
                            saveFn();
                            renderFn();
                        }
                    }
                }
            }
        }

        touchState.active = false;
        touchState.sourceId = null;
    }, { passive: true });
}

// 导出所有用户数据
function exportData() {
    const data = {
        version: 1,
        exportDate: new Date().toISOString(),
        bookmarks: bookmarks,
        staticPages: staticPages,
        settings: JSON.parse(localStorage.getItem('settings') || '{}'),
        theme: localStorage.getItem('theme') || 'light',
        searchHistory: JSON.parse(localStorage.getItem('searchHistory') || '[]')
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `nook-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 导入用户数据
function importData(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);

            // 验证数据格式
            if (!data || typeof data !== 'object') {
                alert('导入失败：无效的数据文件格式。');
                return;
            }

            // 恢复收藏网站
            if (Array.isArray(data.bookmarks)) {
                bookmarks = data.bookmarks;
                localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
            }

            // 恢复静态页面
            if (Array.isArray(data.staticPages)) {
                staticPages = data.staticPages;
                localStorage.setItem('staticPages', JSON.stringify(staticPages));
            }

            // 恢复设置（背景图片、视图模式等）
            if (data.settings && typeof data.settings === 'object') {
                localStorage.setItem('settings', JSON.stringify(data.settings));
                // 立即应用背景
                if (data.settings.backgroundImage) {
                    document.body.style.backgroundImage = `url(${data.settings.backgroundImage})`;
                    document.getElementById('bg-image').value = data.settings.backgroundImage;
                }
                if (data.settings.viewMode) {
                    viewMode = data.settings.viewMode;
                }
            }

            // 恢复主题
            if (data.theme) {
                localStorage.setItem('theme', data.theme);
                if (data.theme === 'dark') {
                    document.body.classList.add('dark');
                    document.getElementById('theme-btn').textContent = '☀️';
                } else {
                    document.body.classList.remove('dark');
                    document.getElementById('theme-btn').textContent = '🌙';
                }
            }

            // 恢复搜索历史
            if (Array.isArray(data.searchHistory)) {
                localStorage.setItem('searchHistory', JSON.stringify(data.searchHistory));
            }

            // 重新渲染
            bookmarkPage = 1;
            staticPage = 1;
            renderBookmarks();
            renderStaticPages();

            // 更新视图模式切换按钮状态
            var gridBtn = document.getElementById('view-grid-btn');
            var listBtn = document.getElementById('view-list-btn');
            if (gridBtn && listBtn) {
                gridBtn.classList.toggle('active', viewMode === 'grid');
                listBtn.classList.toggle('active', viewMode === 'list');
            }

            alert('数据导入成功！所有设置已恢复。');
        } catch (err) {
            alert('导入失败：文件格式错误，请选择有效的备份文件。\n' + err.message);
        }
    };
    reader.readAsText(file);
}

// 生成唯一ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 初始化应用
init();