package com.ryanstudio.rscursor.data

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Thin OkHttp WebSocket to Auto's host.
 *
 * Mirrors the web client's handshake: `ws(s)://host/?session=&fromSeq=`, then
 * JSON ops (`attach`, `prompt`, …) and typed push messages (`hello`,
 * `attached`, `record`, `sessions`, …).
 */
class WsClient(
    private val onMessage: (JSONObject) -> Unit,
    private val onOpen: () -> Unit,
    private val onClosed: () -> Unit,
    private val onFailure: (Throwable) -> Unit,
) {
    private val client =
        OkHttpClient.Builder()
            .pingInterval(20, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .build()

    private var socket: WebSocket? = null
    private val open = AtomicBoolean(false)

    val isOpen: Boolean get() = open.get()

    fun connect(httpOrigin: String, sessionId: String?, fromSeq: Long) {
        close(reconnect = false)
        val wsUrl = toWsUrl(httpOrigin, sessionId, fromSeq)
        val req = Request.Builder().url(wsUrl).build()
        socket =
            client.newWebSocket(
                req,
                object : WebSocketListener() {
                    override fun onOpen(webSocket: WebSocket, response: Response) {
                        open.set(true)
                        onOpen()
                    }

                    override fun onMessage(webSocket: WebSocket, text: String) {
                        try {
                            onMessage(JSONObject(text))
                        } catch (_: Exception) {
                            /* ignore malformed */
                        }
                    }

                    override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                        webSocket.close(1000, null)
                    }

                    override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                        open.set(false)
                        onClosed()
                    }

                    override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                        open.set(false)
                        onFailure(t)
                    }
                },
            )
    }

    fun send(op: JSONObject): Boolean {
        val ws = socket ?: return false
        if (!open.get()) return false
        return ws.send(op.toString())
    }

    fun close(reconnect: Boolean = true) {
        open.set(false)
        socket?.close(1000, if (reconnect) "reconnect" else "bye")
        socket = null
    }

    fun shutdown() {
        close(reconnect = false)
        client.dispatcher.executorService.shutdown()
    }

    companion object {
        fun toWsUrl(httpOrigin: String, sessionId: String?, fromSeq: Long): String {
            val trimmed = httpOrigin.trim().trimEnd('/')
            val base =
                when {
                    trimmed.startsWith("https://", ignoreCase = true) ->
                        "wss://" + trimmed.removePrefix("https://").removePrefix("HTTPS://")
                    trimmed.startsWith("http://", ignoreCase = true) ->
                        "ws://" + trimmed.removePrefix("http://").removePrefix("HTTP://")
                    else -> "ws://$trimmed"
                }
            val q = mutableListOf<String>()
            if (!sessionId.isNullOrBlank()) q += "session=${java.net.URLEncoder.encode(sessionId, "UTF-8")}"
            if (fromSeq > 0) q += "fromSeq=$fromSeq"
            return if (q.isEmpty()) base else "$base/?${q.joinToString("&")}"
        }
    }
}
