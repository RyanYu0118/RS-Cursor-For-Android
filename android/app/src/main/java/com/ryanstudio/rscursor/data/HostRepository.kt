package com.ryanstudio.rscursor.data

import android.os.Handler
import android.os.Looper
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Owns the Auto host connection and projects it into [HostUiState].
 *
 * UI observes [state]; ops go through typed methods that mirror web `sendOp`.
 */
class HostRepository {
    private val main = Handler(Looper.getMainLooper())
    private val reducer = TranscriptReducer()
    private var rememberedSession: String? = null
    private var hostUrl: String = ""
    private var reconnectPosted = AtomicBoolean(false)
    private var draftSeq = 0L
    private var sidebarJson: JSONObject? = null
    private var recentChats: List<JSONObject> = emptyList()
    private val collapsedRepos = mutableSetOf<String>()
    private var collapsedSeeded = false

    private var _state = HostUiState()
    val state: HostUiState get() = _state

    private var listeners = mutableListOf<(HostUiState) -> Unit>()

    private val ws =
        WsClient(
            onMessage = { msg -> main.post { handleMessage(msg) } },
            onOpen = { main.post { onSocketOpen() } },
            onClosed = { main.post { scheduleReconnect("disconnected") } },
            onFailure = { t -> main.post { scheduleReconnect(t.message ?: "connection failed") } },
        )

    fun observe(listener: (HostUiState) -> Unit): () -> Unit {
        listeners += listener
        listener(_state)
        return {
            listeners -= listener
        }
    }

    fun setHostUrl(url: String) {
        hostUrl = url.trim()
        if (hostUrl.isEmpty()) {
            ws.close(reconnect = false)
            publish(
                _state.copy(
                    hostUrl = "",
                    phase = ConnPhase.NoHost,
                    sessionsReady = false,
                    transcriptReady = false,
                    banner = null,
                ),
            )
            return
        }
        connect()
    }

    fun connect() {
        if (hostUrl.isEmpty()) {
            publish(_state.copy(phase = ConnPhase.NoHost))
            return
        }
        reconnectPosted.set(false)
        val phase =
            if (_state.sessionsReady) ConnPhase.Reconnecting else ConnPhase.Connecting
        publish(
            _state.copy(
                hostUrl = hostUrl,
                phase = phase,
                reconnecting = phase == ConnPhase.Reconnecting,
                banner = if (phase == ConnPhase.Reconnecting) "重连中…" else null,
                transcriptReady = if (phase == ConnPhase.Reconnecting) _state.transcriptReady else false,
                sessionsReady = if (phase == ConnPhase.Connecting) false else _state.sessionsReady,
            ),
        )
        ws.connect(hostUrl, rememberedSession ?: _state.sessionId, reducer.sequence)
    }

    fun attach(sessionId: String) {
        if (sessionId == _state.sessionId && _state.transcriptReady) return
        rememberedSession = sessionId
        reducer.clear()
        publish(
            _state.copy(
                sessionId = sessionId,
                transcriptReady = false,
                items = emptyList(),
                draft = "",
                attachments = emptyList(),
                queue = emptyList(),
                earlierCount = 0,
                loadingEarlier = false,
            ),
        )
        send(
            JSONObject()
                .put("op", "attach")
                .put("sessionId", sessionId)
                .put("fromSeq", 0),
        )
    }

    fun createSession(folder: String? = null) {
        val op = JSONObject().put("op", "session.create")
        if (!folder.isNullOrBlank()) op.put("folder", folder)
        send(op)
    }

    fun continueDesktop(chatId: String, folder: String) {
        send(
            JSONObject()
                .put("op", "desktop.continue")
                .put("chatId", chatId)
                .put("folder", folder),
        )
    }

    fun openRailItem(chat: RailChat) {
        val sid = chat.sessionId
        if (!sid.isNullOrBlank()) {
            attach(sid)
            return
        }
        val cid = chat.chatId ?: return
        continueDesktop(cid, chat.folder)
    }

    fun openPinned(pin: RailPinned) {
        val known = _state.sessions.find { it.desktopThreadId == pin.id }
        if (known != null) {
            attach(known.id)
            return
        }
        if (pin.id.isNotBlank() && pin.folder.isNotBlank()) {
            continueDesktop(pin.id, pin.folder)
            return
        }
        if (pin.folder.isNotBlank()) createSession(pin.folder) else createSession()
    }

    fun setDraft(text: String, claim: Boolean = true, force: Boolean = false) {
        publish(_state.copy(draft = text))
        val id = _state.sessionId ?: return
        val at = System.currentTimeMillis()
        draftSeq = at
        send(
            JSONObject()
                .put("op", "session.draft")
                .put("sessionId", id)
                .put("text", text)
                .put("at", at)
                .put("claim", claim)
                .put("force", force),
        )
    }

