package live.squidcloud.app.downloader

import android.app.DownloadManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.provider.Settings
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.webkit.MimeTypeMap
import androidx.core.content.FileProvider
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.io.OutputStream
import java.util.Base64
import java.util.Locale

@CapacitorPlugin(name = "NativeDownloader")
class NativeDownloaderPlugin : Plugin() {
    private val ALLOWED_UPDATE_HOSTS = setOf(
        "squidcloud.vercel.app",
        "github.com",
        "objects.githubusercontent.com",
        "raw.githubusercontent.com"
    )
    private val DOWNLOAD_BUFFER_SIZE = 8 * 1024

    private data class SavedDownload(
        val uri: Uri,
        val absolutePath: String?,
        val sizeBytes: Long
    )

    @PluginMethod
    fun enqueueDownload(call: PluginCall) {
        val base64Data = call.getString("base64Data")
        val incomingFilename = call.getString("filename")
        val mimeType = call.getString("mimeType") ?: "application/octet-stream"

        if (base64Data.isNullOrBlank() || incomingFilename.isNullOrBlank()) {
            call.reject("base64Data and filename are required")
            return
        }

        try {
            val safeFilename = sanitizeFilename(incomingFilename)
            val bytes = decodeBase64(base64Data)
            val displayName = ensureExtension(safeFilename, mimeType)
            val destination = writeToDownloads(displayName, mimeType, bytes)
            val downloadId = registerCompletedDownload(displayName, mimeType, destination)

            val response = JSObject()
            response.put("downloadId", downloadId ?: -1L)
            response.put("destination", destination.absolutePath ?: destination.uri.toString())
            response.put("uri", destination.uri.toString())
            call.resolve(response)
        } catch (error: Exception) {
            call.reject("Failed to save download: ${error.message}", error)
        }
    }

