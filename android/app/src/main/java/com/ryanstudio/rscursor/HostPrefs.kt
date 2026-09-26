package com.ryanstudio.rscursor

import android.content.Context
import android.net.Uri

/** Remembers the Auto host the WebView should open. */
object HostPrefs {
    private const val PREFS = "rs_cursor"
    private const val KEY_HOST = "host_url"

    fun get(context: Context): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_HOST, "")
            ?.trim()
            .orEmpty()

    fun set(context: Context, raw: String) {
        val normalized = normalize(raw)
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_HOST, normalized)
            .apply()
    }

    /** Accepts host, host:port, or a full URL; always stores an http(s) origin with trailing slash. */
    fun normalize(raw: String): String {
        var s = raw.trim()
        if (s.isEmpty()) return ""
        if (!s.contains("://")) s = "http://$s"
        val uri = Uri.parse(s)
        val scheme = (uri.scheme ?: "http").lowercase()
        val host = uri.host ?: return ""
        val port = if (uri.port != -1) ":${uri.port}" else ""
        return "$scheme://$host$port/"
    }
}
