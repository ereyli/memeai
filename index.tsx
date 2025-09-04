import { GoogleGenAI, Type, Modality } from "@google/genai";

// --- DOM ELEMENT SELECTION ---
const canvas = document.getElementById('meme-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');

const imagePlaceholder = document.getElementById('image-placeholder') as HTMLDivElement;
const uploadBtn = document.getElementById('upload-btn') as HTMLButtonElement;
const imageUpload = document.getElementById('image-upload') as HTMLInputElement;
const removeImageBtn = document.getElementById('remove-image-btn') as HTMLButtonElement;
const imageTray = document.getElementById('image-tray') as HTMLDivElement;

const topTextInput = document.getElementById('top-text-input') as HTMLInputElement;
const bottomTextInput = document.getElementById('bottom-text-input') as HTMLInputElement;
const fontSizeSlider = document.getElementById('font-size-slider') as HTMLInputElement;
const textColorPicker = document.getElementById('text-color-picker') as HTMLInputElement;

const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
const styleSelect = document.getElementById('style-select') as HTMLSelectElement;
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
const autoMemeBtn = document.getElementById('auto-meme-btn') as HTMLButtonElement;
const enhanceBtn = document.getElementById('enhance-btn') as HTMLButtonElement;
const combineBtn = document.getElementById('combine-btn') as HTMLButtonElement;
const captionsList = document.getElementById('captions-list') as HTMLUListElement;

const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;
const shareTwitterBtn = document.getElementById('share-twitter-btn') as HTMLButtonElement;
const remixBtn = document.getElementById('remix-btn') as HTMLButtonElement;

// --- STATE MANAGEMENT ---
interface ImageData {
    id: number;
    src: string;
}

let image: HTMLImageElement | null = null;
let uploadedImages: ImageData[] = [];
let nextImageId = 0;
let baseImageId: number | null = null;
let sourceImageIds: number[] = [];
let topText = '';
let bottomText = '';
let fontSize = 40;
let textColor = '#ffffff';

// State for text dragging
let topTextPosition: { rx: number; ry: number } | null = null;
let bottomTextPosition: { rx: number; ry: number } | null = null;
let isDragging = false;
let draggingText: 'top' | 'bottom' | null = null;
let dragStartX = 0;
let dragStartY = 0;

// --- GEMINI API INITIALIZATION & ERROR HANDLING ---
let ai: GoogleGenAI | null = null;
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
    console.error("VITE_GEMINI_API_KEY environment variable not set. AI features will be disabled.");
    const allAIButtons = [generateBtn, autoMemeBtn, enhanceBtn, combineBtn];
    allAIButtons.forEach(btn => {
        if(btn) {
            btn.disabled = true;
            const btnText = btn.querySelector('.btn-text');
            if (btnText) {
                btnText.textContent = 'AI Disabled';
            }
        }
    });
} else {
    try {
        ai = new GoogleGenAI({ apiKey });
    } catch (error) {
        console.error("Failed to initialize GoogleGenAI:", error);
        const allAIButtons = [generateBtn, autoMemeBtn, enhanceBtn, combineBtn];
        allAIButtons.forEach(btn => {
            if(btn) {
                btn.disabled = true;
                const btnText = btn.querySelector('.btn-text');
                if (btnText) {
                    btnText.textContent = 'AI Error';
                }
            }
        });
    }
}

function getApiErrorMessage(error: any): string {
    let errorMessage = 'An unknown error occurred. Please try again.';

    if (error instanceof Error) {
        if (error.message.includes('timed out')) {
            return 'The AI is taking too long to respond. Please try again.';
        }
        errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
        const potentialError = error.error || error;
        if (potentialError && typeof potentialError.message === 'string') {
            errorMessage = potentialError.message;
        } else {
            try {
                errorMessage = JSON.stringify(error);
            } catch { /* Ignore stringify errors */ }
        }
    } else if (typeof error === 'string') {
        errorMessage = error;
    }

    if (errorMessage.toLowerCase().includes("api key not valid")) {
        return "The API key is invalid or missing. Please contact support.";
    }
    if (errorMessage.toUpperCase().includes("SAFETY")) {
        return "The request was blocked due to safety settings. Please modify your prompt.";
    }

    return errorMessage;
}


function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    const timeout = new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
    );
    return Promise.race([promise, timeout]);
}

