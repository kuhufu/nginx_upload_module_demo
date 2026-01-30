/**
 * Nginx Upload Module Demo - 文件上传前端脚本
 * 支持多文件上传、断点续传、拖拽上传等功能
 */

// ========================================
// 配置常量
// ========================================
const UPLOAD_CONFIG = {
    CHUNK_SIZE: 1024 * 1024,      // 1MB 分块大小
    CONTINUE_DELAY: 100,           // 继续上传延迟(ms)
    COMPLETE_DELAY: 2000,          // 完成状态显示延迟(ms)
    MAX_RETRIES: 3,                // 最大重试次数
    RETRY_DELAY: 1000              // 重试延迟(ms)
};

// ========================================
// 状态管理
// ========================================
let fileQueue = [];
let toastContainer = null;

// ========================================
// DOM 元素
// ========================================
const elements = {
    uploadArea: null,
    fileInput: null,
    fileList: null,
    startAllBtn: null,
    pauseAllBtn: null,
    clearAllBtn: null,
    fileStats: null,
    themeToggle: null
};

// ========================================
// 文件类型配置
// ========================================
const FILE_TYPES = {
    image: {
        extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'],
        mimeTypes: ['image/'],
        icon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`,
        class: 'image'
    },
    video: {
        extensions: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'],
        mimeTypes: ['video/'],
        icon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>`,
        class: 'video'
    },
    audio: {
        extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'],
        mimeTypes: ['audio/'],
        icon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg>`,
        class: 'audio'
    },
    document: {
        extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf'],
        mimeTypes: ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument'],
        icon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
        class: 'document'
    },
    archive: {
        extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'],
        mimeTypes: ['application/zip', 'application/x-rar', 'application/x-7z', 'application/x-tar', 'application/gzip'],
        icon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>`,
        class: 'archive'
    },
    code: {
        extensions: ['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'scss', 'less', 'json', 'xml', 'yaml', 'yml', 'py', 'java', 'go', 'rs', 'cpp', 'c', 'h', 'php', 'rb', 'swift', 'kt'],
        mimeTypes: ['text/javascript', 'application/json', 'text/html', 'text/css', 'application/xml', 'text/x-python', 'text/x-java'],
        icon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>`,
        class: 'code'
    }
};

// ========================================
// 工具函数
// ========================================

/**
 * 初始化 DOM 元素引用
 */
function initElements() {
    elements.uploadArea = document.getElementById('uploadArea');
    elements.fileInput = document.getElementById('fileInput');
    elements.fileList = document.getElementById('fileList');
    elements.startAllBtn = document.getElementById('startAllBtn');
    elements.pauseAllBtn = document.getElementById('pauseAllBtn');
    elements.clearAllBtn = document.getElementById('clearAllBtn');
    elements.fileStats = document.getElementById('fileStats');
    elements.themeToggle = document.getElementById('themeToggle');

    // 创建 Toast 容器
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 格式化上传速度
 */
function formatSpeed(bytesPerSecond) {
    return formatFileSize(bytesPerSecond) + '/s';
}

/**
 * 获取文件扩展名
 */
function getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2).toLowerCase();
}

/**
 * 获取文件类型配置
 */
function getFileTypeConfig(file) {
    const ext = getFileExtension(file.name);
    
    for (const [type, config] of Object.entries(FILE_TYPES)) {
        // 检查扩展名
        if (config.extensions.includes(ext)) {
            return config;
        }
        // 检查 MIME 类型
        if (config.mimeTypes.some(mime => file.type.startsWith(mime) || file.type.includes(mime))) {
            return config;
        }
    }
    
    // 默认类型
    return {
        icon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
        class: ''
    };
}

/**
 * 生成文件唯一 ID
 */
function generateFileId(file) {
    const data = file.name + file.size + file.lastModified;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return 'file_' + Math.abs(hash).toString(36);
}

/**
 * 生成会话 ID
 */
function generateSessionId(file) {
    return 'session_' + generateFileId(file);
}

/**
 * 显示 Toast 通知
 */
function showToast(title, message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
        error: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
        warning: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
        info: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
    };

    toast.innerHTML = `
        ${icons[type] || icons.info}
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    toastContainer.appendChild(toast);

    // 自动移除
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ========================================
// 主题管理
// ========================================

/**
 * 初始化主题
 */
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    elements.themeToggle?.addEventListener('click', toggleTheme);
}

/**
 * 切换主题
 */
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// ========================================
// 文件队列管理
// ========================================

/**
 * 添加文件到队列
 */
function addFilesToQueue(files) {
    const token = document.getElementById('token').value;
    const description = document.getElementById('description').value;
    let addedCount = 0;
    let duplicateCount = 0;

    for (const file of files) {
        const fileId = generateFileId(file);

        // 检查文件是否已存在
        if (fileQueue.find(f => f.id === fileId)) {
            duplicateCount++;
            continue;
        }

        const fileTypeConfig = getFileTypeConfig(file);

        const fileItem = {
            id: fileId,
            file: file,
            session: generateSessionId(file),
            token: token,
            description: description,
            status: 'pending', // pending, uploading, paused, completed, error
            progress: 0,
            uploadedBytes: 0,
            startTime: null,
            lastUploadedBytes: 0,
            controller: null,
            result: null,
            fileTypeConfig: fileTypeConfig,
            retryCount: 0
        };

        fileQueue.push(fileItem);
        createFileItemElement(fileItem);
        addedCount++;
    }

    // 显示提示
    if (addedCount > 0) {
        showToast('添加成功', `已添加 ${addedCount} 个文件`, 'success');
    }
    if (duplicateCount > 0) {
        showToast('提示', `${duplicateCount} 个文件已在队列中`, 'warning');
    }

    updateBatchButtons();
    updateEmptyState();
    updateFileStats();
}

/**
 * 创建文件项 DOM 元素
 */
function createFileItemElement(fileItem) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'file-item';
    itemDiv.id = fileItem.id;

    const iconClass = fileItem.fileTypeConfig.class;
    const iconSvg = fileItem.fileTypeConfig.icon;

    itemDiv.innerHTML = `
        <div class="file-item-header">
            <div class="file-item-icon ${iconClass}">
                ${iconSvg}
            </div>
            <div class="file-item-info">
                <div class="file-item-name">${escapeHtml(fileItem.file.name)}</div>
                <div class="file-item-meta">
                    <span>${formatFileSize(fileItem.file.size)}</span>
                    <span>${fileItem.file.type || '未知类型'}</span>
                    <span class="file-item-status pending">待上传</span>
                </div>
            </div>
        </div>
        <div class="file-item-progress">
            <div class="file-item-progress-bar">
                <div class="file-item-progress-fill" style="width: 0%"></div>
            </div>
            <div class="file-item-progress-info">
                <span class="progress-percentage">0%</span>
                <span class="progress-stats">0 / ${formatFileSize(fileItem.file.size)}</span>
                <span class="file-item-speed">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                    <span class="speed-text">等待中</span>
                </span>
            </div>
        </div>
        <div class="file-item-controls">
            <button type="button" class="btn btn-primary upload-btn">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                开始
            </button>
            <button type="button" class="btn btn-warning pause-resume-btn" disabled>
                <svg class="pause-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <svg class="resume-icon" style="display: none;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span class="btn-text">暂停</span>
            </button>
            <button type="button" class="btn btn-danger cancel-btn" disabled>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
                取消
            </button>
            <button type="button" class="btn btn-danger delete-btn">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
                删除
            </button>
        </div>
        <div class="file-item-result-wrapper" style="display: none;">
            <div class="file-item-result-toggle">
                <span class="toggle-icon">▼</span>
                <span>查看结果</span>
            </div>
            <div class="file-item-result-content"></div>
        </div>
    `;

    // 绑定按钮事件
    const uploadBtn = itemDiv.querySelector('.upload-btn');
    const pauseResumeBtn = itemDiv.querySelector('.pause-resume-btn');
    const cancelBtn = itemDiv.querySelector('.cancel-btn');
    const deleteBtn = itemDiv.querySelector('.delete-btn');

    uploadBtn.addEventListener('click', () => startUpload(fileItem.id, true));
    pauseResumeBtn.addEventListener('click', () => {
        if (fileItem.status === 'uploading') {
            pauseUpload(fileItem.id, true);
        } else if (fileItem.status === 'paused') {
            resumeUpload(fileItem.id, true);
        }
    });
    cancelBtn.addEventListener('click', () => cancelUpload(fileItem.id, true));
    deleteBtn.addEventListener('click', () => deleteFile(fileItem.id));

    // 结果展开/收起切换
    const resultToggle = itemDiv.querySelector('.file-item-result-toggle');
    const resultContent = itemDiv.querySelector('.file-item-result-content');
    const toggleIcon = resultToggle.querySelector('.toggle-icon');

    resultToggle.addEventListener('click', () => {
        const isExpanded = resultContent.classList.contains('expanded');
        if (isExpanded) {
            resultContent.classList.remove('expanded');
            toggleIcon.textContent = '▼';
            resultToggle.querySelector('span:last-child').textContent = '查看结果';
        } else {
            resultContent.classList.add('expanded');
            toggleIcon.textContent = '▲';
            resultToggle.querySelector('span:last-child').textContent = '收起结果';
        }
    });

    elements.fileList.appendChild(itemDiv);
}

/**
 * HTML 转义函数
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 更新文件项 UI
 */
function updateFileItemUI(fileItem) {
    const itemDiv = document.getElementById(fileItem.id);
    if (!itemDiv) return;

    const iconDiv = itemDiv.querySelector('.file-item-icon');
    const statusSpan = itemDiv.querySelector('.file-item-status');
    const progressFill = itemDiv.querySelector('.file-item-progress-fill');
    const progressPercent = itemDiv.querySelector('.progress-percentage');
    const progressStats = itemDiv.querySelector('.progress-stats');
    const speedText = itemDiv.querySelector('.speed-text');

    // 更新状态样式
    itemDiv.classList.remove('completed', 'error');
    iconDiv.classList.remove('completed', 'error');

    // 更新状态文本
    statusSpan.className = `file-item-status ${fileItem.status}`;
    switch (fileItem.status) {
        case 'pending':
            statusSpan.textContent = '待上传';
            speedText.textContent = '等待中';
            break;
        case 'uploading':
            statusSpan.textContent = '上传中';
            break;
        case 'paused':
            statusSpan.textContent = '已暂停';
            speedText.textContent = '已暂停';
            break;
        case 'completed':
            statusSpan.textContent = '已完成';
            itemDiv.classList.add('completed');
            iconDiv.classList.add('completed');
            progressFill.classList.add('completed');
            speedText.textContent = '完成';
            break;
        case 'error':
            statusSpan.textContent = '错误';
            itemDiv.classList.add('error');
            iconDiv.classList.add('error');
            progressFill.classList.add('error');
            speedText.textContent = '上传失败';
            break;
    }

    // 更新进度
    progressFill.style.width = fileItem.progress + '%';
    progressPercent.textContent = Math.round(fileItem.progress) + '%';
    progressStats.textContent = `${formatFileSize(fileItem.uploadedBytes)} / ${formatFileSize(fileItem.file.size)}`;

    // 更新速度
    if (fileItem.status === 'uploading' && fileItem.startTime) {
        const elapsed = (Date.now() - fileItem.startTime) / 1000;
        if (elapsed > 0.5 && fileItem.lastUploadedBytes !== fileItem.uploadedBytes) {
            const speed = (fileItem.uploadedBytes - fileItem.lastUploadedBytes) / elapsed;
            speedText.textContent = formatSpeed(speed);
            fileItem.lastUploadedBytes = fileItem.uploadedBytes;
            fileItem.startTime = Date.now();
        }
    }

    // 更新按钮状态
    const uploadBtn = itemDiv.querySelector('.upload-btn');
    const pauseResumeBtn = itemDiv.querySelector('.pause-resume-btn');
    const pauseIcon = pauseResumeBtn.querySelector('.pause-icon');
    const resumeIcon = pauseResumeBtn.querySelector('.resume-icon');
    const btnText = pauseResumeBtn.querySelector('.btn-text');
    const cancelBtn = itemDiv.querySelector('.cancel-btn');
    const deleteBtn = itemDiv.querySelector('.delete-btn');

    switch (fileItem.status) {
        case 'pending':
            uploadBtn.disabled = false;
            pauseResumeBtn.disabled = true;
            cancelBtn.disabled = true;
            deleteBtn.disabled = false;
            pauseIcon.style.display = 'block';
            resumeIcon.style.display = 'none';
            btnText.textContent = '暂停';
            pauseResumeBtn.className = 'btn btn-warning pause-resume-btn';
            break;
        case 'uploading':
            uploadBtn.disabled = true;
            pauseResumeBtn.disabled = false;
            pauseIcon.style.display = 'block';
            resumeIcon.style.display = 'none';
            btnText.textContent = '暂停';
            pauseResumeBtn.className = 'btn btn-warning pause-resume-btn';
            cancelBtn.disabled = false;
            deleteBtn.disabled = false;
            break;
        case 'paused':
            uploadBtn.disabled = true;
            pauseResumeBtn.disabled = false;
            pauseIcon.style.display = 'none';
            resumeIcon.style.display = 'block';
            btnText.textContent = '继续';
            pauseResumeBtn.className = 'btn btn-success pause-resume-btn';
            cancelBtn.disabled = false;
            deleteBtn.disabled = false;
            break;
        case 'completed':
            uploadBtn.disabled = true;
            pauseResumeBtn.disabled = true;
            cancelBtn.disabled = true;
            deleteBtn.disabled = false;
            break;
        case 'error':
            uploadBtn.disabled = false;
            pauseResumeBtn.disabled = true;
            cancelBtn.disabled = true;
            deleteBtn.disabled = false;
            break;
    }
}

/**
 * 显示文件项结果
 */
function showFileItemResult(fileItem, success, message) {
    const itemDiv = document.getElementById(fileItem.id);
    if (!itemDiv) return;

    const resultWrapper = itemDiv.querySelector('.file-item-result-wrapper');
    const resultContent = itemDiv.querySelector('.file-item-result-content');
    const resultToggle = itemDiv.querySelector('.file-item-result-toggle');

    resultContent.className = `file-item-result-content ${success ? 'success' : 'error'}`;
    
    if (message.includes('<')) {
        resultContent.innerHTML = message;
    } else {
        resultContent.textContent = message;
    }

    resultWrapper.style.display = 'block';

    // 自动展开图片预览
    if (message.includes('upload-result-preview')) {
        setTimeout(() => {
            resultContent.classList.add('expanded');
            resultToggle.querySelector('.toggle-icon').textContent = '▲';
            resultToggle.querySelector('span:last-child').textContent = '收起结果';
        }, 100);
    }
}

// ========================================
// 上传控制
// ========================================

/**
 * 开始上传单个文件
 */
function startUpload(fileId, updateBatch = false) {
    const fileItem = fileQueue.find(f => f.id === fileId);
    if (!fileItem) return;

    const token = document.getElementById('token').value;
    const description = document.getElementById('description').value;

    if (!token) {
        showToast('错误', '请输入认证 Token', 'error');
        return;
    }

    if (!description) {
        showToast('错误', '请输入文件描述', 'error');
        return;
    }

    fileItem.token = token;
    fileItem.description = description;
    fileItem.status = 'uploading';
    fileItem.startTime = Date.now();
    fileItem.lastUploadedBytes = fileItem.uploadedBytes;
    fileItem.controller = new AbortController();
    fileItem.retryCount = 0;

    // 隐藏之前的结果
    const itemDiv = document.getElementById(fileId);
    const resultWrapper = itemDiv.querySelector('.file-item-result-wrapper');
    resultWrapper.style.display = 'none';

    updateFileItemUI(fileItem);
    performUpload(fileItem);

    if (updateBatch) {
        updateBatchButtons();
        updateFileStats();
    }
}

/**
 * 暂停上传
 */
function pauseUpload(fileId, updateBatch = false) {
    const fileItem = fileQueue.find(f => f.id === fileId);
    if (!fileItem || fileItem.status !== 'uploading') return;

    fileItem.status = 'paused';
    updateFileItemUI(fileItem);

    if (updateBatch) {
        updateBatchButtons();
        updateFileStats();
    }
}

/**
 * 继续上传
 */
function resumeUpload(fileId, updateBatch = false) {
    const fileItem = fileQueue.find(f => f.id === fileId);
    if (!fileItem || fileItem.status !== 'paused') return;

    fileItem.status = 'uploading';
    fileItem.startTime = Date.now();
    fileItem.lastUploadedBytes = fileItem.uploadedBytes;

    // 确保 AbortController 存在
    if (!fileItem.controller || fileItem.controller.signal.aborted) {
        fileItem.controller = new AbortController();
    }

    // 隐藏之前的结果
    const itemDiv = document.getElementById(fileId);
    const resultWrapper = itemDiv.querySelector('.file-item-result-wrapper');
    resultWrapper.style.display = 'none';

    updateFileItemUI(fileItem);
    performUpload(fileItem);

    if (updateBatch) {
        updateBatchButtons();
        updateFileStats();
    }
}

/**
 * 取消上传
 */
function cancelUpload(fileId, updateBatch = false) {
    const fileItem = fileQueue.find(f => f.id === fileId);
    if (!fileItem) return;

    if (fileItem.controller) {
        fileItem.controller.abort();
    }

    fileItem.status = 'pending';
    fileItem.uploadedBytes = 0;
    fileItem.progress = 0;
    fileItem.controller = null;

    updateFileItemUI(fileItem);

    const itemDiv = document.getElementById(fileId);
    const resultWrapper = itemDiv.querySelector('.file-item-result-wrapper');
    resultWrapper.style.display = 'none';

    if (updateBatch) {
        updateBatchButtons();
        updateFileStats();
    }
}

/**
 * 删除文件
 */
function deleteFile(fileId) {
    const fileItem = fileQueue.find(f => f.id === fileId);
    if (!fileItem) return;

    // 如果正在上传，先取消
    if (fileItem.controller) {
        fileItem.controller.abort();
    }

    // 从队列中移除
    fileQueue = fileQueue.filter(f => f.id !== fileId);

    // 更新状态
    updateBatchButtons();
    updateFileStats();

    // 移除 DOM 元素（带动画）
    const itemDiv = document.getElementById(fileId);
    if (itemDiv) {
        itemDiv.style.maxHeight = itemDiv.scrollHeight + 'px';
        itemDiv.classList.add('deleting');

        requestAnimationFrame(() => {
            itemDiv.style.maxHeight = '0';
            itemDiv.style.opacity = '0';
            itemDiv.style.transform = 'translateX(20px)';
            itemDiv.style.marginTop = '0';
            itemDiv.style.marginBottom = '0';
            itemDiv.style.padding = '0';

            setTimeout(() => {
                itemDiv.remove();
                updateEmptyState();
            }, 400);
        });
    } else {
        updateEmptyState();
    }

    showToast('已删除', '文件已从列表中删除', 'info');
}

/**
 * 构建上传请求头
 */
function buildUploadHeaders(fileItem, startByte, endByte, chunkSize) {
    return {
        'Authorization': fileItem.token,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileItem.file.name)}`,
        'Content-Type': 'application/octet-stream',
        'Content-Range': `bytes ${startByte}-${endByte}/${fileItem.file.size}`,
        'Session-ID': fileItem.session,
        'Content-Length': chunkSize.toString()
    };
}

/**
 * 执行文件上传
 */
async function performUpload(fileItem) {
    if (fileItem.status !== 'uploading') return;

    try {
        const startByte = fileItem.uploadedBytes;
        const endByte = Math.min(startByte + UPLOAD_CONFIG.CHUNK_SIZE - 1, fileItem.file.size - 1);
        const fileSlice = fileItem.file.slice(startByte, endByte + 1);

        const headers = buildUploadHeaders(fileItem, startByte, endByte, fileSlice.size);

        const response = await fetch('/upload', {
            method: 'POST',
            headers: headers,
            body: fileSlice,
            signal: fileItem.controller.signal
        });

        if (response.status === 201) {
            // 继续上传
            const rangeHeader = response.headers.get('Range');
            if (rangeHeader) {
                const match = rangeHeader.match(/(\d+)-(\d+)/);
                if (match) {
                    fileItem.uploadedBytes = parseInt(match[2]) + 1;
                } else {
                    fileItem.uploadedBytes = Math.min(startByte + UPLOAD_CONFIG.CHUNK_SIZE, fileItem.file.size);
                }
            } else {
                fileItem.uploadedBytes = Math.min(startByte + UPLOAD_CONFIG.CHUNK_SIZE, fileItem.file.size);
            }

            fileItem.progress = (fileItem.uploadedBytes / fileItem.file.size) * 100;
            fileItem.retryCount = 0; // 重置重试计数
            updateFileItemUI(fileItem);

            // 继续下一块
            if (fileItem.status === 'uploading') {
                setTimeout(() => performUpload(fileItem), UPLOAD_CONFIG.CONTINUE_DELAY);
            }
            return;
        }

        // 上传完成
        if (response.ok || response.status === 200) {
            fileItem.status = 'completed';
            fileItem.progress = 100;
            fileItem.uploadedBytes = fileItem.file.size;
            updateFileItemUI(fileItem);

            try {
                const data = await response.json();
                let resultHtml = JSON.stringify(data, null, 2);

                // 如果是图片文件，添加预览
                if (fileItem.file.type.startsWith('image/')) {
                    const imageUrl = URL.createObjectURL(fileItem.file);
                    resultHtml = `
<div class="upload-result-preview">
    <div class="preview-image">
        <img src="${imageUrl}" alt="${escapeHtml(fileItem.file.name)}" loading="lazy">
    </div>
    <div class="preview-info">
        <strong>📁 文件名:</strong> ${escapeHtml(fileItem.file.name)}<br>
        <strong>📏 大小:</strong> ${formatFileSize(fileItem.file.size)}<br>
        <strong>🎨 类型:</strong> ${fileItem.file.type || 'unknown'}
        <details>
            <summary>查看服务器响应</summary>
            <pre>${JSON.stringify(data, null, 2)}</pre>
        </details>
    </div>
</div>`;
                }
                showFileItemResult(fileItem, true, resultHtml);
            } catch (e) {
                showFileItemResult(fileItem, true, '上传成功');
            }

            showToast('上传成功', `${fileItem.file.name} 上传完成`, 'success');
        } else {
            throw new Error(`HTTP ${response.status}`);
        }

        updateBatchButtons();
        updateFileStats();

    } catch (error) {
        if (error.name === 'AbortError') {
            return; // 用户取消，不显示错误
        }

        // 重试逻辑
        if (fileItem.retryCount < UPLOAD_CONFIG.MAX_RETRIES && fileItem.status === 'uploading') {
            fileItem.retryCount++;
            showToast('重试', `${fileItem.file.name} 上传失败，正在重试 (${fileItem.retryCount}/${UPLOAD_CONFIG.MAX_RETRIES})`, 'warning');
            setTimeout(() => performUpload(fileItem), UPLOAD_CONFIG.RETRY_DELAY);
            return;
        }

        fileItem.status = 'error';
        updateFileItemUI(fileItem);
        showFileItemResult(fileItem, false, `上传失败: ${error.message}`);
        showToast('上传失败', `${fileItem.file.name}: ${error.message}`, 'error');

        updateBatchButtons();
        updateFileStats();
    }
}

// ========================================
// 批量操作
// ========================================

/**
 * 全部开始上传
 */
function startAllUploads() {
    let startedCount = 0;
    fileQueue.forEach(fileItem => {
        if (fileItem.status === 'pending' || fileItem.status === 'error') {
            startUpload(fileItem.id, false);
            startedCount++;
        }
    });
    
    if (startedCount > 0) {
        showToast('开始上传', `已启动 ${startedCount} 个文件`, 'info');
    }
    
    updateBatchButtons();
    updateFileStats();
}

/**
 * 全部暂停上传
 */
function pauseAllUploads() {
    let pausedCount = 0;
    fileQueue.forEach(fileItem => {
        if (fileItem.status === 'uploading') {
            pauseUpload(fileItem.id, false);
            pausedCount++;
        }
    });
    
    if (pausedCount > 0) {
        showToast('已暂停', `已暂停 ${pausedCount} 个文件`, 'info');
    }
    
    updateBatchButtons();
    updateFileStats();
}

/**
 * 清空列表
 */
function clearAllFiles() {
    // 取消所有正在上传的文件
    fileQueue.forEach(fileItem => {
        if (fileItem.controller) {
            fileItem.controller.abort();
        }
    });

    // 清空队列
    fileQueue = [];

    // 清空 UI（带动画）
    const fileItems = elements.fileList.querySelectorAll('.file-item');
    fileItems.forEach((item, index) => {
        setTimeout(() => {
            item.style.maxHeight = item.scrollHeight + 'px';
            item.classList.add('deleting');
            
            requestAnimationFrame(() => {
                item.style.maxHeight = '0';
                item.style.opacity = '0';
                item.style.transform = 'translateX(20px)';
                item.style.margin = '0';
                item.style.padding = '0';
            });
        }, index * 50);
    });

    // 恢复空状态
    setTimeout(() => {
        elements.fileList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                </div>
                <p class="empty-title">暂无文件</p>
                <p class="empty-desc">点击上方区域或拖拽文件开始上传</p>
            </div>
        `;
        updateEmptyState();
    }, fileItems.length * 50 + 400);

    updateBatchButtons();
    updateFileStats();
    showToast('已清空', '文件列表已清空', 'info');
}

