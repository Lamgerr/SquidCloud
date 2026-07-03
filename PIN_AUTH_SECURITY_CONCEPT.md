# PIN Authentication & Security System - Concept Document

## Executive Summary

This document outlines a comprehensive PIN authentication system for CloudBliss Storage v8, adding an additional security layer for sensitive operations including:
- Opening the web application
- Accessing security/privacy settings
- Creating/managing file shares
- Opening SquidVault
- Accessing security audit logs

## Security Philosophy

**Defense in Depth**: PIN authentication adds a second factor beyond password authentication, following Apple's approach with Screen Time passcodes and biometric fallbacks.

**User Experience First**: Like Apple Intelligence, security should be seamless but uncompromising.

## System Architecture

### 1. PIN Storage & Management

```typescript
// Database Schema
interface UserSecuritySettings {
  user_id: string;
  pin_hash: string; // bcrypt hashed PIN
  pin_enabled: boolean;
  pin_attempts: number;
  pin_locked_until: timestamp | null;
  biometric_enabled: boolean;
  require_pin_on_startup: boolean;
  require_pin_for_shares: boolean;
  require_pin_for_settings: boolean;
  require_pin_for_vault: boolean;
  pin_timeout: number; // minutes before re-auth required
  last_pin_auth: timestamp;
  created_at: timestamp;
  updated_at: timestamp;
}

interface PINAttemptLog {
  id: string;
  user_id: string;
  attempt_type: 'success' | 'failed' | 'locked';
  ip_address: string;
  user_agent: string;
  timestamp: timestamp;
  location?: string;
}
```

### 2. PIN Components

#### 2.1 PINSetupDialog
**Purpose**: Initial PIN creation with security requirements
- 6-digit numeric PIN (like iOS)
- PIN confirmation
- Biometric enrollment option
- Security tips display

#### 2.2 PINAuthDialog
**Purpose**: Authentication for sensitive operations
- Clean, minimal interface (Apple-style)
- Numeric keypad
- Biometric quick-auth button
- Attempt counter
- Forgot PIN recovery

#### 2.3 PINLockScreen
**Purpose**: Full-screen lock for app startup
- Blurred background (content hidden)
- Centered PIN pad
- Face ID/Touch ID option
- Emergency access link

### 3. Protected Operations

#### Level 1: Critical (Always Require PIN)
1. **Opening SquidVault**
   - Even if biometric is enabled
   - 3 failed attempts = 5 minute lockout
   
2. **Sharing Files**
   - Before generating share link
   - Show "Protected by PIN" badge on shared files
   
3. **Security Settings Access**
   - Viewing audit logs
   - Changing security preferences
   - Managing connected sessions
   - Revoking shares

#### Level 2: User Configurable
1. **App Startup** (optional)
   - Can be disabled in settings
   - Timeout based (default: 5 minutes)
   
2. **Sensitive File Operations** (optional)
   - Deleting multiple files
   - Permanent deletion
   - Exporting encryption keys

### 4. Authentication Flow

```typescript
// PIN Authentication Service
class PINAuthService {
  // Check if PIN is required for operation
  async requiresPIN(operation: SecurityOperation): Promise<boolean> {
    const settings = await getUserSecuritySettings();
    const lastAuth = await getLastPINAuth();
    const timeSinceAuth = Date.now() - lastAuth;
    
    // Always require for critical operations
    if (CRITICAL_OPERATIONS.includes(operation)) {
      return true;
    }
    
    // Check timeout
    if (timeSinceAuth > settings.pin_timeout * 60 * 1000) {
      return true;
    }
    
    return false;
  }
  
  // Verify PIN
  async verifyPIN(pin: string): Promise<AuthResult> {
    const settings = await getUserSecuritySettings();
    
    // Check if locked
    if (settings.pin_locked_until && Date.now() < settings.pin_locked_until) {
      return {
        success: false,
        error: 'PIN locked. Try again later.',
        lockedUntil: settings.pin_locked_until
      };
    }
    
    // Verify PIN
    const isValid = await bcrypt.compare(pin, settings.pin_hash);
    
    if (isValid) {
      // Reset attempts, update last auth
      await resetPINAttempts();
      await updateLastPINAuth();
      await logPINAttempt('success');
      
      return { success: true };
    } else {
      // Increment attempts
      const newAttempts = settings.pin_attempts + 1;
      await incrementPINAttempts();
      await logPINAttempt('failed');
      
      // Lock after 3 failed attempts
      if (newAttempts >= 3) {
        const lockUntil = Date.now() + (5 * 60 * 1000); // 5 minutes
        await lockPIN(lockUntil);
        await logPINAttempt('locked');
        
        return {
          success: false,
          error: 'Too many failed attempts. Locked for 5 minutes.',
          lockedUntil: lockUntil
        };
      }
      
      return {
        success: false,
        error: `Incorrect PIN. ${3 - newAttempts} attempts remaining.`,
        attemptsRemaining: 3 - newAttempts
      };
    }
  }
  
  // Biometric authentication (WebAuthn)
  async verifyBiometric(): Promise<AuthResult> {
    try {
      const credential = await navigator.credentials.get({
        publicKey: createAuthenticationOptions()
      });
      
      if (credential) {
        await updateLastPINAuth();
        await logPINAttempt('success');
        return { success: true };
      }
    } catch (error) {
      return { success: false, error: 'Biometric authentication failed' };
    }
  }
}
```