// --- CANVAS LOGIC ---
function resetTextPositions() {
    if (!ctx || !image || !canvas.width || !canvas.height) return;
    topTextPosition = { rx: 0.5, ry: (fontSize * 1.2) / canvas.height };
    bottomTextPosition = { rx: 0.5, ry: (canvas.height - (fontSize * 0.4)) / canvas.height };
}

function redrawCanvas() {
    if (!ctx || !image) return;
    const canvasContainer = document.getElementById('canvas-container')!;
    const canvasWidth = canvasContainer.clientWidth;
    const scale = Math.min(canvasWidth / image.width, canvasWidth / image.height);
    const imgWidth = image.width * scale;
    const imgHeight = image.height * scale;
    canvas.width = imgWidth;
    canvas.height = imgHeight;
    if (topTextPosition === null) {
        resetTextPositions();
    }
    if (!topTextPosition || !bottomTextPosition) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = textColor;
    ctx.strokeStyle = 'black';
    ctx.lineWidth = fontSize / 15;
    ctx.font = `bold ${fontSize}px Impact`;
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    const topX = topTextPosition.rx * canvas.width;
    const topY = topTextPosition.ry * canvas.height;
    ctx.strokeText(topText.toUpperCase(), topX, topY);
    ctx.fillText(topText.toUpperCase(), topX, topY);
    const bottomX = bottomTextPosition.rx * canvas.width;
    const bottomY = bottomTextPosition.ry * canvas.height;
    ctx.strokeText(bottomText.toUpperCase(), bottomX, bottomY);
    ctx.fillText(bottomText.toUpperCase(), bottomX, bottomY);
}

// --- UI & STATE HELPER FUNCTIONS ---

function updateActionButtonsState() {
    const hasBase = baseImageId !== null;
    const hasSource = sourceImageIds.length > 0;
    const hasPrompt = promptInput.value.trim() !== '';
    const aiReady = !!ai;

    generateBtn.disabled = !hasPrompt || !aiReady;
    autoMemeBtn.disabled = !hasBase || !aiReady;
    enhanceBtn.disabled = !(hasBase && hasPrompt) || !aiReady;
    combineBtn.disabled = !(hasBase && hasSource && hasPrompt) || !aiReady;
}


function setBaseImage(imageData: ImageData | null) {
    if (imageData) {
        baseImageId = imageData.id;
        // An image cannot be a base and a source at the same time.
        sourceImageIds = sourceImageIds.filter(id => id !== baseImageId);
        
        const newImage = new Image();
        newImage.onload = () => {
            image = newImage;
            imagePlaceholder.style.display = 'none';
            removeImageBtn.style.display = 'flex';
            topTextPosition = null;
            redrawCanvas();
        };
        newImage.src = imageData.src;
    } else {
        baseImageId = null;
        image = null;
        imagePlaceholder.style.display = 'flex';
        removeImageBtn.style.display = 'none';
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;
    }
    renderImageTray();
}

