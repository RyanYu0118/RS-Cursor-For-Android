package com.ryanstudio.rscursor.ui.rail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Archive
import androidx.compose.material.icons.outlined.CallSplit
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.NotificationAdd
import androidx.compose.material.icons.outlined.PushPin
import androidx.compose.material.icons.outlined.SentimentSatisfied
import androidx.compose.material.icons.outlined.SwapHoriz
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ryanstudio.rscursor.data.IconPickerState
import com.ryanstudio.rscursor.data.MenuMoveState
import com.ryanstudio.rscursor.data.RailMenuTarget
import com.ryanstudio.rscursor.ui.theme.GlassButton
import com.ryanstudio.rscursor.ui.theme.GlassChoiceChip
import com.ryanstudio.rscursor.ui.theme.GlassDialog
import com.ryanstudio.rscursor.ui.theme.GlassMenu
import com.ryanstudio.rscursor.ui.theme.GlassMenuDivider
import com.ryanstudio.rscursor.ui.theme.GlassMenuItem
import com.ryanstudio.rscursor.ui.theme.GlassMenuNote
import com.ryanstudio.rscursor.ui.theme.GlassSubmenu
import com.ryanstudio.rscursor.ui.theme.GlassTextField
import com.ryanstudio.rscursor.ui.theme.RsAccent
import com.ryanstudio.rscursor.ui.theme.RsMuted
import kotlinx.coroutines.delay

private val CopyItems =
    listOf(
        "agent-id" to "Copy Agent ID",
        "branch" to "Copy Branch",
        "transcript" to "Copy Transcript",
    )

private val SubIndent = 28.dp

/**
 * Cursor's row menu, mirrored: every action is done by the host through
 * Cursor's own services. "Move to" is read from Cursor when opened.
 */
@Composable
fun ChatRowMenu(
    expanded: Boolean,
    onDismiss: () -> Unit,
    target: RailMenuTarget,
    menuMove: MenuMoveState?,
    onAction: (RailMenuTarget, String, String?) -> Unit,
    onLoadMove: (String) -> Unit,
    onEditIcon: (RailMenuTarget) -> Unit,
) {
    var sub by remember { mutableStateOf<String?>(null) }
    var renaming by remember { mutableStateOf(false) }
    val close = {
        sub = null
        onDismiss()
    }
    val act = { action: String, arg: String? ->
        close()
        onAction(target, action, arg)
    }
    val chatId = target.chatId

    GlassMenu(expanded = expanded, onDismissRequest = close) {
        if (chatId.isNullOrBlank()) {
            // An Auto-only session has no row in Cursor to act on.
            GlassMenuItem("Archive", icon = Icons.Outlined.Archive, onClick = { act("archive", null) })
            return@GlassMenu
        }
        GlassMenuItem(
            if (target.pinned) "Unpin" else "Pin",
            icon = Icons.Outlined.PushPin,
            onClick = { act(if (target.pinned) "unpin" else "pin", null) },
        )
        GlassMenuItem("Rename", icon = Icons.Outlined.Edit, onClick = {
            close()
            renaming = true
        })
        GlassMenuItem("Edit Icon", icon = Icons.Outlined.SentimentSatisfied, onClick = {
            close()
            onEditIcon(target)
        })
        GlassMenuItem("Mark as Unread", icon = Icons.Outlined.NotificationAdd, onClick = { act("unread", null) })
        GlassMenuDivider()
        GlassMenuItem("Fork", icon = Icons.Outlined.CallSplit, onClick = { act("fork", null) })
        GlassSubmenu(
            text = "Move to",
            icon = Icons.Outlined.SwapHoriz,
            open = sub == "move",
            onToggle = {
                sub = if (sub == "move") null else "move"
                if (sub == "move") onLoadMove(chatId)
            },
        ) {
            val mine = menuMove?.takeIf { it.chatId == chatId }
            when {
                mine == null || mine.loading -> SubLoading()
                mine.items.isEmpty() -> GlassMenuNote("没有可移动的位置", indent = SubIndent)
                else ->
                    mine.items.forEach { opt ->
                        GlassMenuItem(opt.label, detail = opt.detail, indent = SubIndent, onClick = { act("move", opt.label) })
                    }
            }
        }
        GlassMenuDivider()
        GlassSubmenu(
            text = "Copy",
            icon = Icons.Outlined.ContentCopy,
            open = sub == "copy",
            onToggle = { sub = if (sub == "copy") null else "copy" },
        ) {
            CopyItems.forEach { (key, label) ->
                GlassMenuItem(label, indent = SubIndent, onClick = { act("copy", key) })
            }
        }
        GlassMenuDivider()
        GlassMenuItem("Archive", icon = Icons.Outlined.Archive, onClick = { act("archive", null) })
    }

    if (renaming) {
        RenameDialog(
            initial = target.title,
            onDismiss = { renaming = false },
            onRename = { title ->
                renaming = false
                if (title.isNotBlank() && title != target.title) onAction(target, "rename", title)
            },
        )
    }
}

