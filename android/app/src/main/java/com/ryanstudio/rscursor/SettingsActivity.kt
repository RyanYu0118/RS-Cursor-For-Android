package com.ryanstudio.rscursor

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ryanstudio.rscursor.ui.theme.GlassButton
import com.ryanstudio.rscursor.ui.theme.GlassTextField
import com.ryanstudio.rscursor.ui.theme.ImmersiveLightBackground
import com.ryanstudio.rscursor.ui.theme.RsCursorTheme
import com.ryanstudio.rscursor.ui.theme.RsDeny
import com.ryanstudio.rscursor.ui.theme.RsMuted
import com.ryanstudio.rscursor.ui.theme.RsSpace
import com.ryanstudio.rscursor.ui.theme.RsText
import com.ryanstudio.rscursor.ui.theme.glassPanel

/** First-run / later edits of the Auto host URL. */
class SettingsActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val initial = HostPrefs.get(this).trimEnd('/')
        setContent {
            RsCursorTheme {
                SettingsScreen(
                    initial = initial,
                    onBack = { finish() },
                    onSave = { raw ->
                        val normalized = HostPrefs.normalize(raw)
                        if (normalized.isEmpty()) {
                            false
                        } else {
                            HostPrefs.set(this, normalized)
                            setResult(RESULT_OK)
                            finish()
                            true
                        }
                    },
                )
            }
        }
    }
}

@Composable
private fun SettingsScreen(
    initial: String,
    onBack: () -> Unit,
    onSave: (String) -> Boolean,
) {
    var url by remember { mutableStateOf(initial) }
    var error by remember { mutableStateOf(false) }
    val save = {
        error = !onSave(url)
    }
    ImmersiveLightBackground {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .statusBarsPadding()
                    .navigationBarsPadding()
                    .imePadding(),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(RsSpace.bar)
                        .padding(horizontal = 2.dp),
            ) {
                IconButton(onClick = onBack, modifier = Modifier.size(40.dp)) {
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "返回",
                        tint = RsText,
                        modifier = Modifier.size(20.dp),
                    )
                }
                Text("主机地址", color = RsText, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
            }
            Box(
                contentAlignment = Alignment.Center,
                modifier =
                    Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp),
            ) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier =
                        Modifier
                            .widthIn(max = 480.dp)
                            .fillMaxWidth()
                            .glassPanel(shape = RoundedCornerShape(22.dp), strong = true)
                            .padding(horizontal = 22.dp, vertical = 22.dp),
                ) {
                    Text("Auto 主机 URL", color = RsText, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                    GlassTextField(
                        value = url,
                        onValueChange = {
                            url = it
                            error = false
                        },
                        placeholder = "http://100.x.y.z:4331",
                        keyboardOptions =
                            KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Done),
                        keyboardActions = KeyboardActions(onDone = { save() }),
                    )
                    Text(
                        "填电脑上 Auto 的地址（Tailscale IP + 端口 4331）。主机仍跑在电脑；本 App 用原生界面连接。",
                        color = RsMuted,
                        fontSize = 13.sp,
                        lineHeight = 18.sp,
                    )
                    if (error) {
                        Text("还没有主机地址。先填电脑上 Auto 的 URL。", color = RsDeny, fontSize = 13.sp)
                    }
                    Box(modifier = Modifier.align(Alignment.End)) {
                        GlassButton("保存并打开", primary = true, onClick = save)
                    }
                }
            }
        }
    }
}