function renderImageTray() {
    imageTray.style.display = uploadedImages.length > 0 ? 'flex' : 'none';
    imageTray.innerHTML = '';
    
    uploadedImages.forEach(imgData => {
        const thumbContainer = document.createElement('div');
        thumbContainer.className = 'thumbnail-container';

        const thumb = document.createElement('img');
        thumb.src = imgData.src;
        thumb.className = 'variation-thumbnail';
        thumbContainer.setAttribute('data-tooltip', 'Click to cycle role: Source -> Base -> Deselect');

        const isBase = imgData.id === baseImageId;
        const isSource = sourceImageIds.includes(imgData.id);

        if (isBase) {
            thumb.classList.add('base-selection');
            thumbContainer.classList.add('base-selected');
        }
        if (isSource) {
            thumb.classList.add('source-selection');
            thumbContainer.classList.add('source-selected');
        }

        thumbContainer.addEventListener('click', () => {
            // Clear all selection classes first
            thumbContainer.classList.remove('base-selected', 'source-selected');
            thumb.classList.remove('base-selection', 'source-selection');
            
            if (isSource) { // Cycle from Source to Base
                sourceImageIds = sourceImageIds.filter(id => id !== imgData.id);
                setBaseImage(imgData); // This also removes it from sourceIds and rerenders
            } else if (isBase) { // Cycle from Base to Deselected
                setBaseImage(null); // This sets baseImageId to null and rerenders
            } else { // Cycle from Deselected to Source
                sourceImageIds.push(imgData.id);
                renderImageTray(); // Just rerender the tray
            }
        });
        
        const removeThumbBtn = document.createElement('button');
        removeThumbBtn.className = 'remove-thumb-btn';
        removeThumbBtn.innerHTML = '<i class="fa-solid fa-times"></i>';
        removeThumbBtn.title = 'Remove this image';
        removeThumbBtn.onclick = (e) => {
            e.stopPropagation();
            uploadedImages = uploadedImages.filter(img => img.id !== imgData.id);
            if (baseImageId === imgData.id) {
                setBaseImage(null);
            }
            sourceImageIds = sourceImageIds.filter(id => id !== imgData.id);
            renderImageTray();
        };
        
        thumbContainer.appendChild(thumb);

        // Add clear role indicators
        if (isBase || isSource) {
            const roleBadge = document.createElement('div');
            roleBadge.className = 'role-badge';
            roleBadge.innerHTML = isBase ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-solid fa-layer-group"></i>';
            roleBadge.setAttribute('data-tooltip', isBase ? 'Base Image (Ana Görsel)' : 'Source Image (Kaynak Görsel)');
            roleBadge.classList.add(isBase ? 'base-badge' : 'source-badge');
            thumbContainer.appendChild(roleBadge);
        }

        thumbContainer.appendChild(removeThumbBtn);
        imageTray.appendChild(thumbContainer);
    });
    
    if (uploadedImages.length > 0) {
        const addImageBtn = document.createElement('button');
        addImageBtn.className = 'add-image-btn';
        addImageBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
        addImageBtn.title = 'Add more images';
        addImageBtn.onclick = () => imageUpload.click();
        imageTray.appendChild(addImageBtn);
    }
    
    updateActionButtonsState();
}

function isMouseOverText(mouseX: number, mouseY: number, text: string, textRelPos: { rx: number; ry: number } | null) {
    if (!ctx || !textRelPos || text.trim() === '') return false;
    const textAbsPos = { x: textRelPos.rx * canvas.width, y: textRelPos.ry * canvas.height };
    ctx.font = `bold ${fontSize}px Impact`;
    const textMetrics = ctx.measureText(text.toUpperCase());
    const textWidth = textMetrics.width;
    const textHeight = fontSize;
    const textLeft = textAbsPos.x - textWidth / 2;
    const textRight = textAbsPos.x + textWidth / 2;
    const textTop = textAbsPos.y - textHeight;
    const textBottom = textAbsPos.y + (textHeight * 0.2);
    return mouseX >= textLeft && mouseX <= textRight && mouseY >= textTop && mouseY <= textBottom;
}

function triggerMemeDownload(): boolean {
    if (!image) {
        return false;
    }
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'memehub-meme.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
}

// --- EVENT LISTENERS ---

uploadBtn.addEventListener('click', () => imageUpload.click());

imageUpload.addEventListener('change', (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (!files) return;
    
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            const newImage = { id: nextImageId++, src: dataUrl };
            uploadedImages.push(newImage);
            
            if (uploadedImages.length === 1) {
                setBaseImage(newImage);
            } else {
                renderImageTray();
            }
        };
        reader.readAsDataURL(file);
    });
    
    imageUpload.value = '';
});

removeImageBtn.addEventListener('click', () => {
    if (baseImageId === null) return;
    uploadedImages = uploadedImages.filter(img => img.id !== baseImageId);
    setBaseImage(null);
});

topTextInput.addEventListener('input', (e) => { topText = (e.target as HTMLInputElement).value; redrawCanvas(); });
bottomTextInput.addEventListener('input', (e) => { bottomText = (e.target as HTMLInputElement).value; redrawCanvas(); });
fontSizeSlider.addEventListener('input', (e) => { 
  fontSize = parseInt((e.target as HTMLInputElement).value, 10); 
  redrawCanvas(); 
});
textColorPicker.addEventListener('input', (e) => { textColor = (e.target as HTMLInputElement).value; redrawCanvas(); });
promptInput.addEventListener('input', updateActionButtonsState);

