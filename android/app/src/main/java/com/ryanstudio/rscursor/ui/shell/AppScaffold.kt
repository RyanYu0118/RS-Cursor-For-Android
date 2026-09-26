package com.ryanstudio.rscursor.ui.shell

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandHorizontally
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkHorizontally
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.OpenInBrowser
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
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
import com.ryanstudio.rscursor.ui.chat.QueueStrip
import com.ryanstudio.rscursor.ui.chat.TranscriptScreen
import com.ryanstudio.rscursor.ui.composer.ComposerBar
import com.ryanstudio.rscursor.ui.rail.SessionRail
import com.ryanstudio.rscursor.ui.theme.GlassChip
import com.ryanstudio.rscursor.ui.theme.ImmersiveLightBackground
import com.ryanstudio.rscursor.ui.theme.RsAccent
import com.ryanstudio.rscursor.ui.theme.RsMotion
import com.ryanstudio.rscursor.ui.theme.RsMuted
import com.ryanstudio.rscursor.ui.theme.RsSpace
import com.ryanstudio.rscursor.ui.theme.RsText
import com.ryanstudio.rscursor.ui.theme.glassPanel

private enum class ShellPage { NoHost, Skeleton, Main }

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
    onQueueNow: (String) -> Unit,
    onQueueDrop: (String) -> Unit,
    onQueueEdit: (String, String) -> Unit,
    onLoadEarlier: () -> Unit,
    onRailOpen: (Boolean) -> Unit,
    imageUrl: (ImagePart) -> String?,
) {
    val page =
        when {
            state.phase == ConnPhase.NoHost -> ShellPage.NoHost
            !state.sessionsReady &&
                (state.phase == ConnPhase.Connecting || state.phase == ConnPhase.Reconnecting) ->
                ShellPage.Skeleton
            else -> ShellPage.Main
        }

    ImmersiveLightBackground {
        AnimatedContent(
            targetState = page,
            transitionSpec = { RsMotion.fadeSlide() },
            label = "shell-page",
        ) { target ->
            when (target) {
                ShellPage.NoHost -> NoHostScreen(onSettings = onSettings)
                ShellPage.Skeleton -> SkeletonShell(showRail = true)
                ShellPage.Main ->
                    MainShell(
                        state = state,
                        onOpenChat = onOpenChat,
                        onOpenPinned = onOpenPinned,
                        onNewSession = onNewSession,
                        onNewInFolder = onNewInFolder,
                        onToggleRepo = onToggleRepo,
                        onSettings = onSettings,
                        onOpenWeb = onOpenWeb,
                        onDraftChange = onDraftChange,
                        onSend = onSend,
                        onCancel = onCancel,
                        onPickFiles = onPickFiles,
                        onRemoveAttachment = onRemoveAttachment,
                        onMode = onMode,
                        onModel = onModel,
                        onPermission = onPermission,
                        onAnswer = onAnswer,
                        onSkipQuestion = onSkipQuestion,
                        onQueueNow = onQueueNow,
                        onQueueDrop = onQueueDrop,
                        onQueueEdit = onQueueEdit,
                        onLoadEarlier = onLoadEarlier,
                        onRailOpen = onRailOpen,
                        imageUrl = imageUrl,
                    )
            }
        }
    }
}

