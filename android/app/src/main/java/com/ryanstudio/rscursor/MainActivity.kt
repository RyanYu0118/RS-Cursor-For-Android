package com.ryanstudio.rscursor

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.ActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.ryanstudio.rscursor.databinding.ActivityMainBinding

/**
 * Thin shell around Auto's existing web UI.
 *
 * The chat, queue, and + menu stay on the host. This Activity only loads that
 * page and hands `<input type=file>` over to the system picker — the piece a
 * Home Screen PWA cannot do reliably on Android.
 */
class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    private val fileChooser =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            deliverFileChooserResult(result)
        }

    private val openSettings =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            loadHost()
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.toolbar.inflateMenu(R.menu.main_menu)
        binding.toolbar.setOnMenuItemClickListener { item ->
            when (item.itemId) {
                R.id.action_reload -> {
                    binding.webview.reload()
                    true
                }
                R.id.action_settings -> {
                    openSettings.launch(Intent(this, SettingsActivity::class.java))
                    true
                }
                else -> false
            }
        }

        binding.openSettings.setOnClickListener {
            openSettings.launch(Intent(this, SettingsActivity::class.java))
        }

        configureWebView(binding.webview)
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (binding.webview.canGoBack()) binding.webview.goBack()
                    else finish()
                }
            },
        )

        loadHost()
    }

    private fun configureWebView(webView: WebView) {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        // Keep one WebView process; Auto's WS + PWA assets expect a long-lived page.
        WebView.setWebContentsDebuggingEnabled(true)

        webView.webViewClient =
            object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?,
                ): Boolean {
                    val url = request?.url ?: return false
                    val host = HostPrefs.get(this@MainActivity)
                    if (host.isNotEmpty()) {
                        val allowed = Uri.parse(host)
                        if (url.host == allowed.host &&
                            (url.port == allowed.port || (url.port == -1 && allowed.port == -1))
                        ) {
                            return false
                        }
                    }
                    // Leave Auto for a real browser (Tailscale admin, etc.).
                    startActivity(Intent(Intent.ACTION_VIEW, url))
                    return true
                }

                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?,
                ) {
                    if (request?.isForMainFrame == true) {
                        Toast.makeText(this@MainActivity, R.string.load_error, Toast.LENGTH_LONG).show()
                    }
                }
            }

        webView.webChromeClient =
            object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?,
                ): Boolean {
                    this@MainActivity.filePathCallback?.onReceiveValue(null)
                    this@MainActivity.filePathCallback = filePathCallback

                    val intent =
                        fileChooserParams?.createIntent()?.apply {
                            // Prefer images; Auto's composer only attaches pictures.
                            type = "image/*"
                            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, fileChooserParams.mode == FileChooserParams.MODE_OPEN_MULTIPLE)
                            addCategory(Intent.CATEGORY_OPENABLE)
                        }
                            ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                                addCategory(Intent.CATEGORY_OPENABLE)
                                type = "image/*"
                                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                            }

                    return try {
                        fileChooser.launch(Intent.createChooser(intent, getString(R.string.app_name)))
                        true
                    } catch (err: Exception) {
                        this@MainActivity.filePathCallback = null
                        filePathCallback?.onReceiveValue(null)
                        Toast.makeText(this@MainActivity, err.message ?: "picker failed", Toast.LENGTH_SHORT).show()
                        false
                    }
                }
            }
    }

    private fun deliverFileChooserResult(result: ActivityResult) {
        val callback = filePathCallback
        filePathCallback = null
        if (callback == null) return

        if (result.resultCode != RESULT_OK) {
            callback.onReceiveValue(null)
            return
        }

        val data = result.data
        val uris = mutableListOf<Uri>()
        val clip = data?.clipData
        if (clip != null) {
            for (i in 0 until clip.itemCount) {
                clip.getItemAt(i)?.uri?.let { uris.add(it) }
            }
        } else {
            data?.data?.let { uris.add(it) }
        }

        // Also accept WebChromeClient's own parser when the Intent is a single pick.
        val parsed = WebChromeClient.FileChooserParams.parseResult(result.resultCode, data)
        if (uris.isEmpty() && parsed != null) {
            callback.onReceiveValue(parsed)
            return
        }

        callback.onReceiveValue(if (uris.isEmpty()) null else uris.toTypedArray())
    }

    private fun loadHost() {
        val host = HostPrefs.get(this)
        if (host.isEmpty()) {
            binding.webview.visibility = View.GONE
            binding.empty.visibility = View.VISIBLE
            return
        }
        binding.empty.visibility = View.GONE
        binding.webview.visibility = View.VISIBLE
        val current = binding.webview.url
        if (current.isNullOrBlank() || !current.startsWith(host.trimEnd('/'))) {
            binding.webview.loadUrl(host)
        } else {
            binding.webview.reload()
        }
    }

    override fun onDestroy() {
        filePathCallback?.onReceiveValue(null)
        filePathCallback = null
        binding.webview.destroy()
        super.onDestroy()
    }
}
