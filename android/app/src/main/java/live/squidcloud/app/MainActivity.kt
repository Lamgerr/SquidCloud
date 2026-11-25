package live.squidcloud.app

import android.os.Bundle
import com.getcapacitor.BridgeActivity
import live.squidcloud.app.downloader.NativeDownloaderPlugin
import live.squidcloud.app.sharedreceiver.SharedReceiverPlugin

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(SharedReceiverPlugin::class.java)
        registerPlugin(NativeDownloaderPlugin::class.java)
        registerPlugin(SecureKeyStorePlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