autoMemeBtn.addEventListener('click', async () => {
    if (!ai || baseImageId === null) return;

    const currentImage = uploadedImages.find(i => i.id === baseImageId);
    if (!currentImage) {
        alert("Please select a base image first.");
        return;
    }

    const originalBtnContent = autoMemeBtn.innerHTML;
    autoMemeBtn.disabled = true;
    (autoMemeBtn.querySelector('.btn-text') as HTMLElement).textContent = 'Thinking...';
    autoMemeBtn.insertAdjacentHTML('afterbegin', '<span class="loader"></span>');
    captionsList.innerHTML = '<li>Analyzing image to create a meme...</li>';

    try {
        const selectedStyle = styleSelect.value;
        const isAutoStyle = selectedStyle === 'Auto';
        
        const captionSystemInstruction = `You are an AI assistant for MemeHub, a crypto meme generator. You are an expert in web3, cryptocurrencies (like Bitcoin, Ethereum), and internet meme culture. Your goal is to be a creative meme expert. You will analyze a provided image and generate a complete meme concept with witty, and culturally relevant meme captions. The captions must be concise and suitable for placing on a meme image as top and bottom text.`;
        
        let responseSchema: any;
        let textPrompt: string;

        const baseCaptionSchema = {
            type: Type.ARRAY, description: "A list of 3 to 5 meme captions.",
            items: {
                type: Type.OBJECT,
                properties: {
                    top: { type: Type.STRING, description: "The text for the top of the meme." },
                    bottom: { type: Type.STRING, description: "The text for the bottom of the meme." }
                }, required: ['top', 'bottom']
            }
        };

        if (isAutoStyle) {
            responseSchema = {
                type: Type.OBJECT,
                properties: {
                    style: { type: Type.STRING, description: "The single most appropriate meme style chosen by the AI from this list: Sarcastic, Bullish, Rekt, Degen, Motivational." },
                    captions: baseCaptionSchema
                }, required: ['style', 'captions']
            };
            textPrompt = `Analyze this image, determine the most fitting meme style (from Sarcastic, Bullish, Rekt, Degen, or Motivational), and then generate 5 short, witty meme captions in that style suitable for a crypto/web3 audience. The captions should be directly inspired by the image. Ensure the output strictly follows the provided JSON schema.`;
        } else {
            responseSchema = {
                type: Type.OBJECT,
                properties: { captions: baseCaptionSchema }, required: ['captions']
            };
            textPrompt = `Analyze this image and generate 5 short, witty meme captions suitable for a crypto/web3 audience. The captions should be directly inspired by the image. The style should be ${selectedStyle}. Provide a top text and a bottom text for each caption. Ensure the output strictly follows the provided JSON schema.`;
        }

        const match = currentImage.src.match(/^data:(image\/.+);base64,(.+)$/);
        if (!match) throw new Error("Invalid image data format.");

        const imagePart = { inlineData: { mimeType: match[1], data: match[2] } };
        const textPart = { text: textPrompt };

        const captionResult = await withTimeout(ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [imagePart, textPart] },
            config: { systemInstruction: captionSystemInstruction, responseMimeType: "application/json", responseSchema: responseSchema },
        }), 30000);
        
        processCaptionResult(captionResult);

    } catch (error) {
        console.error("Error during Auto-Meme generation:", error);
        const errorMessage = getApiErrorMessage(error);
        captionsList.innerHTML = `<li><strong style="color: #ff5555;">Error:</strong> ${errorMessage}</li>`;
    } finally {
        autoMemeBtn.disabled = false;
        autoMemeBtn.innerHTML = originalBtnContent;
        updateActionButtonsState();
    }
});

