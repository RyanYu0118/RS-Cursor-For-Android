package com.ryanstudio.rscursor.ui.chat

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.ryanstudio.rscursor.data.ChatItem
import com.ryanstudio.rscursor.data.ImagePart
import com.ryanstudio.rscursor.data.ToolLanes
import com.ryanstudio.rscursor.ui.shell.TranscriptSkeleton
import com.ryanstudio.rscursor.ui.theme.GlassBubbleUserBrush
import com.ryanstudio.rscursor.ui.theme.GleamText
import com.ryanstudio.rscursor.ui.theme.RsAccent
import com.ryanstudio.rscursor.ui.theme.RsAllow
import com.ryanstudio.rscursor.ui.theme.RsDeny
import com.ryanstudio.rscursor.ui.theme.RsMuted
import com.ryanstudio.rscursor.ui.theme.RsSpace
import com.ryanstudio.rscursor.ui.theme.RsText
import kotlinx.coroutines.flow.distinctUntilChanged

@Composable
fun TranscriptScreen(
    ready: Boolean,
    items: List<ChatItem>,
    busy: Boolean,
    earlierCount: Int,
    loadingEarlier: Boolean,
    onLoadEarlier: () -> Unit,
    imageUrl: (ImagePart) -> String?,
    onPermission: (requestId: String, optionId: String) -> Unit,
    onAnswer: (askId: String, optionId: String) -> Unit,
    onSkipQuestion: (askId: String) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (!ready) {
        TranscriptSkeleton(modifier = modifier)
        return
    }

    val rows = remember(items, busy) { ToolLanes.project(items, busy) }
    var openFolds by remember { mutableStateOf(setOf<String>()) }

    val listState = rememberLazyListState()
    var stickBottom by remember { mutableStateOf(true) }
    var anchorKey by remember { mutableStateOf<String?>(null) }
    var anchorOffset by remember { mutableIntStateOf(0) }
    var prevSize by remember { mutableIntStateOf(items.size) }
    var prevFirstKey by remember { mutableStateOf(items.firstOrNull()?.key) }

        fun headerCount(): Int =
            (if (earlierCount > 0 || loadingEarlier) 1 else 0)

    LaunchedEffect(items.size, items.firstOrNull()?.key) {
        val first = items.firstOrNull()?.key
        val grew = items.size > prevSize
        val prepended = grew && first != null && first != prevFirstKey && !stickBottom
        if (prepended && anchorKey != null) {
            val idx = rows.indexOfFirst {
                when (it) {
                    is ToolLanes.Row.Item -> it.item.key == anchorKey
                    is ToolLanes.Row.Fold -> it.fold.key == anchorKey
                    is ToolLanes.Row.LiveStrip -> "live" == anchorKey
                }
            }
            if (idx >= 0) {
                listState.scrollToItem(idx + headerCount(), anchorOffset)
            }
        }
        prevSize = items.size
        prevFirstKey = first
    }

    LaunchedEffect(rows.size, rows.lastOrNull(), busy) {
        if (stickBottom && rows.isNotEmpty()) {
            val last = headerCount() + rows.lastIndex
            listState.animateScrollToItem(last.coerceAtLeast(0))
        }
    }

    LaunchedEffect(listState, earlierCount, loadingEarlier) {
        snapshotFlow {
            val info = listState.layoutInfo
            val total = info.totalItemsCount
            val lastVisible = info.visibleItemsInfo.lastOrNull()?.index ?: 0
            val nearBottom = total == 0 || lastVisible >= total - 2
            val nearTop = listState.firstVisibleItemIndex <= 1
            val anchor =
                info.visibleItemsInfo.firstOrNull {
                    val k = it.key
                    k != "earlier"
                }
            Triple(nearTop, nearBottom, anchor?.let { it.key.toString() to it.offset })
        }
            .distinctUntilChanged()
            .collect { (nearTop, nearBottom, anchor) ->
                stickBottom = nearBottom
                if (anchor != null) {
                    anchorKey = anchor.first
                    anchorOffset = anchor.second
                }
                if (nearTop && earlierCount > 0 && !loadingEarlier) {
                    onLoadEarlier()
                }
            }
    }

    LaunchedEffect(earlierCount, loadingEarlier, items.size) {
        if (!loadingEarlier && earlierCount > 0 && listState.firstVisibleItemIndex <= 1) {
            onLoadEarlier()
        }
    }

    LazyColumn(
        state = listState,
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = RsSpace.chatPadH, vertical = RsSpace.chatPadV),
        verticalArrangement = Arrangement.spacedBy(RsSpace.chatGap),
    ) {
        if (earlierCount > 0 || loadingEarlier) {
            item(key = "earlier") {
                EarlierBanner(
                    count = earlierCount,
                    loading = loadingEarlier,
                    onClick = onLoadEarlier,
                )
            }
        }
        items(
            rows,
            key = { row ->
                when (row) {
                    is ToolLanes.Row.Item -> row.item.key
                    is ToolLanes.Row.Fold -> row.fold.key
                    is ToolLanes.Row.LiveStrip -> "live-strip"
                }
            },
        ) { row ->
            val rowMod = Modifier.animateItem()
            when (row) {
                is ToolLanes.Row.Item ->
                    Box(modifier = rowMod) {
                        when (val item = row.item) {
                            is ChatItem.User -> UserBubble(item, imageUrl)
                            is ChatItem.Assistant ->
                                AssistantBubble(
                                    item = item,
                                    liveThought = item.thought && isLiveThought(items, item.key, busy),
                                )
                            is ChatItem.Tool -> ToolCard(item)
                            is ChatItem.Permission -> PermissionCard(item, onPermission)
                            is ChatItem.Question -> QuestionCard(item, onAnswer, onSkipQuestion)
                            is ChatItem.Notice -> NoticeLine(item)
                            is ChatItem.Status -> StatusLine(item.text)
                        }
                    }
                is ToolLanes.Row.Fold -> {
                    val open = row.fold.live || row.fold.key in openFolds
                    Box(modifier = rowMod) {
                        WorkFoldCard(
                            fold = row.fold,
                            expanded = open,
                            onToggle = {
                                openFolds =
                                    if (row.fold.key in openFolds) openFolds - row.fold.key
                                    else openFolds + row.fold.key
                            },
                        )
                    }
                }
                is ToolLanes.Row.LiveStrip -> Box(modifier = rowMod) { LiveStatusStrip(row.text) }
            }
        }
    }
}

