package com.ryanstudio.rscursor.ui.theme

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Immersive light field + liquid-glass surfaces.
 * Approximates HarmonyOS-style glass without true system backdrop blur.
 */
@Composable
fun ImmersiveLightBackground(
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit,
) {
    val transition = rememberInfiniteTransition(label = "light")
    val drift by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec =
            infiniteRepeatable(
                animation = tween(18000, easing = LinearEasing),
                repeatMode = RepeatMode.Reverse,
            ),
        label = "drift",
    )
    val pulse by transition.animateFloat(
        initialValue = 0.85f,
        targetValue = 1.15f,
        animationSpec =
            infiniteRepeatable(
                animation = tween(9000, easing = LinearEasing),
                repeatMode = RepeatMode.Reverse,
            ),
        label = "pulse",
    )

    Box(
        modifier =
            modifier
                .fillMaxSize()
                .drawBehind {
                    drawRect(
                        brush =
                            Brush.verticalGradient(
                                colors = listOf(RsBg, RsBgMid, Color(0xFF101828), RsBg),
                            ),
                    )
                    val w = size.width
                    val h = size.height
                    fun orb(cx: Float, cy: Float, r: Float, c: Color) {
                        drawCircle(
                            brush =
                                Brush.radialGradient(
                                    colors = listOf(c, c.copy(alpha = 0f)),
                                    center = Offset(cx, cy),
                                    radius = r,
                                ),
                            radius = r,
                            center = Offset(cx, cy),
                        )
                    }
                    orb(w * (0.15f + drift * 0.12f), h * 0.18f, w * 0.55f * pulse, RsGlowViolet)
                    orb(w * (0.85f - drift * 0.1f), h * 0.28f, w * 0.48f * pulse, RsGlowCyan)
                    orb(w * (0.45f + drift * 0.08f), h * 0.78f, w * 0.6f, RsGlowRose)
                    orb(w * 0.7f, h * (0.55f + drift * 0.06f), w * 0.35f, RsGlowCyan.copy(alpha = 0.35f))
                    drawRect(
                        brush =
                            Brush.verticalGradient(
                                colors =
                                    listOf(
                                        Color(0x22FFFFFF),
                                        Color(0x00FFFFFF),
                                    ),
                                endY = h * 0.35f,
                            ),
                    )
                },
        content = content,
    )
}

fun Modifier.glassPanel(
    shape: Shape = RoundedCornerShape(22.dp),
    strong: Boolean = false,
    borderWidth: Dp = 1.dp,
): Modifier {
    val fill = if (strong) GlassPanelStrongBrush else GlassPanelBrush
    return this
        .clip(shape)
        .background(fill, shape)
        .border(borderWidth, GlassBorderBrush, shape)
}

@Composable
fun GlassChip(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(18.dp),
    strong: Boolean = false,
    content: @Composable BoxScope.() -> Unit,
) {
    Box(
        modifier = modifier.glassPanel(shape = shape, strong = strong),
        contentAlignment = Alignment.Center,
        content = content,
    )
}

