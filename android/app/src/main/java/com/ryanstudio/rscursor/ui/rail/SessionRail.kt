package com.ryanstudio.rscursor.ui.rail

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ryanstudio.rscursor.data.RailBuilder
import com.ryanstudio.rscursor.data.RailChat
import com.ryanstudio.rscursor.data.RailPinned
import com.ryanstudio.rscursor.data.RailRepo
import com.ryanstudio.rscursor.ui.theme.RsAccent
import com.ryanstudio.rscursor.ui.theme.RsMuted
import com.ryanstudio.rscursor.ui.theme.RsSpace
import com.ryanstudio.rscursor.ui.theme.RsText

private val RailCorner = RoundedCornerShape(RsSpace.cornerSm)
private val PreviewLimit = 5
private val PinnedPreview = 8

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun SessionRail(
    pinned: List<RailPinned>,
    repos: List<RailRepo>,
    activeSessionId: String?,
    activeDesktopThreadId: String?,
    onOpenChat: (RailChat) -> Unit,
    onOpenPinned: (RailPinned) -> Unit,
    onPinChat: (RailChat) -> Unit,
    onUnpinChat: (RailChat) -> Unit,
    onArchiveChat: (RailChat) -> Unit,
    onUnpinPinned: (RailPinned) -> Unit,
    onArchivePinned: (RailPinned) -> Unit,
    onNew: () -> Unit,
    onNewInFolder: (String) -> Unit,
    onToggleRepo: (String) -> Unit,
    onSettings: () -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val pinnedIds = remember(pinned) { pinned.map { it.id }.toSet() }
    var filter by remember { mutableStateOf("") }
    var filterOpen by remember { mutableStateOf(false) }
    var expandedMore by remember { mutableStateOf(setOf<String>()) }
    var pinnedExpanded by remember { mutableStateOf(false) }

    val needle = filter.trim().lowercase()
    val visibleRepos =
        remember(repos, needle) {
            if (needle.isEmpty()) {
                repos
            } else {
                repos.mapNotNull { repo ->
                    val chats =
                        repo.chats.filter {
                            it.title.lowercase().contains(needle) ||
                                repo.name.lowercase().contains(needle)
                        }
                    if (chats.isEmpty() && !repo.name.lowercase().contains(needle)) null
                    else repo.copy(chats = chats, collapsed = false)
                }
            }
        }
    val pinnedVisible =
        remember(pinned, needle) {
            if (needle.isEmpty()) pinned
            else pinned.filter { it.name.lowercase().contains(needle) }
        }
    val pinnedShown =
        if (pinnedExpanded || needle.isNotEmpty() || pinnedVisible.size <= PinnedPreview) {
            pinnedVisible
        } else {
            pinnedVisible.take(PinnedPreview)
        }

    Column(
        modifier =
            modifier
                .width(RsSpace.railWidth)
                .fillMaxHeight()
                .padding(start = 2.dp, end = 2.dp, bottom = 2.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(start = 4.dp, end = 0.dp, top = 2.dp),
        ) {
            Text(
                text = "Agents",
                color = RsText,
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp,
                modifier = Modifier.weight(1f).padding(start = 8.dp),
            )
            IconButton(onClick = onClose, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.Close, contentDescription = "关闭侧栏", tint = RsMuted, modifier = Modifier.size(16.dp))
            }
        }

        RailAction(
            icon = Icons.Default.Add,
            label = "New Chat",
            onClick = onNew,
        )
        RailAction(
            icon = Icons.Default.Search,
            label = if (filterOpen) "Search…" else "Search",
            onClick = { filterOpen = !filterOpen },
            accent = filterOpen,
        )
        AnimatedVisibility(visible = filterOpen) {
            BasicTextField(
                value = filter,
                onValueChange = { filter = it },
                singleLine = true,
                textStyle = TextStyle(color = RsText, fontSize = 13.sp),
                cursorBrush = SolidColor(RsAccent),
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp, vertical = 2.dp)
                        .clip(RailCorner)
                        .background(Color.White.copy(alpha = 0.06f))
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                decorationBox = { inner ->
                    if (filter.isEmpty()) {
                        Text("Filter chats…", color = RsMuted, fontSize = 13.sp)
                    }
                    inner()
                },
            )
        }
        RailAction(
            icon = Icons.Default.Settings,
            label = "Settings",
            onClick = onSettings,
            muted = true,
        )

        Spacer(modifier = Modifier.height(4.dp))

        LazyColumn(
            modifier = Modifier.weight(1f).fillMaxWidth(),
            contentPadding = PaddingValues(bottom = 8.dp),
            verticalArrangement = Arrangement.spacedBy(1.dp),
        ) {
            if (pinnedVisible.isNotEmpty()) {
                item(key = "sec-pinned") {
                    SectionLabel("Pinned")
                }
                items(pinnedShown, key = { "pin:${it.id}" }) { pin ->
                    PinnedRow(
                        pin = pin,
                        selected =
                            pin.id == activeDesktopThreadId ||
                                (activeDesktopThreadId.isNullOrBlank() && pin.id == activeSessionId),
                        onClick = { onOpenPinned(pin) },
                        onUnpin = { onUnpinPinned(pin) },
                        onArchive = { onArchivePinned(pin) },
                    )
                }
                if (pinnedVisible.size > pinnedShown.size) {
                    item(key = "pin-more") {
                        Text(
                            "More (${pinnedVisible.size - pinnedShown.size})",
                            color = RsAccent,
                            fontSize = 12.sp,
                            modifier =
                                Modifier
                                    .padding(start = 14.dp, top = 2.dp, bottom = 4.dp)
                                    .clip(RailCorner)
                                    .clickable { pinnedExpanded = true }
                                    .padding(horizontal = 8.dp, vertical = 4.dp),
                        )
                    }
                }
            }

            item(key = "sec-repos") {
                SectionLabel("Repositories")
            }

            if (visibleRepos.isEmpty() && pinnedVisible.isEmpty()) {
                item(key = "empty") {
                    Text(
                        "No projects yet — start a new chat.",
                        color = RsMuted,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                    )
                }
            }

            visibleRepos.forEach { repo ->
                val repoKey = RailBuilder.folderKey(repo.folder).ifBlank { repo.name }
                val open = !repo.collapsed || needle.isNotEmpty()
                val showAll = repoKey in expandedMore || needle.isNotEmpty()
                val chats = if (showAll) repo.chats else repo.chats.take(PreviewLimit)

                item(key = "repo:$repoKey") {
                    RepoHead(
                        repo = repo,
                        open = open,
                        onToggle = { onToggleRepo(repo.folder) },
                        onAdd = { onNewInFolder(repo.folder) },
                    )
                }
                if (open) {
                    if (chats.isEmpty()) {
                        item(key = "empty:$repoKey") {
                            Text(
                                "No chats yet.",
                                color = RsMuted,
                                fontSize = 11.sp,
                                modifier = Modifier.padding(start = 28.dp, top = 2.dp, bottom = 6.dp),
                            )
                        }
                    } else {
                        items(chats, key = { "c:$repoKey:${it.key}" }) { chat ->
                            ChatRow(
                                chat = chat,
                                selected = isSelected(chat, activeSessionId, activeDesktopThreadId),
                                indented = true,
                                pinned = !chat.chatId.isNullOrBlank() && chat.chatId in pinnedIds,
                                onClick = { onOpenChat(chat) },
                                onPin = { onPinChat(chat) },
                                onUnpin = { onUnpinChat(chat) },
                                onArchive = { onArchiveChat(chat) },
                            )
                        }
                        if (!showAll && repo.chats.size > PreviewLimit) {
                            item(key = "more:$repoKey") {
                                Text(
                                    "More",
                                    color = RsAccent,
                                    fontSize = 12.sp,
                                    modifier =
                                        Modifier
                                            .padding(start = 28.dp, top = 2.dp, bottom = 4.dp)
                                            .clip(RailCorner)
                                            .clickable {
                                                expandedMore = expandedMore + repoKey
                                            }
                                            .padding(horizontal = 8.dp, vertical = 4.dp),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text,
        color = RsMuted,
        fontSize = 11.sp,
        fontWeight = FontWeight.Medium,
        modifier = Modifier.padding(start = 10.dp, top = 6.dp, bottom = 2.dp, end = 8.dp),
    )
}

@Composable
private fun RailAction(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit,
    accent: Boolean = false,
    muted: Boolean = false,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 4.dp, vertical = 0.dp)
                .clip(RailCorner)
                .background(if (accent) Color.White.copy(alpha = 0.08f) else Color.Transparent)
                .clickable(onClick = onClick)
                .padding(horizontal = RsSpace.railRowH, vertical = RsSpace.railRowV),
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = if (muted) RsMuted else RsText,
            modifier = Modifier.size(16.dp),
        )
        Spacer(modifier = Modifier.width(10.dp))
        Text(
            label,
            color = if (muted) RsMuted else RsText,
            fontSize = 13.sp,
            maxLines = 1,
        )
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun PinnedRow(
    pin: RailPinned,
    selected: Boolean,
    onClick: () -> Unit,
    onUnpin: () -> Unit,
    onArchive: () -> Unit,
) {
    var menu by remember { mutableStateOf(false) }
    val bg =
        if (selected) {
            Color.White.copy(alpha = 0.12f)
        } else {
            Color.Transparent
        }
    Box {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 4.dp)
                    .clip(RailCorner)
                    .background(bg)
                    .combinedClickable(
                        onClick = onClick,
                        onLongClick = { menu = true },
                    )
                    .padding(horizontal = RsSpace.railRowH, vertical = RsSpace.railRowV),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(7.dp)
                        .clip(CircleShape)
                        .background(pinColor(pin.color.ifBlank { pin.name })),
            )
            Spacer(modifier = Modifier.width(10.dp))
            Text(
                pin.name,
                color = if (selected) RsAccent else RsText,
                fontSize = 13.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            val age = RailBuilder.relTime(pin.at)
            if (age.isNotEmpty()) {
                Text(age, color = RsMuted, fontSize = 11.sp)
            }
        }
        DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
            DropdownMenuItem(
                text = { Text("Unpin") },
                onClick = {
                    menu = false
                    onUnpin()
                },
            )
            DropdownMenuItem(
                text = { Text("Archive") },
                onClick = {
                    menu = false
                    onArchive()
                },
            )
        }
    }
}

@Composable
private fun RepoHead(
    repo: RailRepo,
    open: Boolean,
    onToggle: () -> Unit,
    onAdd: () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 4.dp, vertical = 0.dp)
                .clip(RailCorner)
                .clickable(onClick = onToggle)
                .padding(start = 4.dp, end = 2.dp, top = 3.dp, bottom = 3.dp),
    ) {
        Icon(
            if (open) Icons.Default.KeyboardArrowDown else Icons.AutoMirrored.Filled.KeyboardArrowRight,
            contentDescription = null,
            tint = RsMuted,
            modifier = Modifier.size(16.dp),
        )
        Spacer(modifier = Modifier.width(4.dp))
        Icon(
            if (repo.kind == "home") Icons.Default.Home else Icons.Default.Folder,
            contentDescription = null,
            tint = RsMuted,
            modifier = Modifier.size(14.dp),
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            repo.name.ifBlank { "No Repo" },
            color = RsText,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        if (repo.chats.isNotEmpty()) {
            Text(
                "${repo.chats.size}",
                color = RsMuted,
                fontSize = 11.sp,
                modifier = Modifier.padding(end = 4.dp),
            )
        }
        Box(
            modifier =
                Modifier
                    .size(26.dp)
                    .clip(RailCorner)
                    .clickable(onClick = onAdd),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Default.Add, contentDescription = "新建", tint = RsMuted, modifier = Modifier.size(14.dp))
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ChatRow(
    chat: RailChat,
    selected: Boolean,
    indented: Boolean,
    pinned: Boolean,
    onClick: () -> Unit,
    onPin: () -> Unit,
    onUnpin: () -> Unit,
    onArchive: () -> Unit,
) {
    var menu by remember { mutableStateOf(false) }
    val bg =
        when {
            selected -> Color.White.copy(alpha = 0.12f)
            else -> Color.Transparent
        }
    val canPin = !chat.chatId.isNullOrBlank()
    Box {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 4.dp)
                    .clip(RailCorner)
                    .background(bg)
                    .combinedClickable(
                        onClick = onClick,
                        onLongClick = { menu = true },
                    )
                    .padding(
                        start = if (indented) 24.dp else RsSpace.railRowH,
                        end = RsSpace.railRowH,
                        top = RsSpace.railRowV,
                        bottom = RsSpace.railRowV,
                    ),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(6.dp)
                        .clip(CircleShape)
                        .background(if (selected) RsAccent else RsMuted.copy(alpha = 0.55f)),
            )
            Spacer(modifier = Modifier.width(10.dp))
            Text(
                chat.title.ifBlank { "Untitled chat" },
                color = if (selected) RsAccent else RsText,
                fontSize = 13.sp,
                fontWeight = if (selected) FontWeight.Medium else FontWeight.Normal,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            val age = RailBuilder.relTime(chat.at)
            if (age.isNotEmpty()) {
                Text(age, color = RsMuted, fontSize = 11.sp)
            }
        }
        DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
            if (canPin) {
                DropdownMenuItem(
                    text = { Text(if (pinned) "Unpin" else "Pin") },
                    onClick = {
                        menu = false
                        if (pinned) onUnpin() else onPin()
                    },
                )
            }
            DropdownMenuItem(
                text = { Text("Archive") },
                onClick = {
                    menu = false
                    onArchive()
                },
            )
        }
    }
}

private fun isSelected(
    chat: RailChat,
    activeSessionId: String?,
    activeDesktopThreadId: String?,
): Boolean {
    if (!chat.sessionId.isNullOrBlank() && chat.sessionId == activeSessionId) return true
    if (!chat.chatId.isNullOrBlank() && chat.chatId == activeDesktopThreadId) return true
    return false
}

private fun pinColor(name: String): Color {
    val known =
        mapOf(
            "green" to Color(0xFF3DD68C),
            "blue" to Color(0xFF6EA8FE),
            "orange" to Color(0xFFE6A15C),
            "purple" to Color(0xFFC084FC),
            "red" to Color(0xFFF07178),
            "yellow" to Color(0xFFE6C15C),
        )
    known[name.lowercase()]?.let { return it }
    var n = 0
    for (ch in name) n = (n * 33 + ch.code) ushr 0
    val hue = (n % 360).toFloat()
    return Color.hsl(hue, 0.62f, 0.58f)
}
