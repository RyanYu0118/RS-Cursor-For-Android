package com.ryanstudio.rscursor.ui.rail

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ryanstudio.rscursor.data.SessionMeta
import com.ryanstudio.rscursor.ui.theme.RsAccent
import com.ryanstudio.rscursor.ui.theme.RsMuted
import com.ryanstudio.rscursor.ui.theme.RsText

@Composable
fun SessionRail(
    sessions: List<SessionMeta>,
    activeId: String?,
    onSelect: (String) -> Unit,
    onNew: () -> Unit,
    onSettings: () -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .width(248.dp)
                .fillMaxHeight()
                .padding(start = 4.dp, top = 0.dp, bottom = 4.dp, end = 4.dp)
                .padding(horizontal = 6.dp, vertical = 4.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "RS Cursor",
                color = RsText,
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp,
                modifier = Modifier.weight(1f).padding(start = 6.dp),
            )
            IconButton(onClick = onClose) {
                Icon(Icons.Default.Close, contentDescription = "关闭侧栏", tint = RsMuted)
            }
        }
        Text(
            text = "会话",
            color = RsMuted,
            fontSize = 11.sp,
            modifier = Modifier.padding(top = 2.dp, bottom = 4.dp, start = 8.dp),
        )
        LazyColumn(
            modifier = Modifier.weight(1f).fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            items(sessions, key = { it.id }) { session ->
                SessionRow(
                    session = session,
                    selected = session.id == activeId,
                    onClick = { onSelect(session.id) },
                )
            }
        }
        Spacer(modifier = Modifier.height(4.dp))
        TextButton(onClick = onNew, modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp), tint = RsAccent)
            Spacer(modifier = Modifier.width(4.dp))
            Text("新建会话", color = RsText, fontSize = 13.sp)
        }
        TextButton(onClick = onSettings, modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Default.Settings, contentDescription = null, modifier = Modifier.size(16.dp), tint = RsMuted)
            Spacer(modifier = Modifier.width(4.dp))
            Text("主机设置", color = RsMuted, fontSize = 13.sp)
        }
    }
}

@Composable
private fun SessionRow(
    session: SessionMeta,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val bg = if (selected) Color.White.copy(alpha = 0.1f) else Color.Transparent
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .background(bg)
                .clickable(onClick = onClick)
                .padding(horizontal = 10.dp, vertical = 8.dp),
    ) {
        Text(
            text = session.title,
            color = if (selected) RsAccent else RsText,
            fontWeight = if (selected) FontWeight.Medium else FontWeight.Normal,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            style = MaterialTheme.typography.bodyMedium,
            fontSize = 14.sp,
        )
        val sub =
            buildString {
                if (session.status == "busy" || session.status == "starting") append("工作中 · ")
                append(session.folder.substringAfterLast('\\').substringAfterLast('/').ifBlank { session.folder })
            }
        if (sub.isNotBlank()) {
            Text(
                text = sub,
                color = RsMuted,
                fontSize = 11.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
