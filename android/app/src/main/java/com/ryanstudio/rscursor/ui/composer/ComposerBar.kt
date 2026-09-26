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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.ryanstudio.rscursor.data.Catalog
import com.ryanstudio.rscursor.data.LocalAttachment
import com.ryanstudio.rscursor.ui.theme.RsAccent
import com.ryanstudio.rscursor.ui.theme.RsMuted
import com.ryanstudio.rscursor.ui.theme.RsText
import com.ryanstudio.rscursor.ui.theme.glassPanel

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
                .padding(horizontal = 10.dp, vertical = 8.dp)
                .glassPanel(shape = RoundedCornerShape(26.dp), strong = true)
                .padding(horizontal = 10.dp, vertical = 10.dp),
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
                                    .size(56.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .glassPanel(shape = RoundedCornerShape(14.dp)),
                        )
                        IconButton(onClick = { onRemoveAttachment(index) }) {
                            Icon(Icons.Default.Close, contentDescription = "移除", tint = RsMuted)
                        }
                    }
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
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
                modifier = Modifier.weight(1f),
                placeholder = { Text("给 Agent 发消息…", color = RsMuted) },
                maxLines = 6,
                shape = RoundedCornerShape(18.dp),
                colors =
                    OutlinedTextFieldDefaults.colors(
                        focusedTextColor = RsText,
                        unfocusedTextColor = RsText,
                        focusedBorderColor = RsAccent.copy(alpha = 0.7f),
                        unfocusedBorderColor = Color.White.copy(alpha = 0.22f),
                        cursorColor = RsAccent,
                        focusedContainerColor = Color.White.copy(alpha = 0.06f),
                        unfocusedContainerColor = Color.White.copy(alpha = 0.04f),
                    ),
            )
            Spacer(modifier = Modifier.width(4.dp))
            if (busy) {
                IconButton(onClick = onCancel) {
                    Icon(Icons.Default.Stop, contentDescription = "停止", tint = RsAccent)
                }
            } else {
                IconButton(
                    onClick = onSend,
                    enabled = draft.isNotBlank() || attachments.isNotEmpty(),
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.Send,
                        contentDescription = "发送",
                        tint = if (draft.isNotBlank() || attachments.isNotEmpty()) RsAccent else RsMuted,
                    )
                }
            }
        }
    }
}
