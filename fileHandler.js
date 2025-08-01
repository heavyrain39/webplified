// fileHandler.js
import { showToast, getToastMessage } from './ui.js'; // ui.js에서 토스트 관련 함수 가져오기

// --- File Utility Functions ---
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function generateOutputFilename(originalName, rule, prefix, suffix, index, targetExtensionWithoutDot) {
    const originalNameWithoutExtension = originalName.substring(0, originalName.lastIndexOf('.'));
    let finalName = '';
    switch (rule) {
        case 'prefix':
            finalName = (prefix || '') + originalNameWithoutExtension;
            break;
        case 'suffix':
            finalName = originalNameWithoutExtension + (suffix || '');
            break;
        case 'numbering':
            const numberString = String(index + 1).padStart(3, '0');
            finalName = numberString + '_' + originalNameWithoutExtension;
            break;
        case 'original':
        default:
            finalName = originalNameWithoutExtension;
            break;
    }
    return `${finalName}.${targetExtensionWithoutDot}`;
}

// --- File Handling Logic ---
export function handleFiles(selectedFiles, state, domElements, uiCallbacks) {
    console.log(`[HANDLER-LOG] handleFiles called. Current mode: ${state.conversionMode}`);

    // ==============================================================================
    // === 핵심 수정 로직: 변환 결과가 표시된 상태에서 새 파일을 추가하면, 모든 것을 초기화 ===
    // ==============================================================================
    if (state.displayingResults) {
        console.log("[HANDLER-LOG] New files added while results were displayed. Clearing ALL old data for a new session.");

        state.filesToConvert.forEach(item => {
            if (item.thumbnailUrl) {
                console.log(`[HANDLER-LOG] Revoking old thumbnail URL: ${item.thumbnailUrl}`);
                URL.revokeObjectURL(item.thumbnailUrl);
            }
        });
        
        state.convertedFiles = [];
        console.log("[HANDLER-LOG] state.convertedFiles has been cleared.");

        state.filesToConvert.length = 0;
        console.log("[HANDLER-LOG] state.filesToConvert has been cleared.");

        state.displayingResults = false;
        console.log(`[HANDLER-LOG] state.displayingResults set to false.`);

        // hideConversionProgress를 호출하여 UI 상태를 초기화하고 버튼 등을 활성화
        uiCallbacks.hideConversionProgress();
    }
    // ==============================================================================

    const newFilesArray = Array.from(selectedFiles);
    const filesToActuallyAdd = [];
    const largeFilesForWarning = [];

    for (const file of newFilesArray) {
        if (state.filesToConvert.length + filesToActuallyAdd.length >= 100) {
            showToast(getToastMessage(state.currentLanguage, 'max_files_exceeded_error', { maxFiles: 100 }), 'error');
            break;
        }
        // Webplified에 맞게 최대 파일 사이즈 20MB로 상향
        const MAX_SIZE_MB_HARD = 20; const MAX_SIZE_BYTES_HARD = MAX_SIZE_MB_HARD * 1024 * 1024;
        const MAX_SIZE_MB_WARN = 10; const MAX_SIZE_BYTES_WARN = MAX_SIZE_MB_WARN * 1024 * 1024;

        if (file.size > MAX_SIZE_BYTES_HARD) {
            showToast(getToastMessage(state.currentLanguage, 'file_exceeds_limit_error', { fileName: file.name, fileSize: formatFileSize(file.size), maxSize: MAX_SIZE_MB_HARD }), 'error');
            continue;
        }
        
        // 파일 타입 검사는 이제 main.js에서 설정된 state.conversionMode를 기준으로 동작
        if (state.conversionMode === 'toWebp' && !['image/png', 'image/jpeg'].includes(file.type)) {
            showToast(getToastMessage(state.currentLanguage, 'invalid_file_type_to_webp_error', { fileName: file.name }), 'error');
            continue;
        } else if (state.conversionMode === 'fromWebp' && file.type !== 'image/webp') {
            showToast(getToastMessage(state.currentLanguage, 'invalid_file_type_from_webp_error', { fileName: file.name }), 'error');
            continue;
        }

        if (state.filesToConvert.some(f => f.file.name === file.name && f.file.size === file.size) ||
            filesToActuallyAdd.some(f => f.file.name === file.name && f.file.size === file.size)) {
            console.warn(`File ${file.name} is already in the list or being added, and will be skipped.`);
            continue;
        }
        if (file.size > MAX_SIZE_BYTES_WARN && file.size <= MAX_SIZE_BYTES_HARD) {
            largeFilesForWarning.push({ name: file.name, size: file.size });
        }

        const fileId = `file-${state.nextFileId++}`;
        let thumbnailUrl = null;
        if (file.type.startsWith('image/')) {
            try {
                thumbnailUrl = URL.createObjectURL(file);
            } catch (error) { console.error("Error creating object URL for:", file.name, error); }
        }
        filesToActuallyAdd.push({ id: fileId, file: file, thumbnailUrl: thumbnailUrl });
    }

    if (largeFilesForWarning.length > 0) {
        if (largeFilesForWarning.length === 1) {
            showToast(getToastMessage(state.currentLanguage, 'file_too_large_warning_single', { fileName: largeFilesForWarning[0].name, fileSize: formatFileSize(largeFilesForWarning[0].size) }), 'warning', 7000);
        } else {
            showToast(getToastMessage(state.currentLanguage, 'file_too_large_warning_multiple', { fileName: largeFilesForWarning[0].name, count: largeFilesForWarning.length - 1 }), 'warning', 7000);
        }
    }
    if (filesToActuallyAdd.length > 0) {
        state.filesToConvert.push(...filesToActuallyAdd);
        console.log(`[HANDLER-LOG] ${filesToActuallyAdd.length} new files pushed. Total filesToConvert: ${state.filesToConvert.length}`);
        state.displayingResults = false; 
        if (uiCallbacks.renderFilePoolList) uiCallbacks.renderFilePoolList();
    }
}

export function removeFileFromPool(fileIdToRemove, state, uiCallbacks) {
    const itemToRemove = state.filesToConvert.find(item => item.id === fileIdToRemove);
    if (itemToRemove) {
        if (itemToRemove.thumbnailUrl) {
             console.log(`[HANDLER-LOG] Revoking thumbnail URL for removed file: ${itemToRemove.thumbnailUrl}`);
             URL.revokeObjectURL(itemToRemove.thumbnailUrl);
        }
    }
    state.filesToConvert = state.filesToConvert.filter(item => item.id !== fileIdToRemove);
    
    // 마지막 파일이 제거되면, 목록이 비워지면서 초기 화면으로 돌아가게 됨 (main.js의 hardReset과 유사한 효과)
    if (state.filesToConvert.length === 0) {
        state.displayingResults = false;
        // renderFilePoolList는 내부적으로 updateSectionsVisibility를 호출하여 UI를 초기 상태로 만듦
        uiCallbacks.renderFilePoolList(); 
    } else {
        // 아직 파일이 남아있다면, 결과 화면 상태만 해제하고 목록을 다시 렌더링
        state.displayingResults = false; 
        if (uiCallbacks.renderFilePoolList) uiCallbacks.renderFilePoolList();
    }
}