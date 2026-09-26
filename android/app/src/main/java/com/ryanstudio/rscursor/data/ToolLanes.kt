package com.ryanstudio.rscursor.data

/**
 * Cursor-style tool lanes — port of `src/web/desktop-tool-ui.js` so Android
 * paints the same work fold and live subtask line as the web / IDE.
 */
object ToolLanes {
    private val HIDE =
        setOf(
            "unspecified",
            "reapply",
            "background_composer_followup",
            "knowledge_base",
            "fetch_pull_request",
            "create_diagram",
            "task",
            "await_task",
            "apply_agent_diff",
            "report_bugfix_results",
            "mcp--",
            "tool",
            "ask_question",
        )

    private val FILE_CHANGE =
        mapOf(
            "edit_file_v2" to Lane("fileChange", "edit", "Edit file", "Edited"),
            "edit_file" to Lane("fileChange", "edit", "Edit file", "Edited"),
            "delete_file" to Lane("fileChange", "delete", "Delete file", "Deleted"),
        )

    private val GROUP =
        mapOf(
            "read_file_v2" to Lane("group", "read", "Read file", "Read"),
            "read_file" to Lane("group", "read", "Read file", "Read"),
            "ripgrep_raw_search" to Lane("group", "search", "Search", "Search"),
            "ripgrep_search" to Lane("group", "search", "Search", "Search"),
            "glob_file_search" to Lane("group", "search", "Find files", "Find"),
            "file_search" to Lane("group", "search", "Find files", "Find"),
            "list_dir_v2" to Lane("group", "read", "List directory", "List"),
            "list_dir" to Lane("group", "read", "List directory", "List"),
            "read_lints" to Lane("group", "read", "Read lints", "Lints"),
            "web_search" to Lane("group", "search", "Search web", "Web"),
            "web_fetch" to Lane("group", "fetch", "Fetch webpage", "Fetch"),
            "await" to Lane("group", "other", "Await", "Await"),
            "get_mcp_tools" to Lane("group", "other", "Get MCP tools", "MCP tools"),
            "semantic_search_full" to Lane("group", "search", "Semantic search", "Search"),
            "todo_read" to Lane("group", "read", "Read todos", "Todos"),
            "fetch_rules" to Lane("group", "read", "Fetch rules", "Rules"),
            "read_semsearch_files" to Lane("group", "read", "Read search files", "Read"),
            "search_symbols" to Lane("group", "search", "Search symbols", "Symbols"),
            "go_to_definition" to Lane("group", "read", "Go to definition", "Definition"),
        )

    private val CARD =
        mapOf(
            "run_terminal_command_v2" to Lane("card", "execute", "Run command", "Run"),
            "todo_write" to Lane("card", "other", "Update todos", "Todos"),
            "task_v2" to Lane("card", "other", "Task", "Task"),
            "create_plan" to Lane("card", "plan", "Create plan", "Plan"),
            "switch_mode" to Lane("card", "other", "Switch mode", "Mode"),
            "generate_image" to Lane("card", "other", "Generate image", "Image"),
            "computer_use" to Lane("card", "other", "Computer use", "Computer"),
            "mcp_auth" to Lane("card", "other", "Authenticate MCP", "Auth"),
            "connect_scm" to Lane("card", "other", "Connect GitHub", "GitHub"),
            "read_mcp_resource" to Lane("card", "fetch", "Read MCP resource", "Resource"),
            "record_screen" to Lane("card", "other", "Screen recording", "Record"),
        )

    private val BY_KIND =
        mapOf(
            "edit" to Lane("fileChange", "edit", "Edit file", "Edited"),
            "delete" to Lane("fileChange", "delete", "Delete file", "Deleted"),
            "read" to Lane("group", "read", "Read file", "Read"),
            "search" to Lane("group", "search", "Search", "Search"),
            "fetch" to Lane("group", "fetch", "Fetch", "Fetch"),
        )

