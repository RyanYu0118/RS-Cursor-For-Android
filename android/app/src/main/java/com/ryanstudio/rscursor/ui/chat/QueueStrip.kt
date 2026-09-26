package com.ryanstudio.rscursor.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ryanstudio.rscursor.data.QueueItem
import com.ryanstudio.rscursor.ui.theme.RsAccent
import com.ryanstudio.rscursor.ui.theme.RsMuted
import com.ryanstudio.rscursor.ui.theme.RsSpace
import com.ryanstudio.rscursor.ui.theme.RsText

/**
 * Cursor-style queue card above the composer: "N Queued" / Start Multitasking / ×,
 * message body underneath (tap to reword). Outer edges match the composer row
 * (+ / Send); header actions share one horizontal centerline.
 */
@Composable
fun QueueStrip(
    queue: List<QueueItem>,
    onNow: (itemId: String) -> Unit,
    onDrop: (itemId: String) -> Unit,
    onEdit: (itemId: String, text: String) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (queue.isEmpty()) return
    val countLabel = "${queue.size} Queued"
    var editingId by remember(queue.map { it.id }) { mutableStateOf<String?>(null) }
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(
                    // Same outer inset as ComposerBar so left/right edges sit
                    // on the + / Send column lines.
                    horizontal = RsSpace.composerPadH,
                    vertical = 2.dp,
                ),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        queue.forEach { item ->
            QueuedCard(
                item = item,
                countLabel = countLabel,
                editing = editingId == item.id,
                onStartEdit = { editingId = item.id },
                onCancelEdit = { editingId = null },
                onSaveEdit = { text ->
                    editingId = null
                    if (text.isNotBlank() && text != item.text) onEdit(item.id, text)
                },
                onNow = { onNow(item.id) },
                onDrop = { onDrop(item.id) },
            )
        }
    }
}

@Composable
private fun QueuedCard(
    item: QueueItem,
    countLabel: String,
    editing: Boolean,
    onStartEdit: () -> Unit,
    onCancelEdit: () -> Unit,
    onSaveEdit: (String) -> Unit,
    onNow: () -> Unit,
    onDrop: () -> Unit,
) {
    val shape = RoundedCornerShape(10.dp)
    var draft by remember(item.id, item.text, editing) {
        mutableStateOf(item.text)
    }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(Color(0xFF1A1A1A).copy(alpha = 0.92f))
                .border(1.dp, Color.White.copy(alpha = 0.16f), shape)
                .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(
                text = countLabel,
                color = RsMuted,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                lineHeight = 16.sp,
                modifier = Modifier.weight(1f),
            )
            if (editing) {
                Text(
                    text = "✓",
                    color = RsAccent,
                    fontSize = 13.sp,
                    lineHeight = 16.sp,
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .clickable { onSaveEdit(draft.trim()) }
                            .padding(horizontal = 4.dp, vertical = 2.dp),
                )
                Icon(
                    Icons.Default.Close,
                    contentDescription = "取消",
                    tint = RsMuted,
                    modifier =
                        Modifier
                            .size(16.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .clickable(onClick = onCancelEdit),
                )
            } else {
                Text(
                    text = "Start Multitasking",
                    color = RsMuted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    lineHeight = 16.sp,
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .clickable(onClick = onNow)
                            .padding(horizontal = 2.dp, vertical = 2.dp),
                )
                Icon(
                    Icons.Default.Close,
                    contentDescription = "移出排队",
                    tint = RsMuted,
                    modifier =
                        Modifier
                            .size(16.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .clickable(onClick = onDrop),
                )
            }
        }
        if (editing) {
            BasicTextField(
                value = draft,
                onValueChange = { draft = it },
                textStyle = TextStyle(color = RsText, fontSize = 13.sp, lineHeight = 18.sp),
                cursorBrush = SolidColor(RsAccent),
                modifier = Modifier.fillMaxWidth(),
            )
        } else {
            Text(
                text = item.text.ifBlank { "(empty)" },
                color = RsText,
                fontSize = 13.sp,
                lineHeight = 18.sp,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clickable(onClick = onStartEdit),
            )
        }
    }
}