    fun setAttachments(parts: List<LocalAttachment>) {
        publish(_state.copy(attachments = parts))
    }

    fun addAttachments(parts: List<LocalAttachment>) {
        publish(_state.copy(attachments = _state.attachments + parts))
    }

    fun removeAttachment(index: Int) {
        if (index !in _state.attachments.indices) return
        publish(_state.copy(attachments = _state.attachments.toMutableList().also { it.removeAt(index) }))
    }

    fun sendPrompt() {
        val text = _state.draft.trim()
        val images = _state.attachments
        if (text.isEmpty() && images.isEmpty()) return
        val id = _state.sessionId ?: return
        val arr = JSONArray()
        for (img in images) {
            arr.put(
                JSONObject()
                    .put("mimeType", img.mimeType)
                    .put("data", img.dataBase64),
            )
        }
        send(
            JSONObject()
                .put("op", "prompt")
                .put("sessionId", id)
                .put("text", text)
                .put("images", arr),
        )
        publish(_state.copy(draft = "", attachments = emptyList()))
        send(
            JSONObject()
                .put("op", "session.draft")
                .put("sessionId", id)
                .put("text", "")
                .put("at", System.currentTimeMillis())
                .put("force", true)
                .put("claim", true),
        )
    }

    fun cancel() {
        val id = _state.sessionId ?: return
        send(JSONObject().put("op", "cancel").put("sessionId", id))
    }

    fun setMode(modeId: String) {
        val id = _state.sessionId ?: return
        send(
            JSONObject()
                .put("op", "session.mode")
                .put("sessionId", id)
                .put("modeId", modeId),
        )
    }

    fun setModel(modelId: String) {
        val id = _state.sessionId ?: return
        send(
            JSONObject()
                .put("op", "session.model")
                .put("sessionId", id)
                .put("modelId", modelId),
        )
    }

    fun resolvePermission(requestId: String, optionId: String) {
        send(
            JSONObject()
                .put("op", "permission")
                .put("requestId", requestId)
                .put("optionId", optionId)
                .put("by", "android"),
        )
    }

    fun answerQuestion(askId: String, optionId: String) {
        val id = _state.sessionId ?: return
        val selections = JSONObject().put("0", JSONArray().put(optionId))
        send(
            JSONObject()
                .put("op", "question.answer")
                .put("sessionId", id)
                .put("askId", askId)
                .put("selections", selections),
        )
    }

    fun skipQuestion(askId: String) {
        val id = _state.sessionId ?: return
        send(
            JSONObject()
                .put("op", "question.answer")
                .put("sessionId", id)
                .put("askId", askId)
                .put("skip", true),
        )
    }

    fun setRailOpen(open: Boolean) {
        publish(_state.copy(railOpen = open))
    }

    fun toggleRepo(folder: String) {
        val key = RailBuilder.folderKey(folder).ifBlank { "norepo" }
        if (!collapsedRepos.add(key)) collapsedRepos.remove(key)
        publish(_state.copy(railRepos = applyCollapsed(_state.railRepos)))
    }

    fun refreshProjects() {
        send(JSONObject().put("op", "projects.list"))
    }

    /** Same as web: scroll near top or tap the earlier row. */
    fun loadEarlier() {
        if (_state.loadingEarlier) return
        if (_state.earlierCount <= 0) return
        val id = _state.sessionId ?: return
        val before = reducer.tailOldestSequence
        if (before <= 0L) return
        publish(_state.copy(loadingEarlier = true))
        send(
            JSONObject()
                .put("op", "transcript.more")
                .put("sessionId", id)
                .put("beforeSeq", before)
                .put("limit", 60),
        )
    }

    fun imageUrl(part: ImagePart): String? {
        if (!part.data.isNullOrBlank()) {
            return "data:${part.mimeType};base64,${part.data}"
        }
        if (!part.url.isNullOrBlank()) {
            return if (part.url.startsWith("http")) part.url else absolutize(part.url)
        }
        val path = part.path ?: return null
        val sid = _state.sessionId ?: return null
        val origin = hostUrl.trimEnd('/')
        return "$origin/api/image?session=${java.net.URLEncoder.encode(sid, "UTF-8")}" +
            "&path=${java.net.URLEncoder.encode(path, "UTF-8")}"
    }

    fun shutdown() {
        ws.shutdown()
        listeners.clear()
    }

    private fun absolutize(path: String): String {
        if (path.startsWith("http")) return path
        val origin = hostUrl.trimEnd('/')
        return if (path.startsWith("/")) "$origin$path" else "$origin/$path"
    }

