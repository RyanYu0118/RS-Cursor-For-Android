package com.ryanstudio.rscursor.ui.theme

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp

/**
 * Title / live-step gleam: muted base with a white highlight sweeping
 * left → right across the glyphs (Compose TextStyle brush).
 */
@Composable
fun GleamText(
    text: String,
    modifier: Modifier = Modifier,
    fontSize: TextUnit = 13.sp,
    fontWeight: FontWeight = FontWeight.Normal,
    maxLines: Int = 1,
    baseColor: Color = RsMuted,
) {
    val transition = rememberInfiniteTransition(label = "gleam")
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec =
            infiniteRepeatable(
                animation = tween(1600, easing = LinearEasing),
                repeatMode = RepeatMode.Restart,
            ),
        label = "gleam-phase",
    )
    var lineWidth by remember { mutableFloatStateOf(0f) }
    val brush =
        remember(phase, lineWidth, baseColor) {
            val w = lineWidth.coerceAtLeast(1f)
            val span = w * 2.2f
            val start = -span + phase * (w + span)
            Brush.linearGradient(
                colorStops =
                    arrayOf(
                        0.00f to baseColor,
                        0.42f to baseColor,
                        0.50f to Color.White.copy(alpha = 0.92f),
                        0.58f to baseColor,
                        1.00f to baseColor,
                    ),
                start = Offset(start, 0f),
                end = Offset(start + span, 0f),
            )
        }
    Text(
        text = text,
        style =
            TextStyle(
                brush = brush,
                fontSize = fontSize,
                fontWeight = fontWeight,
            ),
        maxLines = maxLines,
        overflow = TextOverflow.Ellipsis,
        modifier = modifier.onSizeChanged { lineWidth = it.width.toFloat() },
    )
}
