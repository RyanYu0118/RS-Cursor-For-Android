package com.ryanstudio.rscursor.data

import org.json.JSONArray
import org.json.JSONObject

/** Turns host transcript records into a flat list of [ChatItem]s for Compose. */
class TranscriptReducer {
    private val items = linkedMapOf<String, ChatItem>()
    private var streamKey: String? = null
    private var streamBuf = StringBuilder()
    private var streamThought = false
    private var lastSeq = 0L
    private var oldestSeq = 0L
    private var tailOldestSeq = 0L
    private val knownSeqs = mutableSetOf<Long>()

    val sequence: Long get() = lastSeq
    /** Oldest seq in the attach tail — `beforeSeq` for transcript.more. */
    val tailOldestSequence: Long get() = tailOldestSeq
    fun snapshot(): List<ChatItem> = items.values.toList()

    fun clear() {
        items.clear()
        streamKey = null
        streamBuf = StringBuilder()
        streamThought = false
        lastSeq = 0L
        oldestSeq = 0L
        tailOldestSeq = 0L
        knownSeqs.clear()
    }

    fun ingestAll(records: List<JSONObject>, replace: Boolean) {
        if (replace) clear()
        for (rec in records) apply(rec)
    }

    /** Ingest attach head then tail; only the tail's oldest seq drives load-more. */
    fun ingestAttached(head: List<JSONObject>, tail: List<JSONObject>, replace: Boolean) {
        if (replace) clear()
        for (rec in head) apply(rec)
        val beforeTail = lastSeq
        for (rec in tail) apply(rec)
        tailOldestSeq =
            tail.map { it.optLong("seq", 0L) }.filter { it > 0L }.minOrNull()
                ?: if (beforeTail > 0) beforeTail + 1 else oldestSeq
    }

    /**
     * Paint an older window above what is already shown, keeping keys stable so
     * Compose can hold the scroll anchor on the previously top-visible row.
     */
    fun prependAll(records: List<JSONObject>): Int {
        val fresh =
            records.filter { rec ->
                val seq = rec.optLong("seq", 0L)
                seq <= 0L || knownSeqs.add(seq)
            }
        if (fresh.isEmpty()) return 0
        flushStream()
        val side = TranscriptReducer()
        for (rec in fresh) side.apply(rec)
        side.flushStream()
        val merged = linkedMapOf<String, ChatItem>()
        for ((k, v) in side.items) merged[k] = v
        for ((k, v) in items) if (k !in merged) merged[k] = v
        items.clear()
        items.putAll(merged)
        knownSeqs += side.knownSeqs
        if (side.oldestSeq > 0 && (oldestSeq == 0L || side.oldestSeq < oldestSeq)) {
            oldestSeq = side.oldestSeq
        }
        val newTailOldest =
            fresh.map { it.optLong("seq", 0L) }.filter { it > 0L }.minOrNull()
        if (newTailOldest != null && (tailOldestSeq == 0L || newTailOldest < tailOldestSeq)) {
            tailOldestSeq = newTailOldest
        }
        if (side.lastSeq > lastSeq) lastSeq = side.lastSeq
        return fresh.size
    }