    private fun send(op: JSONObject) {
        if (!ws.send(op)) {
            publish(_state.copy(banner = "未连接主机"))
        }
    }

    private fun onSocketOpen() {
        publish(
            _state.copy(
                phase = ConnPhase.Connected,
                reconnecting = false,
                banner = null,
            ),
        )
        // hello has chats but not the Agents sidebar; ask once so rail can match web.
        send(JSONObject().put("op", "projects.list"))
    }

    private fun scheduleReconnect(reason: String) {
        if (hostUrl.isEmpty()) return
        // Already connected again (stale close from a replaced socket) — ignore.
        if (ws.isOpen && _state.phase == ConnPhase.Connected && !_state.reconnecting) return
        publish(
            _state.copy(
                phase = if (_state.sessionsReady) ConnPhase.Reconnecting else ConnPhase.Connecting,
                reconnecting = true,
                banner = "重连中… ($reason)",
            ),
        )
        if (!reconnectPosted.compareAndSet(false, true)) return
        main.postDelayed(
            {
                reconnectPosted.set(false)
                if (hostUrl.isEmpty()) return@postDelayed
                // A newer connect already succeeded while we waited.
                if (ws.isOpen && _state.phase == ConnPhase.Connected) return@postDelayed
                connect()
            },
            1000L,
        )
    }

    private fun handleMessage(msg: JSONObject) {
        when (msg.optString("type")) {
            "hello" -> {
                val sessions = parseSessions(msg.optJSONArray("sessions"))
                ingestSidebar(msg)
                val (pinned, repos) = rebuildRail(sessions)
                publish(
                    _state.copy(
                        sessions = sessions,
                        sessionsReady = true,
                        phase = ConnPhase.Connected,
                        reconnecting = false,
                        banner = null,
                        railPinned = pinned,
                        railRepos = repos,
                    ),
                )
            }
            "sessions" -> {
                val sessions = parseSessions(msg.optJSONArray("sessions"))
                val mine = sessions.find { it.id == _state.sessionId }
                val (pinned, repos) = rebuildRail(sessions)
                publish(
                    _state.copy(
                        sessions = sessions,
                        sessionsReady = true,
                        meta = mine ?: _state.meta,
                        busy = mine?.status == "busy" || mine?.status == "starting",
                        railPinned = pinned,
                        railRepos = repos,
                    ),
                )
            }
            "projects" -> {
                ingestSidebar(msg)
                val (pinned, repos) = rebuildRail(_state.sessions)
                publish(_state.copy(railPinned = pinned, railRepos = repos))
            }
            "desktopRecent" -> {
                recentChats = RailBuilder.parseChats(msg.optJSONArray("chats"))
                val (pinned, repos) = rebuildRail(_state.sessions)
                publish(_state.copy(railPinned = pinned, railRepos = repos))
            }
            "attached" -> onAttached(msg)
            "record" -> {
                if (msg.optString("sessionId") != _state.sessionId) return
                val rec = msg.optJSONObject("record") ?: return
                reducer.apply(rec)
                publish(_state.copy(items = reducer.snapshot(), transcriptReady = true))
            }
            "queue" -> {
                if (msg.optString("sessionId") != _state.sessionId) return
                val waiting = msg.optJSONArray("waiting")
                val queue = ArrayList<QueueItem>()
                if (waiting != null) {
                    for (i in 0 until waiting.length()) {
                        val o = waiting.optJSONObject(i) ?: continue
                        queue +=
                            QueueItem(
                                id = o.optString("id").ifBlank { o.optString("itemId") },
                                text = o.optString("text"),
                            )
                    }
                }
                publish(_state.copy(queue = queue))
            }
            "draft" -> {
                if (msg.optString("sessionId") != _state.sessionId) return
                val at = msg.optLong("at", 0L)
                if (at > 0 && at < draftSeq) return
                if (msg.optBoolean("force") || msg.optString("source") == "computer") {
                    publish(_state.copy(draft = msg.optString("text")))
                }
            }
            "draft.set" -> { /* ack */ }
            "catalog" -> {
                publish(_state.copy(catalog = TranscriptReducer.catalogFrom(msg.optJSONObject("catalog"))))
            }
            "error" -> {
                publish(_state.copy(banner = msg.optString("message").ifBlank { "error" }))
            }
            "host.restarting" -> {
                publish(_state.copy(banner = "主机重启中…", reconnecting = true))
            }
            "transcript.more" -> onTranscriptMore(msg)
            else -> { /* browser / terminals ignored in v1 */ }
        }
    }