### 5. UI/UX Design (Apple Intelligence Style)

#### Visual Design
```tsx
// PIN Pad Component
<div className="pin-auth-container">
  {/* Background blur effect */}
  <div className="absolute inset-0 backdrop-blur-3xl bg-black/40" />
  
  {/* Floating card with glass morphism */}
  <Card className="glass-morphism shadow-2xl">
    {/* Header */}
    <div className="text-center mb-8">
      <Lock className="w-16 h-16 mx-auto mb-4 text-blue-500" />
      <h2 className="text-2xl font-semibold">Enter PIN</h2>
      <p className="text-sm text-muted-foreground mt-2">
        Required to access SquidVault
      </p>
    </div>
    
    {/* PIN dots display */}
    <div className="flex gap-3 justify-center mb-8">
      {[1,2,3,4,5,6].map(i => (
        <div 
          key={i}
          className={cn(
            "w-3 h-3 rounded-full transition-all duration-200",
            pinLength >= i 
              ? "bg-blue-500 scale-110" 
              : "bg-gray-300 dark:bg-gray-700"
          )}
        />
      ))}
    </div>
    
    {/* Numeric keypad */}
    <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto">
      {[1,2,3,4,5,6,7,8,9].map(num => (
        <Button
          key={num}
          size="lg"
          variant="ghost"
          className="h-16 text-2xl font-light hover:bg-blue-500/10"
          onClick={() => handlePINInput(num)}
        >
          {num}
        </Button>
      ))}
      
      {/* Biometric button */}
      <Button
        size="lg"
        variant="ghost"
        className="h-16"
        onClick={handleBiometric}
      >
        <Fingerprint className="w-6 h-6" />
      </Button>
      
      {/* Zero */}
      <Button
        size="lg"
        variant="ghost"
        className="h-16 text-2xl font-light"
        onClick={() => handlePINInput(0)}
      >
        0
      </Button>
      
      {/* Delete */}
      <Button
        size="lg"
        variant="ghost"
        className="h-16"
        onClick={handleDelete}
      >
        <Delete className="w-6 h-6" />
      </Button>
    </div>
    
    {/* Error message */}
    {error && (
      <div className="mt-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
        <p className="text-sm text-red-600 dark:text-red-400 text-center">
          {error}
        </p>
      </div>
    )}
    
    {/* Forgot PIN link */}
    <div className="mt-6 text-center">
      <button 
        className="text-sm text-blue-500 hover:underline"
        onClick={handleForgotPIN}
      >
        Forgot PIN?
      </button>
    </div>
  </Card>
</div>
```

#### Animation Specifications
- **Entry**: Scale from 0.95 with 0.3s ease-out
- **PIN Input**: Haptic-like bounce on each digit
- **Success**: Green checkmark with spring animation
- **Error**: Red shake animation (3 times, 50ms each)
- **Lock**: Slide down with blur fade

### 6. Integration Points

#### 6.1 Share System Integration
```typescript
// Before creating share
const shareFile = async (fileId: string) => {
  // Check if PIN is required
  const needsPIN = await pinAuthService.requiresPIN('create_share');
  
  if (needsPIN) {
    const result = await showPINDialog({
      title: 'Share File',
      description: 'Enter your PIN to create a share link',
      operation: 'create_share'
    });
    
    if (!result.success) {
      toast({
        title: "Authentication Required",
        description: "PIN verification failed",
        variant: "destructive"
      });
      return;
    }
  }
  
  // Proceed with share creation
  const share = await createFileShare(fileId);
  // ... rest of share logic
};
```

