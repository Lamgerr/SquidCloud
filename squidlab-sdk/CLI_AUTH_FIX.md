# SquidLab SDK CLI Authentication Fix 🔐

## Date: October 7, 2025
## Version: 1.0.6

---

## Issues Fixed ✅

### 1. **Login Accepted Any API Key**
**Problem:** The CLI would accept any string as an API key without validation, even `"fake"` or `"test"`.

**Solution:** 
- Added proper API key validation during login
- Makes actual API call to `/whoami` endpoint to verify key
- Shows user account information for confirmation
- Asks "Is this the correct account?" before saving

### 2. **Whoami Returned Undefined/Null**
**Problem:** `squidlab-sdk whoami` showed:
```
Email: undefined
ID: undefined
Created: Invalid Date
```

**Root Cause:** 
- Used non-existent endpoint `/api/v1/user/profile`
- Wrong authorization headers
- Config not loading properly

**Solution:**
- Created new `/whoami` endpoint in cloudbliss-api Edge Function
- Fixed to use correct endpoint: `/functions/v1/cloudbliss-api/whoami`
- Fixed headers to use `X-SquidCloud-Key` instead of `Bearer` token
- Fixed config loading with proper error handling

### 3. **API Files List Crashed**
**Problem:** `squidlab-sdk api:files:list` crashed with:
```
❌ Error: Cannot read properties of undefined (reading 'forEach')
```

**Root Cause:**
- Wrong API base URL (`/api/v1` instead of `/functions/v1/cloudbliss-api`)
- Response structure mismatch
- Missing null checks

**Solution:**
- Updated base URL to correct Edge Function path
- Added fallback handling for different response structures
- Added null/undefined checks for file arrays
- Shows "No files found" instead of crashing

### 4. **Config Not Persisted Properly**
**Problem:** Login succeeded but commands still said "Not logged in"

**Solution:**
- Fixed `loadConfig()` to properly read JSON file
- Fixed `saveConfig()` to create directory recursively
- Added proper error handling
- Save user info along with API key for better UX

---

## Technical Changes 🔧

### Edge Function Updates

#### New Endpoint: `/whoami` (or `/user`)

**File:** `supabase/functions/cloudbliss-api/index.ts`

Added `handleUserAPI` function:

```typescript
async function handleUserAPI(req: Request, supabase: any, userId: string) {
  if (req.method === 'GET') {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, email, created_at, storage_used')
      .eq('id', userId)
      .single()

    if (profileError) {
      // Fallback to auth.users if profile doesn't exist
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId)
      
      if (authError) throw authError
      
      return new Response(
        JSON.stringify({ 
          id: authUser.user.id,
          email: authUser.user.email,
          created_at: authUser.user.created_at,
          success: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        created_at: profile.created_at,
        storage_used: profile.storage_used,
        success: true 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed', success: false }),
    { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
```

### CLI Updates

#### 1. Fixed `loadConfig()`

**Before:**
```javascript
function loadConfig() {
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
  return {};
}
```

**After:**
```javascript
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    }
  } catch (error) {
    console.error(chalk.red('⚠️  Failed to load config:', error.message));
  }
  return {};
}
```

#### 2. Fixed `saveConfig()`

**Before:**
```javascript
function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}
```

**After:**
```javascript
function saveConfig(config) {
  try {
    // Ensure directory exists
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (error) {
    console.error(chalk.red('❌ Failed to save config:', error.message));
    throw error;
  }
}
```

#### 3. Fixed `makeAPIRequest()`

**Before:**
```javascript
async function makeAPIRequest(endpoint, method = 'GET', data = null) {
  const config = loadConfig();
  const apiKey = config.apiKey;
  
  const axios = require('axios');
  const baseURL = 'https://squidcloud.inflate.live/api/v1'; // WRONG!
  
  const response = await axios({
    method,
    url: `${baseURL}${endpoint}`,
    data,
    headers: {
      'Authorization': `Bearer ${apiKey}`, // WRONG!
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
}
```

