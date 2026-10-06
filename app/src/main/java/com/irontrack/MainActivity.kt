package com.irontrack

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.documentfile.provider.DocumentFile
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.concurrent.thread

class MainActivity : Activity() {
    // Raw GitHub URL of index.html in YOUR repo. The app downloads it on launch and uses it next start.
    private val updateUrl = "https://raw.githubusercontent.com/YOUR_USER/YOUR_REPO/main/app/src/main/assets/index.html"
    private lateinit var wv: WebView
    private var pending = ""
    private val prefs by lazy { getSharedPreferences("app", MODE_PRIVATE) }

    private fun writeToFolder(name: String, text: String): Boolean {
        try {
            val u = prefs.getString("folder", null) ?: return false
            val dir = DocumentFile.fromTreeUri(this, Uri.parse(u)) ?: return false
            val f = dir.findFile(name) ?: dir.createFile("application/json", name) ?: return false
            contentResolver.openOutputStream(f.uri, "wt")?.use { it.write(text.toByteArray()) }
            return true
        } catch (e: Exception) { return false }
    }

    private fun fmt(t: Long) = if (t == 0L) "never" else SimpleDateFormat("d MMM HH:mm", Locale.UK).format(Date(t))

    inner class Bridge {
        @JavascriptInterface fun exportData(json: String) {
            pending = json
            runOnUiThread {
                startActivityForResult(Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE); type = "application/json"
                    putExtra(Intent.EXTRA_TITLE, "IronTrack_Backup_${java.time.LocalDate.now()}.json")
                }, 1)
            }
        }
        @JavascriptInterface fun importData() {
            runOnUiThread {
                startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE); type = "*/*"
                }, 2)
            }
        }
        @JavascriptInterface fun chooseFolder() {
            runOnUiThread {
                startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
                }, 3)
            }
        }
        @JavascriptInterface fun autosave(json: String) {
            thread { if (writeToFolder("IronTrack_autosave.json", json)) prefs.edit().putLong("lastAuto", System.currentTimeMillis()).apply() }
        }
        @JavascriptInterface fun weeklyBackup(json: String) {
            val now = System.currentTimeMillis()
            if (now - prefs.getLong("lastWeekly", 0) > 7 * 86400000L) {
                thread { if (writeToFolder("IronTrack_Backup_${java.time.LocalDate.now()}.json", json)) prefs.edit().putLong("lastWeekly", now).apply() }
            }
        }
        @JavascriptInterface fun backupStatus(): String {
            val u = prefs.getString("folder", null) ?: return "No backup folder chosen. Tap Backup Folder."
            val name = DocumentFile.fromTreeUri(this@MainActivity, Uri.parse(u))?.name ?: "?"
            return "Folder: $name | Autosave: ${fmt(prefs.getLong("lastAuto", 0))} | Weekly backup: ${fmt(prefs.getLong("lastWeekly", 0))}"
        }
        @Suppress("DEPRECATION")
        @JavascriptInterface fun vibrate() {
            (getSystemService(VIBRATOR_SERVICE) as Vibrator).vibrate(VibrationEffect.createWaveform(longArrayOf(0, 400, 150, 400, 150, 400), -1))
        }
    }

    @Suppress("DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        val uri = data?.data
        if (resultCode != RESULT_OK || uri == null) return
        try {
            when (requestCode) {
                1 -> {
                    contentResolver.openOutputStream(uri)?.use { it.write(pending.toByteArray()) }
                    Toast.makeText(this, "Backup saved", Toast.LENGTH_SHORT).show()
                }
                2 -> {
                    val t = contentResolver.openInputStream(uri)!!.bufferedReader().readText()
                    wv.evaluateJavascript("restoreData(" + JSONObject.quote(t) + ")", null)
                }
                3 -> {
                    contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                    prefs.edit().putString("folder", uri.toString()).putLong("lastWeekly", 0).apply()
                    wv.evaluateJavascript("folderSet()", null)
                    Toast.makeText(this, "Backup folder set", Toast.LENGTH_SHORT).show()
                }
            }
        } catch (e: Exception) {
            Toast.makeText(this, "Failed: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    @Suppress("DEPRECATION")
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = 0xFF020617.toInt()
        window.navigationBarColor = 0xFF020617.toInt()

        // A newer APK always wins over an older downloaded copy
        val local = File(filesDir, "index.html")
        val vc = packageManager.getPackageInfo(packageName, 0).versionCode
        if (prefs.getInt("vc", -1) != vc) { local.delete(); prefs.edit().putInt("vc", vc).apply() }

        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/files/", WebViewAssetLoader.InternalStoragePathHandler(this, filesDir))
            .build()

        wv = WebView(this)
        wv.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            cacheMode = WebSettings.LOAD_CACHE_ELSE_NETWORK
        }
        wv.addJavascriptInterface(Bridge(), "Android")
        wv.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                loader.shouldInterceptRequest(request.url)
        }
        wv.webChromeClient = WebChromeClient()
        setContentView(wv)
        wv.loadUrl("https://appassets.androidplatform.net/" + if (local.exists()) "files/index.html" else "assets/index.html")

        thread {
            try {
                if (!updateUrl.contains("YOUR_USER")) {
                    val t = java.net.URL(updateUrl).readText()
                    if (t.contains("<html")) local.writeText(t)
                }
            } catch (_: Exception) { }
        }
    }
}
