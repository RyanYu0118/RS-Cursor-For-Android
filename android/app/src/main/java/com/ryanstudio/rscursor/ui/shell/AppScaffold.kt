package com.ryanstudio.rscursor.ui.shell

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandHorizontally
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.ryanstudio.rscursor.ui.theme.RsDeny
import kotlinx.coroutines.delay
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.requiredWidth
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.OpenInBrowser
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import android.widget.Toast
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ryanstudio.rscursor.data.ConnPhase
import com.ryanstudio.rscursor.data.HostUiState
import com.ryanstudio.rscursor.data.ImagePart
import com.ryanstudio.rscursor.data.RailChat
import com.ryanstudio.rscursor.data.RailMenuTarget
import com.ryanstudio.rscursor.ui.rail.IconPickerDialog
import com.ryanstudio.rscursor.data.RailPinned
import com.ryanstudio.rscursor.ui.chat.QueueStrip
import com.ryanstudio.rscursor.ui.chat.TranscriptScreen
import com.ryanstudio.rscursor.ui.composer.ComposerBar
import com.ryanstudio.rscursor.ui.rail.SessionRail
import com.ryanstudio.rscursor.ui.theme.GlassButton
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
    onChatMenu: (RailMenuTarget, String, String?) -> Unit,
    onLoadMoveTargets: (String) -> Unit,
    onChatIcons: (RailMenuTarget, String, String?, String?) -> Unit,
    onCloseIcons: () -> Unit,
    onNoticeShown: (Long) -> Unit,
    onNewSession: () -> Unit,
    onNewInFolder: (String) -> Unit,
    onToggleRepo: (String) -> Unit,
    onSettings: () -> Unit,
    onRetry: () -> Unit,
    onOpenWeb: () -> Unit,
    onDraftChange: (String) -> Unit,
    onSend: () -> Unit,
    onCancel: () -> Unit,
    onPickFiles: () -> Unit,
    onRemoveAttachment: (Int) -> Unit,
    onMode: (String) -> Unit,
    onModel: (String) -> Unit,
    onAuto: (Boolean) -> Unit,
    onModelParameter: (String, Any) -> Unit,
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
                ShellPage.Skeleton ->
                    Box(modifier = Modifier.fillMaxSize()) {
                        SkeletonShell(showRail = true)
                        ConnectingCard(
                            hostUrl = state.hostUrl,
                            error = state.connError,
                            attempts = state.connAttempts,
                            onSettings = onSettings,
                            onRetry = onRetry,
                        )
                    }
                ShellPage.Main ->
                    MainShell(
                        state = state,
                        onOpenChat = onOpenChat,
                        onOpenPinned = onOpenPinned,
                        onChatMenu = onChatMenu,
                        onLoadMoveTargets = onLoadMoveTargets,
                        onChatIcons = onChatIcons,
                        onCloseIcons = onCloseIcons,
                        onNoticeShown = onNoticeShown,
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
                        onAuto = onAuto,
                        onModelParameter = onModelParameter,
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
    onChatMenu: (RailMenuTarget, String, String?) -> Unit,
    onLoadMoveTargets: (String) -> Unit,
    onChatIcons: (RailMenuTarget, String, String?, String?) -> Unit,
    onCloseIcons: () -> Unit,
    onNoticeShown: (Long) -> Unit,
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
    onAuto: (Boolean) -> Unit,
    onModelParameter: (String, Any) -> Unit,
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
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    val notice = state.notice
    LaunchedEffect(notice?.id) {
        if (notice == null) return@LaunchedEffect
        notice.clip?.let { clipboard.setText(AnnotatedString(it)) }
        Toast.makeText(context, notice.text, Toast.LENGTH_SHORT).show()
        onNoticeShown(notice.id)
    }
    state.iconPicker?.let { picker ->
        val target = RailMenuTarget(chatId = picker.chatId, sessionId = null, title = picker.title, pinned = false)
        IconPickerDialog(
            state = picker,
            onSearch = { q -> onChatIcons(target, q, null, null) },
            onColor = { c -> onChatIcons(target, picker.query, c, null) },
            onIcon = { i -> onChatIcons(target, picker.query, null, i) },
            onDismiss = onCloseIcons,
        )
    }
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
            // The rail's width is what the chat pane grows into. A slide/fade
            // keeps the slot at full width until the animation ends, so the
            // pane used to jump. Shrinking the slot itself makes the pane
            // fill leftward the whole way.
            val railWidth by animateDpAsState(
                targetValue = if (state.railOpen) RsSpace.railWidth else 0.dp,
                animationSpec = tween(RsMotion.Normal, easing = FastOutSlowInEasing),
                label = "rail-width",
            )
            val paneStart by animateDpAsState(
                targetValue = if (state.railOpen) 0.dp else RsSpace.pane,
                animationSpec = tween(RsMotion.Normal, easing = FastOutSlowInEasing),
                label = "pane-start",
            )
            if (state.railOpen || railWidth > 0.dp) {
                Box(
                    modifier =
                        Modifier
                            .width(railWidth)
                            .fillMaxHeight()
                            .clipToBounds()
                            .graphicsLayer {
                                alpha = (railWidth / RsSpace.railWidth).coerceIn(0f, 1f)
                            },
                ) {
                Box(Modifier.requiredWidth(RsSpace.railWidth).fillMaxHeight()) {
                val busyKeys =
                    remember(state.sessions, state.busy, state.sessionId, state.meta?.desktopThreadId) {
                        buildSet {
                            for (s in state.sessions) {
                                if (s.status == "busy" || s.status == "starting") {
                                    add(s.id)
                                    if (s.desktopThreadId.isNotBlank()) add(s.desktopThreadId)
                                }
                            }
                            // Active turn can briefly lead the sessions list.
                            if (state.busy) {
                                state.sessionId?.takeIf { it.isNotBlank() }?.let { add(it) }
                                state.meta?.desktopThreadId?.takeIf { it.isNotBlank() }?.let { add(it) }
                            }
                        }
                    }
                SessionRail(
                    pinned = state.railPinned,
                    repos = state.railRepos,
                    activeSessionId = state.sessionId,
                    activeDesktopThreadId = state.meta?.desktopThreadId,
                    busyKeys = busyKeys,
                    onOpenChat = onOpenChat,
                    onOpenPinned = onOpenPinned,
                    menuMove = state.menuMove,
                    onChatMenu = onChatMenu,
                    onLoadMoveTargets = onLoadMoveTargets,
                    onEditIcon = { target -> onChatIcons(target, "", null, null) },
                    onNew = onNewSession,
                    onNewInFolder = onNewInFolder,
                    onToggleRepo = onToggleRepo,
                    onSettings = onSettings,
                    onClose = { onRailOpen(false) },
                )
                }
                }
            }
            Column(
                modifier =
                    Modifier
                        .weight(1f)
                        .fillMaxSize()
                        .padding(
                            start = paneStart,
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
                    modelControls = state.modelControls,
                    onDraftChange = onDraftChange,
                    onSend = onSend,
                    onCancel = onCancel,
                    onPickFiles = onPickFiles,
                    onRemoveAttachment = onRemoveAttachment,
                    onMode = onMode,
                    onModel = onModel,
                    onAuto = onAuto,
                    onModelParameter = onModelParameter,
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
                GlassButton("主机设置", primary = true, onClick = onSettings)
            }
        }
    }
}