    private val LIVE_ACTION =
        mapOf(
            "run_terminal_command_v2" to "Running",
            "run_terminal_cmd" to "Running",
            "shell" to "Running",
            "read_file_v2" to "Reading",
            "read_file" to "Reading",
            "ripgrep_raw_search" to "Grepping",
            "ripgrep_search" to "Grepping",
            "glob_file_search" to "Searching files",
            "file_search" to "Searching files",
            "edit_file_v2" to "Editing",
            "edit_file" to "Editing",
            "delete_file" to "Deleting",
            "list_dir_v2" to "Listing",
            "list_dir" to "Listing",
            "read_lints" to "Reading lints",
            "web_search" to "Searching web",
            "web_fetch" to "Fetching page",
            "semantic_search_full" to "Searching",
            "create_plan" to "Writing plan",
            "await" to "Waiting",
            "todo_write" to "Updating todos",
            "todo_read" to "Reading todos",
            "task_v2" to "Working on task",
            "generate_image" to "Generating image",
            "switch_mode" to "Switching mode",
            "computer_use" to "Using computer",
            "record_screen" to "Recording screen",
            "mcp_auth" to "Authenticating MCP server",
            "connect_scm" to "Connecting GitHub",
            "read_mcp_resource" to "Reading resource",
            "get_mcp_tools" to "Exploring tools",
        )

    data class Lane(
        val lane: String,
        val toolKind: String,
        val label: String,
        val short: String,
    )

    data class WorkStep(
        val key: String,
        val label: String,
        val status: String,
    )

    data class WorkFold(
        val key: String,
        val summary: String,
        val steps: List<WorkStep>,
        val liveStep: String?,
        val live: Boolean,
    )

    /** Painted row: either a normal chat item or a Cursor work fold. */
    sealed class Row {
        data class Item(val item: ChatItem) : Row()
        data class Fold(val fold: WorkFold) : Row()
        data class LiveStrip(val text: String) : Row()
    }

    fun keyOf(title: String): String = title.trim().lowercase()

    fun isBrowser(title: String): Boolean = keyOf(title).contains("browser")

    fun isNamelessMcp(title: String): Boolean = keyOf(title).let { it.isNotEmpty() && Regex("(?:^|: )tool$").containsMatchIn(it) }

    fun classify(tool: ChatItem.Tool): Lane {
        val key = keyOf(tool.title)
        if (isNamelessMcp(tool.title) || key in HIDE) {
            return Lane("hide", "other", "tool", "tool")
        }
        if (tool.command.isNotBlank()) {
            if (isSimpleLs(tool.command)) {
                return Lane("group", "execute", "List directory", "List")
            }
            return Lane("card", "execute", tool.command, "Run")
        }
        FILE_CHANGE[key]?.let { return it }
        GROUP[key]?.let { return it }
        CARD[key]?.let { return it }
        BY_KIND[tool.toolKind]?.let { return it }
        val kind =
            tool.toolKind.takeIf { it.isNotBlank() && it != "other" && it != "tool" } ?: "other"
        return Lane("card", kind, tool.title.ifBlank { kind }, tool.title.ifBlank { kind })
    }

    fun toolBase(path: String): String {
        val s = path.replace('\\', '/')
        return s.split('/').filter { it.isNotEmpty() }.lastOrNull() ?: s
    }

    fun skillName(path: String): String {
        val s = path.replace('\\', '/')
        val m = Regex("/(?:skills-cursor|skills)/([^/]+)/SKILL\\.md$", RegexOption.IGNORE_CASE).find(s)
        return m?.groupValues?.getOrNull(1).orEmpty()
    }

    fun stepShown(tool: ChatItem.Tool): Boolean {
        val ui = classify(tool)
        if (ui.lane == "hide") return false
        if (isBrowser(tool.title)) return true
        if (ui.lane == "group" && skillName(tool.path).isNotEmpty()) return true
        if (ui.lane == "fileChange") return true
        if (ui.toolKind == "execute" && ui.lane != "group") return true
        return false
    }

