package squidveil

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

const baseURL = "https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api"

type VeilRef struct {
	Name string `json:"name"`
	ID   string `json:"id"`
	Exp  int    `json:"exp"`
}

func (r *VeilRef) String() string {
	return fmt.Sprintf("[VeilRef:%s:id:%s:exp:%d]", r.Name, r.ID, r.Exp)
}

type SquidVeil struct {
	apiKey string
	client *http.Client
}

func Init() *SquidVeil {
	apiKey := os.Getenv("SQUIDCLOUD_API_KEY")
	if apiKey == "" {
		panic("SQUIDCLOUD_API_KEY environment variable is not set")
	}
	return &SquidVeil{
		apiKey: apiKey,
		client: &http.Client{},
	}
}

func (s *SquidVeil) Get(name string) *VeilRef {
	var ref VeilRef
	s.doRequest(name, "/refs", "GET", nil, &ref)
	return &ref
}

func (s *SquidVeil) Request(ref, url, method, body string) (string, error) {
	bodyReader := bytes.NewReader([]byte(body))
	fullURL := baseURL + "/" + url

	req, err := http.NewRequest(method, fullURL, bodyReader)
	if err != nil {
		return "", fmt.Errorf("squidveil: failed to create request: %w", err)
	}

	req.Header.Set("X-SquidCloud-Key", s.apiKey)
	req.Header.Set("X-SquidVeil-Ref", ref)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("squidveil: request failed: %w", err)
	}
	defer resp.Body.Close()

	out, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("squidveil: failed to read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("squidveil: request failed with status %d: %s", resp.StatusCode, string(out))
	}

	return string(out), nil
}

func (s *SquidVeil) doRequest(ref, path, method string, body, result interface{}) {
	var bodyReader *bytes.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			panic(fmt.Sprintf("squidveil: failed to marshal body: %v", err))
		}
		bodyReader = bytes.NewReader(b)
	} else {
		bodyReader = bytes.NewReader([]byte{})
	}

	fullURL := baseURL + "/" + path

	req, err := http.NewRequest(method, fullURL, bodyReader)
	if err != nil {
		panic(fmt.Sprintf("squidveil: failed to create request: %v", err))
	}

	req.Header.Set("X-SquidCloud-Key", s.apiKey)
	req.Header.Set("X-SquidVeil-Ref", ref)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		panic(fmt.Sprintf("squidveil: request failed: %v", err))
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		out, _ := io.ReadAll(resp.Body)
		panic(fmt.Sprintf("squidveil: request failed with status %d: %s", resp.StatusCode, string(out)))
	}

	if result != nil {
		if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
			panic(fmt.Sprintf("squidveil: failed to decode response: %v", err))
		}
	}
}

func (s *SquidVeil) Verify(name, value string) bool {
	var result struct {
		Valid bool `json:"valid"`
	}
	s.doRequest(name, "/verify", "POST", map[string]string{"value": value}, &result)
	return result.Valid
}

var squidveil = Init()