// ========================================
// UI 更新
// ========================================

/**
 * 更新批量操作按钮状态
 */
function updateBatchButtons() {
    const hasPendingOrError = fileQueue.some(f => f.status === 'pending' || f.status === 'error');
    const hasPaused = fileQueue.some(f => f.status === 'paused');
    const hasUploading = fileQueue.some(f => f.status === 'uploading');
    const hasFiles = fileQueue.length > 0;

    elements.startAllBtn.disabled = !hasPendingOrError && !hasPaused;
    elements.pauseAllBtn.disabled = !hasUploading;
    elements.clearAllBtn.disabled = !hasFiles;
}

/**
 * 更新空状态显示
 */
function updateEmptyState() {
    const emptyState = elements.fileList.querySelector('.empty-state');
    const hasFiles = fileQueue.length > 0;

    if (emptyState) {
        if (hasFiles) {
            emptyState.style.display = 'none';
        } else {
            emptyState.style.display = 'block';
            emptyState.style.opacity = '0';
            requestAnimationFrame(() => {
                emptyState.style.opacity = '1';
            });
        }
    }
}

/**
 * 更新文件统计
 */
function updateFileStats() {
    const totalFiles = fileQueue.length;
    const pendingFiles = fileQueue.filter(f => f.status === 'pending').length;
    const uploadingFiles = fileQueue.filter(f => f.status === 'uploading').length;
    const completedFiles = fileQueue.filter(f => f.status === 'completed').length;

    if (totalFiles > 0) {
        elements.fileStats.style.display = 'flex';
        document.getElementById('totalFiles').textContent = totalFiles;
        document.getElementById('pendingFiles').textContent = pendingFiles;
        document.getElementById('uploadingFiles').textContent = uploadingFiles;
        document.getElementById('completedFiles').textContent = completedFiles;
    } else {
        elements.fileStats.style.display = 'none';
    }
}