    private fun onTranscriptMore(msg: JSONObject) {
        if (msg.optString("sessionId") != _state.sessionId) {
            publish(_state.copy(loadingEarlier = false))
            return
        }
        val records = TranscriptReducer.jsonArrayOf(msg.optJSONArray("records"))
        val added = reducer.prependAll(records)
        val remaining =
            when {
                msg.has("remaining") -> msg.optInt("remaining").coerceAtLeast(0)
                added == 0 -> 0
                else -> (_state.earlierCount - added).coerceAtLeast(0)
            }
        publish(
            _state.copy(
                items = reducer.snapshot(),
                earlierCount = remaining,
                loadingEarlier = false,
            ),
        )
    }

    private fun onAttached(msg: JSONObject) {
        val sessionId = msg.optString("sessionId")
        rememberedSession = sessionId
        val metaObj = msg.optJSONObject("meta")
        val meta = metaObj?.let { TranscriptReducer.sessionFrom(it) }
        val catalog = TranscriptReducer.catalogFrom(msg.optJSONObject("catalog"))
        val replaced = msg.optBoolean("replaced", true)
        val head = TranscriptReducer.jsonArrayOf(msg.optJSONArray("head"))
        val records = TranscriptReducer.jsonArrayOf(msg.optJSONArray("records"))
        if (replaced) reducer.clear()
        reducer.ingestAttached(head, records, replace = false)
        for (p in TranscriptReducer.jsonArrayOf(msg.optJSONArray("pending"))) {
            reducer.apply(p.put("kind", p.optString("kind").ifBlank { "permission_request" }))
        }
        val earlier =
            when {
                msg.has("omitted") -> msg.optInt("omitted").coerceAtLeast(0)
                else -> msg.optInt("earlier").coerceAtLeast(0)
            }
        val draftText = msg.optJSONObject("draft")?.optString("text").orEmpty()
        ingestSidebar(msg)
        // Keep the active chat's repo expanded so attach never hides it.
        meta?.folder?.let { folder ->
            val key = RailBuilder.folderKey(folder)
            if (key.isNotBlank()) collapsedRepos.remove(key)
        }
        val sessions =
            _state.sessions.let { list ->
                if (meta == null) list
                else {
                    val without = list.filterNot { it.id == meta.id }
                    without + meta
                }
            }
        val (pinned, repos) = rebuildRail(sessions)
        publish(
            _state.copy(
                sessionId = sessionId,
                meta = meta,
                catalog = catalog,
                items = reducer.snapshot(),
                transcriptReady = true,
                sessionsReady = true,
                phase = ConnPhase.Connected,
                reconnecting = false,
                banner = null,
                busy = meta?.status == "busy" || meta?.status == "starting",
                draft = if (draftText.isNotEmpty()) draftText else _state.draft,
                sessions = sessions,
                railPinned = pinned,
                railRepos = repos,
                earlierCount = earlier,
                loadingEarlier = false,
            ),
        )
        send(JSONObject().put("op", "queue.list").put("sessionId", sessionId))
    }

    private fun ingestSidebar(msg: JSONObject) {
        msg.optJSONObject("sidebar")?.let { sidebarJson = it }
        if (msg.has("chats")) {
            recentChats = RailBuilder.parseChats(msg.optJSONArray("chats"))
        }
    }

    private fun rebuildRail(sessions: List<SessionMeta>): Pair<List<RailPinned>, List<RailRepo>> {
        val (pinned, repos) = RailBuilder.build(sessions, sidebarJson, recentChats)
        if (!collapsedSeeded && repos.isNotEmpty()) {
            collapsedSeeded = true
            for (repo in repos) {
                if (repo.collapsed) {
                    collapsedRepos += RailBuilder.folderKey(repo.folder).ifBlank { "norepo" }
                }
            }
        }
        // Keep the focused session's folder open.
        val focusFolder =
            _state.meta?.folder
                ?: sessions.find { it.id == _state.sessionId }?.folder
                ?: ""
        if (focusFolder.isNotBlank()) {
            collapsedRepos.remove(RailBuilder.folderKey(focusFolder))
        }
        return pinned to applyCollapsed(repos)
    }

    private fun applyCollapsed(repos: List<RailRepo>): List<RailRepo> =
        repos.map { repo ->
            val key = RailBuilder.folderKey(repo.folder).ifBlank { "norepo" }
            repo.copy(collapsed = key in collapsedRepos)
        }

    private fun parseSessions(arr: JSONArray?): List<SessionMeta> {
        if (arr == null) return emptyList()
        val out = ArrayList<SessionMeta>(arr.length())
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            out += TranscriptReducer.sessionFrom(o)
        }
        return out
    }

    private fun publish(next: HostUiState) {
        _state = next
        for (l in listeners.toList()) l(next)
    }
}
