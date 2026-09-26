package com.ryanstudio.rscursor.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.ryanstudio.rscursor.data.ChatItem
import com.ryanstudio.rscursor.data.ImagePart
import com.ryanstudio.rscursor.data.QueueItem
import com.ryanstudio.rscursor.ui.shell.TranscriptSkeleton
import com.ryanstudio.rscursor.ui.theme.GlassBubbleUserBrush
import com.ryanstudio.rscursor.ui.theme.RsAccent
import com.ryanstudio.rscursor.ui.theme.RsAllow
import com.ryanstudio.rscursor.ui.theme.RsDeny
import com.ryanstudio.rscursor.ui.theme.RsMuted
import com.ryanstudio.rscursor.ui.theme.RsText
import kotlinx.coroutines.flow.distinctUntilChanged

@Composable
fun TranscriptScreen(
    ready: Boolean,
    items: List<ChatItem>,
    queue: List<QueueItem>,
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

    val listState = rememberLazyListState()
    var stickBottom by remember { mutableStateOf(true) }
    var anchorKey by remember { mutableStateOf<String?>(null) }
    var anchorOffset by remember { mutableIntStateOf(0) }
    var prevSize by remember { mutableIntStateOf(items.size) }
    var prevFirstKey by remember { mutableStateOf(items.firstOrNull()?.key) }

    fun headerCount(): Int =
        (if (earlierCount > 0 || loadingEarlier) 1 else 0) +
            (if (queue.isNotEmpty()) 1 else 0)

    LaunchedEffect(items.size, items.firstOrNull()?.key) {
        val first = items.firstOrNull()?.key
        val grew = items.size > prevSize
        val prepended = grew && first != null && first != prevFirstKey && !stickBottom
        if (prepended && anchorKey != null) {
            val idx = items.indexOfFirst { it.key == anchorKey }
            if (idx >= 0) {
                listState.scrollToItem(idx + headerCount(), anchorOffset)
            }
        }
        prevSize = items.size
        prevFirstKey = first
    }

    LaunchedEffect(items.size, items.lastOrNull()?.key, busy) {
        if (stickBottom && items.isNotEmpty()) {
            val last = headerCount() + items.lastIndex + if (busy) 1 else 0
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
                    k != "earlier" && k != "queue" && k != "working"
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

    // Still at the top after a chunk landed — keep pulling until the gap is gone
    // or the user scrolls away.
    LaunchedEffect(earlierCount, loadingEarlier, items.size) {
        if (!loadingEarlier && earlierCount > 0 && listState.firstVisibleItemIndex <= 1) {
            onLoadEarlier()
        }
    }

    LazyColumn(
        state = listState,
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
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
        if (queue.isNotEmpty()) {
            item(key = "queue") {
                QueueCard(queue)
            }
        }
        items(items, key = { it.key }) { item ->
            when (item) {
                is ChatItem.User -> UserBubble(item, imageUrl)
                is ChatItem.Assistant -> AssistantBubble(item)
                is ChatItem.Tool -> ToolCard(item)
                is ChatItem.Permission -> PermissionCard(item, onPermission)
                is ChatItem.Question -> QuestionCard(item, onAnswer, onSkipQuestion)
                is ChatItem.Notice -> NoticeLine(item)
                is ChatItem.Status -> StatusLine(item.text)
            }
        }
        if (busy) {
            item(key = "working") {
                StatusLine("Working…")
            }
        }
    }
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
                .clip(RoundedCornerShape(10.dp))
                .background(Color.White.copy(alpha = 0.06f))
                .clickable(enabled = !loading && count > 0, onClick = onClick)
                .padding(horizontal = 12.dp, vertical = 10.dp),
    )
}

@Composable
private fun QueueCard(queue: List<QueueItem>) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(Color.White.copy(alpha = 0.06f))
                .padding(10.dp),
    ) {
        Text("排队中", color = RsMuted, fontSize = 12.sp, fontWeight = FontWeight.Medium)
        queue.forEach { q ->
            Text(
                text = q.text.ifBlank { "(附件)" },
                color = RsText,
                maxLines = 2,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

@Composable
private fun UserBubble(item: ChatItem.User, imageUrl: (ImagePart) -> String?) {
    Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.End) {
        Box(
            modifier =
                Modifier
                    .widthIn(max = 560.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(GlassBubbleUserBrush)
                    .padding(12.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
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
                                            .clip(RoundedCornerShape(10.dp)),
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
}

@Composable
private fun AssistantBubble(item: ChatItem.Assistant) {
    Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.Start) {
        if (item.thought) {
            Text("Thought", color = RsMuted, fontSize = 11.sp, modifier = Modifier.padding(bottom = 2.dp))
        }
        Box(modifier = Modifier.widthIn(max = 720.dp).fillMaxWidth()) {
            MarkdownText(markdown = item.text, muted = item.thought)
        }
    }
}

@Composable
private fun ToolCard(item: ChatItem.Tool) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .background(Color.White.copy(alpha = 0.05f))
                .padding(horizontal = 10.dp, vertical = 8.dp),
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
