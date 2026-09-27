package com.ryanstudio.rscursor

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.rememberTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
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
        // The window only cross-fades; the card's own rise and fall is the motion.
        @Suppress("DEPRECATION")
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
        val initial = HostPrefs.get(this).trimEnd('/')
        setContent {
            RsCursorTheme {
                SettingsScreen(
                    initial = initial,
                    validate = { raw -> HostPrefs.normalize(raw).ifEmpty { null } },
                    onDone = { saved ->
                        if (saved != null) {
                            HostPrefs.set(this, saved)
                            setResult(RESULT_OK)
                        }
                        finish()
                    },
                )
            }
        }
    }

    override fun finish() {
        super.finish()
        @Suppress("DEPRECATION")
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
    }
}

/**
 * The card rises and fades in on open. Back and save play it back down
 * before the activity closes, so leaving is a motion too.
 */
@Composable
private fun SettingsScreen(
    initial: String,
    validate: (String) -> String?,
    onDone: (String?) -> Unit,
) {
    var url by remember { mutableStateOf(initial) }
    var error by remember { mutableStateOf(false) }
    val shown = remember { MutableTransitionState(false).apply { targetState = true } }
    var result by remember { mutableStateOf<String?>(null) }
    var leaving by remember { mutableStateOf(false) }

    val leave = { saved: String? ->
        if (!leaving) {
            leaving = true
            result = saved
            shown.targetState = false
        }
    }
    val save = {
        val saved = validate(url)
        error = saved == null
        if (saved != null) leave(saved)
    }
    BackHandler(enabled = !leaving) { leave(null) }
    LaunchedEffect(shown.currentState, shown.isIdle) {
        if (leaving && shown.isIdle && !shown.currentState) onDone(result)
    }

    val transition = rememberTransition(shown, label = "settings")
    val p by transition.animateFloat(
        transitionSpec = {
            if (targetState) spring(dampingRatio = 0.8f, stiffness = Spring.StiffnessMediumLow) else tween(200)
        },
        label = "settings-progress",
    ) { if (it) 1f else 0f }
    val bar by transition.animateFloat(
        transitionSpec = { tween(if (targetState) 320 else 160) },
        label = "settings-bar",
    ) { if (it) 1f else 0f }

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
                        .padding(horizontal = 2.dp)
                        .graphicsLayer {
                            alpha = bar
                            translationX = (1f - bar) * -16.dp.toPx()
                        },
            ) {
                IconButton(onClick = { leave(null) }, modifier = Modifier.size(40.dp)) {
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
                            .graphicsLayer {
                                alpha = p.coerceIn(0f, 1f)
                                val s = 0.92f + 0.08f * p
                                scaleX = s
                                scaleY = s
                                translationY = (1f - p) * 36.dp.toPx()
                            }
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
                    AnimatedVisibility(
                        visible = error,
                        enter = expandVertically(tween(200)) + fadeIn(tween(200)),
                        exit = shrinkVertically(tween(160)) + fadeOut(tween(120)),
                    ) {
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