@Composable
private fun SubLoading() {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(start = 10.dp + SubIndent, top = 8.dp, bottom = 8.dp, end = 10.dp),
    ) {
        CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 1.6.dp, color = RsAccent)
        Spacer(modifier = Modifier.width(8.dp))
        Text("读取 Cursor…", fontSize = 12.sp, color = RsMuted)
    }
}

@Composable
private fun RenameDialog(
    initial: String,
    onDismiss: () -> Unit,
    onRename: (String) -> Unit,
) {
    var text by remember { mutableStateOf(initial) }
    GlassDialog(
        onDismissRequest = onDismiss,
        title = "Rename",
        actions = { dialog ->
            GlassButton("Cancel", onClick = { dialog.dismiss(onDismiss) })
            GlassButton("Rename", primary = true, onClick = { dialog.dismiss { onRename(text.trim()) } })
        },
    ) {
        GlassTextField(value = text, onValueChange = { text = it })
    }
}

private fun swatch(label: String): Color =
    when (label.lowercase()) {
        "green" -> Color(0xFF3FB950)
        "cyan" -> Color(0xFF39C5CF)
        "blue" -> Color(0xFF4C8DFF)
        "purple" -> Color(0xFFA371F7)
        "magenta" -> Color(0xFFDB61A2)
        "orange" -> Color(0xFFF0883E)
        "yellow" -> Color(0xFFD29922)
        "red" -> Color(0xFFF85149)
        "brand" -> RsAccent
        else -> Color(0xFF8B949E)
    }

/** Cursor's Edit Icon picker: colour swatches, icon search, icon names. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun IconPickerDialog(
    state: IconPickerState,
    onSearch: (String) -> Unit,
    onColor: (String) -> Unit,
    onIcon: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    var query by remember(state.chatId) { mutableStateOf(state.query) }
    LaunchedEffect(query) {
        if (query == state.query) return@LaunchedEffect
        delay(350)
        onSearch(query.trim())
    }
    GlassDialog(
        onDismissRequest = onDismiss,
        title = "Edit Icon · ${state.title}",
        width = 520.dp,
        actions = { dialog -> GlassButton("Done", primary = true, onClick = { dialog.dismiss(onDismiss) }) },
    ) {
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            state.colors.forEach { c ->
                Box(
                    modifier =
                        Modifier
                            .size(28.dp)
                            .border(
                                width = 2.dp,
                                color = if (c.selected) Color.White else Color.White.copy(alpha = 0.08f),
                                shape = CircleShape,
                            )
                            .padding(4.dp)
                            .background(swatch(c.label), CircleShape)
                            .clickable { onColor(c.label) },
                )
            }
        }
        val hasIcon = state.current.isNotBlank() && state.current != "No icon"
        if (!hasIcon) {
            Text("颜色要配合图标才会生效", fontSize = 12.sp, color = RsMuted)
        }
        GlassTextField(
            value = query,
            onValueChange = { query = it },
            placeholder = "Search icons",
            trailing =
                if (state.loading) {
                    { CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 1.6.dp, color = RsAccent) }
                } else {
                    null
                },
        )
        Column(
            modifier =
                Modifier
                    .heightIn(max = 300.dp)
                    .verticalScroll(rememberScrollState()),
        ) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                state.icons.forEach { ic ->
                    GlassChoiceChip(
                        text = ic.label,
                        selected = ic.selected || ic.label == state.current,
                        onClick = { onIcon(ic.label) },
                    )
                }
            }
        }
    }
}
