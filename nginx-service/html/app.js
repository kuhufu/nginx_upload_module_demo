// 上传相关常量
const UPLOAD_CONFIG = {
    CHUNK_SIZE: 1024 * 1024, // 1MB分块大小
    CONTINUE_DELAY: 100, // 继续上传延迟(ms)
    COMPLETE_DELAY: 2000 // 完成状态显示延迟(ms)
};

// 文件队列
let fileQueue = [];

// 获取DOM元素
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const startAllBtn = document.getElementById('startAllBtn');
const pauseAllBtn = document.getElementById('pauseAllBtn');
const clearAllBtn = document.getElementById('clearAllBtn');

/**
 * 工具函数：格式化文件大小
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 工具函数：格式化速度
 */
function formatSpeed(bytesPerSecond) {
    return formatFileSize(bytesPerSecond) + '/s';
}

/**
 * 工具函数：显示Toast通知
 */
function showToast(title, message, type = 'info') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = '';
    if (type === 'success') {
        icon = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
    } else if (type === 'error') {
        icon = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
    } else if (type === 'warning') {
        icon = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>';
    } else {
        icon = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
    }

    toast.innerHTML = `
        ${icon}
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * 生成文件唯一ID
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
 * 生成会话ID
 */
function generateSessionId(file) {
    return 'session_' + generateFileId(file);
}

/**
 * 添加文件到队列
 */
function addFilesToQueue(files) {
    const token = document.getElementById('token').value;
    const description = document.getElementById('description').value;

    for (const file of files) {
        const fileId = generateFileId(file);

        // 检查文件是否已存在
        if (fileQueue.find(f => f.id === fileId)) {
            showToast('提示', '文件已在队列中', 'warning');
            continue;
        }

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
            result: null
        };

        fileQueue.push(fileItem);
        createFileItemElement(fileItem);
    }

    updateBatchButtons();
    updateEmptyState();
}

/**
 * 创建文件项DOM元素
 */
function createFileItemElement(fileItem) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'file-item';
    itemDiv.id = fileItem.id;

    itemDiv.innerHTML = `
        <div class="file-item-header">
            <div class="file-item-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
            </div>
            <div class="file-item-info">
                <div class="file-item-name">${fileItem.file.name}</div>
                <div class="file-item-meta">
                    <span>${formatFileSize(fileItem.file.size)}</span>
                    <span>${fileItem.file.type || 'unknown'}</span>
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
                    <span class="speed-text">0 KB/s</span>
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
        <div class="file-item-result-wrapper" style="visibility: hidden; opacity: 0; max-height: 0; overflow: hidden;">
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
            resultContent.style.maxHeight = '0';
            resultContent.style.opacity = '0';
            resultContent.style.padding = '0';
            toggleIcon.textContent = '▼';
        } else {
            resultContent.classList.add('expanded');
            // 动态计算内容高度
            resultContent.style.maxHeight = resultContent.scrollHeight + 'px';
            resultContent.style.opacity = '1';
            resultContent.style.padding = '10px';
            toggleIcon.textContent = '▲';
        }
    });

    fileList.appendChild(itemDiv);
}

/**
 * 更新文件项状态
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

    // 更新状态
    statusSpan.className = `file-item-status ${fileItem.status}`;
    switch (fileItem.status) {
        case 'pending':
            statusSpan.textContent = '待上传';
            break;
        case 'uploading':
            statusSpan.textContent = '上传中';
            break;
        case 'paused':
            statusSpan.textContent = '已暂停';
            break;
        case 'completed':
            statusSpan.textContent = '已完成';
            iconDiv.classList.add('completed');
            progressFill.classList.add('completed');
            break;
        case 'error':
            statusSpan.textContent = '错误';
            iconDiv.classList.add('error');
            progressFill.classList.add('error');
            break;
    }

    // 更新进度
    progressFill.style.width = fileItem.progress + '%';
    progressPercent.textContent = Math.round(fileItem.progress) + '%';
    progressStats.textContent = `${formatFileSize(fileItem.uploadedBytes)} / ${formatFileSize(fileItem.file.size)}`;

    // 更新速度
    if (fileItem.status === 'uploading' && fileItem.startTime) {
        const elapsed = (Date.now() - fileItem.startTime) / 1000;
        if (elapsed > 0 && fileItem.lastUploadedBytes !== fileItem.uploadedBytes) {
            const speed = (fileItem.uploadedBytes - fileItem.lastUploadedBytes) / elapsed;
            speedText.textContent = formatSpeed(speed);
            fileItem.lastUploadedBytes = fileItem.uploadedBytes;
            fileItem.startTime = Date.now();
        }
    } else if (fileItem.status === 'paused') {
        speedText.textContent = '已暂停';
    } else if (fileItem.status === 'completed') {
        speedText.textContent = '完成';
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

    // 先设置内容，但保持隐藏状态
    resultContent.className = `file-item-result-content file-item-result ${success ? 'success' : 'error'}`;
    resultContent.textContent = message;
    resultContent.style.maxHeight = '0';
    resultContent.style.opacity = '0';
    resultContent.style.padding = '0';

    // 确保wrapper没有max-height限制
    resultWrapper.style.maxHeight = '';

    // 延迟显示wrapper，让用户感觉更平滑
    requestAnimationFrame(() => {
        resultWrapper.style.visibility = 'visible';
        resultWrapper.style.opacity = '1';
    });
}

/**
 * 开始上传单个文件
 * @param {string} fileId - 文件ID
 * @param {boolean} updateBatch - 是否更新批量按钮（默认false）
 */
