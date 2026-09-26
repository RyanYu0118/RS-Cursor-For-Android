package com.ryanstudio.rscursor.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

/** Deep luminous field behind liquid glass panels. */
val RsBg = Color(0xFF070A12)
val RsBgMid = Color(0xFF0E1524)
val RsSurface = Color(0x66141C2C)
val RsSurfaceHi = Color(0x99304A6A)
val RsText = Color(0xFFF2F6FF)
val RsMuted = Color(0xB3B8C4D9)
val RsAccent = Color(0xFF7EC8FF)
val RsAccentSoft = Color(0xFFA78BFA)
val RsUserBubble = Color(0x66408CFF)
val RsAssistantBubble = Color(0x55202838)
val RsSkeleton = Color(0x443A4A66)
val RsDeny = Color(0xFFFF8A80)
val RsAllow = Color(0xFF69F0AE)
val RsGlassEdge = Color(0x66FFFFFF)
val RsGlassHighlight = Color(0x33FFFFFF)
val RsGlowCyan = Color(0x5540D0FF)
val RsGlowViolet = Color(0x446080FF)
val RsGlowRose = Color(0x33FF6BD6)

val GlassPanelBrush =
    Brush.linearGradient(
        colors =
            listOf(
                Color(0x55FFFFFF),
                Color(0x22A8C8FF),
                Color(0x1880A0FF),
                Color(0x22FFFFFF),
            ),
    )

val GlassPanelStrongBrush =
    Brush.linearGradient(
        colors =
            listOf(
                Color(0x66FFFFFF),
                Color(0x3380C0FF),
                Color(0x2890A8FF),
                Color(0x33FFFFFF),
            ),
    )

val GlassBorderBrush =
    Brush.linearGradient(
        colors =
            listOf(
                Color(0xAAFFFFFF),
                Color(0x55A0D8FF),
                Color(0x2280A0FF),
                Color(0x66FFFFFF),
            ),
    )

val GlassBubbleUserBrush =
    Brush.linearGradient(
        colors =
            listOf(
                Color(0x8850A0FF),
                Color(0x664080F0),
                Color(0x553070D0),
            ),
    )

val GlassBubbleAssistBrush =
    Brush.linearGradient(
        colors =
            listOf(
                Color(0x44FFFFFF),
                Color(0x33283848),
                Color(0x28182028),
            ),
    )

private val DarkColors =
    darkColorScheme(
        primary = RsAccent,
        onPrimary = RsBg,
        secondary = RsAccentSoft,
        background = RsBg,
        onBackground = RsText,
        surface = Color(0xFF141C2C),
        onSurface = RsText,
        surfaceVariant = Color(0xFF1E2A3C),
        onSurfaceVariant = RsMuted,
        error = RsDeny,
    )

@Composable
fun RsCursorTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColors,
        content = content,
    )
}
