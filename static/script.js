/**
 * Chat-w-AI Studio - Core Client Engine
 * Features: Multi-model switching, Markdown/KaTeX/Code highlighting,
 * Voice input/output, Conversation grouping & search, Theme engine, Export/Import.
 */

document.addEventListener("DOMContentLoaded", function () {
    // ==========================================
    // 1. Application State & Config
    // ==========================================
    const isGrokMode = window.location.pathname === "/grok";
    const currentModel = isGrokMode ? "grok" : "gigachat";
    const currentModelTitle = isGrokMode ? "Grok (xAI)" : "GigaChat";
    const currentModelSub = isGrokMode ? "grok-3-mini" : "GigaChat-Pro";

    let currentChatId = "general";
    let chatHistory = {}; // { [chatId]: Array<{ role: 'user'|'assistant', content: string, time: string }> }
    let chatMetadata = {}; // { [chatId]: { name: string, createdAt: number, pinned?: boolean } }
    let isGenerating = false;
    let recognition = null;
    let isRecording = false;

    // LocalStorage Keys
    const STORAGE_KEY_HISTORY = `chat_history_${currentModel}`;
    const STORAGE_KEY_META = `chat_meta_${currentModel}`;
    const STORAGE_KEY_THEME = "chat_ai_theme";
    const STORAGE_KEY_SYSTEM_PROMPT = "chat_ai_system_prompt";

    // ==========================================
    // 2. DOM Elements Selection
    // ==========================================
    const serverPillar = document.getElementById("server-pillar");
    const sidebarPanel = document.getElementById("sidebar-panel");
    const mobileOverlay = document.getElementById("mobile-overlay");
    const mobileToggleBtn = document.getElementById("mobile-toggle-btn");
    const sidebarCollapseBtn = document.getElementById("sidebar-collapse-btn");

    const chatMessagesContainer = document.getElementById("chat-messages-container");
    const chatMessages = document.getElementById("chat-messages");
    const chatHeroScreen = document.getElementById("chat-hero-screen");
    const typingContainer = document.getElementById("typing-container");
    const typingModelLabel = document.getElementById("typing-model-label");
    const scrollBottomBtn = document.getElementById("scroll-bottom-btn");

    const messageInput = document.getElementById("message-input");
    const sendButton = document.getElementById("send-button");
    const charCounter = document.getElementById("char-counter");
    const btnVoiceInput = document.getElementById("btn-voice-input");
    const btnClearInput = document.getElementById("btn-clear-input");

    const currentChatNameElem = document.getElementById("current-chat-name");
    const headerModelName = document.getElementById("header-model-name");
    const sidebarModelTitle = document.getElementById("sidebar-model-title");
    const channelsContainer = document.getElementById("channels-container");
    const searchChatsInput = document.getElementById("search-chats-input");

    const btnClearChat = document.getElementById("btn-clear-chat");
    const btnThemeQuickToggle = document.getElementById("btn-theme-quick-toggle");
    const openSettingsBtn = document.getElementById("open-settings-btn");

    // Modals
    const newChatModalEl = document.getElementById("newChatModal");
    const newChatModal = newChatModalEl ? new bootstrap.Modal(newChatModalEl) : null;
    const deleteChatModalEl = document.getElementById("deleteChatModal");
    const deleteChatModal = deleteChatModalEl ? new bootstrap.Modal(deleteChatModalEl) : null;
    const settingsModalEl = document.getElementById("settingsModal");
    const settingsModal = settingsModalEl ? new bootstrap.Modal(settingsModalEl) : null;

    const chatNameInput = document.getElementById("chat-name");
    const createChatBtn = document.getElementById("create-chat-btn");
    const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
    const deleteChatNameSpan = document.getElementById("delete-chat-name");

    const saveSettingsBtn = document.getElementById("save-settings-btn");
    const userSystemPromptInput = document.getElementById("user-system-prompt");
    const themeCardOptions = document.querySelectorAll(".theme-card-option");

    const btnExportMarkdown = document.getElementById("btn-export-markdown");
    const btnExportJson = document.getElementById("btn-export-json");

    // ==========================================
    // 3. Marked & KaTeX Configuration
    // ==========================================
    if (typeof marked !== "undefined") {
        const renderer = new marked.Renderer();
        
        // Custom code block renderer with modern header, copy button, language badge
        renderer.code = function (code, lang) {
            const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
            const validLang = lang ? lang.toLowerCase() : "code";
            const highlighted = typeof hljs !== "undefined" && lang && hljs.getLanguage(lang)
                ? hljs.highlight(code, { language }).value
                : (typeof hljs !== "undefined" ? hljs.highlightAuto(code).value : escapeHtml(code));

            return `
            <div class="code-block-wrapper">
                <div class="code-header">
                    <span class="code-lang"><i class="bi bi-file-earmark-code"></i> ${validLang}</span>
                    <div class="code-tools">
                        <button class="code-btn copy-code-btn" type="button" title="Скопировать код">
                            <i class="bi bi-clipboard"></i>
                            <span>Копировать</span>
                        </button>
                    </div>
                </div>
                <pre class="code-content"><code class="hljs language-${language}">${highlighted}</code></pre>
            </div>`;
        };

        marked.setOptions({
            renderer: renderer,
            gfm: true,
            breaks: true,
            headerIds: false,
            mangle: false,
        });
    }

    function renderMarkdownAndMath(content) {
        if (!content) return "";
        let parsed = content;
        if (typeof marked !== "undefined") {
            parsed = marked.parse(content);
        }
        if (typeof DOMPurify !== "undefined") {
            parsed = DOMPurify.sanitize(parsed, {
                ADD_ATTR: ['target'],
                ADD_TAGS: ['iframe']
            });
        }
        return parsed;
    }

    function renderMathFormulas(element) {
        if (typeof renderMathInElement !== "undefined" && element) {
            renderMathInElement(element, {
                delimiters: [
                    { left: "$$", right: "$$", display: true },
                    { left: "$", right: "$", display: false },
                    { left: "\\(", right: "\\)", display: false },
                    { left: "\\[", right: "\\]", display: true }
                ],
                throwOnError: false
            });
        }
    }

    // ==========================================
    // 4. Theme & Appearance Management
    // ==========================================
    function initTheme() {
        const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || "slate";
        applyTheme(savedTheme);

        if (userSystemPromptInput) {
            userSystemPromptInput.value = localStorage.getItem(STORAGE_KEY_SYSTEM_PROMPT) || "";
        }
    }

    function applyTheme(themeName) {
        document.documentElement.setAttribute("data-theme", themeName);
        localStorage.setItem(STORAGE_KEY_THEME, themeName);

        themeCardOptions.forEach(opt => {
            if (opt.getAttribute("data-theme-val") === themeName) {
                opt.classList.add("active");
            } else {
                opt.classList.remove("active");
            }
        });
    }

    themeCardOptions.forEach(card => {
        card.addEventListener("click", () => {
            const val = card.getAttribute("data-theme-val");
            applyTheme(val);
            showToast(`Установлена тема: ${card.querySelector("span").textContent}`);
        });
    });

    if (btnThemeQuickToggle) {
        const themes = ["slate", "oled", "light", "cyberpunk"];
        btnThemeQuickToggle.addEventListener("click", () => {
            const current = document.documentElement.getAttribute("data-theme") || "slate";
            const nextIdx = (themes.indexOf(current) + 1) % themes.length;
            const nextTheme = themes[nextIdx];
            applyTheme(nextTheme);
            showToast(`Тема: ${nextTheme.toUpperCase()}`);
        });
    }

    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener("click", () => {
            if (userSystemPromptInput) {
                localStorage.setItem(STORAGE_KEY_SYSTEM_PROMPT, userSystemPromptInput.value.trim());
            }
            showToast("Настройки успешно сохранены");
        });
    }

    if (openSettingsBtn && settingsModal) {
        openSettingsBtn.addEventListener("click", () => {
            settingsModal.show();
        });
    }

    // ==========================================
    // 5. Model Routing & Navigation
    // ==========================================
    function initModelHeader() {
        if (sidebarModelTitle) sidebarModelTitle.textContent = currentModelTitle;
        if (headerModelName) headerModelName.textContent = currentModelSub;

        const gigaBtn = document.getElementById("gigachat-server-btn");
        const grokBtn = document.getElementById("grok-server-btn");

        if (isGrokMode) {
            if (grokBtn) grokBtn.classList.add("active");
            if (gigaBtn) gigaBtn.classList.remove("active");
        } else {
            if (gigaBtn) gigaBtn.classList.add("active");
            if (grokBtn) grokBtn.classList.remove("active");
        }

        if (gigaBtn) {
            gigaBtn.addEventListener("click", () => {
                if (window.location.pathname !== "/") {
                    window.location.href = "/";
                }
            });
        }
        if (grokBtn) {
            grokBtn.addEventListener("click", () => {
                if (window.location.pathname !== "/grok") {
                    window.location.href = "/grok";
                }
            });
        }
    }

    // ==========================================
    // 6. Mobile Drawer & Responsiveness
    // ==========================================
    function openMobileDrawer() {
        sidebarPanel.classList.add("active");
        mobileOverlay.classList.add("active");
    }

    function closeMobileDrawer() {
        sidebarPanel.classList.remove("active");
        serverPillar.classList.remove("active");
        mobileOverlay.classList.remove("active");
    }

    if (mobileToggleBtn) {
        mobileToggleBtn.addEventListener("click", () => {
            if (sidebarPanel.classList.contains("active")) {
                closeMobileDrawer();
            } else {
                openMobileDrawer();
            }
        });
    }

    if (sidebarCollapseBtn) {
        sidebarCollapseBtn.addEventListener("click", () => {
            closeMobileDrawer();
        });
    }

    if (mobileOverlay) {
        mobileOverlay.addEventListener("click", closeMobileDrawer);
    }

    // Auto close on window resize if enlarged
    window.addEventListener("resize", () => {
        if (window.innerWidth > 992) {
            closeMobileDrawer();
        }
    });

    // ==========================================
    // 7. Conversation & History Engine
    // ==========================================
    function loadStorageData() {
        try {
            const savedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
            const savedMeta = localStorage.getItem(STORAGE_KEY_META);

            if (savedHistory) chatHistory = JSON.parse(savedHistory);
            if (savedMeta) chatMetadata = JSON.parse(savedMeta);
        } catch (e) {
            console.error("Failed to parse localStorage history", e);
        }

        // Initialize general channel if empty
        if (!chatMetadata["general"]) {
            chatMetadata["general"] = {
                name: "общий-чат",
                createdAt: Date.now(),
            };
        }
        if (!chatHistory["general"]) {
            chatHistory["general"] = [
                {
                    role: "assistant",
                    content: isGrokMode
                        ? `👋 Привет! Я **Grok AI**. Чем могу помочь вам сегодня? Готов к сложным расчетам, кодингу и обсуждению любых тем!`
                        : `👋 Привет! Я **GigaChat**. Чем могу помочь? Мы на платформе с поддержкой Markdown, формул LaTeX и кода!`,
                    time: getCurrentTimeFormatted(),
                }
            ];
        }

        renderChannelsList();
        switchChat(currentChatId);
    }

    function saveStorageData() {
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(chatHistory));
        localStorage.setItem(STORAGE_KEY_META, JSON.stringify(chatMetadata));
    }

    function renderChannelsList(filterQuery = "") {
        channelsContainer.innerHTML = "";
        const query = filterQuery.toLowerCase().trim();

        const chatIds = Object.keys(chatMetadata).sort((a, b) => {
            return (chatMetadata[b]?.createdAt || 0) - (chatMetadata[a]?.createdAt || 0);
        });

        chatIds.forEach(id => {
            const meta = chatMetadata[id];
            if (!meta) return;

            // Search filter
            if (query && !meta.name.toLowerCase().includes(query)) {
                // Check if any message contains query
                const hasMessageMatch = (chatHistory[id] || []).some(m => m.content.toLowerCase().includes(query));
                if (!hasMessageMatch) return;
            }

            const item = document.createElement("div");
            item.className = `channel-item ${id === currentChatId ? "active" : ""}`;
            item.setAttribute("data-chat-id", id);

            const isGeneral = id === "general";

            item.innerHTML = `
                <div class="channel-item-left">
                    <i class="bi ${isGeneral ? 'bi-chat-left-text' : 'bi-hash'} channel-item-icon"></i>
                    <span class="channel-item-title">${escapeHtml(meta.name)}</span>
                </div>
                ${!isGeneral ? `
                <div class="channel-item-actions">
                    <button class="channel-action-btn edit-chat-btn" title="Переименовать" data-chat-id="${id}">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="channel-action-btn delete-btn delete-chat-btn" title="Удалить" data-chat-id="${id}" data-chat-name="${escapeHtml(meta.name)}">
                        <i class="bi bi-trash3"></i>
                    </button>
                </div>
                ` : ""}
            `;

            // Click channel switch
            item.addEventListener("click", (e) => {
                if (e.target.closest(".channel-action-btn")) return;
                switchChat(id);
                if (window.innerWidth <= 992) closeMobileDrawer();
            });

            // Edit chat name
            const editBtn = item.querySelector(".edit-chat-btn");
            if (editBtn) {
                editBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const newTitle = prompt("Введите новое название диалога:", meta.name);
                    if (newTitle && newTitle.trim()) {
                        meta.name = newTitle.trim();
                        saveStorageData();
                        renderChannelsList(searchChatsInput.value);
                        if (currentChatId === id) {
                            currentChatNameElem.textContent = meta.name;
                        }
                        showToast("Диалог переименован");
                    }
                });
            }

            // Delete chat
            const delBtn = item.querySelector(".delete-chat-btn");
            if (delBtn) {
                delBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    openDeleteModal(id, meta.name);
                });
            }

            channelsContainer.appendChild(item);
        });
    }

    // Live search listener
    if (searchChatsInput) {
        searchChatsInput.addEventListener("input", (e) => {
            renderChannelsList(e.target.value);
        });
    }

    function switchChat(chatId) {
        if (!chatMetadata[chatId]) {
            chatId = "general";
        }
        currentChatId = chatId;
        const meta = chatMetadata[chatId];
        if (currentChatNameElem && meta) {
            currentChatNameElem.textContent = meta.name;
        }

        // Update active class in list
        document.querySelectorAll(".channel-item").forEach(el => {
            if (el.getAttribute("data-chat-id") === chatId) {
                el.classList.add("active");
            } else {
                el.classList.remove("active");
            }
        });

        renderMessages();
    }

    function createNewChat(name) {
        const chatId = "chat-" + Date.now();
        const chatTitle = name.trim() || `Диалог ${Object.keys(chatMetadata).length + 1}`;

        chatMetadata[chatId] = {
            name: chatTitle,
            createdAt: Date.now(),
        };

        chatHistory[chatId] = [];

        saveStorageData();
        renderChannelsList();
        switchChat(chatId);
        showToast(`Создан диалог «${chatTitle}»`);
    }

    if (createChatBtn && chatNameInput) {
        createChatBtn.addEventListener("click", () => {
            const name = chatNameInput.value.trim();
            createNewChat(name || "Новый диалог");
            chatNameInput.value = "";
            if (newChatModal) newChatModal.hide();
        });

        chatNameInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                createChatBtn.click();
            }
        });
    }

    function openDeleteModal(chatId, chatName) {
        if (deleteChatNameSpan) deleteChatNameSpan.textContent = chatName;
        if (confirmDeleteBtn) confirmDeleteBtn.setAttribute("data-chat-id", chatId);
        if (deleteChatModal) deleteChatModal.show();
    }

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener("click", () => {
            const chatId = confirmDeleteBtn.getAttribute("data-chat-id");
            if (chatId && chatId !== "general") {
                delete chatMetadata[chatId];
                delete chatHistory[chatId];
                saveStorageData();

                if (currentChatId === chatId) {
                    switchChat("general");
                }
                renderChannelsList();
                if (deleteChatModal) deleteChatModal.hide();
                showToast("Диалог удален");
            }
        });
    }

    // Clear active chat messages
    if (btnClearChat) {
        btnClearChat.addEventListener("click", () => {
            if (confirm(`Очистить все сообщения в текущем диалоге «${chatMetadata[currentChatId]?.name}»?`)) {
                chatHistory[currentChatId] = [];
                saveStorageData();
                renderMessages();
                showToast("История диалога очищена");
            }
        });
    }

    // ==========================================
    // 8. Message Rendering & Interaction
    // ==========================================
    function renderMessages() {
        const messages = chatHistory[currentChatId] || [];
        chatMessages.innerHTML = "";

        if (messages.length === 0) {
            if (chatHeroScreen) {
                chatHeroScreen.style.display = "flex";
                chatMessages.appendChild(chatHeroScreen);
            }
        } else {
            if (chatHeroScreen) chatHeroScreen.style.display = "none";

            messages.forEach((msg, index) => {
                const messageRow = createMessageElement(msg, index);
                chatMessages.appendChild(messageRow);
            });
        }

        scrollToBottom(false);
    }

    function createMessageElement(msg, index) {
        const isUser = msg.role === "user";
        const row = document.createElement("div");
        row.className = `message-row ${isUser ? "user-row" : "ai-row"}`;
        row.setAttribute("data-model", currentModel);
        row.setAttribute("data-msg-idx", index);

        const authorName = isUser ? "Вы" : (isGrokMode ? "Grok AI" : "GigaChat");
        const avatarIcon = isUser ? '<i class="bi bi-person-fill"></i>' : '<i class="bi bi-stars"></i>';
        const formattedHtml = renderMarkdownAndMath(msg.content);

        row.innerHTML = `
            <div class="message-avatar">
                ${avatarIcon}
            </div>
            <div class="message-bubble-wrapper">
                <div class="message-meta">
                    <span class="message-author">${authorName}</span>
                    <span class="message-timestamp">${msg.time || ""}</span>
                </div>
                <div class="message-body">${formattedHtml}</div>
                <div class="message-actions-bar">
                    <button class="msg-action-btn copy-msg-btn" title="Копировать текст">
                        <i class="bi bi-clipboard"></i>
                        <span>Копировать</span>
                    </button>
                    ${!isUser ? `
                    <button class="msg-action-btn speak-msg-btn" title="Озвучить (TTS)">
                        <i class="bi bi-volume-up"></i>
                        <span>Озвучить</span>
                    </button>
                    <button class="msg-action-btn retry-msg-btn" title="Повторить генерацию">
                        <i class="bi bi-arrow-clockwise"></i>
                        <span>Повтор</span>
                    </button>
                    ` : `
                    <button class="msg-action-btn edit-msg-btn" title="Редактировать запрос">
                        <i class="bi bi-pencil"></i>
                        <span>Изменить</span>
                    </button>
                    `}
                    <button class="msg-action-btn delete-msg-btn" title="Удалить сообщение">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        `;

        // Render Math equations if KaTeX is present
        renderMathFormulas(row.querySelector(".message-body"));

        // Attach listeners for code block copy buttons
        row.querySelectorAll(".copy-code-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const codeEl = btn.closest(".code-block-wrapper")?.querySelector("code");
                if (codeEl) {
                    navigator.clipboard.writeText(codeEl.innerText);
                    const originalText = btn.innerHTML;
                    btn.classList.add("copied");
                    btn.innerHTML = `<i class="bi bi-check2"></i> <span>Скопировано!</span>`;
                    setTimeout(() => {
                        btn.classList.remove("copied");
                        btn.innerHTML = originalText;
                    }, 2000);
                }
            });
        });

        // Copy entire message
        const copyBtn = row.querySelector(".copy-msg-btn");
        if (copyBtn) {
            copyBtn.addEventListener("click", () => {
                navigator.clipboard.writeText(msg.content);
                showToast("Сообщение скопировано в буфер обмена");
            });
        }

        // Text-to-speech
        const speakBtn = row.querySelector(".speak-msg-btn");
        if (speakBtn) {
            speakBtn.addEventListener("click", () => {
                speakText(msg.content);
            });
        }

        // Retry / regenerate response
        const retryBtn = row.querySelector(".retry-msg-btn");
        if (retryBtn) {
            retryBtn.addEventListener("click", () => {
                regenerateResponse(index);
            });
        }

        // Edit user prompt
        const editBtn = row.querySelector(".edit-msg-btn");
        if (editBtn) {
            editBtn.addEventListener("click", () => {
                messageInput.value = msg.content;
                messageInput.focus();
                adjustTextareaHeight();
                showToast("Текст помещен в поле ввода для редактирования");
            });
        }

        // Delete single message
        const delMsgBtn = row.querySelector(".delete-msg-btn");
        if (delMsgBtn) {
            delMsgBtn.addEventListener("click", () => {
                chatHistory[currentChatId].splice(index, 1);
                saveStorageData();
                renderMessages();
            });
        }

        return row;
    }

    // Text-to-Speech (TTS)
    function speakText(text) {
        if (!('speechSynthesis' in window)) {
            showToast("Синтез речи не поддерживается вашим браузером");
            return;
        }

        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            showToast("Озвучивание остановлено");
            return;
        }

        // Strip markdown formatting for cleaner speech
        const plainText = text.replace(/[#*`_~$$\[\]]/g, '');
        const utterance = new SpeechSynthesisUtterance(plainText);
        utterance.lang = "ru-RU";
        utterance.rate = 1.0;

        utterance.onstart = () => showToast("🔊 Озвучивание сообщения...");
        utterance.onend = () => {};
        utterance.onerror = () => showToast("Ошибка воспроизведения звука");

        window.speechSynthesis.speak(utterance);
    }

    // ==========================================
    // 9. Prompt Starters & Composer UX
    // ==========================================
    // Starter cards click handler
    document.querySelectorAll(".starter-card").forEach(card => {
        card.addEventListener("click", () => {
            const prompt = card.getAttribute("data-prompt");
            if (prompt) {
                messageInput.value = prompt;
                adjustTextareaHeight();
                handleSendMessage();
            }
        });
    });

    // Auto resize textarea & char counter
    function adjustTextareaHeight() {
        messageInput.style.height = "auto";
        messageInput.style.height = Math.min(messageInput.scrollHeight, 180) + "px";

        const count = messageInput.value.length;
        if (charCounter) {
            charCounter.textContent = `${count} симв.`;
        }

        if (sendButton) {
            sendButton.disabled = count === 0 || isGenerating;
        }
    }

    messageInput.addEventListener("input", adjustTextareaHeight);

    // Keyboard Shortcuts: Enter sends, Shift+Enter new line
    messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!isGenerating && messageInput.value.trim().length > 0) {
                handleSendMessage();
            }
        }
    });

    if (sendButton) {
        sendButton.addEventListener("click", () => {
            if (!isGenerating && messageInput.value.trim().length > 0) {
                handleSendMessage();
            }
        });
    }

    if (btnClearInput) {
        btnClearInput.addEventListener("click", () => {
            messageInput.value = "";
            adjustTextareaHeight();
            messageInput.focus();
        });
    }

    // Speech-to-Text (Voice input)
    if (btnVoiceInput) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = "ru-RU";

            recognition.onstart = () => {
                isRecording = true;
                btnVoiceInput.classList.add("recording");
                btnVoiceInput.innerHTML = `<i class="bi bi-mic-fill"></i>`;
                showToast("🎙️ Идет запись голоса... Говорите");
            };

            recognition.onresult = (event) => {
                let transcript = "";
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    transcript += event.results[i][0].transcript;
                }
                messageInput.value = transcript;
                adjustTextareaHeight();
            };

            recognition.onerror = (event) => {
                console.error("Speech recognition error:", event.error);
                stopVoiceRecording();
                showToast(`Ошибка микрофона: ${event.error}`);
            };

            recognition.onend = () => {
                stopVoiceRecording();
            };

            btnVoiceInput.addEventListener("click", () => {
                if (isRecording) {
                    recognition.stop();
                } else {
                    try {
                        recognition.start();
                    } catch (e) {
                        console.error(e);
                    }
                }
            });
        } else {
            btnVoiceInput.style.display = "none";
        }
    }

    function stopVoiceRecording() {
        isRecording = false;
        if (btnVoiceInput) {
            btnVoiceInput.classList.remove("recording");
            btnVoiceInput.innerHTML = `<i class="bi bi-mic"></i>`;
        }
    }

    // Scroll to bottom helper
    function scrollToBottom(smooth = true) {
        setTimeout(() => {
            chatMessagesContainer.scrollTo({
                top: chatMessagesContainer.scrollHeight,
                behavior: smooth ? "smooth" : "auto",
            });
        }, 50);
    }

    // Floating Scroll-down button
    chatMessagesContainer.addEventListener("scroll", () => {
        const distFromBottom = chatMessagesContainer.scrollHeight - chatMessagesContainer.scrollTop - chatMessagesContainer.clientHeight;
        if (distFromBottom > 150) {
            scrollBottomBtn.classList.add("visible");
        } else {
            scrollBottomBtn.classList.remove("visible");
        }
    });

    if (scrollBottomBtn) {
        scrollBottomBtn.addEventListener("click", () => {
            scrollToBottom(true);
        });
    }

    // ==========================================
    // 10. API Communication & AI Generation
    // ==========================================
    async function handleSendMessage() {
        const text = messageInput.value.trim();
        if (!text || isGenerating) return;

        // Auto-rename chat if it's the first message and still has default name
        if (chatHistory[currentChatId]?.length === 0 && chatMetadata[currentChatId]?.name.startsWith("Диалог")) {
            const shortName = text.slice(0, 24) + (text.length > 24 ? "..." : "");
            chatMetadata[currentChatId].name = shortName;
            currentChatNameElem.textContent = shortName;
            renderChannelsList();
        }

        // Append User Message
        const userMsg = {
            role: "user",
            content: text,
            time: getCurrentTimeFormatted(),
        };

        chatHistory[currentChatId].push(userMsg);
        saveStorageData();

        messageInput.value = "";
        adjustTextareaHeight();
        renderMessages();

        // Send to backend
        await requestAiResponse(text);
    }

    async function requestAiResponse(promptText) {
        isGenerating = true;
        setComposerBusy(true);

        if (typingContainer) {
            typingModelLabel.textContent = `${currentModelTitle} думает...`;
            typingContainer.style.display = "flex";
            scrollToBottom(true);
        }

        const endpoint = isGrokMode ? "/api/grok" : "/api/chat";
        const url = new URL(endpoint, window.location.origin);
        url.searchParams.append("content", promptText);

        try {
            const response = await fetch(url, {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const data = await response.json();

            let assistantContent = data.raw || data.content;
            if (!assistantContent) {
                throw new Error("Пустой ответ от сервера");
            }

            // Save assistant reply
            chatHistory[currentChatId].push({
                role: "assistant",
                content: assistantContent,
                time: getCurrentTimeFormatted(),
            });

            saveStorageData();
            renderMessages();
        } catch (error) {
            console.error("AI Generation Error:", error);
            
            // Helpful and styled error response
            const errorMsg = `⚠️ **Не удалось получить ответ от ${currentModelTitle}**\n\n` +
                `*Причина:* \`${error.message}\`\n\n` +
                `> 💡 **Подсказка:** Проверьте наличие и валидность API-ключа в файле \`config.yaml\` на сервере.\n` +
                `> Для **GigaChat** укажите ключ от [giga.chat](https://giga.chat), а для **Grok** — ключ от [requesty.ai](https://www.requesty.ai).`;

            chatHistory[currentChatId].push({
                role: "assistant",
                content: errorMsg,
                time: getCurrentTimeFormatted(),
            });

            saveStorageData();
            renderMessages();
        } finally {
            isGenerating = false;
            setComposerBusy(false);
            if (typingContainer) typingContainer.style.display = "none";
            scrollToBottom(true);
        }
    }

    async function regenerateResponse(assistantMsgIndex) {
        if (isGenerating) return;
        // Find preceding user message
        const messages = chatHistory[currentChatId] || [];
        let promptToRetry = "";

        for (let i = assistantMsgIndex - 1; i >= 0; i--) {
            if (messages[i].role === "user") {
                promptToRetry = messages[i].content;
                break;
            }
        }

        if (promptToRetry) {
            // Remove the old assistant response
            chatHistory[currentChatId].splice(assistantMsgIndex, 1);
            saveStorageData();
            renderMessages();
            await requestAiResponse(promptToRetry);
        } else {
            showToast("Не удалось найти исходный запрос для повтора");
        }
    }

    function setComposerBusy(busy) {
        if (messageInput) messageInput.disabled = busy;
        if (sendButton) sendButton.disabled = busy || messageInput.value.trim().length === 0;
    }

    // ==========================================
    // 11. Export & Backup Engine
    // ==========================================
    if (btnExportMarkdown) {
        btnExportMarkdown.addEventListener("click", () => {
            exportChatToMarkdown();
        });
    }

    if (btnExportJson) {
        btnExportJson.addEventListener("click", () => {
            exportChatToJson();
        });
    }

    function exportChatToMarkdown() {
        const meta = chatMetadata[currentChatId] || { name: "chat" };
        const messages = chatHistory[currentChatId] || [];

        let mdContent = `# Диалог: ${meta.name}\n`;
        mdContent += `*Модель:* ${currentModelTitle} | *Экспортировано:* ${new Date().toLocaleString('ru-RU')}\n\n---\n\n`;

        messages.forEach(msg => {
            const author = msg.role === "user" ? "### 👤 Пользователь" : `### 🤖 ${currentModelTitle}`;
            mdContent += `${author} *(${msg.time || ""})*\n\n${msg.content}\n\n---\n\n`;
        });

        downloadFile(`${slugify(meta.name)}.md`, mdContent, "text/markdown;charset=utf-8");
        showToast("Файл Markdown успешно сохранен");
    }

    function exportChatToJson() {
        const exportData = {
            model: currentModel,
            metadata: chatMetadata,
            history: chatHistory,
            exportedAt: new Date().toISOString(),
        };

        const jsonString = JSON.stringify(exportData, null, 2);
        downloadFile(`ai-chat-backup-${currentModel}-${Date.now()}.json`, jsonString, "application/json;charset=utf-8");
        showToast("Резервная копия JSON сохранена");
    }

    function downloadFile(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ==========================================
    // 12. Utilities & Toast Notifications
    // ==========================================
    function showToast(message, icon = "bi-info-circle") {
        let container = document.getElementById("toast-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "toast-container";
            document.body.appendChild(container);
        }

        const toast = document.createElement("div");
        toast.className = "app-toast";
        toast.innerHTML = `<i class="bi ${icon} text-primary"></i> <span>${escapeHtml(message)}</span>`;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(-10px)";
            toast.style.transition = "all 0.3s ease";
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    }

    function getCurrentTimeFormatted() {
        const now = new Date();
        return now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }

    function escapeHtml(text) {
        if (!text) return "";
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function slugify(text) {
        return text.toString().toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-а-яё]+/gi, '')
            .replace(/\-\-+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
    }

    // ==========================================
    // 13. System Initialization
    // ==========================================
    initTheme();
    initModelHeader();
    loadStorageData();
    adjustTextareaHeight();
});