function startUpload(fileId, updateBatch = false) {
    const fileItem = fileQueue.find(f => f.id === fileId);
    if (!fileItem) return;

    const token = document.getElementById('token').value;
    const description = document.getElementById('description').value;

    if (!token) {
        showToast('错误', '请输入认证Token', 'error');
        return;
    }

    if (!description) {
        showToast('错误', '请输入文件描述', 'error');
        return;
    }

    fileItem.token = token;
    fileItem.description = description;
    fileItem.status = 'uploading';
    fileItem.uploadedBytes = 0;
    fileItem.progress = 0;
    fileItem.startTime = Date.now();
    fileItem.lastUploadedBytes = 0;
    fileItem.controller = new AbortController();

    // 隐藏之前的结果
    const itemDiv = document.getElementById(fileId);
    const resultWrapper = itemDiv.querySelector('.file-item-result-wrapper');
    const resultContent = itemDiv.querySelector('.file-item-result-content');
    resultWrapper.style.visibility = 'hidden';
    resultWrapper.style.opacity = '0';
    resultWrapper.style.maxHeight = '0';
    resultContent.classList.remove('expanded');
    resultContent.style.maxHeight = '0';
    resultContent.style.opacity = '0';
    resultContent.style.padding = '0';

    updateFileItemUI(fileItem);
    performUpload(fileItem);

    if (updateBatch) {
        updateBatchButtons();
    }
}

/**
 * 暂停上传
 * @param {string} fileId - 文件ID
 * @param {boolean} updateBatch - 是否更新批量按钮（默认false）
 */
function pauseUpload(fileId, updateBatch = false) {
    const fileItem = fileQueue.find(f => f.id === fileId);
    if (!fileItem || fileItem.status !== 'uploading') return;

    fileItem.status = 'paused';
    updateFileItemUI(fileItem);

    if (updateBatch) {
        updateBatchButtons();
    }
}

/**
 * 继续上传
 * @param {string} fileId - 文件ID
 * @param {boolean} updateBatch - 是否更新批量按钮（默认false）
 */
function resumeUpload(fileId, updateBatch = false) {
    const fileItem = fileQueue.find(f => f.id === fileId);
    if (!fileItem || fileItem.status !== 'paused') return;

    fileItem.status = 'uploading';
    fileItem.startTime = Date.now();
    fileItem.lastUploadedBytes = fileItem.uploadedBytes;

    // 确保 AbortController 存在
    if (!fileItem.controller) {
        fileItem.controller = new AbortController();
    } else if (fileItem.controller.signal.aborted) {
        fileItem.controller = new AbortController();
    }

    // 隐藏之前的结果
    const itemDiv = document.getElementById(fileId);
    const resultWrapper = itemDiv.querySelector('.file-item-result-wrapper');
    const resultContent = itemDiv.querySelector('.file-item-result-content');
    resultWrapper.style.visibility = 'hidden';
    resultWrapper.style.opacity = '0';
    resultWrapper.style.maxHeight = '0';
    resultContent.classList.remove('expanded');
    resultContent.style.maxHeight = '0';
    resultContent.style.opacity = '0';
    resultContent.style.padding = '0';

    updateFileItemUI(fileItem);
    performUpload(fileItem);

    if (updateBatch) {
        updateBatchButtons();
    }
}

