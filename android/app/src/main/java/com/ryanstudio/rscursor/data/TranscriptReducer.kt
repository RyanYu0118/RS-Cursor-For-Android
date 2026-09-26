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

    val sequence: Long get() = lastSeq
    fun snapshot(): List<ChatItem> = items.values.toList()

    fun clear() {
        items.clear()
        streamKey = null
        streamBuf = StringBuilder()
        streamThought = false
        lastSeq = 0L
    }

    fun ingestAll(records: List<JSONObject>, replace: Boolean) {
        if (replace) clear()
        for (rec in records) apply(rec)
    }

    fun apply(rec: JSONObject) {
        val seq = rec.optLong("seq", 0L)
        if (seq > lastSeq) lastSeq = seq
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
                items[key] =
                    ChatItem.Tool(
                        key = key,
                        toolCallId = id,
                        title = rec.optString("title").ifBlank {
                            rec.optJSONObject("toolCall")?.optString("title")
                                ?: rec.optString("kind", "tool")
                        },
                        status = rec.optString("status", "pending"),
                    )
            }
            "tool_update" -> {
                val id = rec.optString("toolCallId")
                val key = "tool-$id"
                val prev = items[key] as? ChatItem.Tool
                if (prev != null) {
                    items[key] =
                        prev.copy(status = rec.optString("status", prev.status).ifBlank { prev.status })
                }
            }
            "permission_request" -> {
                flushStream()
                if (isWorkspaceMark(rec)) return
                val rid = rec.optString("requestId").ifBlank { "perm-${rec.optLong("seq")}" }
                val title =
                    rec.optJSONObject("toolCall")?.optString("title")
                        ?: rec.optJSONObject("toolCall")?.optString("kind")
                        ?: "this action"
                items["perm-$rid"] =
                    ChatItem.Permission(
                        key = "perm-$rid",
                        requestId = rid,
                        title = title,
                        options = parseOptions(rec.optJSONArray("options")),
                    )
            }
            "permission_resolved" -> {
                val rid = rec.optString("requestId")
                val key = "perm-$rid"
                val prev = items[key] as? ChatItem.Permission ?: return
                val how =
                    when {
                        rec.optBoolean("cancelled") -> "cancelled"
                        else ->
                            buildString {
                                append(rec.optString("optionId").ifBlank { "answered" })
                                if (rec.optBoolean("automatic")) append(" (policy)")
                            }
                    }
                items[key] = prev.copy(resolved = true, outcome = how)
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
