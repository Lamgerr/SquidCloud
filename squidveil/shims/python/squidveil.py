import os
import json
import urllib.request
import urllib.error


API_KEY_ENV = 'SQUIDCLOUD_API_KEY'
BASE_URL = 'https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api'


class VeilRef:
    def __init__(self, name, id=None, exp=None, Ns=None):
        self._name = name
        self.id = id
        self.exp = exp
        self.Ns = Ns

    @property
    def name(self):
        return self._name

    def __repr__(self):
        return f'[VeilRef:{self._name}:{self.id}:{self.exp}:{self.Ns}]'


class SquidVeil:
    def __init__(self):
        self._api_key = os.environ.get(API_KEY_ENV)

    def _headers(self):
        return {
            'Content-Type': 'application/json',
            'X-SquidCloud-Key': self._api_key or '',
        }

    def _request(self, path, data=None):
        url = f'{BASE_URL}{path}'
        body = json.dumps(data).encode('utf-8') if data else None
        req = urllib.request.Request(url, data=body, headers=self._headers(), method='POST')
        try:
            with urllib.request.urlopen(req) as resp:
                return json.loads(resp.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            raise RuntimeError(f'SquidVeil API error: {e.code} {e.read().decode()}')

    def __getattr__(self, name):
        if name.startswith('_'):
            raise AttributeError(name)
        return VeilRef(name)

    def connect(self):
        return self._request('/squidshake/handshake')

    def create_veilref(self, secret_name):
        return self._request('/squidshake/ref', {'name': secret_name})

    def verify(self, secret_name, candidate_value):
        return self._request(f'/secrets/{secret_name}/verify', {'value': candidate_value})

    def request(self, ref, url, method='GET', body=None):
        return self._request('/squidshake/request', {
            'ref': ref._name if isinstance(ref, VeilRef) else ref,
            'url': url,
            'method': method,
            'body': body,
        })

    def sign(self, ref, data):
        return self._request('/squidshake/sign', {
            'ref': ref._name if isinstance(ref, VeilRef) else ref,
            'data': data,
        })

    def encrypt(self, ref, data):
        return self._request('/squidshake/encrypt', {
            'ref': ref._name if isinstance(ref, VeilRef) else ref,
            'data': data,
        })

    def decrypt(self, ref, data):
        return self._request('/squidshake/decrypt', {
            'ref': ref._name if isinstance(ref, VeilRef) else ref,
            'data': data,
        })

    def hmac(self, ref, data, algorithm='SHA256'):
        return self._request('/squidshake/hmac', {
            'ref': ref._name if isinstance(ref, VeilRef) else ref,
            'data': data,
            'algorithm': algorithm,
        })


squidveil = SquidVeil()