@Composable
private fun MainShell(
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
    onQueueNow: (String) -> Unit,
    onQueueDrop: (String) -> Unit,
    onQueueEdit: (String, String) -> Unit,
    onLoadEarlier: () -> Unit,
    onRailOpen: (Boolean) -> Unit,
    imageUrl: (ImagePart) -> String?,
) {
    Scaffold(
        containerColor = Color.Transparent,
        contentWindowInsets = WindowInsets.navigationBars,
        topBar = {
            CompactTopBar(
                title = state.meta?.title ?: "RS Cursor",
                subtitle =
                    when {
                        state.reconnecting -> "重连中…"
                        state.banner != null -> state.banner
                        state.busy -> "Working…"
                        else ->
                            state.meta?.folder?.substringAfterLast('\\')
                                ?.substringAfterLast('/')
                                ?: state.hostUrl.trimEnd('/')
                    },
                onMenu = { onRailOpen(!state.railOpen) },
                onOpenWeb = onOpenWeb,
                onSettings = onSettings,
            )
        },
    ) { padding ->
        Row(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(padding),
        ) {
            AnimatedVisibility(
                visible = state.railOpen,
                enter = RsMotion.railEnter,
                exit = RsMotion.railExit,
            ) {
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
            Column(
                modifier =
                    Modifier
                        .weight(1f)
                        .fillMaxSize()
                        .padding(
                            start = if (state.railOpen) 0.dp else RsSpace.pane,
                            end = RsSpace.pane,
                            bottom = RsSpace.pane,
                        )
                        .glassPanel(shape = RoundedCornerShape(RsSpace.corner), strong = true),
            ) {
                AnimatedVisibility(
                    visible = state.reconnecting && state.banner != null,
                    enter = fadeIn() + expandHorizontally(),
                    exit = fadeOut() + shrinkHorizontally(),
                ) {
                    Text(
                        state.banner.orEmpty(),
                        color = RsAccent,
                        fontSize = 12.sp,
                        modifier =
                            Modifier.padding(
                                horizontal = RsSpace.chatPadH,
                                vertical = 4.dp,
                            ),
                    )
                }
                AnimatedContent(
                    targetState = state.transcriptReady,
                    transitionSpec = { RsMotion.fadeOnly },
                    label = "transcript-ready",
                    modifier = Modifier.weight(1f),
                ) { ready ->
                    TranscriptScreen(
                        ready = ready,
                        items = state.items,
                        busy = state.busy,
                        earlierCount = state.earlierCount,
                        loadingEarlier = state.loadingEarlier,
                        onLoadEarlier = onLoadEarlier,
                        imageUrl = imageUrl,
                        onPermission = onPermission,
                        onAnswer = onAnswer,
                        onSkipQuestion = onSkipQuestion,
                        modifier = Modifier.fillMaxSize(),
                    )
                }
                QueueStrip(
                    queue = state.queue,
                    onNow = onQueueNow,
                    onDrop = onQueueDrop,
                    onEdit = onQueueEdit,
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
private fun CompactTopBar(
    title: String,
    subtitle: String?,
    onMenu: () -> Unit,
    onOpenWeb: () -> Unit,
    onSettings: () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier =
            Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .height(RsSpace.bar)
                .padding(horizontal = 2.dp),
    ) {
        IconButton(onClick = onMenu, modifier = Modifier.size(40.dp)) {
            Icon(Icons.Default.Menu, contentDescription = "会话列表", tint = RsText, modifier = Modifier.size(20.dp))
        }
        Column(modifier = Modifier.weight(1f).padding(end = 4.dp)) {
            Text(
                text = title,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp,
                color = RsText,
                lineHeight = 18.sp,
            )
            if (!subtitle.isNullOrBlank()) {
                Text(
                    subtitle,
                    fontSize = 11.sp,
                    color = RsMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    lineHeight = 13.sp,
                )
            }
        }
        IconButton(onClick = onOpenWeb, modifier = Modifier.size(40.dp)) {
            Icon(Icons.Default.OpenInBrowser, contentDescription = "网页版", tint = RsMuted, modifier = Modifier.size(18.dp))
        }
        IconButton(onClick = onSettings, modifier = Modifier.size(40.dp)) {
            Icon(Icons.Default.Settings, contentDescription = "设置", tint = RsMuted, modifier = Modifier.size(18.dp))
        }
    }
}

@Composable
private fun NoHostScreen(onSettings: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize().statusBarsPadding().windowInsetsPadding(WindowInsets.navigationBars),
        contentAlignment = Alignment.Center,
    ) {
        GlassChip(
            modifier = Modifier.padding(28.dp),
            shape = RoundedCornerShape(24.dp),
            strong = true,
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 28.dp),
            ) {
                Text("RS Cursor", color = RsText, fontWeight = FontWeight.SemiBold, fontSize = 22.sp)
                Text(
                    "先设置电脑上 Auto 主机的地址",
                    color = RsMuted,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(top = 8.dp, bottom = 16.dp),
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