enhanceBtn.addEventListener('click', async () => {
    if (!ai || baseImageId === null) return;

    const baseImg = uploadedImages.find(i => i.id === baseImageId);
    const prompt = promptInput.value;

    if (!baseImg || !prompt) {
        alert("Please select a base image and provide an instruction for enhancement.");
        return;
    }

    const btnText = enhanceBtn.querySelector('.btn-text') as HTMLElement;
    const originalBtnContent = enhanceBtn.innerHTML;
    enhanceBtn.disabled = true;
    btnText.textContent = 'Enhancing...';
    enhanceBtn.insertAdjacentHTML('afterbegin', '<span class="loader"></span>');

    try {
        const baseMatch = baseImg.src.match(/^data:(image\/.+);base64,(.+)$/);
        if (!baseMatch) throw new Error("Invalid image data format.");

        const parts = [
            { inlineData: { mimeType: baseMatch[1], data: baseMatch[2] } },
            { text: prompt }
        ];

        const result = await withTimeout(ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: parts },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        }), 45000);

        let newImageFound = false;
        let responseText = '';
        for (const part of result.candidates[0].content.parts) {
            if (part.inlineData) {
                const newImageData = {
                    id: nextImageId++,
                    src: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
                };
                uploadedImages.push(newImageData);
                setBaseImage(newImageData);
                newImageFound = true;
                break;
            } else if (part.text) {
                responseText += part.text + ' ';
            }
        }
        if (!newImageFound) {
            const errorMessage = responseText.trim() || "AI did not return an image. Please try a different prompt.";
            throw new Error(errorMessage);
        }

    } catch (error) {
        console.error("Error enhancing image:", error);
        const errorMessage = getApiErrorMessage(error);
        alert(`Could not enhance image: ${errorMessage}`);
    } finally {
        enhanceBtn.disabled = false;
        enhanceBtn.innerHTML = originalBtnContent;
        updateActionButtonsState();
    }
});


combineBtn.addEventListener('click', async () => {
    if (!ai || baseImageId === null || sourceImageIds.length === 0) return;

    const baseImg = uploadedImages.find(i => i.id === baseImageId);
    const sourceImgs = uploadedImages.filter(i => sourceImageIds.includes(i.id));
    const prompt = promptInput.value;

    if (!baseImg || sourceImgs.length === 0 || !prompt) {
        alert("Please select a base image, at least one source image, and provide an instruction.");
        return;
    }

    const btnText = combineBtn.querySelector('.btn-text') as HTMLElement;
    const originalBtnContent = combineBtn.innerHTML;
    combineBtn.disabled = true;
    btnText.textContent = 'Combining...';
    combineBtn.insertAdjacentHTML('afterbegin', '<span class="loader"></span>');

    try {
        const parts = [];
        const baseMatch = baseImg.src.match(/^data:(image\/.+);base64,(.+)$/);
        if (!baseMatch) throw new Error("Invalid base image data format.");
        parts.push({ inlineData: { mimeType: baseMatch[1], data: baseMatch[2] } });

        for (const sourceImg of sourceImgs) {
            const sourceMatch = sourceImg.src.match(/^data:(image\/.+);base64,(.+)$/);
            if (!sourceMatch) throw new Error(`Invalid source image data format for image ID ${sourceImg.id}.`);
            parts.push({ inlineData: { mimeType: sourceMatch[1], data: sourceMatch[2] } });
        }
        
        parts.push({ text: prompt });
        
        const result = await withTimeout(ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: parts },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        }), 45000);

        let newImageFound = false;
        let responseText = '';
        for (const part of result.candidates[0].content.parts) {
            if (part.inlineData) {
                const newImageData = {
                    id: nextImageId++,
                    src: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
                };
                uploadedImages.push(newImageData);
                sourceImageIds = []; // Reset sources after combination
                setBaseImage(newImageData); // Set new image as base
                newImageFound = true;
                break; 
            } else if (part.text) {
                responseText += part.text + ' ';
            }
        }
        if (!newImageFound) {
            const errorMessage = responseText.trim() || "AI did not return an image. Please try a different prompt.";
            throw new Error(errorMessage);
        }

    } catch (error) {
        console.error("Error combining images:", error);
        const errorMessage = getApiErrorMessage(error);
        alert(`Could not combine images: ${errorMessage}`);
    } finally {
        combineBtn.disabled = false;
        combineBtn.innerHTML = originalBtnContent;
        updateActionButtonsState();
    }
});


