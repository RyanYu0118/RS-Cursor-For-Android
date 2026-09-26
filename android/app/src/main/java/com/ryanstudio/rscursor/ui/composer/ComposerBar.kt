package com.ryanstudio.rscursor.ui.composer

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isShiftPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.ryanstudio.rscursor.data.Catalog
import com.ryanstudio.rscursor.data.LocalAttachment
import com.ryanstudio.rscursor.ui.theme.RsAccent
import com.ryanstudio.rscursor.ui.theme.RsMuted
import com.ryanstudio.rscursor.ui.theme.RsSpace
import com.ryanstudio.rscursor.ui.theme.RsText

@Composable
fun ComposerBar(
    draft: String,
    attachments: List<LocalAttachment>,
    busy: Boolean,
    catalog: Catalog,
    currentMode: String,
    currentModel: String,
    onDraftChange: (String) -> Unit,
    onSend: () -> Unit,
    onCancel: () -> Unit,
    onPickFiles: () -> Unit,
    onRemoveAttachment: (Int) -> Unit,
    onMode: (String) -> Unit,
    onModel: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var plusOpen by remember { mutableStateOf(false) }
    var modelOpen by remember { mutableStateOf(false) }
    var modeOpen by remember { mutableStateOf(false) }

    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(horizontal = RsSpace.composerPadH, vertical = RsSpace.composerPadV),
    ) {
        if (attachments.isNotEmpty()) {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                itemsIndexed(attachments) { index, att ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        AsyncImage(
                            model = att.displayUri,
                            contentDescription = att.name,
                            contentScale = ContentScale.Crop,
                            modifier =
                                Modifier
                                    .size(40.dp)
                                    .clip(RoundedCornerShape(RsSpace.cornerSm)),
                        )
                        IconButton(onClick = { onRemoveAttachment(index) }) {
                            Icon(Icons.Default.Close, contentDescription = "移除", tint = RsMuted)
                        }
                    }
                }
            }
            Spacer(modifier = Modifier.height(4.dp))
        }

        Row(verticalAlignment = Alignment.Bottom) {
            IconButton(onClick = { plusOpen = true }) {
                Icon(Icons.Default.Add, contentDescription = "加号菜单", tint = RsAccent)
            }
            DropdownMenu(expanded = plusOpen, onDismissRequest = { plusOpen = false }) {
                DropdownMenuItem(
                    text = { Text("模式") },
                    onClick = {
                        plusOpen = false
                        modeOpen = true
                    },
                )
                DropdownMenuItem(
                    text = { Text("Files") },
                    onClick = {
                        plusOpen = false
                        onPickFiles()
                    },
                )
                DropdownMenuItem(
                    text = { Text("模型") },
                    onClick = {
                        plusOpen = false
                        modelOpen = true
                    },
                )
                HorizontalDivider()
                DropdownMenuItem(
                    text = {
                        Text(
                            "模式: ${catalog.modes.find { it.id == currentMode }?.name ?: currentMode.ifBlank { "—" }}",
                            fontSize = 12.sp,
                            color = RsMuted,
                        )
                    },
                    onClick = {},
                    enabled = false,
                )
                DropdownMenuItem(
                    text = {
                        Text(
                            "模型: ${catalog.models.find { it.id == currentModel }?.name ?: currentModel.ifBlank { "—" }}",
                            fontSize = 12.sp,
                            color = RsMuted,
                        )
                    },
                    onClick = {},
                    enabled = false,
                )
            }
            DropdownMenu(expanded = modeOpen, onDismissRequest = { modeOpen = false }) {
                if (catalog.modes.isEmpty()) {
                    DropdownMenuItem(text = { Text("暂无模式") }, onClick = { modeOpen = false })
                } else {
                    catalog.modes.forEach { mode ->
                        DropdownMenuItem(
                            text = { Text(mode.name) },
                            onClick = {
                                modeOpen = false
                                onMode(mode.id)
                            },
                        )
                    }
                }
            }
            DropdownMenu(expanded = modelOpen, onDismissRequest = { modelOpen = false }) {
                if (catalog.models.isEmpty()) {
                    DropdownMenuItem(text = { Text("暂无模型") }, onClick = { modelOpen = false })
                } else {
                    catalog.models.take(40).forEach { model ->
                        DropdownMenuItem(
                            text = { Text(model.name) },
                            onClick = {
                                modelOpen = false
                                onModel(model.id)
                            },
                        )
                    }
                }
            }

            OutlinedTextField(
                value = draft,
                onValueChange = onDraftChange,
                modifier =
                    Modifier
                        .weight(1f)
                        .onPreviewKeyEvent { event ->
                            if (event.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
                            if (event.key != Key.Enter && event.key != Key.NumPadEnter) {
                                return@onPreviewKeyEvent false
                            }
                            // Shift+Enter keeps the newline; bare Enter sends (or queues when busy).
                            if (event.isShiftPressed) return@onPreviewKeyEvent false
                            if (draft.isNotBlank() || attachments.isNotEmpty()) onSend()
                            true
                        },
                placeholder = {
                    Text(
                        if (busy) "加入排队…" else "给 Agent 发消息…",
                        color = RsMuted,
                    )
                },
                maxLines = 6,
                shape = RoundedCornerShape(14.dp),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                keyboardActions =
                    KeyboardActions(
                        onSend = {
                            if (draft.isNotBlank() || attachments.isNotEmpty()) onSend()
                        },
                    ),
                colors =
                    OutlinedTextFieldDefaults.colors(
                        focusedTextColor = RsText,
                        unfocusedTextColor = RsText,
                        focusedBorderColor = RsAccent.copy(alpha = 0.55f),
                        unfocusedBorderColor = Color.White.copy(alpha = 0.14f),
                        cursorColor = RsAccent,
                        focusedContainerColor = Color.Transparent,
                        unfocusedContainerColor = Color.Transparent,
                    ),
            )
            Spacer(modifier = Modifier.width(2.dp))
            // Like the web: Stop stays available while busy, but Send still
            // works — the host queues the message behind the running turn.
            if (busy) {
                IconButton(onClick = onCancel) {
                    Icon(Icons.Default.Stop, contentDescription = "停止", tint = RsAccent)
                }
            }
            IconButton(
                onClick = onSend,
                enabled = draft.isNotBlank() || attachments.isNotEmpty(),
            ) {
                Icon(
                    Icons.AutoMirrored.Filled.Send,
                    contentDescription = if (busy) "加入排队" else "发送",
                    tint =
                        if (draft.isNotBlank() || attachments.isNotEmpty()) {
                            RsAccent
                        } else {
                            RsMuted
                        },
                )
            }
        }
    }
}