    fun displayLabel(tool: ChatItem.Tool): String {
        val ui = classify(tool)
        val skill = if (ui.lane == "group") skillName(tool.path) else ""
        if (skill.isNotEmpty()) return "Used $skill"
        if (isBrowser(tool.title)) {
            val raw =
                tool.title
                    .replace(Regex("^mcp-cursor-ide-browser-"), "")
                    .replace(Regex("^browser_"), "")
                    .replace('_', ' ')
                    .trim()
            val nice = if (raw.isNotEmpty()) raw.replaceFirstChar { it.uppercase() } else "action"
            return "Browser $nice"
        }
        if (tool.command.isNotBlank() && ui.lane != "group") {
            val line =
                tool.commandDescription.ifBlank {
                    tool.command.replace(Regex("\\s+"), " ").trim()
                }
            return "Ran $line"
        }
        val base = toolBase(tool.path)
        if (ui.lane == "fileChange") {
            val verb = if (ui.toolKind == "delete") "Deleted" else "Edited"
            return if (base.isNotEmpty()) "$verb $base" else ui.label
        }
        if (base.isNotEmpty() && (ui.lane == "group" || ui.toolKind == "read" || ui.toolKind == "search")) {
            return "${ui.label} $base"
        }
        if (tool.query.isNotBlank()) return tool.query.trim()
        if (tool.pattern.isNotBlank()) return tool.pattern.trim()
        return ui.label.ifBlank { tool.title.ifBlank { "tool" } }
    }

    fun liveStepLabel(tool: ChatItem.Tool): String {
        val ui = classify(tool)
        val skill = if (ui.lane == "group") skillName(tool.path) else ""
        if (skill.isNotEmpty()) return "Using $skill"
        val action = liveActionFor(tool, ui)
        val details = liveDetailsFor(tool, ui)
        return if (details.isNotEmpty()) "$action $details" else action
    }

    fun workSummary(tools: List<ChatItem.Tool>, live: Boolean): String {
        var files = 0
        var searches = 0
        var edits = 0
        var commands = 0
        var browsers = 0
        var running = live
        for (tool in tools) {
            val ui = classify(tool)
            if (ui.lane == "hide") continue
            if (tool.status == "in_progress" || tool.status == "pending") running = true
            when {
                ui.lane == "fileChange" -> edits++
                isBrowser(tool.title) -> browsers++
                ui.toolKind == "search" -> searches++
                ui.toolKind == "execute" && ui.lane != "group" -> commands++
                else -> files++
            }
        }
        if (edits == 0 && commands == 0 && browsers == 0) {
            return activityCopy(files, searches, running)
        }
        val clauses = mutableListOf<String>()
        if (edits > 0) {
            clauses +=
                "${if (running) "editing" else "edited"} $edits ${word(edits, "file")}"
        }
        if (files > 0 || searches > 0 || browsers > 0) {
            val explorePresent = running && edits == 0 && (files > 0 || searches > 0)
            val bits = mutableListOf<String>()
            if (files > 0 || searches > 0) {
                bits += if (explorePresent) "exploring" else "explored"
            }
            if (files > 0) bits += "$files ${word(files, "file")}"
            if (searches > 0) {
                if (files > 0) bits[bits.lastIndex] = bits.last() + ","
                bits += "$searches ${word(searches, "search", "searches")}"
            }
            if (browsers > 0) {
                if (files > 0 || searches > 0) bits[bits.lastIndex] = bits.last() + ","
                bits += "$browsers ${word(browsers, "browser action")}"
            }
            clauses += bits.joinToString(" ")
        }
        if (commands > 0) {
            val cmdPresent = running && edits == 0 && files == 0 && searches == 0 && browsers == 0
            clauses +=
                "${if (cmdPresent) "running" else "ran"} $commands ${word(commands, "command")}"
        }
        return clauses
            .mapIndexed { i, c ->
                if (i == 0) c.replaceFirstChar { it.uppercase() } else c
            }
            .joinToString(", ")
    }

