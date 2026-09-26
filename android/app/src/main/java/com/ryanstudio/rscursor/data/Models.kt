package com.ryanstudio.rscursor.data

/** Session row from the host `sessions` / `hello` payload. */
data class SessionMeta(
    val id: String,
    val title: String,
    val folder: String = "",
    val status: String = "idle",
    val agent: String = "cursor",
    val model: String = "",
    val modelName: String = "",
    val mode: String = "",
    val kind: String = "",
    val active: Boolean = false,
)

data class CatalogItem(
    val id: String,
    val name: String,
)

data class Catalog(
    val models: List<CatalogItem> = emptyList(),
    val modes: List<CatalogItem> = emptyList(),
)

data class ImagePart(
    val mimeType: String = "image/png",
    val data: String? = null,
    val path: String? = null,
    val url: String? = null,
    val name: String = "image",
)

data class PermOption(
    val optionId: String,
    val name: String,
    val kind: String = "",
)

/** One painted row in the native transcript. */
sealed class ChatItem {
    abstract val key: String

    data class User(
        override val key: String,
        val text: String,
        val images: List<ImagePart> = emptyList(),
        val waiting: Boolean = false,
    ) : ChatItem()

    data class Assistant(
        override val key: String,
        val text: String,
        val thought: Boolean = false,
    ) : ChatItem()

    data class Tool(
        override val key: String,
        val toolCallId: String,
        val title: String,
        val status: String,
    ) : ChatItem()

    data class Permission(
        override val key: String,
        val requestId: String,
        val title: String,
        val options: List<PermOption>,
        val resolved: Boolean = false,
        val outcome: String = "",
    ) : ChatItem()

    data class Question(
        override val key: String,
        val askId: String,
        val title: String,
        val prompt: String,
        val options: List<PermOption>,
        val answered: Boolean = false,
    ) : ChatItem()

    data class Notice(
        override val key: String,
        val text: String,
        val error: Boolean = false,
    ) : ChatItem()

    data class Status(
        override val key: String,
        val text: String,
    ) : ChatItem()
}

data class QueueItem(
    val id: String,
    val text: String,
)

data class LocalAttachment(
    val mimeType: String,
    val dataBase64: String,
    val displayUri: String,
    val name: String,
)

enum class ConnPhase {
    NoHost,
    Connecting,
    Connected,
    Reconnecting,
}

data class HostUiState(
    val hostUrl: String = "",
    val phase: ConnPhase = ConnPhase.NoHost,
    val sessionsReady: Boolean = false,
    val transcriptReady: Boolean = false,
    val reconnecting: Boolean = false,
    val sessions: List<SessionMeta> = emptyList(),
    val sessionId: String? = null,
    val meta: SessionMeta? = null,
    val items: List<ChatItem> = emptyList(),
    val draft: String = "",
    val attachments: List<LocalAttachment> = emptyList(),
    val catalog: Catalog = Catalog(),
    val busy: Boolean = false,
    val queue: List<QueueItem> = emptyList(),
    val banner: String? = null,
    val railOpen: Boolean = true,
)
