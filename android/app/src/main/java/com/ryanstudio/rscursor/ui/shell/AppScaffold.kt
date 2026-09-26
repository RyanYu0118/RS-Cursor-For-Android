package com.ryanstudio.rscursor.ui.shell

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.OpenInBrowser
import androidx.compose.material.icons.filled.Settings
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ryanstudio.rscursor.data.ConnPhase
import com.ryanstudio.rscursor.data.HostUiState
import com.ryanstudio.rscursor.data.ImagePart
import com.ryanstudio.rscursor.ui.chat.TranscriptScreen
import com.ryanstudio.rscursor.ui.composer.ComposerBar
import com.ryanstudio.rscursor.ui.rail.SessionRail
import com.ryanstudio.rscursor.ui.theme.RsAccent
import com.ryanstudio.rscursor.ui.theme.RsBg
import com.ryanstudio.rscursor.ui.theme.RsMuted
import com.ryanstudio.rscursor.ui.theme.RsSurface
import com.ryanstudio.rscursor.ui.theme.RsText

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppScaffold(
    state: HostUiState,
    onSelectSession: (String) -> Unit,
    onNewSession: () -> Unit,
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

    Scaffold(
        containerColor = RsBg,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = state.meta?.title ?: "RS Cursor",
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            fontWeight = FontWeight.Medium,
                        )
                        val sub =
                            when {
                                state.reconnecting -> "重连中…"
                                state.banner != null -> state.banner
                                state.busy -> "Working…"
                                else -> state.meta?.folder?.substringAfterLast('\\')
                                    ?.substringAfterLast('/')
                                    ?: state.hostUrl.trimEnd('/')
                            }
                        if (!sub.isNullOrBlank()) {
                            Text(sub, fontSize = 12.sp, color = RsMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = { onRailOpen(!state.railOpen) }) {
                        Icon(Icons.Default.Menu, contentDescription = "会话列表")
                    }
                },
                actions = {
                    IconButton(onClick = onOpenWeb) {
                        Icon(Icons.Default.OpenInBrowser, contentDescription = "网页版")
                    }
                    IconButton(onClick = onSettings) {
                        Icon(Icons.Default.Settings, contentDescription = "设置")
                    }
                },
                colors =
                    TopAppBarDefaults.topAppBarColors(
                        containerColor = RsSurface,
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
                    .padding(padding)
                    .background(RsBg),
        ) {
            if (state.railOpen) {
                SessionRail(
                    sessions = state.sessions,
                    activeId = state.sessionId,
                    onSelect = onSelectSession,
                    onNew = onNewSession,
                    onSettings = onSettings,
                    onClose = { onRailOpen(false) },
                )
            }
            Column(modifier = Modifier.weight(1f).fillMaxSize()) {
                if (state.reconnecting && state.banner != null) {
                    Box(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .background(RsSurface)
                                .padding(horizontal = 12.dp, vertical = 6.dp),
                    ) {
                        Text(state.banner!!, color = RsAccent, fontSize = 13.sp)
                    }
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

@Composable
private fun NoHostScreen(onSettings: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize().background(RsBg),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("RS Cursor", color = RsText, fontWeight = FontWeight.SemiBold, fontSize = 22.sp)
            Text(
                "先设置电脑上 Auto 主机的地址",
                color = RsMuted,
                modifier = Modifier.padding(top = 8.dp, bottom = 16.dp),
            )
            androidx.compose.material3.Button(onClick = onSettings) {
                Text("主机设置")
            }
        }
    }
}
