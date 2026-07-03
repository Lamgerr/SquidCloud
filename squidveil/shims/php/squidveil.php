<?php

class VeilRef
{
    public string $name;
    public string $id;
    public int $exp;

    public function __construct(string $name, string $id, int $exp)
    {
        $this->name = $name;
        $this->id = $id;
        $this->exp = $exp;
    }

    public function __toString(): string
    {
        return "[VeilRef:{$this->name}:id:{$this->id}:exp:{$this->exp}]";
    }
}

class SquidVeil
{
    private string $baseUrl;
    private string $apiKey;

    public function __construct()
    {
        $this->baseUrl = 'https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api';
        $this->apiKey = getenv('SQUIDCLOUD_API_KEY');
        if (!$this->apiKey) {
            throw new RuntimeException('SQUIDCLOUD_API_KEY environment variable is not set');
        }
    }

    public function __get(string $name): VeilRef
    {
        $response = $this->request($name, '/refs', 'GET');
        $data = json_decode($response, true);
        return new VeilRef(
            $data['name'] ?? $name,
            $data['id'] ?? '',
            $data['exp'] ?? 0
        );
    }

    private function buildUrl(string $path): string
    {
        return rtrim($this->baseUrl, '/') . '/' . ltrim($path, '/');
    }

    public function request(string $ref, string $url, string $method = 'GET', $body = null): string
    {
        $ch = curl_init();
        $fullUrl = $this->buildUrl($url);

        curl_setopt_array($ch, [
            CURLOPT_URL => $fullUrl,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => strtoupper($method),
            CURLOPT_HTTPHEADER => [
                'X-SquidCloud-Key: ' . $this->apiKey,
                'X-SquidVeil-Ref: ' . $ref,
                'Content-Type: application/json',
            ],
        ]);

        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, is_string($body) ? $body : json_encode($body));
        }

        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new RuntimeException("SquidVeil request failed: $error");
        }

        if ($httpCode >= 400) {
            throw new RuntimeException("SquidVeil request failed with status $httpCode: $result");
        }

        return $result;
    }

    public function sign(string $ref, $data): string
    {
        return $this->request($ref, '/sign', 'POST', $data);
    }

    public function encrypt(string $ref, $data): string
    {
        return $this->request($ref, '/encrypt', 'POST', $data);
    }

    public function decrypt(string $ref, $data): string
    {
        return $this->request($ref, '/decrypt', 'POST', $data);
    }

    public function verify(string $name, string $value): bool
    {
        $response = $this->request($name, '/verify', 'POST', ['value' => $value]);
        $data = json_decode($response, true);
        return isset($data['valid']) && $data['valid'] === true;
    }
}

$squidveil = new SquidVeil();
