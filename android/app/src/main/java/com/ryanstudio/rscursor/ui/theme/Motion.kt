package com.ryanstudio.rscursor.ui.theme

import androidx.compose.animation.ContentTransform
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.ui.unit.dp

/** Shared compact spacing for the pad shell. */
object RsSpace {
    val page = 6.dp
    val pane = 6.dp
    val bar = 48.dp
    val railWidth = 248.dp
    val chatGap = 6.dp
    val chatPadH = 12.dp
    val chatPadV = 6.dp
    val railRowV = 4.dp
    val railRowH = 8.dp
    val composerPadH = 8.dp
    val composerPadV = 4.dp
    val corner = 18.dp
    val cornerSm = 10.dp
}

object RsMotion {
    const val Fast = 180
    const val Normal = 260
    const val Slow = 360

    fun fadeSlide(): ContentTransform =
        (
            fadeIn(tween(Normal, easing = FastOutSlowInEasing)) +
                slideInVertically(tween(Normal, easing = FastOutSlowInEasing)) { it / 24 }
        ) togetherWith (
            fadeOut(tween(Fast)) +
                slideOutVertically(tween(Fast)) { -it / 32 }
        )

    val railEnter: EnterTransition =
        slideInHorizontally(tween(Normal, easing = FastOutSlowInEasing)) { -it / 3 } +
            fadeIn(tween(Normal))

    val railExit: ExitTransition =
        slideOutHorizontally(tween(Fast)) { -it / 3 } + fadeOut(tween(Fast))

    val fadeOnly: ContentTransform =
        fadeIn(tween(Normal)) togetherWith fadeOut(tween(Fast))
}
