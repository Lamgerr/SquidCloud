package com.squidcloud.plugins.sharedreceiver

import android.content.Intent
import android.net.Uri
import android.util.Log
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "SharedReceiver")
class SharedReceiverPlugin : Plugin() {
    override fun handleOnNewIntent(intent: Intent) {
        super.handleOnNewIntent(intent)
        handleIntent(intent)
    }

    override fun handleOnStart() {
        super.handleOnStart()
        activity?.intent?.let { handleIntent(it) }
    }

    private fun handleIntent(intent: Intent) {
        try {
            val action = intent.action
            val type = intent.type
            val files = JSArray()
            if (Intent.ACTION_SEND == action) {
                (intent.getParcelableExtra(Intent.EXTRA_STREAM) as? Uri)?.let { uri ->
                    val o = JSObject()
                    o.put("uri", uri.toString())
                    o.put("mimeType", type)
                    files.put(o)
                }
            } else if (Intent.ACTION_SEND_MULTIPLE == action) {
                val uris = intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
                uris?.forEach { uri ->
                    val o = JSObject()
                    o.put("uri", uri.toString())
                    o.put("mimeType", type)
                    files.put(o)
                }
            }

            if (files.length() > 0) {
                val payload = JSObject()
                payload.put("files", files)
                notifyListeners("sharedFiles", payload)

                // Enqueue background worker for each file (optional — implement UploadWorker)
                for (i in 0 until files.length()) {
                    val f = files.getJSONObject(i)
                    val uriString = f.getString("uri")
                    // enqueueWork(uriString)
                }
            }
        } catch (e: Exception) {
            Log.e("SharedReceiver", "error handling intent", e)
        }
    }

    // Example enqueue stub; implement your UploadWorker and WorkManager logic here
    private fun enqueueWork(uriString: String) {
        // val data = Data.Builder().putString("uri", uriString).build()
        // val work = OneTimeWorkRequestBuilder<UploadWorker>().setInputData(data).build()
        // WorkManager.getInstance(context).enqueue(work)
    }
}