/**
 * Floats over the loading skeleton so a host that moved IP is not a dead
 * end: shows where it is dialling, why it fails, and a way to change it.
 */
@Composable
private fun ConnectingCard(
    hostUrl: String,
    error: String?,
    attempts: Int,
    onSettings: () -> Unit,
    onRetry: () -> Unit,
) {
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        delay(1200)
        shown = true
    }
    val failing = attempts > 0
    Box(
        modifier = Modifier.fillMaxSize().statusBarsPadding().windowInsetsPadding(WindowInsets.navigationBars),
        contentAlignment = Alignment.Center,
    ) {
        AnimatedVisibility(
            visible = shown || failing,
            enter = fadeIn(tween(RsMotion.Normal)) + slideInVertically(tween(RsMotion.Normal)) { it / 6 },
            exit = fadeOut(tween(RsMotion.Fast)),
        ) {
            GlassChip(
                modifier = Modifier.padding(28.dp).widthIn(max = 420.dp),
                shape = RoundedCornerShape(22.dp),
                strong = true,
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(horizontal = 24.dp, vertical = 22.dp),
                ) {
                    Text(
                        if (failing) "连不上主机" else "正在连接主机…",
                        color = RsText,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 17.sp,
                    )
                    Text(
                        hostUrl.trimEnd('/').ifBlank { "（未设置）" },
                        color = RsMuted,
                        fontSize = 13.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                    AnimatedVisibility(visible = failing) {
                        Text(
                            "已重试 $attempts 次" + (error?.takeIf { it.isNotBlank() }?.let { "：$it" } ?: "") +
                                "\n电脑换了 IP 的话，改一下主机地址。",
                            color = RsDeny,
                            fontSize = 12.sp,
                            lineHeight = 17.sp,
                            maxLines = 4,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.padding(top = 10.dp),
                        )
                    }
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.padding(top = 16.dp),
                    ) {
                        GlassButton("重试", onClick = onRetry)
                        GlassButton("更改主机地址", primary = true, onClick = onSettings)
                    }
                }
            }
        }
    }
}