/**
 * 取消上传
 * @param {string} fileId - 文件ID
 * @param {boolean} updateBatch - 是否更新批量按钮（默认false）
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
    const resultToggle = itemDiv.querySelector('.file-item-result-toggle');
    const resultContent = itemDiv.querySelector('.file-item-result-content');
    resultToggle.style.display = 'none';
    resultContent.classList.remove('expanded');
    resultContent.style.maxHeight = '0';
    resultContent.style.opacity = '0';
    resultContent.style.padding = '0';

    if (updateBatch) {
        updateBatchButtons();
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

    // 移除DOM元素
    const itemDiv = document.getElementById(fileId);
    if (itemDiv) {
        // 先记录当前高度
        itemDiv.style.maxHeight = itemDiv.scrollHeight + 'px';
        itemDiv.classList.add('deleting');

        requestAnimationFrame(() => {
            itemDiv.style.maxHeight = '0';
            itemDiv.style.opacity = '0';
            itemDiv.style.transform = 'translateX(20px)';
            itemDiv.style.marginTop = '0';
            itemDiv.style.padding = '0';
            itemDiv.style.marginBottom = '0';
            itemDiv.style.borderTop = '0';
            itemDiv.style.borderBottom = '0';

            // 等待动画完成后移除元素
            const handleTransitionEnd = (e) => {
                if (e.propertyName === 'max-height' || e.propertyName === 'opacity' || e.propertyName === 'transform' || e.propertyName === 'margin-bottom') {
                    itemDiv.removeEventListener('transitionend', handleTransitionEnd);
                    itemDiv.remove();
                    // 删除完成后才更新空状态
                    updateEmptyState();
                }
            };
            itemDiv.addEventListener('transitionend', handleTransitionEnd);
        });
    } else {
        // 如果没有itemDiv（比如已经在其他地方被删除），直接更新空状态
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
        if (fileItem.controller.signal.aborted) {
            return;
        }
    } catch (e) {
        console.warn('检查 AbortController 状态时出错:', e);
    }

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
            updateFileItemUI(fileItem);

            setTimeout(() => performUpload(fileItem), UPLOAD_CONFIG.CONTINUE_DELAY);
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
                showFileItemResult(fileItem, true, JSON.stringify(data, null, 2));
            } catch (e) {
                showFileItemResult(fileItem, true, '上传成功');
            }
            showToast('上传成功', `${fileItem.file.name} 上传完成`, 'success');
        } else {
            throw new Error(`HTTP ${response.status}`);
        }

        updateBatchButtons();

    } catch (error) {
        if (error.name === 'AbortError') {
            // 用户取消，不显示错误
            return;
        }

        fileItem.status = 'error';
        updateFileItemUI(fileItem);
        showFileItemResult(fileItem, false, '上传失败: ' + error.message);
        showToast('上传失败', `${fileItem.file.name}: ${error.message}`, 'error');

        updateBatchButtons();
    }
}

/**
 * 更新批量操作按钮状态
 */
function updateBatchButtons() {
    const hasPendingOrPaused = fileQueue.some(f => f.status === 'pending' || f.status === 'error' || f.status === 'paused');
    const hasUploading = fileQueue.some(f => f.status === 'uploading');
    const hasFiles = fileQueue.length > 0;

    startAllBtn.disabled = !hasPendingOrPaused;
    pauseAllBtn.disabled = !hasUploading;
    clearAllBtn.disabled = !hasFiles;
}

/**
 * 更新空状态显示
 */
function updateEmptyState() {
    const emptyState = fileList.querySelector('.empty-state');
    if (fileQueue.length === 0) {
        emptyState.style.display = 'block';
        emptyState.style.opacity = '0';
        requestAnimationFrame(() => {
            emptyState.style.opacity = '1';
        });
    } else {
        emptyState.style.display = 'none';
        emptyState.style.opacity = '0';
    }
}

/**
 * 全部开始上传
 */
function startAllUploads() {
    fileQueue.forEach(fileItem => {
        // 启动待上传、错误和已暂停的文件
        if (fileItem.status === 'pending' || fileItem.status === 'error' || fileItem.status === 'paused') {
            startUpload(fileItem.id, false); // 传递false避免在循环中更新按钮
        }
    });
    // 循环结束后立即更新批量按钮
    updateBatchButtons();
}

/**
 * 全部暂停上传
 */
function pauseAllUploads() {
    fileQueue.forEach(fileItem => {
        if (fileItem.status === 'uploading') {
            pauseUpload(fileItem.id, false); // 传递false避免在循环中更新按钮
        }
    });
    // 循环结束后立即更新批量按钮
    updateBatchButtons();
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

    // 清空UI
    fileList.innerHTML = `
        <div class="empty-state">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <p>暂无文件，请选择文件开始上传</p>
        </div>
    `;

    updateBatchButtons();
}

// 事件监听器
startAllBtn.addEventListener('click', startAllUploads);
pauseAllBtn.addEventListener('click', pauseAllUploads);
clearAllBtn.addEventListener('click', clearAllFiles);

// 点击上传区域选择文件
uploadArea.addEventListener('click', () => fileInput.click());

// 文件选择处理
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        addFilesToQueue(Array.from(e.target.files));
        e.target.value = ''; // 清空input以允许重复选择相同文件
    }
});

// 拖拽上传支持
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        addFilesToQueue(Array.from(files));
    }
});

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    updateBatchButtons();
});