**After:**
```javascript
async function makeAPIRequest(endpoint, method = 'GET', data = null) {
  const config = loadConfig();
  const apiKey = config.apiKey;
  
  if (!apiKey) {
    console.log(chalk.red('❌ Not logged in! Run: squidlab-sdk login'));
    process.exit(1);
  }
  
  const axios = require('axios');
  const baseURL = 'https://squidcloud.inflate.live/functions/v1/cloudbliss-api'; // CORRECT!
  
  try {
    const response = await axios({
      method,
      url: `${baseURL}${endpoint}`,
      data,
      headers: {
        'X-SquidCloud-Key': apiKey, // CORRECT!
        'Content-Type': 'application/json'
      }
    });
    
    // Check if response has success field
    if (response.data && response.data.success === false) {
      throw new Error(response.data.error || 'API request failed');
    }
    
    return response.data;
  } catch (error) {
    if (error.response) {
      const errorMsg = error.response.data?.error || error.response.data?.message || error.response.statusText;
      throw new Error(`API Error (${error.response.status}): ${errorMsg}`);
    }
    throw error;
  }
}
```

#### 4. Completely Rewrote `login` Command

**Key Improvements:**
- ✅ API key format validation (must start with `cb_`)
- ✅ API key length validation (min 20 chars)
- ✅ Actual API call to verify key works
- ✅ Shows user account information
- ✅ Asks for confirmation before saving
- ✅ Saves user info along with key
- ✅ Better error messages

**New Flow:**
```javascript
program
  .command('login')
  .description('Login to SquidCloud API')
  .option('-k, --api-key <key>', 'Your API key')
  .action(async (options) => {
    console.log(chalk.blue('🔐 SquidCloud API Login'));
    
    // 1. Get API key (with validation)
    let apiKey = options.apiKey;
    if (!apiKey) {
      const answers = await inquirer.prompt([
        {
          type: 'password',
          name: 'apiKey',
          message: 'Enter your API key (starts with cb_):',
          mask: '*',
          validate: (input) => {
            if (!input || input.trim().length === 0) return 'API key cannot be empty';
            if (!input.startsWith('cb_')) return 'API key must start with cb_';
            if (input.length < 20) return 'API key seems too short';
            return true;
          }
        }
      ]);
      apiKey = answers.apiKey.trim();
    }
    
    // 2. Validate API key format
    if (!apiKey.startsWith('cb_')) {
      console.log(chalk.red('❌ Invalid API key format. Key must start with cb_'));
      process.exit(1);
    }
    
    // 3. Test API key with actual request
    try {
      const axios = require('axios');
      console.log(chalk.yellow('🔍 Validating API key...'));
      
      const response = await axios.get(
        'https://squidcloud.inflate.live/functions/v1/cloudbliss-api/whoami', 
        {
          headers: {
            'X-SquidCloud-Key': apiKey
          }
        }
      );
      
      const userData = response.data;
      
      if (!userData.success) {
        throw new Error(userData.error || 'Invalid API key');
      }
      
      // 4. Show user account info for confirmation
      console.log(chalk.green('\n✅ API Key Valid!'));
      console.log(chalk.blue('\n👤 Account Information:'));
      console.log(chalk.cyan(`   Email: ${userData.email || 'N/A'}`));
      console.log(chalk.cyan(`   Name: ${userData.full_name || 'Not set'}`));
      console.log(chalk.cyan(`   User ID: ${userData.id}`));
      console.log(chalk.cyan(`   Account Created: ${new Date(userData.created_at).toLocaleDateString()}`));
      
      // 5. Ask for confirmation
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Is this the correct account?',
          default: true
        }
      ]);
      
      if (!confirm) {
        console.log(chalk.yellow('⚠️  Login cancelled'));
        process.exit(0);
      }
      
      // 6. Save config with user info
      saveConfig({ 
        apiKey, 
        userId: userData.id,
        email: userData.email,
        loggedInAt: new Date().toISOString() 
      });
      
      console.log(chalk.green('\n✅ Login successful!'));
      console.log(chalk.cyan(`📝 Config saved to: ${configPath}`));
      console.log(chalk.yellow('\n💡 You can now use API commands!'));
      console.log(chalk.gray('\nTry: squidlab-sdk whoami'));
      
    } catch (error) {
      console.log(chalk.red('\n❌ Login failed!'));
      if (error.response) {
        const errorMsg = error.response.data?.error || error.response.statusText;
        console.log(chalk.red(`   Error: ${errorMsg}`));
        console.log(chalk.red(`   Status: ${error.response.status}`));
      } else {
        console.log(chalk.red(`   Error: ${error.message}`));
      }
      console.log(chalk.yellow('\n💡 Make sure you:'));
      console.log(chalk.yellow('   1. Have a valid API key from https://squidcloud.inflate.live'));
      console.log(chalk.yellow('   2. The API key starts with cb_'));
      console.log(chalk.yellow('   3. The API key is active and not revoked'));
      process.exit(1);
    }
  });
```

