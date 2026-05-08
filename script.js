// 全局变量
let bookmarks = [];
let staticPages = [];
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
            // 设置默认背景图片
            const defaultBgImage = '//';
            document.body.style.backgroundImage = `url(${defaultBgImage})`;
            document.getElementById('bg-image').value = defaultBgImage;
            settings.backgroundImage = defaultBgImage;
            saveSettings(settings);
        }
    } else {
        // 设置默认背景图片
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
    
    // 搜索输入框点击事件
    elements.searchInput.addEventListener('click', showSearchHistory);
    
    // 点击页面其他地方隐藏历史记录
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container-with-history')) {
            hideSearchHistory();
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
                if (faviconUrl) {
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
    // 清空容器
    elements.bookmarksContainer.innerHTML = '';
    
    // 渲染收藏网站
    bookmarks.forEach(bookmark => {
        const bookmarkItem = document.createElement('div');
        bookmarkItem.className = 'bookmark-item';
        
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'bookmark-actions';
        
        const editBtn = document.createElement('button');
        editBtn.textContent = '编辑';
        editBtn.addEventListener('click', () => openEditBookmarkModal(bookmark));
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '删除';
        deleteBtn.addEventListener('click', () => deleteBookmark(bookmark.id));
        
        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);
        
        const link = document.createElement('a');
        link.href = bookmark.url;
        link.target = '_blank';
        
        const iconDiv = document.createElement('div');
        iconDiv.className = 'bookmark-icon';
        
        if (bookmark.iconType === 'url' && bookmark.icon) {
            // 显示URL图标
            const img = document.createElement('img');
            img.src = bookmark.icon;
            img.alt = bookmark.name;
            img.loading = 'lazy';
            img.onerror = function() {
                iconDiv.textContent = '🌐';
            };
            iconDiv.appendChild(img);
        } else {
            // 显示表情图标
            iconDiv.textContent = bookmark.icon || '🌐';
        }
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'bookmark-name';
        nameDiv.textContent = bookmark.name;
        
        link.appendChild(iconDiv);
        link.appendChild(nameDiv);
        
        bookmarkItem.appendChild(actionsDiv);
        bookmarkItem.appendChild(link);
        
        elements.bookmarksContainer.appendChild(bookmarkItem);
    });
    
    // 最后创建并添加添加按钮
    const addBookmarkBtn = document.createElement('div');
    addBookmarkBtn.id = 'add-bookmark-btn';
    addBookmarkBtn.className = 'bookmark-item add-bookmark';
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'bookmark-actions';
    
    const link = document.createElement('a');
    link.href = 'javascript:void(0)';
    
    const iconDiv = document.createElement('div');
    iconDiv.className = 'bookmark-icon';
    iconDiv.textContent = '+';
    
    const nameDiv = document.createElement('div');
    nameDiv.className = 'bookmark-name';
    nameDiv.textContent = '添加';
    
    link.appendChild(iconDiv);
    link.appendChild(nameDiv);
    
    addBookmarkBtn.appendChild(actionsDiv);
    addBookmarkBtn.appendChild(link);
    addBookmarkBtn.addEventListener('click', openAddBookmarkModal);
    
    elements.bookmarksContainer.appendChild(addBookmarkBtn);
}

// 渲染静态页面
function renderStaticPages() {
    elements.staticPagesContainer.innerHTML = '';
    
    if (staticPages.length === 0) {
        elements.staticPagesContainer.innerHTML = '<p class="empty-message">暂无静态页面</p>';
        return;
    }
    
    staticPages.forEach(page => {
        const pageItem = document.createElement('div');
        pageItem.className = 'static-page-item';
        
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'bookmark-actions';
        
        const editBtn = document.createElement('button');
        editBtn.textContent = '编辑';
        editBtn.addEventListener('click', () => openEditStaticPageModal(page));
        
        actionsDiv.appendChild(editBtn);
        
        const link = document.createElement('a');
        link.href = page.path;
        link.target = '_blank';
        
        const iconDiv = document.createElement('div');
        iconDiv.className = 'static-page-icon';
        
        if (page.iconType === 'url' && page.icon) {
            // 显示URL图标
            const img = document.createElement('img');
            img.src = page.icon;
            img.alt = page.name;
            img.loading = 'lazy';
            img.onerror = function() {
                iconDiv.textContent = '📄';
            };
            iconDiv.appendChild(img);
        } else {
            // 显示表情图标
            iconDiv.textContent = page.icon || '📄';
        }
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'static-page-name';
        nameDiv.textContent = page.name;
        
        link.appendChild(iconDiv);
        link.appendChild(nameDiv);
        
        pageItem.appendChild(actionsDiv);
        pageItem.appendChild(link);
        
        elements.staticPagesContainer.appendChild(pageItem);
    });
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

// 生成唯一ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 初始化应用
init();