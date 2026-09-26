package com.ryanstudio.rscursor.data

import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

/** Build Cursor Agents–style rail groups from host payloads (same idea as web `renderRail`). */
object RailBuilder {
    fun folderKey(path: String): String =
        path.trim().trimEnd('\\', '/').lowercase()

    fun folderName(path: String): String =
        path.trim().trimEnd('\\', '/').substringAfterLast('\\').substringAfterLast('/').ifBlank { path }

    fun parseTime(raw: Any?): Long {
        when (raw) {
            is Number -> {
                val n = raw.toLong()
                return if (n > 1_000_000_000_000L) n else n * 1000
            }
            is String -> {
                val t = raw.trim()
                if (t.isEmpty()) return 0L
                t.toLongOrNull()?.let { n ->
                    return if (n > 1_000_000_000_000L) n else n * 1000
                }
                return try {
                    Instant.parse(t).toEpochMilli()
                } catch (_: Exception) {
                    0L
                }
            }
            else -> return 0L
        }
    }

    fun relTime(at: Long): String {
        if (at <= 0L) return ""
        val min = ((System.currentTimeMillis() - at) / 60_000L).coerceAtLeast(1)
        if (min < 60) return "${min}m"
        val hr = (min / 60.0).toInt().coerceAtLeast(1)
        if (hr < 24) return "${hr}h"
        return "${(hr / 24.0).toInt().coerceAtLeast(1)}d"
    }