    /**
     * Collapse consecutive tool rows into Cursor work folds; leave everything
     * else alone. While [busy], the open fold shows a present-tense live step,
     * or a Thinking / Planning strip when no tools have started yet.
     */
    fun project(items: List<ChatItem>, busy: Boolean): List<Row> {
        val out = ArrayList<Row>()
        var i = 0
        var emittedToolFold = false
        while (i < items.size) {
            val item = items[i]
            if (item is ChatItem.Tool) {
                val batch = ArrayList<ChatItem.Tool>()
                while (i < items.size && items[i] is ChatItem.Tool) {
                    val t = items[i] as ChatItem.Tool
                    if (classify(t).lane != "hide") batch += t
                    i++
                }
                if (batch.isEmpty()) continue
                val live = busy && batch.any { it.status == "in_progress" || it.status == "pending" }
                val steps =
                    batch.filter { stepShown(it) }.map {
                        WorkStep(key = it.key, label = displayLabel(it), status = it.status)
                    }
                val liveStep =
                    if (busy) {
                        batch.asReversed().firstOrNull {
                            it.status == "in_progress" || it.status == "pending"
                        }?.let { liveStepLabel(it) }
                            ?: if (live || busy) "Planning next moves" else null
                    } else {
                        null
                    }
                out +=
                    Row.Fold(
                        WorkFold(
                            key = "fold-${batch.first().toolCallId}",
                            summary = workSummary(batch, live = busy),
                            steps = steps,
                            liveStep = liveStep,
                            live = busy,
                        ),
                    )
                emittedToolFold = true
            } else {
                out += Row.Item(item)
                i++
            }
        }
        if (busy && !emittedToolFold) {
            val thinking = items.any { it is ChatItem.Assistant && it.thought }
            out += Row.LiveStrip(if (thinking) "Thinking" else "Planning next moves")
        } else if (busy && emittedToolFold) {
            val last = out.lastOrNull()
            if (last is Row.Fold && last.fold.liveStep == null) {
                val thinking = items.any { it is ChatItem.Assistant && it.thought }
                out[out.lastIndex] =
                    Row.Fold(
                        last.fold.copy(
                            liveStep = if (thinking) "Thinking" else "Planning next moves",
                            live = true,
                        ),
                    )
            }
        }
        return out
    }

    private fun liveActionFor(tool: ChatItem.Tool, ui: Lane): String {
        val key = keyOf(tool.title)
        LIVE_ACTION[key]?.let { return it }
        if (isBrowser(tool.title)) return "Running"
        return when (ui.toolKind) {
            "execute" -> "Running"
            "delete" -> "Deleting"
            "edit" -> "Editing"
            "read" -> "Reading"
            "search" -> if (key.contains("grep")) "Grepping" else "Searching"
            "fetch" -> "Fetching"
            "plan" -> "Writing plan"
            else -> ui.short.ifBlank { ui.label }.ifBlank { "Running" }
        }
    }

    private fun liveDetailsFor(tool: ChatItem.Tool, ui: Lane): String {
        if (tool.command.isNotBlank() && ui.lane != "group" && ui.toolKind == "execute") {
            return tool.commandDescription.ifBlank {
                tool.command.replace(Regex("\\s+"), " ").trim().ifBlank { "command" }
            }
        }
        if (ui.toolKind == "search" || keyOf(tool.title).let { it.contains("grep") || it.contains("search") || it.contains("glob") || it.contains("find") }) {
            val pattern = tool.pattern.ifBlank { tool.query }.trim()
            val where = toolBase(tool.path)
            if (pattern.isNotEmpty() && where.isNotEmpty()) return "$pattern in $where"
            if (pattern.isNotEmpty()) return pattern
            if (where.isNotEmpty()) return where
        }
        val base = toolBase(tool.path)
        if (base.isNotEmpty()) return base
        if (tool.query.isNotBlank()) return tool.query.trim()
        if (isBrowser(tool.title)) {
            return tool.title
                .replace(Regex("^mcp-cursor-ide-browser-"), "")
                .replace(Regex("^browser_"), "")
                .replace('_', ' ')
                .trim()
        }
        return ""
    }

    private fun activityCopy(files: Int, searches: Int, running: Boolean): String {
        val fileWord = word(files, "file")
        val searchWord = word(searches, "search", "searches")
        return when {
            running && files > 0 && searches > 0 ->
                "Exploring $files $fileWord, $searches $searchWord"
            running && searches > 0 -> "Exploring $searches $searchWord"
            running && files > 0 -> "Exploring $files $fileWord"
            running -> "Exploring"
            files > 0 && searches > 0 -> "Explored $files $fileWord, $searches $searchWord"
            searches > 0 -> "Searched $searches $fileWord"
            files > 0 -> "Explored $files $fileWord"
            else -> "Explored"
        }
    }

    private fun word(n: Int, one: String, many: String = "${one}s"): String =
        if (n == 1) one else many

    private fun isSimpleLs(command: String): Boolean {
        val t = command.trim()
        if (t.isEmpty() || !Regex("^\\s*ls(\\s|$)", RegexOption.IGNORE_CASE).containsMatchIn(t)) {
            return false
        }
        if (Regex("[|;&]|&&|\\|\\|").containsMatchIn(t)) return false
        if (Regex("\\$\\(|`|[><]").containsMatchIn(t)) return false
        return true
    }
}