#### 5. Fixed `whoami` Command

**Before:**
```javascript
program
  .command('whoami')
  .action(async () => {
    try {
      const data = await makeAPIRequest('/user/profile'); // WRONG ENDPOINT!
      console.log(chalk.blue('👤 Current User:'));
      console.log(chalk.cyan(`   Email: ${data.email}`)); // CRASHED: undefined
      console.log(chalk.cyan(`   ID: ${data.id}`)); // CRASHED: undefined
    } catch (error) {
      console.log(chalk.red('❌ Error:', error.message));
    }
  });
```

**After:**
```javascript
program
  .command('whoami')
  .action(async () => {
    try {
      const config = loadConfig();
      if (!config.apiKey) {
        console.log(chalk.red('❌ Not logged in! Run: squidlab-sdk login'));
        process.exit(1);
      }
      
      const data = await makeAPIRequest('/whoami'); // CORRECT ENDPOINT!
      console.log(chalk.blue('👤 Current User:'));
      console.log(chalk.cyan(`   Email: ${data.email || 'N/A'}`)); // NULL SAFE
      console.log(chalk.cyan(`   Name: ${data.full_name || 'Not set'}`)); // NULL SAFE
      console.log(chalk.cyan(`   ID: ${data.id}`));
      console.log(chalk.cyan(`   Created: ${new Date(data.created_at).toLocaleDateString()}`));
      
      if (data.storage_used !== undefined) {
        const storageGB = (data.storage_used / (1024 * 1024 * 1024)).toFixed(2);
        console.log(chalk.cyan(`   Storage Used: ${storageGB} GB`));
      }
      
      console.log(chalk.gray(`\n📝 Logged in since: ${new Date(config.loggedInAt).toLocaleString()}`));
    } catch (error) {
      console.log(chalk.red('❌ Error:', error.message));
      console.log(chalk.yellow('\n💡 Try running: squidlab-sdk login'));
      process.exit(1);
    }
  });
```

#### 6. Fixed `api:files:list` Command

**Before:**
```javascript
const data = await makeAPIRequest(endpoint);

console.log(chalk.blue(`📁 Files (${data.count} total):\n`));
data.data.forEach(file => { // CRASHED: data.data was undefined
  // ...
});
```

**After:**
```javascript
const data = await makeAPIRequest(endpoint);

if (options.json) {
  console.log(JSON.stringify(data, null, 2));
} else {
  const files = data.files || data.data || []; // HANDLES DIFFERENT STRUCTURES
  const count = data.count || data.total || files.length;
  
  console.log(chalk.blue(`📁 Files (${count} total):\n`));
  
  if (files.length === 0) {
    console.log(chalk.yellow('   No files found')); // INSTEAD OF CRASH
  } else {
    files.forEach(file => {
      const size = formatFileSize(file.size || 0); // NULL SAFE
      const date = new Date(file.created_at).toLocaleDateString();
      console.log(chalk.cyan(`  📄 ${file.name}`));
      console.log(chalk.gray(`     ID: ${file.id} | Size: ${size} | Created: ${date}`));
    });
  }
}
```

---

## Testing the Fixes ✅

### 1. Test Invalid API Key (Should Fail)

```bash
squidlab-sdk login --api-key "fake_key_test"
```

**Expected Output:**
```
🔐 SquidCloud API Login
🔍 Validating API key...

❌ Login failed!
   Error: Invalid API key
   Status: 401

💡 Make sure you:
   1. Have a valid API key from https://squidcloud.inflate.live
   2. The API key starts with cb_
   3. The API key is active and not revoked
```

### 2. Test Valid API Key

```bash
squidlab-sdk login
# Enter your real API key when prompted
```

**Expected Output:**
```
🔐 SquidCloud API Login
? Enter your API key (starts with cb_): [hidden]
🔍 Validating API key...

✅ API Key Valid!

👤 Account Information:
   Email: your-email@example.com
   Name: Your Name
   User ID: uuid-here
   Account Created: 10/7/2025

? Is this the correct account? (Y/n)
# Press Y

✅ Login successful!
📝 Config saved to: /home/user/.squidlab/config.json

💡 You can now use API commands!

Try: squidlab-sdk whoami
```

### 3. Test Whoami (After Login)

```bash
squidlab-sdk whoami
```

