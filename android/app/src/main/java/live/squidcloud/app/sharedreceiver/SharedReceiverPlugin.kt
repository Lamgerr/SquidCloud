package live.squidcloud.app.sharedreceiver

import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Log
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import androidx.core.content.IntentCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.io.FileOutputStream
import java.util.Locale

@CapacitorPlugin(name = "SharedReceiver")
class SharedReceiverPlugin : Plugin() {
    private var pendingFiles = JSArray()
    private var lastIntentFingerprint: String? = null

    override fun handleOnNewIntent(intent: Intent) {
        super.handleOnNewIntent(intent)
        handleIntent(intent)
    }

    override fun handleOnStart() {
        super.handleOnStart()
        activity?.intent?.let { handleIntent(it) }
    }

    @PluginMethod
    fun clearSharedFiles(call: PluginCall) {
        pendingFiles = JSArray()
        lastIntentFingerprint = null

        try {
            val queueDir = File(context?.cacheDir, "shared_upload_queue")
            val filesList = queueDir.listFiles()
            if (filesList != null && queueDir.exists() && queueDir.isDirectory) {
                for (file in filesList) {
                    file.delete()
                }
            }
        } catch (e: Exception) {
            Log.e("SharedReceiver", "error clearing staged files", e)
        }

        call.resolve()
    }

    @PluginMethod
    fun getInitialSharedFiles(call: PluginCall) {
        val merged = JSArray()
        for (i in 0 until pendingFiles.length()) {
            merged.put(pendingFiles.getJSONObject(i))
        }

        val payload = JSObject()
        payload.put("files", merged)
        call.resolve(payload)

        pendingFiles = JSArray()
    }

    private fun handleIntent(intent: Intent) {
        try {
            val files = extractFilesFromIntent(intent)
            if (files.length() == 0) return

            val fingerprint = buildFingerprint(files)
            if (fingerprint == lastIntentFingerprint) return
            lastIntentFingerprint = fingerprint

            pendingFiles = files

            val payload = JSObject()
            payload.put("files", files)
            notifyListeners("sharedFiles", payload, true)

            for (i in 0 until files.length()) {
                val entry = files.getJSONObject(i)
                enqueueWork(entry)
            }
        } catch (e: Exception) {
            Log.e("SharedReceiver", "error handling intent", e)
        }
    }

    private fun extractFilesFromIntent(intent: Intent): JSArray {
        val files = JSArray()
        val action = intent.action
        val type = intent.type

        if (Intent.ACTION_SEND == action) {
            val rawUri = IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java)
            rawUri?.let { uri ->
                buildFileObject(uri, type)?.let { files.put(it) }
            }
        } else if (Intent.ACTION_SEND_MULTIPLE == action) {
            val uris = IntentCompat.getParcelableArrayListExtra(intent, Intent.EXTRA_STREAM, Uri::class.java)
            uris?.forEach { rawUri ->
                if (rawUri != null) {
                    buildFileObject(rawUri, type)?.let { files.put(it) }
                }
            }
        }

        return files
    }

    private fun buildFileObject(rawUri: Uri, fallbackMimeType: String?): JSObject? {
        return try {
            val normalized = copyContentUriToCache(rawUri)
            val resolver = context?.contentResolver
            val mimeType = resolver?.getType(rawUri) ?: fallbackMimeType
            val (displayName, size) = queryNameAndSize(rawUri)

            JSObject().apply {
                put("uri", normalized.toString())
                put("mimeType", mimeType ?: "application/octet-stream")
                put("name", displayName)
                put("size", size)
            }
        } catch (error: Exception) {
            Log.e("SharedReceiver", "Failed to build shared file payload", error)
            null
        }
    }

    private fun queryNameAndSize(uri: Uri): Pair<String, Long> {
        var name = "shared-file-${System.currentTimeMillis()}"
        var size = -1L

        val cursor = context?.contentResolver?.query(uri, null, null, null, null)
        cursor?.use {
            if (it.moveToFirst()) {
                val nameIndex = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (nameIndex >= 0) {
                    val n = it.getString(nameIndex)
                    if (!n.isNullOrBlank()) name = n
                }

                val sizeIndex = it.getColumnIndex(OpenableColumns.SIZE)
                if (sizeIndex >= 0) {
                    size = it.getLong(sizeIndex)
                }
            }
        }

        return Pair(name, size)
    }

    private fun copyContentUriToCache(uri: Uri): Uri {
        if (!"content".equals(uri.scheme, ignoreCase = true)) {
            return uri
        }

        val (displayName, _) = queryNameAndSize(uri)
        val safeName = displayName
            .replace(Regex("[^A-Za-z0-9._-]"), "_")
            .lowercase(Locale.US)
            .ifBlank { "shared-file.bin" }

        val queueDir = File(context?.cacheDir, "shared_upload_queue")
        if (!queueDir.exists()) {
            queueDir.mkdirs()
        }

        val outputFile = File(queueDir, "${System.currentTimeMillis()}_$safeName")
        context?.contentResolver?.openInputStream(uri)?.use { input ->
            FileOutputStream(outputFile).use { output ->
                input.copyTo(output)
            }
        }

        return Uri.fromFile(outputFile)
    }

    private fun buildFingerprint(files: JSArray): String {
        val parts = mutableListOf<String>()
        for (i in 0 until files.length()) {
            val file = files.getJSONObject(i)
            parts.add(file.optString("uri", ""))
        }
        return parts.joinToString("|")
    }

    private fun enqueueWork(file: org.json.JSONObject) {
        try {
            val uriString = file.getString("uri") ?: return
            val name = file.optString("name", "shared-file")
            val mimeType = file.optString("mimeType", "application/octet-stream")

            val inputData = workDataOf(
                "uri" to uriString,
                "name" to name,
                "mimeType" to mimeType
            )

            val work = OneTimeWorkRequestBuilder<UploadWorker>()
                .setInputData(inputData)
                .addTag("squidcloud-shared-upload")
                .build()

            context?.let { ctx ->
                WorkManager.getInstance(ctx).enqueue(work)
            }
        } catch (error: Exception) {
            Log.e("SharedReceiver", "Failed to enqueue shared upload worker", error)
        }
    }

}