#### 6.2 SquidVault Integration
```typescript
// SquidVault component already has auth, add PIN layer
const handleVaultOpen = async () => {
  // First check PIN
  const needsPIN = await pinAuthService.requiresPIN('open_vault');
  
  if (needsPIN) {
    const result = await showPINDialog({
      title: 'Open SquidVault',
      description: 'Enter your PIN to access your private vault',
      operation: 'open_vault',
      allowBiometric: true
    });
    
    if (!result.success) return;
  }
  
  // Then check vault password/passkey
  // ... existing vault auth logic
};
```

#### 6.3 Settings Page Integration
```typescript
const SecuritySettings = () => {
  const [isLocked, setIsLocked] = useState(true);
  
  useEffect(() => {
    // Lock security settings by default
    checkPINAuth();
  }, []);
  
  const checkPINAuth = async () => {
    const result = await showPINDialog({
      title: 'Security Settings',
      description: 'Verify your identity to view security settings',
      operation: 'view_security_settings'
    });
    
    setIsLocked(!result.success);
  };
  
  if (isLocked) {
    return <LockedSettingsView onUnlock={checkPINAuth} />;
  }
  
  return <SecuritySettingsContent />;
};
```

### 7. Recovery & Emergency Access

#### Forgot PIN Flow
1. User clicks "Forgot PIN?"
2. Options presented:
   - **Use Biometric** (if enrolled)
   - **Email Verification** (send code to email)
   - **Master Password** (existing account password)
3. After verification, allow PIN reset
4. Log security event

#### Account Recovery
- If user loses access to both PIN and password
- Email verification + security questions
- 24-hour cooldown period
- Admin notification for suspicious activity

### 8. Security Audit Integration

```typescript
interface SecurityAuditEvent {
  event_type: 'pin_auth' | 'pin_change' | 'pin_reset' | 'pin_locked';
  user_id: string;
  ip_address: string;
  user_agent: string;
  location?: GeoLocation;
  success: boolean;
  metadata: {
    operation?: string;
    attempts?: number;
    locked_duration?: number;
  };
  risk_level: 'low' | 'medium' | 'high';
  timestamp: Date;
}
```

### 9. Progressive Enhancement

#### Phase 1: Core PIN System ✓
- [ ] Database schema creation
- [ ] PINSetupDialog component
- [ ] PINAuthDialog component
- [ ] PINAuthService implementation
- [ ] Basic integration with SquidVault

#### Phase 2: Enhanced Security ✓
- [ ] Biometric fallback (WebAuthn)
- [ ] Share creation PIN protection
- [ ] Settings page PIN protection
- [ ] Audit logging integration

#### Phase 3: Advanced Features ✓
- [ ] PIN timeout management
- [ ] App startup lock screen
- [ ] Multiple PIN attempt lockout
- [ ] Emergency recovery flow
- [ ] Geolocation tracking

#### Phase 4: Polish & UX ✓
- [ ] Apple Intelligence-style animations
- [ ] Haptic feedback (if available)
- [ ] Dark mode optimization
- [ ] Accessibility features
- [ ] User education tooltips

### 10. Share System Security Review

#### Current Share System Analysis

**Strengths:**
1. ✅ Unique share IDs (not file IDs)
2. ✅ Expiration dates supported
3. ✅ Access codes (passwords) supported
4. ✅ View tracking in audit logs
5. ✅ Revocation capability

**Security Gaps:**
1. ⚠️ No PIN protection on share creation
2. ⚠️ No rate limiting on share access
3. ⚠️ No geolocation tracking
4. ⚠️ No share modification notifications
5. ⚠️ No suspicious activity detection

#### Enhanced Share Security

```typescript
interface EnhancedShareOptions {
  // Existing
  shareType: 'public' | 'user_specific';
  allowedUsers?: string[];
  expiresAt?: string | null;
  accessCode?: string;
  
  // New Security Features
  requirePIN: boolean; // Creator must verify PIN
  maxDownloads?: number; // Limit downloads
  ipWhitelist?: string[]; // Restrict by IP
  geoFence?: {
    countries: string[];
    regions?: string[];
  };
  notifyOnAccess: boolean; // Email/push on each access
  requireRecipientAuth: boolean; // Force login to access
  watermark?: {
    text: string;
    position: 'center' | 'corner';
  };
}

interface ShareAccessLog {
  share_id: string;
  accessed_at: timestamp;
  ip_address: string;
  user_agent: string;
  country: string;
  city: string;
  access_granted: boolean;
  denial_reason?: string;
  download_count: number;
}
```

