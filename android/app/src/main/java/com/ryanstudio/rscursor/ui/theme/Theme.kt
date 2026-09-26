package com.ryanstudio.rscursor.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val RsBg = Color(0xFF0F1115)
val RsSurface = Color(0xFF181B22)
val RsSurfaceHi = Color(0xFF22262F)
val RsText = Color(0xFFE8EAED)
val RsMuted = Color(0xFF9AA0A6)
val RsAccent = Color(0xFF8AB4F8)
val RsUserBubble = Color(0xFF1E3A5F)
val RsAssistantBubble = Color(0xFF1A1D24)
val RsSkeleton = Color(0xFF2A2E38)
val RsDeny = Color(0xFFE57373)
val RsAllow = Color(0xFF81C784)

private val DarkColors =
    darkColorScheme(
        primary = RsAccent,
        onPrimary = RsBg,
        secondary = RsAccent,
        background = RsBg,
        onBackground = RsText,
        surface = RsSurface,
        onSurface = RsText,
        surfaceVariant = RsSurfaceHi,
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
