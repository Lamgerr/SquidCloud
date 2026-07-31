package squidveil

import (
	"context"
	"encoding/json"
	"io"
	"math/rand"
	"net/http"
	"strings"
	"time"
)

const (
	defaultTimeout    = 30 * time.Second
	defaultMaxRetries = 3
	userAgent         = "squidveil-go/0.1.0"
)

var retryableStatuses = map[int]bool{408: true, 425: true, 429: true, 500: true, 502: true, 503: true, 504: true}

func (c *Client) do(ctx context.Context, method, path string, payload any, out any) error {
	var body io.Reader
	if payload != nil {
		raw, err := json.Marshal(payload)
		if err != nil {
			return &Error{Code: "ENCODE", Message: "failed to encode request body"}
		}
		body = strings.NewReader(string(raw))
	}

	var lastErr error
	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		resp, err := c.doOnce(ctx, method, path, body, payload != nil)
		if err != nil {
			lastErr = err
			if !c.retryable(err) || attempt >= c.maxRetries {
				return err
			}
			c.backoff(attempt, nil)
			continue
		}
		if retryableStatuses[resp.StatusCode] && attempt < c.maxRetries {
			c.backoff(attempt, resp.Header)
			continue
		}
		if resp.StatusCode >= 400 {
			return c.parseError(resp)
		}
		raw, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return &Error{Code: "NETWORK", Message: "failed to read response body"}
		}
		if out != nil {
			if err := json.Unmarshal(raw, out); err != nil {
				return &Error{Code: "DECODE", Status: resp.StatusCode, Message: "failed to decode response"}
			}
		}
		return nil
	}
	return lastErr
}

func (c *Client) doOnce(ctx context.Context, method, path string, body io.Reader, hasBody bool) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, c.url+path, body)
	if err != nil {
		return nil, &Error{Code: "CONFIGURATION", Message: "invalid request URL: " + c.url + path}
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Authorization", "Bearer "+c.token)
	if c.deviceFingerprint != "" {
		req.Header.Set("x-squidveil-device", c.deviceFingerprint)
	}
	if hasBody {
		req.Header.Set("Content-Type", "application/json")
	}
	return c.http.Do(req)
}

func (c *Client) retryable(err error) bool {
	if e, ok := err.(*Error); ok {
		return retryableStatuses[e.Status]
	}
	return true
}

func (c *Client) backoff(attempt int, headers http.Header) {
	delay := time.Duration(rand.Int63n(int64(250*(1<<attempt)) * int64(time.Millisecond)))
	if headers != nil {
		if ra := headers.Get("Retry-After"); ra != "" {
			if secs, err := time.ParseDuration(ra + "s"); err == nil && secs < 10*time.Second {
				delay = secs
			}
		}
	}
	time.Sleep(delay)
}

func (c *Client) parseError(resp *http.Response) error {
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	var e struct {
		Error string `json:"error"`
		Code  string `json:"code"`
	}
	_ = json.Unmarshal(body, &e)
	code := e.Code
	if code == "" {
		code = "ERROR"
	}
	msg := e.Error
	if msg == "" {
		msg = http.StatusText(resp.StatusCode)
	}
	return &Error{Code: code, Status: resp.StatusCode, Message: msg}
}
