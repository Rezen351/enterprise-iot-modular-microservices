package channels

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/smtp"
	"strconv"
	"time"

	"github.com/almuzky/iot/services/webhook/internal/config"
)

type SenderResult struct {
	OK  bool
	Err string
}

func SendEmail(cfg *config.Config, to, subject, body, secret string) SenderResult {
	if cfg.SMTPHost == "" {
		return SenderResult{Err: "email transport not configured"}
	}
	from := cfg.SMTPFrom
	if from == "" {
		from = cfg.SMTPUser
	}
	if from == "" || to == "" {
		return SenderResult{Err: "email from/to missing"}
	}
	addr := net.JoinHostPort(cfg.SMTPHost, strconv.Itoa(cfg.SMTPPort))
	conn, err := net.DialTimeout("tcp", addr, 5*time.Second)
	if err != nil {
		return SenderResult{Err: "smtp dial failed"}
	}
	defer conn.Close()
	c, err := smtp.NewClient(conn, cfg.SMTPHost)
	if err != nil {
		return SenderResult{Err: "smtp client failed"}
	}
	defer c.Quit()
	if cfg.SMTPUser != "" {
		if err := c.Auth(smtp.PlainAuth("", cfg.SMTPUser, secret, cfg.SMTPHost)); err != nil {
			return SenderResult{Err: "smtp auth failed"}
		}
	}
	if err := c.Mail(from); err != nil {
		return SenderResult{Err: "smtp mail-from failed"}
	}
	if err := c.Rcpt(to); err != nil {
		return SenderResult{Err: "smtp rcpt failed"}
	}
	w, err := c.Data()
	if err != nil {
		return SenderResult{Err: "smtp data failed"}
	}
	if _, err := w.Write([]byte(buildRFC822(from, to, subject, body))); err != nil {
		return SenderResult{Err: "smtp write failed"}
	}
	if err := w.Close(); err != nil {
		return SenderResult{Err: "smtp close failed"}
	}
	return SenderResult{OK: true}
}

func buildRFC822(from, to, subject, body string) string {
	var b bytes.Buffer
	b.WriteString("From: " + from + "\r\n")
	b.WriteString("To: " + to + "\r\n")
	b.WriteString("Subject: " + subject + "\r\n")
	b.WriteString("MIME-Version: 1.0\r\n")
	b.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	b.WriteString("\r\n")
	b.WriteString(body)
	return b.String()
}

func SendTelegram(cfg *config.Config, chatID, body, secret string) SenderResult {
	if secret == "" {
		return SenderResult{Err: "telegram bot token not configured"}
	}
	api := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", secret)
	payload := map[string]string{"chat_id": chatID, "text": body}
	return httpPost(api, payload, "", 10*time.Second)
}

func SendWebhookHTTP(cfg *config.Config, url, subject, body, secret string) SenderResult {
	if url == "" {
		return SenderResult{Err: "webhook url not configured"}
	}
	payload := map[string]string{"subject": subject, "body": body}
	if secret != "" {
		payload["signature"] = secret
	}
	return httpPost(url, payload, "", 10*time.Second)
}

func httpPost(url string, payload map[string]string, bearer string, timeout time.Duration) SenderResult {
	data, err := json.Marshal(payload)
	if err != nil {
		return SenderResult{Err: "payload encode failed"}
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		return SenderResult{Err: "request build failed"}
	}
	req.Header.Set("Content-Type", "application/json")
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return SenderResult{Err: "http request failed"}
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return SenderResult{OK: true}
	}
	return SenderResult{Err: fmt.Sprintf("http status %d", resp.StatusCode)}
}