    fun apply(rec: JSONObject) {
        val seq = rec.optLong("seq", 0L)
        if (seq > 0L) {
            knownSeqs += seq
            if (seq > lastSeq) lastSeq = seq
            if (oldestSeq == 0L || seq < oldestSeq) oldestSeq = seq
        }
        when (rec.optString("kind")) {
            "user_message" -> {
                flushStream()
                val key = recKey(rec, "user")
                items[key] =
                    ChatItem.User(
                        key = key,
                        text = rec.optString("text"),
                        images = parseImages(rec),
                        waiting = rec.optBoolean("waiting", false),
                    )
            }
            "agent_delta", "agent_thought" -> {
                val thought = rec.optString("kind") == "agent_thought"
                val text = rec.optString("text")
                if (text.isEmpty()) return
                if (streamKey == null || streamThought != thought) {
                    flushStream()
                    streamThought = thought
                    streamKey = "stream-${rec.optLong("seq")}-${if (thought) "t" else "a"}"
                    streamBuf = StringBuilder(text)
                } else {
                    streamBuf.append(text)
                }
                val key = streamKey!!
                items[key] =
                    ChatItem.Assistant(key = key, text = streamBuf.toString(), thought = thought)
            }
            "tool_call" -> {
                flushStream()
                val id = rec.optString("toolCallId").ifBlank { "tool-${rec.optLong("seq")}" }
                val key = "tool-$id"
                items[key] = toolFrom(rec, id, key)
            }
            "tool_update" -> {
                val id = rec.optString("toolCallId")
                val key = "tool-$id"
                val prev = items[key] as? ChatItem.Tool
                if (prev != null) {
                    items[key] = mergeTool(prev, rec)
                } else {
                    items[key] = toolFrom(rec, id, key)
                }
            }
            "permission_request" -> {
                // Cursor desktop approvals used to flash here then vanish.
                // Those are answered in the IDE now; do not paint a card.
                return
            }
            "permission_resolved" -> {
                val rid = rec.optString("requestId")
                items.remove("perm-$rid")
            }
            "question" -> {
                flushStream()
                val askId = rec.optString("askId").ifBlank { "ask-${rec.optLong("seq")}" }
                val questions = rec.optJSONArray("questions")
                val first = questions?.optJSONObject(0)
                val opts = parseQuestionOptions(first)
                items["ask-$askId"] =
                    ChatItem.Question(
                        key = "ask-$askId",
                        askId = askId,
                        title = rec.optString("title").ifBlank { "Question" },
                        prompt = first?.optString("prompt") ?: rec.optString("text"),
                        options = opts,
                    )
            }
            "question_answered" -> {
                val askId = rec.optString("askId")
                val key = "ask-$askId"
                val prev = items[key] as? ChatItem.Question ?: return
                items[key] = prev.copy(answered = true)
            }
            "error" -> {
                flushStream()
                val key = "err-${rec.optLong("seq")}"
                items[key] =
                    ChatItem.Notice(key = key, text = rec.optString("text").ifBlank { "error" }, error = true)
            }
            "notice" -> {
                flushStream()
                val key = "notice-${rec.optLong("seq")}"
                items[key] = ChatItem.Notice(key = key, text = rec.optString("text"))
            }
            "turn_end" -> {
                flushStream()
                val label =
                    when {
                        rec.has("durationMs") && rec.optLong("durationMs") > 0 ->
                            "Worked for ${formatDuration(rec.optLong("durationMs"))}"
                        else -> "Done"
                    }
                val key = "turn-end-${rec.optLong("seq")}"
                items[key] = ChatItem.Status(key = key, text = label)
            }
            "turn_start" -> {
                flushStream()
                /* status comes from session busy flag */
            }
            else -> {
                /* session_start, commands, terminal_chunk, plan — v1 skip */
            }
        }
    }

    private fun flushStream() {
        streamKey = null
        streamBuf = StringBuilder()
        streamThought = false
    }

    private fun toolFrom(rec: JSONObject, id: String, key: String): ChatItem.Tool {
        val input = rec.optJSONObject("rawInput") ?: JSONObject()
        val path =
            input.optString("relativeWorkspacePath")
                .ifBlank { input.optString("targetFile") }
                .ifBlank { input.optString("path") }
                .ifBlank { input.optString("file_path") }
                .ifBlank { input.optString("effectiveUri") }
        val added =
            when {
                input.has("added") -> input.optInt("added")
                input.has("editLinesAdded") -> input.optInt("editLinesAdded")
                else -> null
            }
        val removed =
            when {
                input.has("removed") -> input.optInt("removed")
                input.has("editLinesRemoved") -> input.optInt("editLinesRemoved")
                else -> null
            }
        return ChatItem.Tool(
            key = key,
            toolCallId = id,
            title =
                rec.optString("title").ifBlank {
                    rec.optJSONObject("toolCall")?.optString("title")
                        ?: rec.optString("kind", "tool")
                },
            status = rec.optString("status", "pending"),
            toolKind = rec.optString("toolKind"),
            command = input.optString("command"),
            commandDescription = input.optString("commandDescription"),
            path = path,
            query = input.optString("query").ifBlank { input.optString("searchTerm") },
            pattern = input.optString("pattern").ifBlank { input.optString("glob") },
            added = added,
            removed = removed,
        )
    }

    private fun mergeTool(prev: ChatItem.Tool, rec: JSONObject): ChatItem.Tool {
        val next = toolFrom(rec, prev.toolCallId, prev.key)
        return prev.copy(
            title = next.title.ifBlank { prev.title },
            status = rec.optString("status", prev.status).ifBlank { prev.status },
            toolKind = next.toolKind.ifBlank { prev.toolKind },
            command = next.command.ifBlank { prev.command },
            commandDescription = next.commandDescription.ifBlank { prev.commandDescription },
            path = next.path.ifBlank { prev.path },
            query = next.query.ifBlank { prev.query },
            pattern = next.pattern.ifBlank { prev.pattern },
            added = next.added ?: prev.added,
            removed = next.removed ?: prev.removed,
        )
    }

