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
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.outlined.Archive
import androidx.compose.material.icons.outlined.CallSplit
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.NotificationAdd
import androidx.compose.material.icons.outlined.PushPin
import androidx.compose.material.icons.outlined.SentimentSatisfied
import androidx.compose.material.icons.outlined.SwapHoriz
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ryanstudio.rscursor.data.IconPickerState
import com.ryanstudio.rscursor.data.MenuMoveState
import com.ryanstudio.rscursor.data.RailMenuTarget
import com.ryanstudio.rscursor.ui.theme.RsAccent
import com.ryanstudio.rscursor.ui.theme.RsMuted
import kotlinx.coroutines.delay

private val CopyItems =
    listOf(
        "agent-id" to "Copy Agent ID",
        "branch" to "Copy Branch",
        "transcript" to "Copy Transcript",
    )

/**
 * Cursor's row menu, mirrored: every action is pressed in Cursor's own
 * sidebar by the host. "Move to" is read live from Cursor when opened.
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

    DropdownMenu(expanded = expanded, onDismissRequest = close) {
        if (chatId.isNullOrBlank()) {
            // An Auto-only session has no row in Cursor to act on.
            MenuRow(Icons.Outlined.Archive, "Archive") { act("archive", null) }
            return@DropdownMenu
        }
        MenuRow(Icons.Outlined.PushPin, if (target.pinned) "Unpin" else "Pin") {
            act(if (target.pinned) "unpin" else "pin", null)
        }
        MenuRow(Icons.Outlined.Edit, "Rename") {
            close()
            renaming = true
        }
        MenuRow(Icons.Outlined.SentimentSatisfied, "Edit Icon") {
            close()
            onEditIcon(target)
        }
        MenuRow(Icons.Outlined.NotificationAdd, "Mark as Unread") { act("unread", null) }
        HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
        MenuRow(Icons.Outlined.CallSplit, "Fork") { act("fork", null) }
        MenuRow(Icons.Outlined.SwapHoriz, "Move to", open = sub == "move") {
            sub = if (sub == "move") null else "move"
            if (sub == "move") onLoadMove(chatId)
        }
        if (sub == "move") {
            val mine = menuMove?.takeIf { it.chatId == chatId }
            when {
                mine == null || mine.loading -> SubLoading()
                mine.items.isEmpty() -> SubNote("没有可移动的位置")
                else ->
                    mine.items.forEach { opt ->
                        SubRow(opt.label, opt.detail) { act("move", opt.label) }
                    }
            }
        }
        HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
        MenuRow(Icons.Outlined.ContentCopy, "Copy", open = sub == "copy") {
            sub = if (sub == "copy") null else "copy"
        }
        if (sub == "copy") {
            CopyItems.forEach { (key, label) -> SubRow(label) { act("copy", key) } }
        }
        HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
        MenuRow(Icons.Outlined.Archive, "Archive") { act("archive", null) }
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
private fun MenuRow(
    icon: ImageVector,
    label: String,
    open: Boolean? = null,
    onClick: () -> Unit,
) {
    DropdownMenuItem(
        leadingIcon = { Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp)) },
        text = { Text(label, fontSize = 14.sp) },
        trailingIcon =
            open?.let {
                {
                    Icon(
                        if (it) Icons.Default.KeyboardArrowDown else Icons.AutoMirrored.Filled.KeyboardArrowRight,
                        contentDescription = null,
                        tint = RsMuted,
                        modifier = Modifier.size(18.dp),
                    )
                }
            },
        onClick = onClick,
    )
}

@Composable
private fun SubRow(
    label: String,
    detail: String = "",
    onClick: () -> Unit,
) {
    DropdownMenuItem(
        text = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(label, fontSize = 13.sp)
                if (detail.isNotBlank()) {
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(detail, fontSize = 12.sp, color = RsMuted)
                }
            }
        },
        modifier = Modifier.padding(start = 30.dp),
        onClick = onClick,
    )
}

@Composable
private fun SubLoading() {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(start = 46.dp, top = 6.dp, bottom = 6.dp, end = 16.dp),
    ) {
        CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 1.6.dp)
        Spacer(modifier = Modifier.width(8.dp))
        Text("读取 Cursor…", fontSize = 12.sp, color = RsMuted)
    }
}

@Composable
private fun SubNote(text: String) {
    Text(
        text,
        fontSize = 12.sp,
        color = RsMuted,
        modifier = Modifier.padding(start = 46.dp, top = 6.dp, bottom = 6.dp, end = 16.dp),
    )
}

@Composable
private fun RenameDialog(
    initial: String,
    onDismiss: () -> Unit,
    onRename: (String) -> Unit,
) {
    var text by remember { mutableStateOf(initial) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Rename") },
        text = {
            OutlinedTextField(
                value = text,
                onValueChange = { text = it },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
        },
        confirmButton = { TextButton(onClick = { onRename(text.trim()) }) { Text("Rename") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
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
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Edit Icon · ${state.title}", maxLines = 1, fontSize = 16.sp) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    state.colors.forEach { c ->
                        Box(
                            modifier =
                                Modifier
                                    .size(26.dp)
                                    .border(
                                        width = if (c.selected) 2.dp else 0.dp,
                                        color = if (c.selected) Color.White else Color.Transparent,
                                        shape = CircleShape,
                                    )
                                    .padding(3.dp)
                                    .background(swatch(c.label), CircleShape)
                                    .clickable { onColor(c.label) },
                        )
                    }
                }
                val hasIcon = state.current.isNotBlank() && state.current != "No icon"
                if (!hasIcon) {
                    Text("颜色要配合图标才会生效", fontSize = 12.sp, color = RsMuted)
                }
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    singleLine = true,
                    placeholder = { Text("Search icons") },
                    trailingIcon = {
                        if (state.loading) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 1.6.dp)
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                    modifier =
                        Modifier
                            .heightIn(max = 280.dp)
                            .verticalScroll(rememberScrollState()),
                ) {
                    state.icons.forEach { ic ->
                        FilterChip(
                            selected = ic.selected || ic.label == state.current,
                            onClick = { onIcon(ic.label) },
                            label = { Text(ic.label, fontSize = 12.sp) },
                        )
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Done") } },
    )
}
