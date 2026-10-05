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
import androidx.compose.foundation.layout.Box
import androidx.compose.material.icons.outlined.AttachFile
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.widthIn
import coil.compose.AsyncImage
import com.ryanstudio.rscursor.data.Catalog
import com.ryanstudio.rscursor.data.LocalAttachment
import com.ryanstudio.rscursor.data.ModelControls
import com.ryanstudio.rscursor.ui.theme.GlassMenu
import com.ryanstudio.rscursor.ui.theme.GlassMenuItem
import com.ryanstudio.rscursor.ui.theme.GlassMenuNote
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
    modelControls: ModelControls,
    onDraftChange: (String) -> Unit,
    onSend: () -> Unit,
    onCancel: () -> Unit,
    onPickFiles: () -> Unit,
    onRemoveAttachment: (Int) -> Unit,
    onMode: (String) -> Unit,
    onModel: (String) -> Unit,
    onAuto: (Boolean) -> Unit,
    onModelParameter: (String, Any) -> Unit,
    modifier: Modifier = Modifier,
) {
    var plusOpen by remember { mutableStateOf(false) }
    var modelOpen by remember { mutableStateOf(false) }
    var modeOpen by remember { mutableStateOf(false) }
    val modelLabel =
        when {
            modelControls.auto || currentModel == "default[]" || currentModel == "default" -> "Auto"
            modelControls.model.isNotBlank() -> modelControls.model
            else -> catalog.models.find { it.id == currentModel }?.name ?: currentModel.ifBlank { "Model" }
        }

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
            Box {
                IconButton(onClick = { plusOpen = true }) {
                    Icon(Icons.Default.Add, contentDescription = "加号菜单", tint = RsAccent)
                }
                val modeName = catalog.modes.find { it.id == currentMode }?.name ?: currentMode.ifBlank { "—" }
                GlassMenu(expanded = plusOpen, onDismissRequest = { plusOpen = false }) {
                    GlassMenuItem("模式", icon = Icons.Outlined.Tune, detail = modeName, onClick = {
                        plusOpen = false
                        modeOpen = true
                    })
                    GlassMenuItem("Files", icon = Icons.Outlined.AttachFile, onClick = {
                        plusOpen = false
                        onPickFiles()
                    })
                }
                GlassMenu(expanded = modeOpen, onDismissRequest = { modeOpen = false }) {
                    if (catalog.modes.isEmpty()) {
                        GlassMenuNote("暂无模式")
                    } else {
                        catalog.modes.forEach { mode ->
                            GlassMenuItem(mode.name, selected = mode.id == currentMode, onClick = {
                                modeOpen = false
                                onMode(mode.id)
                            })
                        }
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
                trailingIcon = {
                    Box {
                        TextButton(
                            onClick = { modelOpen = true },
                            contentPadding = PaddingValues(horizontal = 6.dp, vertical = 0.dp),
                            modifier = Modifier.widthIn(max = 148.dp),
                        ) {
                            Text(
                                modelLabel,
                                color = RsMuted,
                                fontSize = 13.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Text(" ⌄", color = RsMuted, fontSize = 12.sp)
                        }
                        ModelMenu(
                            expanded = modelOpen,
                            controls = modelControls,
                            catalog = catalog,
                            currentModelId = currentModel,
                            onDismiss = { modelOpen = false },
                            onParameter = onModelParameter,
                            onModel = onModel,
                            onAuto = onAuto,
                        )
                    }
                },
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