    @PluginMethod
    fun canRequestPackageInstalls(call: PluginCall) {
        val response = JSObject()
        val allowed = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.packageManager.canRequestPackageInstalls()
        } else {
            true
        }
        response.put("allowed", allowed)
        call.resolve(response)
    }

    @PluginMethod
    fun openInstallPermissionSettings(call: PluginCall) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val intent = Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:${context.packageName}")
                ).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
            } else {
                val intent = Intent(Settings.ACTION_SECURITY_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
            }
            val response = JSObject()
            response.put("opened", true)
            call.resolve(response)
        } catch (error: Exception) {
            call.reject("Failed to open install permission settings: ${error.message}", error)
        }
    }

    @PluginMethod
    fun downloadApkFromUrl(call: PluginCall) {
        val url = call.getString("url")
        val filename = call.getString("filename")?.trim().takeUnless { it.isNullOrBlank() } ?: "squidcloud-update.apk"

        if (url.isNullOrBlank()) {
            call.reject("url is required")
            return
        }
        if (!isAllowedUpdateUrl(url)) {
            call.reject("Untrusted update URL")
            return
        }

        try {
            val safeFilename = sanitizeFilename(filename).let {
                if (it.lowercase(Locale.US).endsWith(".apk")) it else "$it.apk"
            }
            val outFile = File(context.cacheDir, safeFilename)
            downloadFile(url, outFile)

            val response = JSObject()
            response.put("apkPath", outFile.absolutePath)
            response.put(
                "uri",
                FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", outFile).toString()
            )
            call.resolve(response)
        } catch (error: Exception) {
            call.reject("Failed to download APK: ${error.message}", error)
        }
    }

    @PluginMethod
    fun verifyAndInstallApk(call: PluginCall) {
        val apkPath = call.getString("apkPath")
        if (apkPath.isNullOrBlank()) {
            call.reject("apkPath is required")
            return
        }

        try {
            val apkFile = File(apkPath)
            if (!apkFile.exists()) {
                call.reject("APK file does not exist")
                return
            }

            val verified = verifySignaturesMatch(apkFile)
            if (!verified) {
                call.reject("APK signature does not match installed app signature")
                return
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                !context.packageManager.canRequestPackageInstalls()
            ) {
                val response = JSObject()
                response.put("verified", true)
                response.put("installIntentStarted", false)
                call.resolve(response)
                return
            }

            val apkUri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                apkFile
            )
            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(apkUri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            context.startActivity(installIntent)
            val response = JSObject()
            response.put("verified", true)
            response.put("installIntentStarted", true)
            call.resolve(response)
        } catch (error: Exception) {
            call.reject("Failed to verify/install APK: ${error.message}", error)
        }
    }

    private fun decodeBase64(base64Data: String): ByteArray {
        val normalized = base64Data.substringAfter(",", base64Data).trim()
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Base64.getDecoder().decode(normalized)
        } else {
            android.util.Base64.decode(normalized, android.util.Base64.DEFAULT)
        }
    }

    private fun sanitizeFilename(name: String): String {
        val cleaned = name.trim().replace(Regex("[\\\\/:*?\"<>|]"), "_")
        return if (cleaned.isBlank()) "download-${System.currentTimeMillis()}" else cleaned
    }

    private fun ensureExtension(name: String, mimeType: String): String {
        if (name.contains(".")) return name
        val ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType)?.lowercase(Locale.US)
        return if (ext.isNullOrBlank()) name else "$name.$ext"
    }

    private fun writeToDownloads(fileName: String, mimeType: String, bytes: ByteArray): SavedDownload {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val resolver = context.contentResolver
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                put(MediaStore.Downloads.MIME_TYPE, mimeType)
                put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                put(MediaStore.Downloads.IS_PENDING, 1)
            }

            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: throw IllegalStateException("Unable to create destination in Downloads")

            resolver.openOutputStream(uri)?.use { output ->
                output.write(bytes)
                output.flush()
            } ?: throw IllegalStateException("Unable to open destination output stream")

            values.clear()
            values.put(MediaStore.Downloads.IS_PENDING, 0)
            resolver.update(uri, values, null, null)

            return SavedDownload(
                uri = uri,
                absolutePath = null,
                sizeBytes = bytes.size.toLong()
            )
        }

        val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        if (!downloadsDir.exists()) downloadsDir.mkdirs()
        val outFile = uniqueFile(downloadsDir, fileName)
        FileOutputStream(outFile).use { writeBytes(it, bytes) }

        return SavedDownload(
            uri = Uri.fromFile(outFile),
            absolutePath = outFile.absolutePath,
            sizeBytes = outFile.length()
        )
    }

    private fun registerCompletedDownload(
        displayName: String,
        mimeType: String,
        savedDownload: SavedDownload
    ): Long? {
        if (savedDownload.absolutePath.isNullOrBlank()) {
            return null
        }

        return try {
            val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            downloadManager.addCompletedDownload(
                displayName,
                "Downloaded via SquidCloud",
                true,
                mimeType,
                savedDownload.absolutePath,
                savedDownload.sizeBytes,
                true
            )
        } catch (_: Exception) {
            null
        }
    }

    private fun uniqueFile(parent: File, fileName: String): File {
        var candidate = File(parent, fileName)
        if (!candidate.exists()) return candidate
        val dot = fileName.lastIndexOf('.')
        val base = if (dot > 0) fileName.substring(0, dot) else fileName
        val ext = if (dot > 0) fileName.substring(dot) else ""
        var index = 1
        while (candidate.exists()) {
            candidate = File(parent, "$base ($index)$ext")
            index++
        }
        return candidate
    }

    private fun writeBytes(output: OutputStream, bytes: ByteArray) {
        output.write(bytes)
        output.flush()
    }

    private fun downloadFile(fileUrl: String, outputFile: File) {
        var connection: HttpURLConnection? = null
        var inputStream: InputStream? = null

        try {
            val url = URL(fileUrl)
            if (url.protocol.lowercase(Locale.US) != "https") {
                throw IllegalStateException("Only HTTPS update URLs are allowed")
            }
            connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 20000
                readTimeout = 30000
                instanceFollowRedirects = true
                connect()
            }

            if (connection.responseCode !in 200..299) {
                throw IllegalStateException("HTTP ${connection.responseCode}")
            }

            inputStream = BufferedInputStream(connection.inputStream)
            FileOutputStream(outputFile).use { output ->
                val buffer = ByteArray(DOWNLOAD_BUFFER_SIZE)
                var read: Int
                while (inputStream.read(buffer).also { read = it } != -1) {
                    output.write(buffer, 0, read)
                }
                output.flush()
            }
        } finally {
            inputStream?.close()
            connection?.disconnect()
        }
    }

    private fun verifySignaturesMatch(apkFile: File): Boolean {
        val pm = context.packageManager
        val packageName = context.packageName

        val installedInfo: PackageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            pm.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES)
        } else {
            @Suppress("DEPRECATION")
            pm.getPackageInfo(packageName, PackageManager.GET_SIGNATURES)
        }

        val archiveInfo: PackageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            pm.getPackageArchiveInfo(apkFile.absolutePath, PackageManager.GET_SIGNING_CERTIFICATES)
        } else {
            @Suppress("DEPRECATION")
            pm.getPackageArchiveInfo(apkFile.absolutePath, PackageManager.GET_SIGNATURES)
        } ?: return false

        val installedSigners = getSignerSet(installedInfo)
        val archiveSigners = getSignerSet(archiveInfo)
        if (installedSigners.isEmpty() || archiveSigners.isEmpty()) return false
        return installedSigners == archiveSigners
    }

    private fun getSignerSet(packageInfo: PackageInfo): Set<String> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val signingInfo = packageInfo.signingInfo ?: return emptySet()
            val signatures = if (signingInfo.hasMultipleSigners()) {
                signingInfo.apkContentsSigners
            } else {
                signingInfo.signingCertificateHistory
            }
            signatures?.map { it.toCharsString() }?.toSet() ?: emptySet()
        } else {
            @Suppress("DEPRECATION")
            packageInfo.signatures?.map { it.toCharsString() }?.toSet() ?: emptySet()
        }
    }

    private fun isAllowedUpdateUrl(rawUrl: String): Boolean {
        return try {
            val parsed = URL(rawUrl)
            val protocol = parsed.protocol.lowercase(Locale.US)
            if (protocol != "https") return false
            val host = parsed.host.lowercase(Locale.US)
            ALLOWED_UPDATE_HOSTS.contains(host)
        } catch (_: Exception) {
            false
        }
    }
}