    private fun recKey(rec: JSONObject, prefix: String): String {
        val bubble = rec.optString("desktopBubbleId")
        if (bubble.isNotBlank()) return "$prefix-$bubble"
        return "$prefix-${rec.optLong("seq")}"
    }

    companion object {
        fun parseImages(rec: JSONObject): List<ImagePart> {
            val arr = rec.optJSONArray("imageParts") ?: return emptyList()
            val out = ArrayList<ImagePart>(arr.length())
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                out +=
                    ImagePart(
                        mimeType = o.optString("mimeType").ifBlank { o.optString("mime", "image/png") },
                        data = o.optString("data").takeIf { it.isNotBlank() },
                        path = o.optString("path").takeIf { it.isNotBlank() },
                        url = o.optString("url").takeIf { it.isNotBlank() },
                        name = o.optString("name", "image"),
                    )
            }
            return out
        }

        fun parseOptions(arr: JSONArray?): List<PermOption> {
            if (arr == null) return emptyList()
            val out = ArrayList<PermOption>(arr.length())
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                out +=
                    PermOption(
                        optionId = o.optString("optionId"),
                        name = o.optString("name").ifBlank { o.optString("optionId") },
                        kind = o.optString("kind"),
                    )
            }
            return out
        }

        fun parseQuestionOptions(q: JSONObject?): List<PermOption> {
            if (q == null) return emptyList()
            val arr = q.optJSONArray("options") ?: return emptyList()
            val out = ArrayList<PermOption>(arr.length())
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val id = o.optString("id").ifBlank { o.optString("optionId") }
                out +=
                    PermOption(
                        optionId = id,
                        name = o.optString("label").ifBlank { o.optString("name", id) },
                    )
            }
            return out
        }

        fun isWorkspaceMark(rec: JSONObject): Boolean {
            val opts = rec.optJSONArray("options") ?: return false
            if (opts.length() == 0) return false
            for (i in 0 until opts.length()) {
                val o = opts.optJSONObject(i) ?: return false
                val name = (o.optString("name").ifBlank { o.optString("optionId") }).trim()
                if (!name.equals("no repo", ignoreCase = true)) return false
            }
            return true
        }

        fun formatDuration(ms: Long): String {
            val s = ms / 1000
            return when {
                s < 60 -> "${s}s"
                s < 3600 -> "${s / 60}m ${s % 60}s"
                else -> "${s / 3600}h ${(s % 3600) / 60}m"
            }
        }

        fun sessionFrom(o: JSONObject): SessionMeta =
            SessionMeta(
                id = o.optString("id"),
                title = o.optString("title").ifBlank { "session" },
                folder = o.optString("folder"),
                status = o.optString("status", "idle"),
                agent = o.optString("agent", "cursor"),
                model = o.optString("model"),
                modelName = o.optString("modelName"),
                mode = o.optString("mode"),
                kind = o.optString("kind"),
                desktopThreadId = o.optString("desktopThreadId"),
                updatedAt =
                    RailBuilder.parseTime(
                        o.opt("updatedAt") ?: o.opt("createdAt"),
                    ),
                active = o.optBoolean("active", false),
            )

        fun catalogFrom(o: JSONObject?): Catalog {
            if (o == null) return Catalog()
            return Catalog(
                models = itemsFrom(o.optJSONArray("models")),
                modes = itemsFrom(o.optJSONArray("modes")),
            )
        }

        private fun itemsFrom(arr: JSONArray?): List<CatalogItem> {
            if (arr == null) return emptyList()
            val out = ArrayList<CatalogItem>(arr.length())
            for (i in 0 until arr.length()) {
                val x = arr.optJSONObject(i) ?: continue
                val id =
                    x.optString("modelId")
                        .ifBlank { x.optString("id") }
                        .ifBlank { x.optString("value") }
                if (id.isBlank()) continue
                out +=
                    CatalogItem(
                        id = id,
                        name = x.optString("name").ifBlank { x.optString("label", id) },
                    )
            }
            return out
        }

        fun jsonArrayOf(arr: JSONArray?): List<JSONObject> {
            if (arr == null) return emptyList()
            val out = ArrayList<JSONObject>(arr.length())
            for (i in 0 until arr.length()) {
                arr.optJSONObject(i)?.let { out += it }
            }
            return out
        }
    }
}
