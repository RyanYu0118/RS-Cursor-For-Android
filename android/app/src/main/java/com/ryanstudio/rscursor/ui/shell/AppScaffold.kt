package com.ryanstudio.rscursor.ui.shell

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.OpenInBrowser
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ryanstudio.rscursor.data.ConnPhase
import com.ryanstudio.rscursor.data.HostUiState
import com.ryanstudio.rscursor.data.ImagePart
import com.ryanstudio.rscursor.data.RailChat
import com.ryanstudio.rscursor.data.RailPinned
import com.ryanstudio.rscursor.ui.chat.TranscriptScreen
import com.ryanstudio.rscursor.ui.composer.ComposerBar
import com.ryanstudio.rscursor.ui.rail.SessionRail
import com.ryanstudio.rscursor.ui.theme.GlassChip
import com.ryanstudio.rscursor.ui.theme.ImmersiveLightBackground
import com.ryanstudio.rscursor.ui.theme.RsAccent
import com.ryanstudio.rscursor.ui.theme.RsMuted
import com.ryanstudio.rscursor.ui.theme.RsText
import com.ryanstudio.rscursor.ui.theme.glassPanel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppScaffold(
    state: HostUiState,
    onOpenChat: (RailChat) -> Unit,
    onOpenPinned: (RailPinned) -> Unit,
    onNewSession: () -> Unit,
    onNewInFolder: (String) -> Unit,
    onToggleRepo: (String) -> Unit,
    onSettings: () -> Unit,
    onOpenWeb: () -> Unit,
    onDraftChange: (String) -> Unit,
    onSend: () -> Unit,
    onCancel: () -> Unit,
    onPickFiles: () -> Unit,
    onRemoveAttachment: (Int) -> Unit,
    onMode: (String) -> Unit,
    onModel: (String) -> Unit,
    onPermission: (String, String) -> Unit,
    onAnswer: (String, String) -> Unit,
    onSkipQuestion: (String) -> Unit,
    onRailOpen: (Boolean) -> Unit,
    imageUrl: (ImagePart) -> String?,
) {
    val showFullSkeleton =
        state.phase == ConnPhase.Connecting ||
            (state.phase == ConnPhase.NoHost) ||
            (!state.sessionsReady && state.phase != ConnPhase.NoHost)

    if (state.phase == ConnPhase.NoHost) {
        NoHostScreen(onSettings = onSettings)
        return
    }

    if (showFullSkeleton && !state.sessionsReady) {
        SkeletonShell(showRail = true)
        return
    }

    ImmersiveLightBackground {
        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                TopAppBar(
                    title = {
                        Column {
                            Text(
                                text = state.meta?.title ?: "RS Cursor",
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                fontWeight = FontWeight.SemiBold,
                                color = RsText,
                            )
                            val sub =
                                when {
                                    state.reconnecting -> "重连中…"
                                    state.banner != null -> state.banner
                                    state.busy -> "Working…"
                                    else ->
                                        state.meta?.folder?.substringAfterLast('\\')
                                            ?.substringAfterLast('/')
                                            ?: state.hostUrl.trimEnd('/')
                                }
                            if (!sub.isNullOrBlank()) {
                                Text(
                                    sub,
                                    fontSize = 12.sp,
                                    color = RsMuted,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = { onRailOpen(!state.railOpen) }) {
                            Icon(Icons.Default.Menu, contentDescription = "会话列表", tint = RsText)
                        }
                    },
                    actions = {
                        IconButton(onClick = onOpenWeb) {
                            Icon(Icons.Default.OpenInBrowser, contentDescription = "网页版", tint = RsMuted)
                        }
                        IconButton(onClick = onSettings) {
                            Icon(Icons.Default.Settings, contentDescription = "设置", tint = RsMuted)
                        }
                    },
                    colors =
                        TopAppBarDefaults.topAppBarColors(
                            containerColor = Color.Transparent,
                            titleContentColor = RsText,
                            navigationIconContentColor = RsText,
                            actionIconContentColor = RsText,
                        ),
                )
            },
        ) { padding ->
            Row(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .padding(padding),
            ) {
                if (state.railOpen) {
                    SessionRail(
                        pinned = state.railPinned,
                        repos = state.railRepos,
                        activeSessionId = state.sessionId,
                        activeDesktopThreadId = state.meta?.desktopThreadId,
                        onOpenChat = onOpenChat,
                        onOpenPinned = onOpenPinned,
                        onNew = onNewSession,
                        onNewInFolder = onNewInFolder,
                        onToggleRepo = onToggleRepo,
                        onSettings = onSettings,
                        onClose = { onRailOpen(false) },
                    )
                }
                // Only the chat column is a rounded glass window (web-like compactness elsewhere).
                Column(
                    modifier =
                        Modifier
                            .weight(1f)
                            .fillMaxSize()
                            .padding(start = if (state.railOpen) 0.dp else 8.dp, end = 8.dp, bottom = 8.dp)
                            .glassPanel(shape = RoundedCornerShape(22.dp), strong = true),
                ) {
                    if (state.reconnecting && state.banner != null) {
                        Text(
                            state.banner!!,
                            color = RsAccent,
                            fontSize = 13.sp,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                        )
                    }
                    TranscriptScreen(
                        ready = state.transcriptReady,
                        items = state.items,
                        queue = state.queue,
                        busy = state.busy,
                        imageUrl = imageUrl,
                        onPermission = onPermission,
                        onAnswer = onAnswer,
                        onSkipQuestion = onSkipQuestion,
                        modifier = Modifier.weight(1f),
                    )
                    ComposerBar(
                        draft = state.draft,
                        attachments = state.attachments,
                        busy = state.busy,
                        catalog = state.catalog,
                        currentMode = state.meta?.mode.orEmpty(),
                        currentModel = state.meta?.model.orEmpty(),
                        onDraftChange = onDraftChange,
                        onSend = onSend,
                        onCancel = onCancel,
                        onPickFiles = onPickFiles,
                        onRemoveAttachment = onRemoveAttachment,
                        onMode = onMode,
                        onModel = onModel,
                    )
                }
            }
        }
    }
}

@Composable
private fun NoHostScreen(onSettings: () -> Unit) {
    ImmersiveLightBackground {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            GlassChip(
                modifier = Modifier.padding(32.dp),
                shape = RoundedCornerShape(28.dp),
                strong = true,
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(horizontal = 28.dp, vertical = 32.dp),
                ) {
                    Text("RS Cursor", color = RsText, fontWeight = FontWeight.SemiBold, fontSize = 24.sp)
                    Text(
                        "先设置电脑上 Auto 主机的地址",
                        color = RsMuted,
                        modifier = Modifier.padding(top = 10.dp, bottom = 20.dp),
                    )
                    Button(
                        onClick = onSettings,
                        colors =
                            ButtonDefaults.buttonColors(
                                containerColor = RsAccent.copy(alpha = 0.85f),
                                contentColor = Color(0xFF071018),
                            ),
                        shape = RoundedCornerShape(999.dp),
                    ) {
                        Text("主机设置")
                    }
                }
            }
        }
    }
}
