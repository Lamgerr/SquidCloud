package live.squidcloud.app.sharedreceiver

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.Worker
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import live.squidcloud.app.R
import java.io.File
import java.io.FileOutputStream

class UploadWorker(appContext: Context, params: WorkerParameters) : Worker(appContext, params) {
    companion object {
        private const val CHANNEL_ID = "squidcloud_uploads"
        private const val CHANNEL_NAME = "SquidCloud Uploads"
    }

    override fun doWork(): androidx.work.ListenableWorker.Result {
        val uriString = inputData.getString("uri") ?: return androidx.work.ListenableWorker.Result.failure()
        val displayName = inputData.getString("name") ?: "shared-file"
        val uri = Uri.parse(uriString)

        val notificationId = (System.currentTimeMillis() % Int.MAX_VALUE).toInt()
        ensureNotificationChannel()

        try {
            updateNotification(notificationId, displayName, 0, "Preparing upload")

            val queueDir = File(applicationContext.cacheDir, "shared_upload_queue")
            if (!queueDir.exists()) {
                queueDir.mkdirs()
            }

            val targetFile = if ("file".equals(uri.scheme, ignoreCase = true)) {
                File(uri.path ?: "")
            } else {
                val safeName = displayName.replace(Regex("[^A-Za-z0-9._-]"), "_")
                File(queueDir, "${System.currentTimeMillis()}_$safeName")
            }

            if (!targetFile.exists()) {
                val contentResolver = applicationContext.contentResolver
                val totalBytes = inputData.getLong("size", -1L)
                var copiedBytes = 0L

                contentResolver.openInputStream(uri).use { input ->
                    if (input == null) return androidx.work.ListenableWorker.Result.failure()
                    FileOutputStream(targetFile).use { output ->
                        val buffer = ByteArray(64 * 1024)
                        while (true) {
                            val read = input.read(buffer)
                            if (read <= 0) break
                            output.write(buffer, 0, read)
                            copiedBytes += read

                            if (totalBytes > 0) {
                                val progress = ((copiedBytes * 100) / totalBytes).toInt().coerceIn(0, 100)
                                updateNotification(notificationId, displayName, progress, "Preparing upload")
                            }
                        }
                    }
                }
            }

            updateNotification(notificationId, displayName, 100, "Queued for upload")

            return androidx.work.ListenableWorker.Result.success(
                workDataOf(
                    "stagedPath" to targetFile.absolutePath,
                    "name" to displayName,
                )
            )
        } catch (_error: Exception) {
            updateFailureNotification(notificationId, displayName)
            return androidx.work.ListenableWorker.Result.retry()
        }
    }

    private fun ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val existing = manager.getNotificationChannel(CHANNEL_ID)
            if (existing == null) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_LOW
                )
                manager.createNotificationChannel(channel)
            }
        }
    }

    private fun updateNotification(id: Int, fileName: String, progress: Int, status: String) {
        val builder = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("SquidCloud")
            .setContentText("$status: $fileName")
            .setOnlyAlertOnce(true)
            .setOngoing(progress in 0..99)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setProgress(100, progress, false)

        NotificationManagerCompat.from(applicationContext).notify(id, builder.build())
    }

    private fun updateFailureNotification(id: Int, fileName: String) {
        val builder = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("SquidCloud")
            .setContentText("Upload preparation failed: $fileName")
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)

        NotificationManagerCompat.from(applicationContext).notify(id, builder.build())
    }
}
