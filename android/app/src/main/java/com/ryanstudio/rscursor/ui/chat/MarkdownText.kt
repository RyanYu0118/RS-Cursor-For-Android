package com.ryanstudio.rscursor.ui.chat

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.mikepenz.markdown.m3.Markdown
import com.mikepenz.markdown.m3.markdownColor
import com.mikepenz.markdown.m3.markdownTypography
import com.ryanstudio.rscursor.ui.theme.RsAccent
import com.ryanstudio.rscursor.ui.theme.RsMuted
import com.ryanstudio.rscursor.ui.theme.RsText

/** Render agent/user prose as Markdown (not raw `**md**` source). */
@Composable
fun MarkdownText(
    markdown: String,
    modifier: Modifier = Modifier,
    muted: Boolean = false,
) {
    val body = if (muted) RsMuted else RsText
    Markdown(
        content = markdown,
        modifier = modifier,
        colors =
            markdownColor(
                text = body,
                codeBackground = Color.White.copy(alpha = 0.08f),
                codeText = body,
                inlineCodeBackground = Color.White.copy(alpha = 0.1f),
                inlineCodeText = body,
                linkText = RsAccent,
                dividerColor = RsMuted.copy(alpha = 0.35f),
            ),
        typography =
            markdownTypography(
                h1 = TextStyle(color = body, fontSize = 22.sp, fontWeight = FontWeight.SemiBold),
                h2 = TextStyle(color = body, fontSize = 19.sp, fontWeight = FontWeight.SemiBold),
                h3 = TextStyle(color = body, fontSize = 17.sp, fontWeight = FontWeight.SemiBold),
                h4 = TextStyle(color = body, fontSize = 16.sp, fontWeight = FontWeight.Medium),
                h5 = TextStyle(color = body, fontSize = 15.sp, fontWeight = FontWeight.Medium),
                h6 = TextStyle(color = body, fontSize = 14.sp, fontWeight = FontWeight.Medium),
                text = TextStyle(color = body, fontSize = 15.sp, lineHeight = 22.sp),
                code = TextStyle(color = body, fontSize = 13.sp, fontFamily = FontFamily.Monospace, lineHeight = 18.sp),
                inlineCode = TextStyle(color = body, fontSize = 13.sp, fontFamily = FontFamily.Monospace),
                quote = TextStyle(color = RsMuted, fontSize = 15.sp, lineHeight = 22.sp),
                paragraph = TextStyle(color = body, fontSize = 15.sp, lineHeight = 22.sp),
                ordered = TextStyle(color = body, fontSize = 15.sp, lineHeight = 22.sp),
                bullet = TextStyle(color = body, fontSize = 15.sp, lineHeight = 22.sp),
                list = TextStyle(color = body, fontSize = 15.sp, lineHeight = 22.sp),
            ),
    )
}