    fun parsePinned(arr: JSONArray?): List<RailPinned> {
        if (arr == null) return emptyList()
        val out = ArrayList<RailPinned>(arr.length())
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            val id = o.optString("id")
            if (id.isBlank()) continue
            val name =
                o.optString("name").ifBlank {
                    o.optString("subtitle").ifBlank { "project" }
                }
            out +=
                RailPinned(
                    id = id,
                    name = name,
                    folder = o.optString("folder"),
                    at = parseTime(o.opt("at")),
                    color = o.optString("color"),
                )
        }
        return out
    }

    fun parseChats(arr: JSONArray?): List<JSONObject> {
        if (arr == null) return emptyList()
        val out = ArrayList<JSONObject>(arr.length())
        for (i in 0 until arr.length()) {
            arr.optJSONObject(i)?.let { out += it }
        }
        return out
    }

    /**
     * Prefer Cursor's Agents sidebar snapshot when present; otherwise group
     * Auto sessions + recent desktop chats by folder (web `railRepos` fallback).
     */
    fun build(
        sessions: List<SessionMeta>,
        sidebar: JSONObject?,
        recentChats: List<JSONObject>,
    ): Pair<List<RailPinned>, List<RailRepo>> {
        val pinned = parsePinned(sidebar?.optJSONArray("pinned"))
        val reposArr = sidebar?.optJSONArray("repos")
        val repos =
            if (reposArr != null && reposArr.length() > 0) {
                reposFromSidebar(sessions, reposArr)
            } else {
                reposFromSessionsAndChats(sessions, recentChats)
            }
        return pinned to repos
    }

    private fun isGenericTitle(title: String, folder: String = ""): Boolean {
        val t = title.trim()
        if (t.isEmpty()) return true
        val lower = t.lowercase()
        if (lower == "session" || lower == "chat" || lower == "desktop chat") return true
        if (lower == "untitled chat" || lower == "untitled" || lower == "norepo") return true
        val leaf = folderName(folder)
        return leaf.isNotBlank() && t.equals(leaf, ignoreCase = true)
    }

    private fun pickTitle(cursorTitle: String, sessionTitle: String, folder: String): String {
        val c = cursorTitle.trim()
        val s = sessionTitle.trim()
        return when {
            c.isNotEmpty() && !isGenericTitle(c, folder) -> c
            s.isNotEmpty() && !isGenericTitle(s, folder) -> s
            c.isNotEmpty() -> c
            s.isNotEmpty() -> s
            else -> "Untitled chat"
        }
    }

    private fun sessionChat(s: SessionMeta, cursorTitle: String = ""): RailChat {
        val folder = s.folder
        return RailChat(
            key = "s:${s.id}",
            sessionId = s.id,
            chatId = s.desktopThreadId.ifBlank { null },
            title = pickTitle(cursorTitle, s.title, folder),
            folder = folder,
            at = s.updatedAt,
        )
    }

    private fun reposFromSidebar(sessions: List<SessionMeta>, reposArr: JSONArray): List<RailRepo> {
        val byThread = sessions.filter { it.desktopThreadId.isNotBlank() }.associateBy { it.desktopThreadId }
        val seenSession = mutableSetOf<String>()
        val seenThread = mutableSetOf<String>()
        val repos = ArrayList<RailRepo>()
        for (i in 0 until reposArr.length()) {
            val r = reposArr.optJSONObject(i) ?: continue
            val folder = r.optString("folder")
            val chatsArr = r.optJSONArray("chats")
            val chats = ArrayList<RailChat>()
            if (chatsArr != null) {
                for (j in 0 until chatsArr.length()) {
                    val c = chatsArr.optJSONObject(j) ?: continue
                    val chatId = c.optString("id")
                    if (chatId.isBlank() || chatId in seenThread) continue
                    seenThread += chatId
                    val cursorTitle = c.optString("title")
                    // Skip nameless drafts the host may still emit.
                    if (isGenericTitle(cursorTitle, folder) &&
                        cursorTitle.isBlank() &&
                        byThread[chatId] == null
                    ) {
                        continue
                    }
                    val known = byThread[chatId]
                    if (known != null) {
                        seenSession += known.id
                        chats += sessionChat(known, cursorTitle)
                    } else {
                        val title = pickTitle(cursorTitle, "", folder)
                        chats +=
                            RailChat(
                                key = "c:$chatId",
                                chatId = chatId,
                                title = title,
                                folder = c.optString("folder").ifBlank { folder },
                                at = parseTime(c.opt("at")),
                            )
                    }
                }
            }
            chats.sortByDescending { it.at }
            repos +=
                RailRepo(
                    folder = folder,
                    name = r.optString("name").ifBlank { folderName(folder).ifBlank { "No Repo" } },
                    kind = r.optString("kind").ifBlank { if (folder.isBlank()) "home" else "folder" },
                    collapsed = r.optBoolean("collapsed", false),
                    chats = chats,
                )
        }
        // Cursor's sidebar is authoritative: only append desktop threads the
        // snapshot missed (e.g. outside the per-repo window), never ACP shells
        // that only inherit a folder name and read as blank/wrong rows.
        for (s in sessions) {
            if (s.id in seenSession) continue
            if (s.desktopThreadId.isBlank()) continue
            if (s.desktopThreadId in seenThread) continue
            seenThread += s.desktopThreadId
            seenSession += s.id
            val key = folderKey(s.folder)
            val idx = repos.indexOfFirst { folderKey(it.folder) == key }
            if (idx >= 0) {
                val repo = repos[idx]
                repos[idx] = repo.copy(chats = (repo.chats + sessionChat(s)).sortedByDescending { it.at })
            } else {
                repos +=
                    RailRepo(
                        folder = s.folder,
                        name = folderName(s.folder).ifBlank { "No Repo" },
                        kind = if (s.folder.isBlank()) "home" else "folder",
                        chats = listOf(sessionChat(s)),
                    )
            }
        }
        return repos
    }

    private fun reposFromSessionsAndChats(
        sessions: List<SessionMeta>,
        recentChats: List<JSONObject>,
    ): List<RailRepo> {
        val byKey = linkedMapOf<String, RailRepo>()
        fun ensure(folder: String, name: String = folderName(folder)): RailRepo {
            val key = folderKey(folder).ifBlank { "norepo" }
            return byKey.getOrPut(key) {
                RailRepo(
                    folder = folder,
                    name = name.ifBlank { if (folder.isBlank()) "No Repo" else folderName(folder) },
                    kind = if (folder.isBlank()) "home" else "folder",
                )
            }
        }

        val openThreads = sessions.map { it.desktopThreadId }.filter { it.isNotBlank() }.toSet()
        for (s in sessions) {
            // Prefer desktop-backed rows; skip nameless Auto shells.
            if (s.desktopThreadId.isBlank() && isGenericTitle(s.title, s.folder)) continue
            val repo = ensure(s.folder)
            byKey[folderKey(s.folder).ifBlank { "norepo" }] =
                repo.copy(chats = repo.chats + sessionChat(s))
        }
        for (c in recentChats) {
            val chatId = c.optString("id")
            if (chatId.isBlank() || chatId in openThreads) continue
            val folder = c.optString("folder")
            val cursorTitle = c.optString("title")
            if (isGenericTitle(cursorTitle, folder) && cursorTitle.isBlank()) continue
            val repo = ensure(folder, c.optString("project").ifBlank { folderName(folder) })
            val key = folderKey(folder).ifBlank { "norepo" }
            byKey[key] =
                repo.copy(
                    chats =
                        repo.chats +
                            RailChat(
                                key = "c:$chatId",
                                chatId = chatId,
                                title = pickTitle(cursorTitle, "", folder),
                                folder = folder,
                                at = parseTime(c.opt("updatedAt") ?: c.opt("at") ?: c.opt("createdAt")),
                            ),
                )
        }
        return byKey.values
            .map { it.copy(chats = it.chats.sortedByDescending { c -> c.at }) }
            .sortedWith(
                compareByDescending<RailRepo> { it.chats.isNotEmpty() }
                    .thenByDescending { it.chats.maxOfOrNull { c -> c.at } ?: 0L }
                    .thenBy { it.name.lowercase() },
            )
    }
}