// ========================================
// 事件处理
// ========================================

/**
 * 初始化事件监听器
 */
function initEventListeners() {
    // 批量按钮
    elements.startAllBtn?.addEventListener('click', startAllUploads);
    elements.pauseAllBtn?.addEventListener('click', pauseAllUploads);
    elements.clearAllBtn?.addEventListener('click', clearAllFiles);

    // 点击上传区域
    elements.uploadArea?.addEventListener('click', () => elements.fileInput?.click());

    // 文件选择
    elements.fileInput?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            addFilesToQueue(Array.from(e.target.files));
            e.target.value = ''; // 清空 input 以允许重复选择相同文件
        }
    });

    // 拖拽上传
    elements.uploadArea?.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.add('dragover');
    });

    elements.uploadArea?.addEventListener('dragleave', () => {
        elements.uploadArea.classList.remove('dragover');
    });

    elements.uploadArea?.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            addFilesToQueue(Array.from(files));
        }
    });

    // 粘贴上传
    document.addEventListener('paste', (e) => {
        const files = e.clipboardData.files;
        if (files.length > 0) {
            addFilesToQueue(Array.from(files));
            showToast('粘贴上传', `已添加 ${files.length} 个文件`, 'info');
        }
    });
}

// ========================================
// 初始化
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initElements();
    initTheme();
    initEventListeners();
    updateBatchButtons();
    updateEmptyState();
});