@Composable
private fun WorkFoldCard(
    fold: ToolLanes.WorkFold,
    expanded: Boolean,
    onToggle: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(RsSpace.cornerSm))
                .background(Color.White.copy(alpha = 0.05f))
                .animateContentSize()
                .padding(horizontal = 8.dp, vertical = 6.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onToggle)
                    .padding(vertical = 1.dp),
        ) {
            Icon(
                if (expanded) Icons.Default.KeyboardArrowDown else Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = null,
                tint = RsMuted,
                modifier = Modifier.size(16.dp),
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = fold.summary,
                color = RsText,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
                lineHeight = 16.sp,
            )
        }
        if (!fold.liveStep.isNullOrBlank()) {
            Spacer(modifier = Modifier.height(4.dp))
            GleamLine(fold.liveStep)
        }
        AnimatedVisibility(
            visible = expanded && fold.steps.isNotEmpty(),
            enter = fadeIn() + expandVertically(),
            exit = fadeOut() + shrinkVertically(),
        ) {
            Column(
                verticalArrangement = Arrangement.spacedBy(2.dp),
                modifier = Modifier.padding(top = 4.dp),
            ) {
                fold.steps.forEach { step ->
                    Text(
                        text = step.label,
                        color = if (step.status == "in_progress" || step.status == "pending") RsAccent else RsMuted,
                        fontSize = 12.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        lineHeight = 15.sp,
                        modifier = Modifier.padding(start = 20.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun LiveStatusStrip(text: String) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(vertical = 2.dp),
    ) {
        GleamLine(text)
    }
}

@Composable
private fun GleamLine(text: String) {
    GleamText(
        text = text,
        fontSize = 13.sp,
        maxLines = 2,
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(start = 20.dp, top = 1.dp, bottom = 1.dp),
    )
}

@Composable
private fun EarlierBanner(
    count: Int,
    loading: Boolean,
    onClick: () -> Unit,
) {
    val label =
        when {
            loading -> "正在加载更早的消息…"
            count > 0 -> "${"%,d".format(count)} 条更早 · 上滑或点此加载"
            else -> "加载更早的消息"
        }
    Text(
        text = label,
        color = if (loading) RsMuted else RsAccent,
        fontSize = 12.sp,
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(RsSpace.cornerSm))
                .background(Color.White.copy(alpha = 0.06f))
                .clickable(enabled = !loading && count > 0, onClick = onClick)
                .padding(horizontal = 10.dp, vertical = 7.dp),
    )
}

@Composable
private fun UserBubble(item: ChatItem.User, imageUrl: (ImagePart) -> String?) {
    var viewing by remember { mutableStateOf<Pair<String, String>?>(null) }
    Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.End) {
        Box(
            modifier =
                Modifier
                    .widthIn(max = 560.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(GlassBubbleUserBrush)
                    .padding(horizontal = 10.dp, vertical = 8.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                if (item.images.isNotEmpty()) {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        item.images.take(4).forEach { part ->
                            val url = imageUrl(part)
                            if (url != null) {
                                AsyncImage(
                                    model = url,
                                    contentDescription = part.name,
                                    contentScale = ContentScale.Crop,
                                    modifier =
                                        Modifier
                                            .size(72.dp)
                                            .clip(RoundedCornerShape(10.dp))
                                            .clickable {
                                                viewing = url to part.name.ifBlank { "image" }
                                            },
                                )
                            }
                        }
                    }
                }
                if (item.text.isNotBlank()) {
                    MarkdownText(markdown = item.text)
                }
            }
        }
    }
    viewing?.let { (url, title) ->
        ImageLightbox(
            url = url,
            title = title,
            onDismiss = { viewing = null },
        )
    }
}

@Composable
private fun AssistantBubble(
    item: ChatItem.Assistant,
    liveThought: Boolean = false,
) {
    if (!item.thought) {
        Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.Start) {
            Box(modifier = Modifier.widthIn(max = 720.dp).fillMaxWidth()) {
                MarkdownText(markdown = item.text)
            }
        }
        return
    }

    // Finished thoughts collapse; the live trailing thought stays open.
    var expanded by remember(item.key) { mutableStateOf(liveThought) }
    LaunchedEffect(liveThought) {
        if (liveThought) expanded = true else expanded = false
    }
    val preview =
        item.text
            .lineSequence()
            .firstOrNull { it.isNotBlank() }
            ?.take(72)
            .orEmpty()
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(RsSpace.cornerSm))
                .background(Color.White.copy(alpha = 0.04f))
                .animateContentSize()
                .clickable { expanded = !expanded }
                .padding(horizontal = 8.dp, vertical = 6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                if (expanded) Icons.Default.KeyboardArrowDown else Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = null,
                tint = RsMuted,
                modifier = Modifier.size(16.dp),
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = if (expanded || preview.isEmpty()) "Thought" else "Thought · $preview",
                color = RsMuted,
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
        }
        AnimatedVisibility(
            visible = expanded,
            enter = fadeIn() + expandVertically(),
            exit = fadeOut() + shrinkVertically(),
        ) {
            Box(
                modifier =
                    Modifier
                        .widthIn(max = 720.dp)
                        .fillMaxWidth()
                        .padding(start = 20.dp, top = 4.dp),
            ) {
                MarkdownText(markdown = item.text, muted = true)
            }
        }
    }
}

