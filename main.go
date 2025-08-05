package main

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"time"

	"github.com/google/uuid"
	"github.com/ilyakaznacheev/cleanenv"
	"github.com/microcosm-cc/bluemonday"
	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
	"github.com/yuin/goldmark"
)

type APIKeys struct {
	GIGACHAT_API_KEY string `yaml:"GIGACHAT_API" env-default:"gigachat_api"`
	GROK_API_KEY     string `yaml:"GROK_API" env-default:"grok_api"`
}

func GetAccessToken() (map[string]interface{}, error) {
	apiUrl := "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
	newUUID := uuid.NewString()

	data := url.Values{}
	data.Set("scope", "GIGACHAT_API_PERS")

	req, err := http.NewRequest("POST", apiUrl, bytes.NewBufferString(data.Encode()))
	if err != nil {
		return nil, err
	}
	var cfg APIKeys

	err = cleanenv.ReadConfig("config.yaml", &cfg)
	if err != nil {
		return nil, fmt.Errorf("error config: %w", err)
	}
	if cfg.GIGACHAT_API_KEY == "gigachat_api" {
		return nil, fmt.Errorf("ENTER GIGACHAT API")
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("RqUID", newUUID)
	req.Header.Set("Authorization", fmt.Sprintf("Basic %s", cfg.GIGACHAT_API_KEY))

	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var res map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&res)
	return res, err
}

type jsonRequest struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
	Stream   bool      `json:"stream"`
	Penalty  int64     `json:"repetition_penalty"`
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type Response struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
			Role    string `json:"role"`
		} `json:"message"`
	} `json:"choices"`
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

var contents []string

func GrokHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	content := r.URL.Query().Get("content")
	if content == "" {
		http.Error(w, `{"error": "Параметр content обязателен"}`, http.StatusBadRequest)
		return
	}

	fmt.Printf("Processing Grok request with content: %s\n", content)
	var cfg APIKeys

	err := cleanenv.ReadConfig("config.yaml", &cfg)
	if err != nil {
		log.Fatal("error config: ", err)
		return
	}
	if cfg.GIGACHAT_API_KEY == "gigachat_api" {
		log.Fatal("error config: ", err)
		return
	}

	client := openai.NewClient(
		option.WithBaseURL("https://router.requesty.ai/v1"),
		option.WithHeader("Authorization", fmt.Sprintf("Bearer %s", cfg.GROK_API_KEY)),
	)

	chatCompletion, err := client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
		Messages: []openai.ChatCompletionMessageParamUnion{
			openai.UserMessage(content),
		},
		Model: "xai/grok-3-mini-beta",
	})

	if err != nil {
		fmt.Printf("Grok API error: %v\n", err)
		errorResponse := map[string]string{"error": err.Error()}
		json.NewEncoder(w).Encode(errorResponse)
		return
	}

	// Debug log
	fmt.Printf("Grok API response received successfully\n")

	if len(chatCompletion.Choices) == 0 {
		fmt.Printf("Grok API returned no choices\n")
		errorResponse := map[string]string{"error": "No response from Grok API"}
		json.NewEncoder(w).Encode(errorResponse)
		return
	}

	rawContent := chatCompletion.Choices[0].Message.Content
	// fmt.Printf("Raw Grok content: %s\n", rawContent)

	rawHTML := renderMarkdown(rawContent)
	safeHTML := sanitizeHTML(rawHTML)

	response := map[string]string{
		"content": safeHTML,
		"raw":     rawContent,
	}

	err = json.NewEncoder(w).Encode(response)
	if err != nil {
		fmt.Printf("Error encoding JSON response: %v\n", err)
		http.Error(w, `{"error": "Error encoding response"}`, http.StatusInternalServerError)
		return
	}
}

func GigaChatHandler(w http.ResponseWriter, r *http.Request) {
	apiUrl := "https://gigachat.devices.sberbank.ru/api/v1/chat/completions"
	content := r.URL.Query().Get("content")
	if content == "" {
		http.Error(w, `{"error": "Параметр content обязателен"}`, http.StatusBadRequest)
		return
	}

	// история сообщений
	if len(contents) >= 4 {
		contents = contents[1:]
	}
	contents = append(contents, content)

	jsonReq := jsonRequest{
		Model:   "GigaChat-Pro",
		Stream:  false,
		Penalty: 1,
		Messages: []Message{
			{Role: "user", Content: content},
		},
	}

	jsonData, err := json.Marshal(jsonReq)
	if err != nil {
		http.Error(w, `{"error": "Ошибка при формировании запроса"}`, http.StatusInternalServerError)
		return
	}

	req, err := http.NewRequest("POST", apiUrl, bytes.NewBuffer(jsonData))
	if err != nil {
		http.Error(w, `{"error": "Ошибка при создании запроса"}`, http.StatusBadRequest)
		return
	}

	accessToken, err := GetAccessToken()
	if err != nil {
		http.Error(w, `{"error": "Не удалось получить токен доступа"}`, http.StatusInternalServerError)
		return
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", accessToken["access_token"].(string)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}

	resp, err := client.Do(req)
	if err != nil {
		http.Error(w, `{"error": "Ошибка при выполнении запроса к API"}`, http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	var jsonMessage Response
	if err := json.NewDecoder(resp.Body).Decode(&jsonMessage); err != nil {
		http.Error(w, `{"error": "Ошибка при обработке ответа"}`, http.StatusInternalServerError)
		return
	}

	if len(jsonMessage.Choices) > 0 {
		// Экранируем HTML
		rawHTML := renderMarkdown(jsonMessage.Choices[0].Message.Content)
		safeHTML := sanitizeHTML(rawHTML)

		response := map[string]string{
			"content": safeHTML,
			"raw":     rawHTML,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}

func renderMarkdown(md string) string {
	var buf bytes.Buffer
	if err := goldmark.Convert([]byte(md), &buf); err != nil {
		return "<pre>Error rendering markdown</pre>"
	}
	return buf.String()
}

func sanitizeHTML(html string) string {
	p := bluemonday.UGCPolicy()
	p.AllowAttrs("class").Matching(regexp.MustCompile("^language-[a-zA-Z0-9]+$")).OnElements("code")
	return p.Sanitize(html)
}

func staticFileHandler(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	if path == "/" || path == "/grok" {
		path = "/index.html"
	}

	filePath := "./static" + path
	_, err := os.Stat(filePath)
	if os.IsNotExist(err) {
		http.NotFound(w, r)
		return
	}

	contentType := "text/html"
	switch filepath.Ext(filePath) {
	case ".css":
		contentType = "text/css"
	case ".js":
		contentType = "application/javascript"
	case ".png":
		contentType = "image/png"
	case ".jpg", ".jpeg":
		contentType = "image/jpeg"
	case ".svg":
		contentType = "image/svg+xml"
	}

	w.Header().Set("Content-Type", contentType)
	http.ServeFile(w, r, filePath)
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/grok", GrokHandler)
	mux.HandleFunc("/api/chat", GigaChatHandler)
	mux.HandleFunc("/", staticFileHandler)

	fmt.Println("Сервер запущен на http://localhost:8080")
	http.ListenAndServe(":8080", corsMiddleware(mux))
}
