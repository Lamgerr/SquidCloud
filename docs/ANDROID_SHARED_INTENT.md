# Android: External Share (ACTION_SEND) and Background Uploads

This document explains how to add native Android support to receive files shared from other apps, forward them to the Capacitor web layer, and enqueue background uploads using WorkManager so uploads proceed without opening the app UI.

Summary of steps

- Add an Android Activity intent-filter for `ACTION_SEND` and `ACTION_SEND_MULTIPLE`.
- Implement a small Capacitor plugin (Kotlin) that extracts shared URIs and calls `notifyListeners("sharedFiles", ...)` to forward to the web layer.
- Use WorkManager to start a background `UploadWorker` that performs the actual network upload. The worker runs even if the app is not open.
- Ensure files referenced by content:// URIs are accessible to the worker (use FileProvider to copy to app cache if needed).
- Wire icons and signing in Android Studio for release build.

Kotlin snippets

1) AndroidManifest.xml (inside `android/app/src/main/AndroidManifest.xml`) - add intent filters to your main Activity (or a dedicated share receiver activity):

```xml
<intent-filter>
  <action android:name="android.intent.action.SEND" />
  <category android:name="android.intent.category.DEFAULT" />
  <data android:mimeType="*/*" />
</intent-filter>
<intent-filter>
  <action android:name="android.intent.action.SEND_MULTIPLE" />
  <category android:name="android.intent.category.DEFAULT" />
  <data android:mimeType="*/*" />
</intent-filter>
```

2) Capacitor plugin (Kotlin) - a minimal plugin to extract shared files and forward:

```kotlin
package com.squidcloud.plugins.sharedreceiver

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission

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
        val action = intent.action
        val type = intent.type
        val files = mutableListOf<JSObject>()
        if (Intent.ACTION_SEND == action) {
            (intent.getParcelableExtra(Intent.EXTRA_STREAM) as? Uri)?.let { uri ->
                val o = JSObject()
                o.put("uri", uri.toString())
                o.put("mimeType", type)
                files.add(o)
            }
        } else if (Intent.ACTION_SEND_MULTIPLE == action) {
            val uris = intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
            uris?.forEach { uri ->
                val o = JSObject()
                o.put("uri", uri.toString())
                o.put("mimeType", type)
                files.add(o)
            }
        }

        if (files.isNotEmpty()) {
            notifyListeners("sharedFiles", JSObject().put("files", files))

            // Enqueue background worker to upload files when received
            files.forEach { js ->
                val uriString = js.getString("uri")
                uriString?.let { enqueueUploadWork(Uri.parse(it)) }
            }
        }
    }

    private fun enqueueUploadWork(uri: Uri) {
        // Example WorkManager enqueue. Implement your UploadWorker to do the upload.
        // val data = Data.Builder().putString("uri", uri.toString()).build()
        // val work = OneTimeWorkRequestBuilder<UploadWorker>().setInputData(data).build()
        // WorkManager.getInstance(context).enqueue(work)
    }
}
```

3) UploadWorker (Kotlin) - perform the upload in the background using WorkManager:

```kotlin
class UploadWorker(appContext: Context, params: WorkerParameters) : Worker(appContext, params) {
    override fun doWork(): Result {
        val uriString = inputData.getString("uri") ?: return Result.failure()
        val uri = Uri.parse(uriString)

        // copy content:// URI to a temporary file accessible to the worker if necessary
        // then perform an HTTP upload with OkHttp or HttpUrlConnection

        return try {
            // upload code
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }
}
```

Notes and caveats

- Background uploads require proper handling of scoped storage and content URIs; for Android 10+ you'll likely need to open an InputStream from the content resolver and copy to cache before upload.
- WorkManager persists work across reboots depending on your constraints.
- Use `notifyListeners` to forward the shared files to the web layer; the web-side `initSharedReceiver()` will pick them up and can show progress UI if the app is open.
- For uploads while the app is closed, use WorkManager and implement network logic in `UploadWorker`.

Signing and icons

- Add your `signingConfigs` in `android/app/build.gradle` for release and configure a keystore with alias `squidcloud` or similar.
- Use Android Studio's Image Asset tool to generate launcher and adaptive icons from a source PNG.
- Example signing config snippet (add to `android/app/build.gradle`):

```groovy
android {
  signingConfigs {
    squidcloudRelease {
      storeFile file("/path/to/squidcloud.keystore")
      storePassword "REPLACE_ME"
      keyAlias "squidcloud"
      keyPassword "REPLACE_ME"
    }
  }
  buildTypes {
    release {
      signingConfig signingConfigs.squidcloudRelease
    }
  }
}
```

Build an APK

1. In project root (after capacitor sync / adding Android platform):

```bash
npx cap sync android
npx cap open android
```

2. In Android Studio: Build > Generate Signed Bundle / APK > select `squidcloud` signing config.

3. Or from the command line (Gradle):

```bash
cd android
./gradlew assembleRelease
```

This will produce a signed APK in `android/app/build/outputs/apk/release/`.

Security

- Do not commit keystore passwords. Use CI secrets and environment variables for signing.
- Validate shared file URIs and sizes before uploading.