generateBtn.addEventListener('click', async () => {
    if (!ai) return alert("AI is not available.");
    const prompt = promptInput.value;
    if (!prompt) return alert('Please enter a topic or description.');

    const loader = generateBtn.querySelector('.loader') as HTMLElement;
    generateBtn.disabled = true;
    loader.style.display = 'inline-block';
    
    try {
        const selectedStyle = styleSelect.value;
        const isAutoStyle = selectedStyle === 'Auto';

        const captionSystemInstruction = `You are an AI assistant for MemeHub, a crypto meme generator. You are an expert in web3, cryptocurrencies (like Bitcoin, Ethereum), and internet meme culture. Your goal is to generate short, witty, and culturally relevant meme captions. The captions must be concise and suitable for placing on a meme image as top and bottom text.`;
        
        let responseSchema: any;
        let captionContents: string;

        const baseCaptionSchema = {
            type: Type.ARRAY, description: "A list of 3 to 5 meme captions.",
            items: {
                type: Type.OBJECT,
                properties: {
                    top: { type: Type.STRING, description: "The text for the top of the meme." },
                    bottom: { type: Type.STRING, description: "The text for the bottom of the meme." }
                }, required: ['top', 'bottom']
            }
        };

        if (isAutoStyle) {
            responseSchema = {
                type: Type.OBJECT,
                properties: {
                    style: { type: Type.STRING, description: "The single most appropriate meme style chosen by the AI from this list: Sarcastic, Bullish, Rekt, Degen, Motivational." },
                    captions: baseCaptionSchema
                }, required: ['style', 'captions']
            };
            captionContents = `Based on the crypto topic "${prompt}", first determine the most fitting meme style (from Sarcastic, Bullish, Rekt, Degen, or Motivational). Then, generate 5 short, witty meme captions in that style. Provide a top text and a bottom text for each caption. Ensure the output strictly follows the provided JSON schema.`;
        } else {
            responseSchema = {
                type: Type.OBJECT,
                properties: { captions: baseCaptionSchema }, required: ['captions']
            };
            captionContents = `Generate 5 short, witty meme captions for the crypto topic: "${prompt}". The style should be ${selectedStyle}. Provide a top text and a bottom text for each caption. Ensure the output strictly follows the provided JSON schema.`;
        }

        captionsList.innerHTML = '<li>Generating image...</li>';
        setBaseImage(null);

        const imagePrompt = `Generate a high-quality, visually expressive image for a Web3/crypto meme based on this topic: "${prompt}". The main subject of the image must be exactly what is requested in the topic. For example, if the topic asks for a beaver, you MUST draw a beaver. If it asks for a dog, draw a dog. If it asks for a human, draw a human. If it doesn't specify a character, you can be creative within the Web3 theme. The overall style should be a clean, vibrant anime or cartoon style, like a frame from a funny, expressive animation or a popular reaction GIF. The scene should be simple, clear, and focused on a single, hilarious moment or reaction relevant to the crypto/Web3 context of the topic. ABSOLUTE CRITICAL RULE: The image MUST be 100% visual. It must NOT contain ANY text, letters, words, numbers, logos, or written symbols of any kind. This is the single most important instruction. The image must be a completely clean template, ready for the user to add their own captions. Generating an image with any form of writing is a failure.`;
        
        // Generate image first
        const imageResult = await withTimeout(ai.models.generateImages({
            model: 'imagen-4.0-generate-001', prompt: imagePrompt,
            config: { numberOfImages: 1, outputMimeType: 'image/jpeg', aspectRatio: '1:1' },
        }), 45000);
        
        const newImageData = {
            id: nextImageId++,
            src: `data:image/jpeg;base64,${imageResult.generatedImages[0].image.imageBytes}`
        };
        uploadedImages.push(newImageData);
        setBaseImage(newImageData);
        
        captionsList.innerHTML = '<li>Image complete. Generating suggestions...</li>';

        // Then generate captions
        const captionResult = await withTimeout(ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: captionContents,
            config: { systemInstruction: captionSystemInstruction, responseMimeType: "application/json", responseSchema: responseSchema },
        }), 30000);
        
        processCaptionResult(captionResult);

    } catch (error) {
        console.error('Error during AI generation:', error);
        const errorMessage = getApiErrorMessage(error);
        captionsList.innerHTML = `<li><strong style="color: #ff5555;">Error:</strong> ${errorMessage}</li>`;
    } finally {
        generateBtn.disabled = false;
        loader.style.display = 'none';
    }
});