**Expected Output:**
```
👤 Current User:
   Email: your-email@example.com
   Name: Your Name
   ID: uuid-here
   Created: 10/7/2025
   Storage Used: 0.05 GB

📝 Logged in since: 10/7/2025, 2:30:45 PM
```

### 4. Test Files List

```bash
squidlab-sdk api:files:list
```

**Expected Output (with files):**
```
📁 Files (3 total):

  📄 document.pdf
     ID: file-uuid-1 | Size: 2.5 MB | Created: 10/7/2025
  📄 image.png
     ID: file-uuid-2 | Size: 1.2 MB | Created: 10/6/2025
  📄 spreadsheet.xlsx
     ID: file-uuid-3 | Size: 500 KB | Created: 10/5/2025
```

**Expected Output (no files):**
```
📁 Files (0 total):

   No files found
```

---

## Config File Structure 📄

**Location:** `~/.squidlab/config.json`

```json
{
  "apiKey": "cb_your_actual_api_key_here",
  "userId": "user-uuid",
  "email": "your-email@example.com",
  "loggedInAt": "2025-10-07T14:30:45.123Z"
}
```

---

## API Endpoints 🌐

### Base URL
```
https://squidcloud.inflate.live/functions/v1/cloudbliss-api
```

### Available Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/whoami` | GET | Get current user info |
| `/user` | GET | Alias for `/whoami` |
| `/files` | GET | List user's files |
| `/files/upload` | POST | Upload a file |
| `/files/{id}` | GET | Get file info |
| `/files/{id}` | DELETE | Delete a file |
| `/keys` | GET | List API keys |
| `/storage` | GET | Get storage info |

### Required Header

All requests must include:
```
X-SquidCloud-Key: cb_your_api_key_here
```

---

## Breaking Changes ⚠️

### For Developers Using the CLI

1. **Config file now includes user info:**
   - Old: `{ "apiKey": "..." }`
   - New: `{ "apiKey": "...", "userId": "...", "email": "...", "loggedInAt": "..." }`

2. **Login now requires confirmation:**
   - Shows account info and asks "Is this the correct account?"
   - Can be skipped with auto-yes in scripts (TODO: add `-y` flag)

3. **API endpoint changed:**
   - Old: `https://squidcloud.inflate.live/api/v1/...`
   - New: `https://squidcloud.inflate.live/functions/v1/cloudbliss-api/...`

4. **Header name changed:**
   - Old: `Authorization: Bearer cb_...`
   - New: `X-SquidCloud-Key: cb_...`

---

## Migration Guide 🔄

### If You Were Using Old CLI

1. **Logout and login again:**
```bash
squidlab-sdk logout
squidlab-sdk login
```

2. **Update any scripts:**
```bash
# Old
curl -H "Authorization: Bearer $API_KEY" \
  https://squidcloud.inflate.live/api/v1/files

# New
curl -H "X-SquidCloud-Key: $API_KEY" \
  https://squidcloud.inflate.live/functions/v1/cloudbliss-api/files
```

---

## Next Steps 📝

### Recommended Enhancements

1. **Add `-y/--yes` flag to login** for automation:
   ```bash
   squidlab-sdk login --api-key cb_xxx --yes
   ```

2. **Add `api:user:info` command** for detailed user info

3. **Add `api:keys:validate` command** to test an API key without logging in

4. **Add retry logic** for network failures

5. **Add caching** for user info (reduce API calls)

6. **Add `--refresh` flag** to force reload user info

---

## Security Notes 🔒

1. **API keys are never logged** - They're hidden in prompts and not shown in error messages

2. **Config file permissions** - Should be readable only by user (chmod 600)

3. **No API keys in Git** - Config directory is in `.gitignore`

4. **API keys are hashed** on server - Server stores SHA-256 hash, not plaintext

5. **Account confirmation** - Login shows user info before saving to prevent accidents

---

## Support 💬

If you encounter issues:

1. **Check your API key:**
   ```bash
   squidlab-sdk logout
   squidlab-sdk login
   ```

2. **Verify connectivity:**
   ```bash
   curl https://squidcloud.inflate.live/functions/v1/cloudbliss-api/debug
   ```

3. **Check config file:**
   ```bash
   cat ~/.squidlab/config.json
   ```

4. **Report issues:** [GitHub Issues](https://github.com/squidcloud/squidlab-sdk/issues)

---

**All authentication issues have been fixed! 🎉**
