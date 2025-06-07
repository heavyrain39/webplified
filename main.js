// main.js
import { translations } from './translations.js';
import * as UI from './ui.js';
import * as FileHandler from './fileHandler.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded. Webplified. Main script starting.");

    const state = {
        themes: ["theme-default", "theme-cosmic-indigo", "theme-aetherial-light"],
        currentLanguage: 'ko', // Default, will be overridden
        conversionMode: 'toWebp',
        targetReverseFormat: 'png',
        filesToConvert: [],
        nextFileId: 0,
        convertedFiles: [],
        displayingResults: false,
        conversionWorker: null,
        totalFilesForCurrentBatch: 0,
        processedFilesCountInCurrentBatch: 0,
    };

    const domElements = {
        body: document.body,
        logoLink: document.getElementById('logo-link'),
        footerThemeButtons: document.querySelectorAll('.footer-theme-selector .theme-btn'),
        langButtons: document.querySelectorAll('.lang-btn'),
        modeToggleBtn: document.getElementById('mode-toggle-btn'),
        convertAllBtn: document.getElementById('convert-all-btn'),
        fileInput: document.getElementById('file-input'),
        dragDropArea: document.getElementById('drag-drop-area'),
        dragDropTextElement: document.getElementById('drag-drop-area').querySelector('p[data-i18n]'),
        conversionActionsSection: document.getElementById('conversion-actions-section'),
        conversionPoolSection: document.getElementById('conversion-pool-section'),
        settingsSection: document.getElementById('settings-section'),
        listTitleElement: document.getElementById('conversion-pool-section').querySelector('h3'),
        listAreaWrapper: document.getElementById('conversion-pool-section').querySelector('.list-area-wrapper'),
        fileListElement: document.getElementById('file-list-pool'),
        downloadAllZipBtn: document.getElementById('download-all-zip-btn'),
        clearPoolBtn: document.getElementById('clear-pool-btn'),
        conversionOverlay: document.querySelector('.conversion-overlay.global-overlay'),
        progressBarFill: document.querySelector('.conversion-overlay.global-overlay .progress-bar-fill'),
        progressPercentageText: document.querySelector('.conversion-overlay.global-overlay .progress-percentage'),
        qualitySlider: document.getElementById('quality-slider'),
        qualityValueDisplayElement: document.getElementById('quality-value-display'),
        qualityTooltipTextElement: document.querySelector('.tooltip-text[data-i18n="quality_tooltip_text"]'),
        filenameOptionSelect: document.getElementById('filename-option'),
        filenamePrefixInput: document.getElementById('filename-prefix'),
        filenameSuffixInput: document.getElementById('filename-suffix'),
        reverseFormatSettingGroup: document.querySelector('.reverse-format-setting-group'),
        formatToggleSwitch: document.getElementById('format-toggle-switch'),
        toggleOptions: document.getElementById('format-toggle-switch') ? document.getElementById('format-toggle-switch').querySelectorAll('.toggle-option') : [],
        toggleSliderElement: document.getElementById('format-toggle-switch') ? document.getElementById('format-toggle-switch').querySelector('.toggle-slider') : null,
        comparisonModal: document.getElementById('comparison-modal'),
        comparisonSliderContainer: document.getElementById('comparison-slider-container'),
        closeModalBtn: document.getElementById('comparison-modal') ? document.getElementById('comparison-modal').querySelector('.close-modal-btn') : null,
        supportLinkBtn: document.getElementById('support-link-btn'),
    };
    
    function updateSectionsVisibility() {
        const hasFilesOrResults = state.filesToConvert.length > 0 || state.convertedFiles.length > 0;

        if (hasFilesOrResults) {
            domElements.conversionActionsSection.classList.remove('section-hidden');
            domElements.conversionPoolSection.classList.remove('section-hidden');
            domElements.settingsSection.classList.remove('section-hidden');
        } else {
            domElements.conversionActionsSection.classList.add('section-hidden');
            domElements.conversionPoolSection.classList.add('section-hidden');
        }
    }
    
    function hardReset() {
        console.log("[MAIN-LOG] Performing hard reset.");
        state.filesToConvert.forEach(item => {
            if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
        });
        state.filesToConvert.length = 0;
        state.convertedFiles = [];
        state.displayingResults = false;
        
        if (domElements.qualitySlider) {
            domElements.qualitySlider.value = 90;
            domElements.qualityValueDisplayElement.textContent = '90%';
        }
        if (domElements.filenameOptionSelect) {
            domElements.filenameOptionSelect.value = 'original';
        }
        uiCallbacks.updateFilenameInputStates();
        
        uiCallbacks.renderFilePoolList(); 
        
        domElements.settingsSection.classList.add('section-hidden'); 
    }

    const SvgIcons = {
        trash: `
            <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" class="bi bi-trash3-fill" viewBox="0 0 16 16">
                <path d="M11 1.5v1h3.5a.5.5 0 0 1 0 1h-.538l-.853 10.66A2 2 0 0 1 11.115 16h-6.23a2 2 0 0 1-1.994-1.84L2.038 3.5H1.5a.5.5 0 0 1 0-1H5v-1A1.5 1.5 0 0 1 6.5 0h3A1.5 1.5 0 0 1 11 1.5m-5 0v1h4v-1a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5M4.5 5.029l.5 8.5a.5.5 0 1 0 .998-.06l-.5-8.5a.5.5 0 1 0-.998.06Zm6.53-.528a.5.5 0 0 0-.528.47l-.5 8.5a.5.5 0 0 0 .998.058l.5-8.5a.5.5 0 0 0-.47-.528ZM8 4.5a.5.5 0 0 0-.5.5v8.5a.5.5 0 0 0 1 0V5a.5.5 0 0 0-.5-.5"/>
            </svg>
        `,
        download: `
            <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" class="bi bi-download" viewBox="0 0 16 16">
                <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
                <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/>
            </svg>
        `,
        compare: `
            <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" class="bi bi-layout-split" viewBox="0 0 16 16">
                <path d="M0 3a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm8.5-1v12H14a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1zm-1 0H2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h5.5z"/>
            </svg>
        `
    };
    UI.setSvgIcons(SvgIcons);

    const handleOrderChange = (fromIndex, toIndex) => {
        if (fromIndex < toIndex) {
            toIndex--;
        }
        const [item] = state.filesToConvert.splice(fromIndex, 1);
        state.filesToConvert.splice(toIndex, 0, item);
        uiCallbacks.renderFilePoolList();
    };


    const uiCallbacks = {
        updateFilenameInputStates: () => UI.updateFilenameInputStates(domElements.filenameOptionSelect, domElements.filenamePrefixInput, domElements.filenameSuffixInput),
        updateListTitleAndCount: () => UI.updateListTitleAndCount(domElements.listTitleElement, state.displayingResults, state.filesToConvert.length, state.convertedFiles.length, state.currentLanguage),
        updateQualitySliderAndTooltip: () => UI.updateQualitySliderAndTooltip(state.conversionMode, state.targetReverseFormat, domElements.qualitySlider, domElements.qualityValueDisplayElement, domElements.qualityTooltipTextElement, state.currentLanguage),
        renderFilePoolList: () => {
            UI.renderFilePoolList(state.filesToConvert, domElements.fileListElement, domElements.listAreaWrapper, FileHandler.formatFileSize, state.currentLanguage, proxyRemoveFileFromPool, handleOrderChange);
            uiCallbacks.updateListTitleAndCount();
            UI.showCorrectTitleButtons(state.displayingResults, domElements.clearPoolBtn, domElements.downloadAllZipBtn, state.convertedFiles.length, state.filesToConvert.length);
            updateSectionsVisibility();
        },
        renderConversionResults: () => {
            UI.renderConversionResults(state.convertedFiles, domElements.fileListElement, FileHandler.formatFileSize, state.currentLanguage, openComparisonModal);
            uiCallbacks.updateListTitleAndCount();
            UI.showCorrectTitleButtons(state.displayingResults, domElements.clearPoolBtn, domElements.downloadAllZipBtn, state.convertedFiles.length, state.filesToConvert.length);
            updateSectionsVisibility();
        },
        hideConversionProgress: () => UI.hideConversionProgressUI(
            domElements.conversionOverlay, domElements.listAreaWrapper,
            domElements.clearPoolBtn, domElements.convertAllBtn, domElements.fileInput,
            domElements.dragDropArea, domElements.fileListElement,
            state.filesToConvert.length, state.displayingResults, state.currentLanguage
        )
    };

    function proxyRemoveFileFromPool(fileIdToRemove) {
        FileHandler.removeFileFromPool(fileIdToRemove, state, uiCallbacks);
    }

    function initializeWorker() {
        if (window.Worker) {
            if (!state.conversionWorker) {
                try {
                    state.conversionWorker = new Worker('converter.worker.js');
                    state.conversionWorker.onmessage = (e) => {
                        const { status, fileId, originalName, originalSize, convertedBlob, error: errorMessage } = e.data;
                        if (status === 'success') {
                            const originalFileItem = state.filesToConvert.find(item => item.id === fileId);
                            if (!originalFileItem) {
                                console.error(`CRITICAL: Could not find original file item for ID: ${fileId}. Skipping result.`);
                                state.processedFilesCountInCurrentBatch++;
                                UI.updateProgressBarReal(state.processedFilesCountInCurrentBatch, state.totalFilesForCurrentBatch, domElements.progressBarFill, domElements.progressPercentageText);
                                return;
                            }

                            let finalConvertedName = '';
                            let targetExtension = state.conversionMode === 'toWebp' ? 'webp' : state.targetReverseFormat;
                            
                            const filenameRule = domElements.filenameOptionSelect.value;
                            const prefixValue = domElements.filenamePrefixInput.value;
                            const suffixValue = domElements.filenameSuffixInput.value;
                            const fileIndexInBatch = state.filesToConvert.findIndex(item => item.id === fileId);
                            finalConvertedName = FileHandler.generateOutputFilename(originalName, filenameRule, prefixValue, suffixValue, fileIndexInBatch, targetExtension);
                            
                            state.convertedFiles.push({
                                fileId,
                                originalName,
                                originalSize,
                                convertedBlob,
                                convertedName: finalConvertedName,
                                originalFile: originalFileItem.file 
                            });

                        } else {
                            console.error(`Conversion failed for ${originalName || `File ID: ${fileId}`}:`, errorMessage);
                            UI.showToast(UI.getToastMessage(state.currentLanguage, 'conversion_error_generic', { fileName: originalName || `File ID: ${fileId}`, errorMessage: errorMessage }), 'error', 0);
                        }
                        
                        state.processedFilesCountInCurrentBatch++;
                        UI.updateProgressBarReal(state.processedFilesCountInCurrentBatch, state.totalFilesForCurrentBatch, domElements.progressBarFill, domElements.progressPercentageText);

                        if (state.processedFilesCountInCurrentBatch === state.totalFilesForCurrentBatch) {
                            UI.stopOptimisticProgress();
                            
                            if (domElements.filenameOptionSelect.value === 'numbering') {
                                state.convertedFiles.sort((a, b) => a.convertedName.localeCompare(b.convertedName, undefined, { numeric: true, sensitivity: 'base' }));
                            }
                            
                            const finalDelay = 250;

                            setTimeout(() => {
                                state.displayingResults = true;
                                uiCallbacks.renderConversionResults();
                                UI.hideConversionProgressUI(domElements.conversionOverlay, domElements.listAreaWrapper, domElements.clearPoolBtn, domElements.convertAllBtn, domElements.fileInput, domElements.dragDropArea, domElements.fileListElement, 0, state.displayingResults, state.currentLanguage);
                                
                                if (state.convertedFiles.length > 0 && state.convertedFiles.length === state.totalFilesForCurrentBatch) {
                                    UI.showToast(UI.getToastMessage(state.currentLanguage, 'all_conversions_complete_success'), 'success');
                                }
                                
                                uiCallbacks.updateListTitleAndCount();
                                UI.showCorrectTitleButtons(state.displayingResults, domElements.clearPoolBtn, domElements.downloadAllZipBtn, state.convertedFiles.length, state.filesToConvert.length);

                            }, finalDelay);
                        }
                    };
                    state.conversionWorker.onerror = (err) => {
                        console.error('Error in Web Worker:', err.message, err);
                        UI.hideConversionProgressUI(domElements.conversionOverlay, domElements.listAreaWrapper, domElements.clearPoolBtn, domElements.convertAllBtn, domElements.fileInput, domElements.dragDropArea, domElements.fileListElement, state.filesToConvert.length, state.displayingResults, state.currentLanguage);
                        state.totalFilesForCurrentBatch = 0; state.processedFilesCountInCurrentBatch = 0;
                        UI.showToast(UI.getToastMessage(state.currentLanguage, "conversion_error_generic", { fileName: "Conversion Worker", errorMessage: err.message || "Unknown worker error" }), 'error', 0);
                    };
                } catch (e) {
                    console.error("Failed to create Web Worker:", e); state.conversionWorker = null;
                    UI.showToast(UI.getToastMessage(state.currentLanguage, "conversion_error_generic", { fileName: "Conversion Worker", errorMessage: "Initialization failed."}), 'error', 0);
                }
            }
        } else {
            console.error('Web Workers are not supported in this browser.');
            UI.showToast(UI.getToastMessage(state.currentLanguage, 'error_web_worker_unsupported'), 'error', 0);
        }
    }

    function startAllConversionsWithWorker() {
        if (!state.conversionWorker) {
            UI.showToast(UI.getToastMessage(state.currentLanguage, "conversion_error_generic", { fileName: "Worker", errorMessage: "Not ready."}), 'error', 0);
            uiCallbacks.hideConversionProgress();
            state.totalFilesForCurrentBatch = 0; state.processedFilesCountInCurrentBatch = 0; return;
        }
        const qualitySetting = parseInt(domElements.qualitySlider.value, 10);
        if (state.filesToConvert.length === 0) {
            uiCallbacks.hideConversionProgress();
            return;
        }

        let workerTargetOutputFormat;
        if (state.conversionMode === 'toWebp') workerTargetOutputFormat = 'webp';
        else if (state.conversionMode === 'fromWebp') workerTargetOutputFormat = state.targetReverseFormat;
        else {
            uiCallbacks.hideConversionProgress();
            return;
        }
        state.filesToConvert.forEach(fileItem => {
            state.conversionWorker.postMessage({ 
                file: fileItem.file, 
                qualitySetting: qualitySetting, 
                fileId: fileItem.id, 
                originalName: fileItem.file.name,
                originalSize: fileItem.file.size,
                targetOutputFormat: workerTargetOutputFormat 
            });
        });
    }

    function openComparisonModal(fileId) {
        UI.openComparisonModalUI(fileId, state.convertedFiles, domElements.comparisonModal, domElements.comparisonSliderContainer, state.currentLanguage);
    }

    // --- EVENT LISTENERS ---

    if (domElements.logoLink) {
        domElements.logoLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (state.filesToConvert.length > 0 || state.convertedFiles.length > 0) {
                hardReset();
                UI.showToast(UI.getToastMessage(state.currentLanguage, 'pool_cleared_info'), 'info');
            }
        });
    }

    domElements.footerThemeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const themeName = button.dataset.theme;
            UI.applyTheme(themeName, state.themes, domElements.body, domElements.footerThemeButtons, true, state.currentLanguage);
        });
    });

    domElements.langButtons.forEach(button => {
        button.addEventListener('click', () => {
            const lang = button.dataset.lang;
            UI.updateTexts(lang, state, domElements, uiCallbacks, true);
        });
    });

    if (domElements.modeToggleBtn) {
        domElements.modeToggleBtn.addEventListener('click', () => {
            hardReset();
            
            if (state.conversionMode === 'toWebp') {
                state.conversionMode = 'fromWebp';
                domElements.modeToggleBtn.dataset.i18n = "toggle_mode_webp_to_png_jpg";
                if (domElements.dragDropTextElement) domElements.dragDropTextElement.dataset.i18n = "drag_drop_text_from_webp";
                if (domElements.fileInput) domElements.fileInput.accept = ".webp";
                if (domElements.reverseFormatSettingGroup) domElements.reverseFormatSettingGroup.style.display = 'flex';
                state.targetReverseFormat = 'png';
                UI.updateToggleSwitchUI(state.targetReverseFormat, domElements.toggleOptions, domElements.toggleSliderElement);
            } else {
                state.conversionMode = 'toWebp';
                domElements.modeToggleBtn.dataset.i18n = "toggle_mode_png_jpg_to_webp";
                if (domElements.dragDropTextElement) domElements.dragDropTextElement.dataset.i18n = "drag_drop_text_to_webp";
                if (domElements.fileInput) domElements.fileInput.accept = ".png,.jpg,.jpeg";
                if (domElements.reverseFormatSettingGroup) domElements.reverseFormatSettingGroup.style.display = 'none';
            }

            uiCallbacks.updateQualitySliderAndTooltip();
            UI.updateTexts(state.currentLanguage, state, domElements, uiCallbacks, false);
        });
    }

    if (domElements.convertAllBtn) {
        domElements.convertAllBtn.addEventListener('click', () => {
            if (state.filesToConvert.length === 0) {
                UI.showToast(UI.getToastMessage(state.currentLanguage, "no_files_to_convert_warning"), 'warning');
                return;
            }
            domElements.convertAllBtn.textContent = UI.getToastMessage(state.currentLanguage, "converting_btn_text");
            state.totalFilesForCurrentBatch = state.filesToConvert.length;
            state.processedFilesCountInCurrentBatch = 0;
            state.convertedFiles = [];
            
            UI.showConversionProgressUI(domElements.conversionOverlay, domElements.listAreaWrapper, domElements.progressBarFill, domElements.progressPercentageText, domElements.clearPoolBtn, domElements.convertAllBtn, domElements.fileInput, domElements.dragDropArea);
            
            initializeWorker();
            startAllConversionsWithWorker();
        });
    }

    if (domElements.clearPoolBtn) {
        domElements.clearPoolBtn.addEventListener('click', () => {
            if (domElements.listAreaWrapper.classList.contains('processing')) return;
            state.filesToConvert.forEach(item => {
                if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
            });
            state.filesToConvert.length = 0;
            uiCallbacks.renderFilePoolList();
            UI.showToast(UI.getToastMessage(state.currentLanguage, 'pool_cleared_info'), 'info');
        });
    }

    if (domElements.downloadAllZipBtn) {
        domElements.downloadAllZipBtn.addEventListener('click', async () => {
            if (state.convertedFiles.length === 0) {
                UI.showToast(UI.getToastMessage(state.currentLanguage, "no_converted_files_warning"), 'warning');
                return;
            }
            const zip = new JSZip();
            state.convertedFiles.forEach(item => { if (item.convertedBlob instanceof Blob) zip.file(item.convertedName, item.convertedBlob); else console.warn(`Skipping ${item.convertedName}`); });

            domElements.downloadAllZipBtn.disabled = true;
            const originalZipText = domElements.downloadAllZipBtn.textContent;
            domElements.downloadAllZipBtn.textContent = UI.getToastMessage(state.currentLanguage, "zipping_btn_text");
            UI.showToast(UI.getToastMessage(state.currentLanguage, 'zip_creation_started_info'), 'info', 2500);

            try {
                const zipBlob = await zip.generateAsync({ type: "blob" });
                const now = new Date(); const dateString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const zipFileNamePrefix = UI.getToastMessage(state.currentLanguage, "zip_filename_prefix");
                const fileName = `${zipFileNamePrefix}${dateString}.zip`;

                const link = document.createElement('a'); link.href = URL.createObjectURL(zipBlob); link.download = fileName;
                document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(link.href);
                UI.showToast(UI.getToastMessage(state.currentLanguage, 'zip_ready_success'), 'success');
            } catch (error) {
                console.error("Error creating ZIP file:", error);
                UI.showToast(UI.getToastMessage(state.currentLanguage, "error_creating_zip", { message: error.message }), 'error', 0);
            } finally {
                domElements.downloadAllZipBtn.disabled = false;
                domElements.downloadAllZipBtn.textContent = originalZipText;
            }
        });
    }

    if (domElements.qualitySlider && domElements.qualityValueDisplayElement) {
        domElements.qualitySlider.addEventListener('input', (e) => {
            if (!domElements.qualitySlider.disabled) domElements.qualityValueDisplayElement.textContent = `${e.target.value}%`;
        });
    }
    if (domElements.filenameOptionSelect) {
        domElements.filenameOptionSelect.addEventListener('change', uiCallbacks.updateFilenameInputStates);
    }

    if (domElements.toggleOptions && domElements.toggleOptions.length > 0 && domElements.toggleSliderElement) {
        domElements.toggleOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                const selectedFormat = e.currentTarget.dataset.format;
                if (state.targetReverseFormat !== selectedFormat) {
                    state.targetReverseFormat = selectedFormat;
                    UI.updateToggleSwitchUI(state.targetReverseFormat, domElements.toggleOptions, domElements.toggleSliderElement);
                    uiCallbacks.updateQualitySliderAndTooltip();
                }
            });
        });
    }

    if (domElements.dragDropArea) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            domElements.dragDropArea.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
        });
        ['dragenter', 'dragover'].forEach(eventName => {
            domElements.dragDropArea.addEventListener(eventName, (e) => {
                if (domElements.listAreaWrapper.classList.contains('processing')) return;
                if (e.dataTransfer.types.includes('Files')) domElements.dragDropArea.classList.add('drag-over');
            }, false);
        });
        ['dragleave', 'drop'].forEach(eventName => {
            domElements.dragDropArea.addEventListener(eventName, () => { domElements.dragDropArea.classList.remove('drag-over'); }, false);
        });
        domElements.dragDropArea.addEventListener('drop', (e) => {
            if (domElements.listAreaWrapper.classList.contains('processing')) return;
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                FileHandler.handleFiles(e.dataTransfer.files, state, domElements, uiCallbacks);
            }
        }, false);
    }

    if (domElements.fileInput) {
        domElements.fileInput.addEventListener('click', (e) => { if (domElements.listAreaWrapper.classList.contains('processing')) e.preventDefault(); });
        domElements.fileInput.addEventListener('change', (e) => {
            if (domElements.listAreaWrapper.classList.contains('processing')) { e.target.value = null; return; }
            if (e.target.files) { FileHandler.handleFiles(e.target.files, state, domElements, uiCallbacks); e.target.value = null; }
        });
    }

    if (domElements.closeModalBtn) {
        domElements.closeModalBtn.addEventListener('click', () => UI.closeComparisonModalUI(domElements.comparisonModal, domElements.comparisonSliderContainer));
    }
    if (domElements.comparisonModal) {
        domElements.comparisonModal.addEventListener('click', (event) => {
            if (event.target === domElements.comparisonModal) UI.closeComparisonModalUI(domElements.comparisonModal, domElements.comparisonSliderContainer);
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && domElements.comparisonModal.style.display === 'flex') {
                UI.closeComparisonModalUI(domElements.comparisonModal, domElements.comparisonSliderContainer);
            }
        });
    }

    // --- NEW: Language determination logic ---
    function getInitialLanguage() {
        const urlParams = new URLSearchParams(window.location.search);
        const langFromUrl = urlParams.get('lang');
        if (langFromUrl && translations[langFromUrl]) {
            console.log(`Language set from URL parameter: ${langFromUrl}`);
            return langFromUrl;
        }

        const langFromStorage = localStorage.getItem('webpConverterLang');
        if (langFromStorage && translations[langFromStorage]) {
            console.log(`Language set from localStorage: ${langFromStorage}`);
            return langFromStorage;
        }

        const langFromBrowser = navigator.language.split('-')[0];
        if (translations[langFromBrowser]) {
            console.log(`Language set from browser preference: ${langFromBrowser}`);
            return langFromBrowser;
        }
        
        console.log("Using default language: en");
        return 'en'; // Fallback
    }

    function init() {
        console.log("[MAIN-LOG] Initializing application.");
        
        const initialLang = getInitialLanguage();
        UI.updateTexts(initialLang, state, domElements, uiCallbacks, false);

        UI.loadThemePreference(state.themes, domElements.body, domElements.footerThemeButtons, state.currentLanguage);
        if(domElements.fileInput) domElements.fileInput.accept = state.conversionMode === 'toWebp' ? ".png,.jpg,.jpeg" : ".webp";
        if(domElements.reverseFormatSettingGroup) domElements.reverseFormatSettingGroup.style.display = state.conversionMode === 'fromWebp' ? 'flex' : 'none';
        
        UI.updateToggleSwitchUI(state.targetReverseFormat, domElements.toggleOptions, domElements.toggleSliderElement);
        uiCallbacks.updateFilenameInputStates();
        initializeWorker();
        state.displayingResults = false;
    }
    init();

});