/** Trailing thought block while the turn is still busy — keep it open. */
private fun isLiveThought(items: List<ChatItem>, key: String, busy: Boolean): Boolean {
    if (!busy) return false
    val idx = items.indexOfFirst { it.key == key }
    if (idx < 0) return false
    return items.drop(idx + 1).all { it is ChatItem.Assistant && it.thought }
}

@Composable
private fun ToolCard(item: ChatItem.Tool) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .background(Color.White.copy(alpha = 0.05f))
                .padding(horizontal = 8.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = item.title.ifBlank { "tool" },
            color = RsText,
            modifier = Modifier.weight(1f),
            maxLines = 2,
            fontSize = 13.sp,
        )
        Text(item.status, color = RsMuted, fontSize = 12.sp)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PermissionCard(
    item: ChatItem.Permission,
    onPermission: (String, String) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(Color.White.copy(alpha = 0.07f))
                .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text("需要许可", color = RsMuted, fontSize = 12.sp, fontWeight = FontWeight.Medium)
        Text(item.title, color = RsText)
        if (item.resolved) {
            Text(item.outcome, color = RsMuted, fontSize = 13.sp)
        } else {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item.options.forEach { opt ->
                    val deny =
                        Regex("reject|deny", RegexOption.IGNORE_CASE)
                            .containsMatchIn("${opt.kind} ${opt.optionId}")
                    Button(
                        onClick = { onPermission(item.requestId, opt.optionId) },
                        colors =
                            ButtonDefaults.buttonColors(
                                containerColor = if (deny) RsDeny else RsAllow,
                                contentColor = RsText,
                            ),
                        shape = RoundedCornerShape(999.dp),
                    ) {
                        Text(opt.name)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun QuestionCard(
    item: ChatItem.Question,
    onAnswer: (String, String) -> Unit,
    onSkip: (String) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(Color.White.copy(alpha = 0.07f))
                .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(item.title, color = RsMuted, fontSize = 12.sp, fontWeight = FontWeight.Medium)
        if (item.prompt.isNotBlank()) Text(item.prompt, color = RsText)
        if (item.answered) {
            Text("已回答", color = RsMuted)
        } else {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item.options.forEach { opt ->
                    OutlinedButton(
                        onClick = { onAnswer(item.askId, opt.optionId) },
                        shape = RoundedCornerShape(999.dp),
                    ) {
                        Text(opt.name)
                    }
                }
                TextButton(onClick = { onSkip(item.askId) }) {
                    Text("Skip")
                }
            }
        }
    }
}

@Composable
private fun NoticeLine(item: ChatItem.Notice) {
    Text(
        text = item.text,
        color = if (item.error) RsDeny else RsMuted,
        fontSize = 13.sp,
        modifier = Modifier.padding(vertical = 2.dp),
    )
}

@Composable
private fun StatusLine(text: String) {
    Text(
        text = text,
        color = RsMuted,
        fontSize = 12.sp,
        modifier = Modifier.padding(vertical = 2.dp),
    )
}
