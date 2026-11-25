package live.squidcloud.app

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.security.KeyStore
import javax.crypto.KeyGenerator
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import android.util.Base64

/**
 * Hardware-backed vault key bridge for the hardened native client.
 * Keys are generated inside Android Keystore and are NON-EXPORTABLE:
 * even root or a memory dump cannot extract them.
 */
@CapacitorPlugin(name = "SecureKeyStore")
class SecureKeyStorePlugin : Plugin() {

    private val keystore: KeyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    private val aliasPrefix = "squidcloud_vault_"

    private fun alias(userId: String) = aliasPrefix + userId

    private fun ensureKey(userId: String) {
        val a = alias(userId)
        if (!keystore.containsAlias(a)) {
            val spec = KeyGenParameterSpec.Builder(
                a,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setUserAuthenticationRequired(true) // biometric/PIN gate
                .setInvalidatedByBiometricEnrollment(true)
                .build()
            val kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
            kg.init(spec)
            kg.generateKey()
        }
    }

    @PluginMethod
    fun wrap(call: PluginCall) {
        try {
            val userId = call.getString("userId") ?: throw Exception("userId required")
            val wrapped = call.getString("wrappedMk") ?: throw Exception("wrappedMk required")
            ensureKey(userId)
            val key = keystore.getKey(alias(userId), null)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, key)
            val iv = cipher.iv
            val out = cipher.doFinal(wrapped.toByteArray(Charsets.UTF_8))
            val res = JSObject()
            res.put("iv", Base64.encodeToString(iv, Base64.NO_WRAP))
            res.put("data", Base64.encodeToString(out, Base64.NO_WRAP))
            call.resolve(res)
        } catch (e: Exception) { call.reject(e.message) }
    }

    @PluginMethod
    fun unwrap(call: PluginCall) {
        try {
            val userId = call.getString("userId") ?: throw Exception("userId required")
            val iv = call.getString("iv") ?: throw Exception("iv required")
            val data = call.getString("data") ?: throw Exception("data required")
            ensureKey(userId)
            val key = keystore.getKey(alias(userId), null)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)))
            val plain = cipher.doFinal(Base64.decode(data, Base64.NO_WRAP))
            val res = JSObject()
            res.put("wrappedMk", String(plain, Charsets.UTF_8))
            call.resolve(res)
        } catch (e: Exception) { call.reject(e.message) }
    }

    @PluginMethod
    fun delete(call: PluginCall) {
        try {
            val userId = call.getString("userId") ?: throw Exception("userId required")
            val a = alias(userId)
            if (keystore.containsAlias(a)) keystore.deleteEntry(a)
            call.resolve()
        } catch (e: Exception) { call.reject(e.message) }
    }
}