#### Share Security UI

```tsx
const ShareSecurityOptions = () => (
  <div className="space-y-4">
    {/* PIN Protection Toggle */}
    <div className="flex items-center justify-between">
      <div>
        <Label>Require PIN to Create Share</Label>
        <p className="text-xs text-muted-foreground">
          Additional security layer before sharing
        </p>
      </div>
      <Switch checked={requirePIN} onCheckedChange={setRequirePIN} />
    </div>
    
    {/* Download Limit */}
    <div>
      <Label>Maximum Downloads</Label>
      <Input 
        type="number" 
        placeholder="Unlimited" 
        value={maxDownloads}
      />
    </div>
    
    {/* Geo-fencing */}
    <div>
      <Label>Allowed Countries</Label>
      <MultiSelect 
        options={COUNTRIES}
        selected={allowedCountries}
      />
    </div>
    
    {/* Notifications */}
    <div className="flex items-center justify-between">
      <div>
        <Label>Notify on Access</Label>
        <p className="text-xs text-muted-foreground">
          Get email when someone accesses this share
        </p>
      </div>
      <Switch checked={notifyOnAccess} />
    </div>
  </div>
);
```

### 11. Implementation Checklist

#### Database Migrations
- [ ] Create `user_security_settings` table
- [ ] Create `pin_attempt_logs` table
- [ ] Add PIN-related columns to shares
- [ ] Create `share_access_logs` table with geolocation

#### Components
- [ ] PINSetupDialog.tsx
- [ ] PINAuthDialog.tsx
- [ ] PINLockScreen.tsx
- [ ] PINKeypad.tsx (reusable)
- [ ] BiometricPrompt.tsx

#### Services
- [ ] pinAuthService.ts
- [ ] biometricService.ts
- [ ] geoLocationService.ts
- [ ] shareSecurityService.ts

#### Hooks
- [ ] usePINAuth.ts
- [ ] useBiometric.ts
- [ ] useSecuritySettings.ts

#### Context
- [ ] SecurityContext.tsx (wrap entire app)

#### Integration
- [ ] Update SquidVault component
- [ ] Update Share creation flow
- [ ] Update Settings pages
- [ ] Update Dashboard (startup lock)
- [ ] Update FileActionMenu
- [ ] Update FileCardMenu

### 12. Performance Considerations

- **PIN Verification**: Use Web Workers for bcrypt hashing
- **Biometric**: Cache credentials for session
- **Geolocation**: Use IP-based lookup, not GPS (privacy)
- **Audit Logs**: Batch writes, async processing
- **UI Animations**: Hardware-accelerated CSS transforms

### 13. Accessibility

- [ ] Keyboard navigation for PIN pad
- [ ] Screen reader announcements
- [ ] High contrast mode support
- [ ] Large touch targets (min 44x44px)
- [ ] Voice control support
- [ ] Reduced motion preferences

### 14. Testing Strategy

#### Unit Tests
- PIN hashing/verification
- Attempt limiting
- Timeout calculations
- Biometric fallback

#### Integration Tests
- Full authentication flow
- Share creation with PIN
- Settings access with PIN
- Recovery scenarios

#### E2E Tests
- User journey: Setup → Use → Recovery
- Failed attempts → Lockout → Recovery
- Multi-device scenarios

#### Security Tests
- Brute force resistance
- Session hijacking prevention
- XSS/CSRF protection
- Rate limiting effectiveness

---

## Conclusion

This PIN authentication system provides enterprise-grade security with consumer-grade UX. By following Apple's design language and security principles, we create a familiar yet powerful protection layer for CloudBliss Storage.

**Key Benefits:**
- 🔒 Multi-factor authentication
- 🎨 Beautiful, intuitive interface
- ⚡ Fast and responsive
- 🛡️ Defense in depth
- 📊 Comprehensive audit trail
- ♿ Fully accessible

**Next Steps:**
1. Review and approve this concept
2. Create database migrations
3. Build core components
4. Integrate with existing systems
5. Test thoroughly
6. Deploy with feature flag
7. Gather user feedback
8. Iterate and improve

---

**Document Version:** 1.0  
**Created:** 2025-11-03  
**Author:** CloudBliss Development Team  
**Status:** Awaiting Approval
