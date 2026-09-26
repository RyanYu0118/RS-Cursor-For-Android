package com.ryanstudio.rscursor.ui.shell

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.unit.dp
import com.ryanstudio.rscursor.ui.theme.ImmersiveLightBackground
import com.ryanstudio.rscursor.ui.theme.RsSkeleton
import com.ryanstudio.rscursor.ui.theme.RsSpace
import com.ryanstudio.rscursor.ui.theme.glassPanel

@Composable
fun SkeletonShell(
    showRail: Boolean,
    modifier: Modifier = Modifier,
) {
    ImmersiveLightBackground(modifier = modifier) {
        Row(
            modifier =
                Modifier
                    .fillMaxSize()
                    .statusBarsPadding()
                    .windowInsetsPadding(WindowInsets.navigationBars)
                    .padding(RsSpace.page),
        ) {
            if (showRail) {
                Column(
                    modifier =
                        Modifier
                            .width(RsSpace.railWidth)
                            .fillMaxHeight()
                            .padding(6.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Bone(Modifier.fillMaxWidth(0.55f).height(14.dp))
                    Spacer(modifier = Modifier.height(2.dp))
                    repeat(6) {
                        Bone(Modifier.fillMaxWidth().height(28.dp))
                    }
                }
            }
            Column(
                modifier =
                    Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .glassPanel(shape = RoundedCornerShape(RsSpace.corner))
                        .padding(10.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Bone(Modifier.fillMaxWidth(0.4f).height(14.dp))
                Bone(Modifier.fillMaxWidth(0.72f).height(40.dp))
                Bone(Modifier.fillMaxWidth(0.9f).height(56.dp))
                Bone(Modifier.fillMaxWidth(0.55f).height(32.dp))
                Spacer(modifier = Modifier.weight(1f))
                Bone(Modifier.fillMaxWidth().height(40.dp))
            }
        }
    }
}

@Composable
fun TranscriptSkeleton(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxSize().padding(RsSpace.chatPadH),
        verticalArrangement = Arrangement.spacedBy(RsSpace.chatGap),
    ) {
        Bone(Modifier.fillMaxWidth(0.7f).height(40.dp))
        Bone(Modifier.fillMaxWidth(0.85f).height(56.dp))
        Bone(Modifier.fillMaxWidth(0.5f).height(28.dp))
        Bone(Modifier.fillMaxWidth(0.9f).height(48.dp))
    }
}

@Composable
private fun Bone(modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "shimmer")
    val shift by
        transition.animateFloat(
            initialValue = 0f,
            targetValue = 1f,
            animationSpec =
                infiniteRepeatable(
                    animation = tween(1400, easing = LinearEasing),
                    repeatMode = RepeatMode.Restart,
                ),
            label = "shift",
        )
    val brush =
        Brush.horizontalGradient(
            colors =
                listOf(
                    RsSkeleton.copy(alpha = 0.35f),
                    RsSkeleton.copy(alpha = 0.85f),
                    RsSkeleton.copy(alpha = 0.35f),
                ),
            startX = shift * 420f - 210f,
            endX = shift * 420f + 210f,
        )
    Box(modifier = modifier.clip(RoundedCornerShape(10.dp)).background(brush))
}
