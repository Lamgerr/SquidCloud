package com.squidcloud.plugins.sharedreceiver

import android.content.Context
import android.net.Uri
import androidx.work.Worker
import androidx.work.WorkerParameters

class UploadWorker(appContext: Context, params: WorkerParameters) : Worker(appContext, params) {
    override fun doWork(): Result {
        val uriString = inputData.getString("uri") ?: return Result.failure()
        val uri = Uri.parse(uriString)

        try {
            // TODO: open input stream from content resolver, copy to file if necessary
            // TODO: perform upload via OkHttp or other HTTP client
            return Result.success()
        } catch (e: Exception) {
            return Result.retry()
        }
    }
}
