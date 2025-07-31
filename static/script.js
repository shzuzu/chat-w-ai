document.addEventListener("DOMContentLoaded", function () {
  // =========== Mobile Navigation Elements ===========
  const sidebar = document.getElementById("sidebar");
  const serverColumn = document.getElementById("server-column");
  const overlay = document.getElementById("overlay");
  const toggleSidebar = document.getElementById("toggle-sidebar");
  const showServers = document.getElementById("show-servers");
  const showChannels = document.getElementById("show-channels");
  const showChat = document.getElementById("show-chat");

  // =========== Chat Elements ===========
  const chatMessages = document.getElementById("chat-messages");
  const messageInput = document.getElementById("message-input");
  const sendButton = document.getElementById("send-button");
  const loadingIndicator = document.getElementById("loading-indicator");
  const currentChatName = document.getElementById("current-chat-name");
  const createChatBtn = document.getElementById("create-chat-btn");
  const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
  const channelList = document.querySelector(".channel-list");
  const newChatModal = new bootstrap.Modal(
    document.getElementById("newChatModal"),
  );
  const deleteChatModal = new bootstrap.Modal(
    document.getElementById("deleteChatModal"),
  );
  const chatCategory = document.getElementById("chat-category");
  const categoryChevron = document.getElementById("category-chevron");
  const channelsContainer = document.getElementById("channels-container");

  // =========== Mobile Navigation Functions ===========
  // Функция для закрытия всех панелей
  document
    .getElementById("close-server-list")
    .addEventListener("click", function () {
      const serverColumn = document.getElementById("server-column");
      serverColumn.classList.remove("active");
      document.getElementById("overlay").classList.remove("active");
    });

  // Закрытие при клике вне панели
  document.getElementById("overlay").addEventListener("click", function () {
    document.getElementById("server-column").classList.remove("active");
    this.classList.remove("active");
  });
  function closeAllPanels() {
    sidebar.classList.remove("active");
    serverColumn.classList.remove("active");
    overlay.classList.remove("active");

    showServers.classList.remove("active");
    showChannels.classList.remove("active");
    showChat.classList.add("active");
  }

  // Обработчик для кнопки-гамбургера
  if (toggleSidebar) {
    toggleSidebar.addEventListener("click", function () {
      sidebar.classList.toggle("active");
      overlay.classList.toggle("active");
    });
  }

  // Обработчик для кнопки "Серверы"
  if (showServers) {
    showServers.addEventListener("click", function () {
      serverColumn.classList.add("active");
      sidebar.classList.remove("active");
      overlay.classList.add("active");

      showServers.classList.add("active");
      showChannels.classList.remove("active");
      showChat.classList.remove("active");
    });
  }

  // Обработчик для кнопки "Каналы"
  if (showChannels) {
    showChannels.addEventListener("click", function () {
      sidebar.classList.add("active");
      serverColumn.classList.remove("active");
      overlay.classList.add("active");

      showServers.classList.remove("active");
      showChannels.classList.add("active");
      showChat.classList.remove("active");
    });
  }

  // Обработчик для кнопки "Чат"
  if (showChat) {
    showChat.addEventListener("click", function () {
      closeAllPanels();
    });
  }

  // Закрытие панелей при клике на оверлей
  if (overlay) {
    overlay.addEventListener("click", closeAllPanels);
  }

  // Автоматическая адаптация при изменении размера окна
  window.addEventListener("resize", function () {
    if (window.innerWidth > 768) {
      closeAllPanels();
    }
  });

  // =========== Хранилище для истории чатов ===========
  let chatHistory = {
    general: [],
  };

  // Текущий активный чат
  let currentChatId = "general";

  // Определяем текущий режим (Grok или GigaChat)
  const isGrokMode = window.location.pathname === "/grok";

  // =========== Инициализируем приветственное сообщение в зависимости от режима ===========
  function initializeWelcomeMessage() {
    if (isGrokMode) {
      chatHistory.general = [
        {
          role: "assistant",
          content: "Привет! Я Grok AI. Чем могу помочь?",
        },
      ];

      // Обновляем заголовок
      const modelTitle = document.getElementById("ai-model-title");
      if (modelTitle) {
        modelTitle.textContent = "Grok AI";
      }
    } else {
      chatHistory.general = [
        {
          role: "assistant",
          content:
            "Привет! Я GigaChat. Чем могу помочь? Мы на платформе Зуфара!",
        },
      ];

      // Обновляем заголовок для GigaChat (если нужно)
      const modelTitle = document.getElementById("ai-model-title");
      if (modelTitle) {
        modelTitle.textContent = "GigaChat";
      }
    }
  }

  // =========== Функция для добавления нового сообщения в чат ===========
  function addMessage(content, role = "user") {
    const isUser = role === "user";

    // Добавляем сообщение в историю
    chatHistory[currentChatId].push({
      role: role,
      content: content, // Сохраняем оригинальный Markdown
    });

    // Создаем элемент сообщения
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${isUser ? "user-message" : "assistant-message"}`;

    // Проверяем существование marked и DOMPurify перед использованием
    let safeContent = content;
    if (typeof marked !== "undefined" && typeof DOMPurify !== "undefined") {
      // Рендерим Markdown и санитайзим HTML
      const renderedContent = marked.parse(content);
      safeContent = DOMPurify.sanitize(renderedContent);
    }

    // Определяем аватар и имя в зависимости от режима
    const avatarLetter = isUser ? "U" : isGrokMode ? "G" : "G";
    const authorName = isUser
      ? "Пользователь"
      : isGrokMode
        ? "Grok"
        : "GigaChat";

    messageDiv.innerHTML = `
        <div class="message-avatar">${avatarLetter}</div>
        <div class="message-content">
            <div class="message-author">${authorName}</div>
            <div class="message-text">${safeContent}</div>
            ${!isUser ? '<div class="message-actions"><button class="copy-btn"><i class="bi bi-copy"></i></button></div>' : ""}
        </div>
    `;

    // Добавляем обработчик копирования
    if (!isUser) {
      const copyBtn = messageDiv.querySelector(".copy-btn");
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(content);
        showToast("Сообщение скопировано!");
      });
    }

    // Анимация появления
    messageDiv.style.opacity = 0;
    chatMessages.appendChild(messageDiv);
    setTimeout(() => (messageDiv.style.opacity = 1), 50);

    // Прокрутка и обновление хранилища
    chatMessages.scrollTo({
      top: chatMessages.scrollHeight,
      behavior: "smooth",
    });
    saveChatsToLocalStorage();

    // Подсветка кода
    setTimeout(() => {
      if (typeof hljs !== "undefined") {
        messageDiv.querySelectorAll("pre code").forEach((block) => {
          hljs.highlightElement(block);
        });
      }
    }, 100);
  }

  // =========== Категории и каналы ===========
  if (chatCategory) {
    chatCategory.addEventListener("click", function (e) {
      if (
        !e.target.classList.contains("add-chat-btn") &&
        !e.target.classList.contains("fa-plus")
      ) {
        channelsContainer.classList.toggle("collapsed");
        categoryChevron.classList.toggle("collapsed");
      }
    });
  }

  // Обработка создания нового чата
  const chatNameInput = document.getElementById("chat-name");

  if (createChatBtn && chatNameInput) {
    createChatBtn.addEventListener("click", function () {
      const chatName = chatNameInput.value.trim();
      if (chatName) {
        createNewChat(chatName);
        chatNameInput.value = "";

        if (typeof newChatModal !== "undefined" && newChatModal.hide) {
          newChatModal.hide();
        }

        // Убедимся, что контейнер чатов развернут при создании нового чата
        categoryChevron.classList.remove("collapsed");
        channelsContainer.classList.remove("collapsed");
      }
    });
  }

  // =========== Функция для загрузки истории чата ===========
  function loadChatHistory(chatId) {
    // Очищаем текущий чат
    chatMessages.innerHTML = "";

    // Загружаем историю выбранного чата
    const history = chatHistory[chatId] || [];

    history.forEach((message) => {
      const isUser = message.role === "user";

      const messageDiv = document.createElement("div");
      messageDiv.className = `message ${isUser ? "user-message" : "assistant-message"}`;

      // Определяем аватар и имя в зависимости от режима
      const avatarLetter = isUser ? "U" : isGrokMode ? "G" : "G";
      const authorName = isUser
        ? "Пользователь"
        : isGrokMode
          ? "Grok"
          : "GigaChat";

      messageDiv.innerHTML = `
            <div class="message-avatar">${avatarLetter}</div>
            <div class="message-content">
                <div class="message-author">${authorName}</div>
                <div class="message-text">${message.content}</div>
                ${!isUser ? '<div class="message-actions"><button class="copy-btn"><i class="bi bi-copy"></i></button></div>' : ""}
            </div>
        `;

      // Добавляем обработчик копирования для кнопки скопировать
      if (!isUser) {
        const copyBtn = messageDiv.querySelector(".copy-btn");
        if (copyBtn) {
          copyBtn.addEventListener("click", () => {
            navigator.clipboard.writeText(message.content);
            showToast("Сообщение скопировано!");
          });
        }
      }

      chatMessages.appendChild(messageDiv);
    });

    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // =========== Функция для отправки запроса к бэкенду ===========
  async function sendMessage(content) {
    try {
      loadingIndicator.style.display = "flex";
      messageInput.disabled = true;

      // Determine which API endpoint to use based on the current mode
      const endpoint = isGrokMode ? "/api/grok" : "/api/chat";

      // Formulate the URL with proper parameter encoding
      const url = new URL(endpoint, window.location.origin);
      url.searchParams.append("content", content);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      // Check HTTP status
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP error! status: ${response.status}. ${error}`);
      }

      // Parse JSON response
      const data = await response.json();

      // Check if content exists in response
      if (!data?.content) {
        throw new Error("Invalid response format");
      }

      // Add message to chat
      addMessage(data.content, "assistant");
    } catch (error) {
      console.error("Error:", error);
      addMessage(
        `
    ⚠️ Произошла ошибка:<br>
    <small>${error.message}</small>
    `,
        "assistant",
      );

      // Ask if user wants to retry
      if (confirm("Ошибка при отправке. Попробовать снова?")) {
        await sendMessage(content);
      }
    } finally {
      loadingIndicator.style.display = "none";
      messageInput.disabled = false;
    }
  }
  // =========== Создание нового чата ===========
  function createNewChat(chatName) {
    // Генерируем уникальный ID для чата
    const chatId = "chat-" + Date.now();

    // Получаем имя ассистента в зависимости от режима
    const assistantName = isGrokMode ? "Grok" : "GigaChat";

    // Инициализируем историю для нового чата
    chatHistory[chatId] = [
      {
        role: "assistant",
        content: `Новый чат "${chatName}" создан. Чем я могу вам помочь?`,
      },
    ];

    // Добавляем новый чат в список каналов
    const channelItem = document.createElement("div");
    channelItem.className = "channel-item";
    channelItem.setAttribute("data-chat-id", chatId);
    channelItem.innerHTML = `
        <i class="fa-solid fa-hashtag channel-icon"></i> ${chatName}
        <span class="delete-channel" data-chat-id="${chatId}" data-chat-name="${chatName}">
            <i class="fa-solid fa-trash-can"></i>
        </span>
    `;

    // Добавляем элемент в контейнер каналов
    channelsContainer.appendChild(channelItem);

    // Добавляем обработчик для переключения на новый канал
    setupChannelItemEvent(channelItem);

    // Сохраняем чаты в localStorage
    saveChatsToLocalStorage();

    // Переключаемся на новый чат
    switchChat(chatId, chatName);
  }

  // =========== Удаление чата ===========
  function deleteChat(chatId) {
    // Удаляем из истории
    delete chatHistory[chatId];

    // Удаляем элемент из DOM
    const channelItem = document.querySelector(
      `.channel-item[data-chat-id="${chatId}"]`,
    );
    if (channelItem) {
      channelItem.remove();
    }

    // Сохраняем чаты в localStorage
    saveChatsToLocalStorage();

    // Если удаляем текущий чат, переключаемся на общий
    if (currentChatId === chatId) {
      switchChat("general", "общий-чат");
    }
  }

  // =========== Переключение между чатами ===========
  function switchChat(chatId, chatName) {
    // Обновляем текущий чат
    currentChatId = chatId;
    currentChatName.textContent = chatName;

    // Обновляем активный класс
    document.querySelectorAll(".channel-item").forEach((item) => {
      item.classList.remove("active");
    });

    const activeChannel = document.querySelector(
      `.channel-item[data-chat-id="${chatId}"]`,
    );
    if (activeChannel) {
      activeChannel.classList.add("active");
    }

    // Загружаем историю
    loadChatHistory(chatId);

    // На мобильных устройствах закрыть сайдбар после выбора чата
    if (window.innerWidth <= 768) {
      closeAllPanels();
    }
  }

  // =========== Сохранение чатов в localStorage ===========
  function saveChatsToLocalStorage() {
    // Используем разные ключи в зависимости от режима
    const historyKey = isGrokMode ? "grok_history" : "gigachat_history";
    const channelsKey = isGrokMode ? "grok_channels" : "gigachat_channels";

    localStorage.setItem(historyKey, JSON.stringify(chatHistory));
    localStorage.setItem(channelsKey, JSON.stringify(getChannelsInfo()));
  }

  // =========== Загрузка чатов из localStorage ===========
  function loadChatsFromLocalStorage() {
    // Используем разные ключи в зависимости от режима
    const historyKey = isGrokMode ? "grok_history" : "gigachat_history";
    const channelsKey = isGrokMode ? "grok_channels" : "gigachat_channels";

    const savedHistory = localStorage.getItem(historyKey);
    const savedChannels = localStorage.getItem(channelsKey);

    // Если в localStorage есть данные, загружаем их
    if (savedHistory) {
      chatHistory = JSON.parse(savedHistory);
    } else {
      // Иначе инициализируем дефолтное состояние
      initializeWelcomeMessage();
    }

    // Если есть сохраненные каналы, создаем их в DOM
    if (savedChannels) {
      const channels = JSON.parse(savedChannels);

      // Очищаем контейнер каналов перед добавлением новых
      // Сохраняем только элементы общего канала, если он есть
      const generalChannel = Array.from(channelsContainer.children).filter(
        (el) => el.getAttribute("data-chat-id") === "general",
      );

      channelsContainer.innerHTML = "";

      // Возвращаем элемент общего канала, если он был
      if (generalChannel.length > 0) {
        generalChannel.forEach((el) => channelsContainer.appendChild(el));
      }

      // Добавляем все остальные каналы
      channels.forEach((channel) => {
        if (channel.id !== "general") {
          const channelItem = document.createElement("div");
          channelItem.className = "channel-item";
          channelItem.setAttribute("data-chat-id", channel.id);
          channelItem.innerHTML = `
                    <i class="fa-solid fa-hashtag channel-icon"></i> ${channel.name}
                    <span class="delete-channel" data-chat-id="${channel.id}" data-chat-name="${channel.name}">
                        <i class="fa-solid fa-trash-can"></i>
                    </span>
                `;

          channelsContainer.appendChild(channelItem);

          // Добавляем обработчик для канала
          setupChannelItemEvent(channelItem);
        }
      });
    } else {
      // Если нет сохраненных каналов, инициализируем дефолтное состояние
      initializeWelcomeMessage();
    }

    // Загружаем историю текущего чата
    loadChatHistory(currentChatId);
  }

  // =========== Обработчик перехода между Grok и GigaChat ===========
  const grokServerIcon = document.getElementById("grok-server-icon");
  const gigaChatServerIcon = document.getElementById("gigachat-server-icon");

  if (grokServerIcon) {
    grokServerIcon.addEventListener("click", function () {
      window.location.href = "/grok";
    });
  }

  if (gigaChatServerIcon) {
    gigaChatServerIcon.addEventListener("click", function () {
      window.location.href = "/";
    });
  }

  // =========== Получение информации о каналах ===========
  function getChannelsInfo() {
    const channels = [];

    document.querySelectorAll(".channel-item").forEach((item) => {
      const id = item.getAttribute("data-chat-id");
      // Извлекаем текст до элемента с классом delete-channel
      let name = "";
      for (let node of item.childNodes) {
        if (node.nodeType === 3) {
          // Текстовый узел
          name += node.textContent.trim();
        } else if (
          node.nodeType === 1 &&
          !node.classList.contains("delete-channel")
        ) {
          // Элемент
          if (node.tagName.toLowerCase() === "i") continue; // Пропускаем иконку
          name += node.textContent.trim();
        } else if (
          node.classList &&
          node.classList.contains("delete-channel")
        ) {
          break; // Останавливаемся, когда достигли кнопки удаления
        }
      }

      channels.push({
        id: id,
        name: name.trim(),
      });
    });

    return channels;
  }

  // =========== Функция настройки обработчика событий для канала ===========
  function setupChannelItemEvent(channelItem) {
    channelItem.addEventListener("click", function (e) {
      // Игнорируем клик по кнопке удаления
      if (e.target.closest(".delete-channel")) return;

      document.querySelectorAll(".channel-item").forEach((item) => {
        item.classList.remove("active");
      });
      channelItem.classList.add("active");

      // Обновление заголовка чата
      const chatId = channelItem.getAttribute("data-chat-id");

      // Получаем имя чата из текста канала (без иконки и кнопки удаления)
      let chatName = "";
      for (let node of channelItem.childNodes) {
        if (node.nodeType === 3) {
          // Текстовый узел
          chatName += node.textContent.trim();
        } else if (
          node.nodeType === 1 &&
          !node.classList.contains("delete-channel")
        ) {
          // Элемент
          if (node.tagName.toLowerCase() === "i") continue; // Пропускаем иконку
          chatName += node.textContent.trim();
        }
      }

      // Переключаемся на выбранный чат
      switchChat(chatId, chatName.trim());
    });
  }

  // =========== Функция отображения всплывающего уведомления ===========
  function showToast(message) {
    // Проверяем, существует ли уже контейнер для тостов
    let toastContainer = document.getElementById("toast-container");
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.id = "toast-container";
      toastContainer.style.cssText =
        "position: fixed; bottom: 20px; right: 20px; z-index: 9999;";
      document.body.appendChild(toastContainer);
    }

    // Создаем новый тост
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.style.cssText =
      "background-color: #333; color: #fff; padding: 10px 20px; border-radius: 4px; margin-top: 10px; opacity: 0; transition: opacity 0.3s;";
    toast.textContent = message;

    // Добавляем тост в контейнер
    toastContainer.appendChild(toast);

    // Отображаем тост
    setTimeout(() => {
      toast.style.opacity = "1";
    }, 10);

    // Скрываем и удаляем тост через 3 секунды
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => {
        toastContainer.removeChild(toast);
      }, 300);
    }, 3000);
  }

  // =========== Функция отправки сообщения ===========
  function handleSendMessage() {
    const content = messageInput.value.trim();
    if (content) {
      // Добавляем сообщение пользователя в чат
      addMessage(content, "user");

      // Отправляем запрос к бэкенду
      sendMessage(content);

      // Очищаем поле ввода
      messageInput.value = "";
    }
  }

  // =========== Обработчики событий ===========

  // Отправка сообщения при нажатии Enter
  if (messageInput) {
    messageInput.addEventListener("keypress", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        handleSendMessage();
      }
    });
  }

  // Отправка сообщения при клике на кнопку
  if (sendButton) {
    sendButton.addEventListener("click", function () {
      handleSendMessage();
    });
  }

  // Обработчик для переключения между чатами
  if (channelList) {
    channelList.addEventListener("click", function (event) {
      // Проверяем, был ли клик по элементу канала
      let channelItem = event.target.closest(".channel-item");
      if (channelItem) {
        const deleteBtn = event.target.closest(".delete-channel");

        // Если клик был не по кнопке удаления
        if (!deleteBtn) {
          const chatId = channelItem.getAttribute("data-chat-id");

          // Получаем имя чата из текста канала (без иконки и кнопки удаления)
          let chatName = "";
          for (let node of channelItem.childNodes) {
            if (node.nodeType === 3) {
              // Текстовый узел
              chatName += node.textContent.trim();
            } else if (
              node.nodeType === 1 &&
              !node.classList.contains("delete-channel")
            ) {
              // Элемент
              if (node.tagName.toLowerCase() === "i") continue; // Пропускаем иконку
              chatName += node.textContent.trim();
            }
          }

          switchChat(chatId, chatName.trim());
        }
      }

      // Если клик был по кнопке удаления
      if (event.target.closest(".delete-channel")) {
        const deleteBtn = event.target.closest(".delete-channel");
        const chatId = deleteBtn.getAttribute("data-chat-id");
        const chatName = deleteBtn.getAttribute("data-chat-name");

        // Показываем модальное окно для подтверждения
        document.getElementById("delete-chat-name").textContent = chatName;
        document
          .getElementById("confirm-delete-btn")
          .setAttribute("data-chat-id", chatId);
        deleteChatModal.show();

        // Предотвращаем всплытие события для предотвращения переключения на канал
        event.stopPropagation();
      }
    });
  }

  // Подтверждение удаления чата
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", function () {
      const chatId = this.getAttribute("data-chat-id");
      deleteChat(chatId);
      deleteChatModal.hide();
    });
  }

  // =========== Мобильный тогглер для сайдбара ===========
  const mobileToggle = document.getElementById("toggle-channels");
  const toggleIcon = document.getElementById("toggle-icon");

  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener("click", function () {
      sidebar.style.display =
        sidebar.style.display === "none" ? "block" : "none";
      if (toggleIcon) {
        toggleIcon.classList.toggle("bi-arrows-collapse-vertical");
        toggleIcon.classList.toggle("bi-arrows-expand-vertical");
      }
    });
  }

  // =========== Подсветка кода при загрузке ===========
  if (typeof hljs !== "undefined") {
    hljs.highlightAll();
  }

  // =========== Загружаем чаты при инициализации ===========
  loadChatsFromLocalStorage();

  // Устанавливаем обработчики для существующих каналов
  document.querySelectorAll(".channel-item").forEach(setupChannelItemEvent);
});

// Автоматическая подсветка при загрузке и после динамического контента
