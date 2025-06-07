// converter.worker.js

// This file is simplified as it doesn't need complex helper functions for this task.

// Main conversion function
async function convertImage(fileData) {
    // Destructure all needed properties from the incoming data object
    const { file, qualitySetting, fileId, originalName, originalSize, targetOutputFormat } = fileData;
    
    if (!file.type.startsWith('image/')) {
        self.postMessage({
            status: 'error',
            fileId: fileId,
            error: 'File is not an image.',
            originalName: originalName // Use data passed from main thread
        });
        return;
    }

    try {
        const imageBitmap = await createImageBitmap(file);
        const offscreenCanvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
        const ctx = offscreenCanvas.getContext('2d');
        ctx.drawImage(imageBitmap, 0, 0);

        let blob;
        const quality = qualitySetting / 100;
        let mimeType;

        switch (targetOutputFormat) {
            case 'webp':
                mimeType = 'image/webp';
                blob = await offscreenCanvas.convertToBlob({ type: mimeType, quality: quality });
                break;
            case 'png':
                mimeType = 'image/png';
                blob = await offscreenCanvas.convertToBlob({ type: mimeType });
                break;
            case 'jpg':
            case 'jpeg':
                mimeType = 'image/jpeg';
                blob = await offscreenCanvas.convertToBlob({ type: mimeType, quality: quality });
                break;
            default:
                throw new Error(`Unsupported target output format: ${targetOutputFormat}`);
        }
        
        imageBitmap.close();

        if (!blob) {
            throw new Error(`Failed to convert to ${mimeType}. Blob is null.`);
        }

        // Send back all the necessary data. This data was originally passed from the main thread.
        self.postMessage({
            status: 'success',
            fileId: fileId,
            originalName: originalName,
            originalSize: originalSize,
            convertedBlob: blob,
        });

    } catch (error) {
        self.postMessage({
            status: 'error',
            fileId: fileId,
            error: error.message || `Error converting to ${targetOutputFormat}.`,
            originalName: originalName
        });
    }
}


self.onmessage = function(e) {
    const fileData = e.data;

    if (typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined') {
        // Check for all required properties in the data object
        if (fileData && fileData.file && typeof fileData.qualitySetting === 'number' && fileData.fileId && fileData.targetOutputFormat && fileData.originalName && typeof fileData.originalSize === 'number') {
            convertImage(fileData);
        } else {
            self.postMessage({
                status: 'error',
                fileId: fileData ? fileData.fileId : null,
                error: 'Invalid or incomplete data received by worker.',
                originalName: fileData ? fileData.originalName : 'Unknown file'
            });
        }
    } else {
        self.postMessage({
            status: 'error',
            fileId: fileData ? fileData.fileId : null,
            error: 'OffscreenCanvas or createImageBitmap is not supported in this worker environment.',
            originalName: fileData ? fileData.originalName : 'Unknown file for unsupported API'
        });
    }
};