function processCaptionResult(captionResult: any) {
    const jsonText = captionResult.text.trim().replace(/^```json\s*|```\s*$/g, '');
    if (!jsonText) throw new Error("The AI returned empty captions. Try rephrasing your topic.");
    const jsonResponse = JSON.parse(jsonText);
    captionsList.innerHTML = '';

    if (jsonResponse.style) {
        const styleHeader = document.createElement('li');
        styleHeader.className = 'style-header';
        styleHeader.innerHTML = `AI chose style: <strong>${jsonResponse.style}</strong>`;
        captionsList.appendChild(styleHeader);
    }
    
    if (jsonResponse.captions && jsonResponse.captions.length > 0) {
        jsonResponse.captions.forEach((caption: { top: string; bottom: string; }) => {
            const li = document.createElement('li');
            li.textContent = `${caption.top || ''} / ${caption.bottom || ''}`;
            li.onclick = () => {
                topTextInput.value = caption.top || '';
                bottomTextInput.value = caption.bottom || '';
                topText = caption.top || '';
                bottomText = caption.bottom || '';
                redrawCanvas();
                document.querySelectorAll('#captions-list li').forEach(item => item.classList.remove('selected'));
                li.classList.add('selected');
            };
            captionsList.appendChild(li);
        });
        const firstCaption = jsonResponse.captions[0];
        topTextInput.value = firstCaption.top || '';
        bottomTextInput.value = firstCaption.bottom || '';
        topText = firstCaption.top || '';
        bottomText = firstCaption.bottom || '';
        const firstSuggestion = captionsList.querySelector('li:not(.style-header)') as HTMLLIElement;
        if (firstSuggestion) firstSuggestion.classList.add('selected');
        if (image?.complete) redrawCanvas();
    } else {
         captionsList.innerHTML = '<li>No suggestions found. Try a different prompt.</li>';
    }
}

downloadBtn.addEventListener('click', () => {
    if (!triggerMemeDownload()) {
        alert('Please generate or upload an image first.');
    }
});

shareTwitterBtn.addEventListener('click', async () => {
    if (!image) { 
        alert('Please create a meme before sharing!');
        return;
    }

    try {
        // Convert canvas to blob for sharing
        const canvas = document.getElementById('meme-canvas') as HTMLCanvasElement;
        const dataUrl = canvas.toDataURL('image/png');
        
        // Create enhanced message with BURROWBURR.FUN branding
        const memeCaption = [topText, bottomText].filter(Boolean).join(' / ');
        const fullText = `🚀 Just created an epic meme with BurrMemeHub! ${memeCaption ? `"${memeCaption}"` : ''}\n\n🎨 Created by @burr_burrow for the Starknet community\n\n#BurrowBurr #Starknet #Crypto`;
        const encodedText = encodeURIComponent(fullText.trim());

        // Show modal with sharing options
        showSharingModal(dataUrl, encodedText);

    } catch (error) {
        console.error('Error sharing to X:', error);
        alert('❌ Error sharing to X. Please try again.');
    }
});

// Create sharing modal with multiple options
function showSharingModal(dataUrl: string, encodedText: string) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(10px);
    `;

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: var(--surface-color);
        border: 2px solid var(--primary-color);
        border-radius: 16px;
        padding: 2rem;
        max-width: 500px;
        width: 90%;
        text-align: center;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    `;

    modalContent.innerHTML = `
        <h3 style="color: var(--primary-color); margin-bottom: 1rem;">
            <i class="fa-solid fa-share-nodes"></i> Share Your BurrMemeHub Meme
        </h3>
        <div style="margin-bottom: 1.5rem;">
            <img src="${dataUrl}" style="max-width: 200px; border-radius: 8px; border: 2px solid var(--primary-color);" alt="Your Meme">
        </div>
        <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem;">
            <button id="download-meme-btn" class="button button-primary" style="width: 100%;">
                <i class="fa-solid fa-download"></i> Download Meme
            </button>
            <button id="copy-image-btn" class="button button-secondary" style="width: 100%;">
                <i class="fa-solid fa-copy"></i> Copy Image to Clipboard
            </button>
            <button id="open-x-btn" class="button button-x" style="width: 100%;">
                <i class="fa-brands fa-x-twitter"></i> Open X (Twitter)
            </button>
        </div>
        <p style="color: var(--text-secondary-color); font-size: 0.9rem; margin-bottom: 1rem;">
            💡 <strong>Tip:</strong> Download the image, then paste it directly into your X post!
        </p>
        <button id="close-modal-btn" class="button" style="background: var(--destructive-color);">
            <i class="fa-solid fa-times"></i> Close
        </button>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Event listeners for modal buttons
    const downloadBtn = modalContent.querySelector('#download-meme-btn');
    const copyBtn = modalContent.querySelector('#copy-image-btn');
    const openXBtn = modalContent.querySelector('#open-x-btn');
    const closeBtn = modalContent.querySelector('#close-modal-btn');

    downloadBtn?.addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'memehub-meme.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Show success message
        const originalText = downloadBtn.innerHTML;
        downloadBtn.innerHTML = '<i class="fa-solid fa-check"></i> Downloaded!';
        setTimeout(() => {
            downloadBtn.innerHTML = originalText;
        }, 2000);
    });

    copyBtn?.addEventListener('click', async () => {
        try {
            // Convert data URL to blob
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            
            // Copy to clipboard
            await navigator.clipboard.write([
                new ClipboardItem({
                    'image/png': blob
                })
            ]);
            
            // Show success message
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
            }, 2000);
        } catch (error) {
            console.error('Failed to copy image:', error);
            alert('❌ Failed to copy image. Please try downloading instead.');
        }
    });

    openXBtn?.addEventListener('click', () => {
        const twitterUrl = `https://x.com/intent/tweet?text=${encodedText}`;
        window.open(twitterUrl, '_blank');
        
        // Show success message
        const originalText = openXBtn.innerHTML;
        openXBtn.innerHTML = '<i class="fa-solid fa-check"></i> X Opened!';
        setTimeout(() => {
            openXBtn.innerHTML = originalText;
        }, 2000);
    });

    closeBtn?.addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

remixBtn.addEventListener('click', () => {
    setBaseImage(null);
    uploadedImages = [];
    nextImageId = 0;
    sourceImageIds = [];
    promptInput.value = '';
    topTextInput.value = '';
    bottomTextInput.value = '';
    topText = '';
    bottomText = '';
    topTextPosition = null;
    bottomTextPosition = null;
    captionsList.innerHTML = '';
    renderImageTray();
    updateActionButtonsState();
    imageUpload.value = '';
});

// --- CANVAS DRAG-AND-DROP LOGIC (FOR MOUSE AND TOUCH) ---

function getCanvasCoordinates(clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    return { x, y };
}

function handleDragStart(clientX: number, clientY: number) {
    if (!topTextPosition || !bottomTextPosition) return;
    const { x: mouseX, y: mouseY } = getCanvasCoordinates(clientX, clientY);

    if (isMouseOverText(mouseX, mouseY, topText, topTextPosition)) {
        isDragging = true;
        draggingText = 'top';
        dragStartX = mouseX;
        dragStartY = mouseY;
    } else if (isMouseOverText(mouseX, mouseY, bottomText, bottomTextPosition)) {
        isDragging = true;
        draggingText = 'bottom';
        dragStartX = mouseX;
        dragStartY = mouseY;
    }
}

function handleDragMove(clientX: number, clientY: number) {
    const { x: mouseX, y: mouseY } = getCanvasCoordinates(clientX, clientY);
    
    // Update cursor style on desktop
    canvas.style.cursor = (isDragging || isMouseOverText(mouseX, mouseY, topText, topTextPosition) || isMouseOverText(mouseX, mouseY, bottomText, bottomTextPosition)) ? 'move' : 'default';

    if (!isDragging || !topTextPosition || !bottomTextPosition) return;

    const dx = mouseX - dragStartX;
    const dy = mouseY - dragStartY;

    if (draggingText === 'top') {
        topTextPosition.rx += dx / canvas.width;
        topTextPosition.ry += dy / canvas.height;
    } else if (draggingText === 'bottom') {
        bottomTextPosition.rx += dx / canvas.width;
        bottomTextPosition.ry += dy / canvas.height;
    }

    dragStartX = mouseX;
    dragStartY = mouseY;
    redrawCanvas();
}

function handleDragEnd() {
    if (isDragging) {
        isDragging = false;
        draggingText = null;
        canvas.style.cursor = 'default';
    }
}

// Mouse Events
canvas.addEventListener('mousedown', (e) => handleDragStart(e.clientX, e.clientY));
canvas.addEventListener('mousemove', (e) => handleDragMove(e.clientX, e.clientY));
canvas.addEventListener('mouseup', handleDragEnd);
canvas.addEventListener('mouseout', handleDragEnd);

// Touch Events
canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
        handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }
}, { passive: true });

canvas.addEventListener('touchmove', (e) => {
    // Prevent scrolling while dragging text on canvas
    if (isDragging) e.preventDefault();
    if (e.touches.length > 0) {
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
    }
}, { passive: false });

canvas.addEventListener('touchend', handleDragEnd);
canvas.addEventListener('touchcancel', handleDragEnd);


window.addEventListener('resize', redrawCanvas);

export {};