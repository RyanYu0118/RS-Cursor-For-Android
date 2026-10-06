package com.ryanstudio.rscursor.ui.theme

import android.content.Context
import android.graphics.Typeface
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Cursor's own icon font, fetched once from the host (`/api/cursor-icons.ttf`,
 * converted from the installed Cursor) and kept in app storage, so a chat's
 * icon draws exactly as in Cursor's sidebar.
 */
object CursorIcons {
    var family by mutableStateOf<FontFamily?>(null)
        private set

    private var checkedHost = ""

    suspend fun load(context: Context, hostUrl: String) {
        val origin = hostUrl.trim().trimEnd('/')
        val file = File(context.filesDir, "cursor-icons.ttf")
        val tag = File(context.filesDir, "cursor-icons.etag")
        withContext(Dispatchers.IO) {
            if (family == null && file.length() > 0) use(file)
            if (origin.isBlank() || origin == checkedHost) return@withContext
            try {
                val conn = URL("$origin/api/cursor-icons.ttf").openConnection() as HttpURLConnection
                conn.connectTimeout = 6_000
                conn.readTimeout = 15_000
                if (file.length() > 0 && tag.exists()) conn.setRequestProperty("If-None-Match", tag.readText())
                when (conn.responseCode) {
                    200 -> {
                        val tmp = File(context.filesDir, "cursor-icons.ttf.part")
                        conn.inputStream.use { input -> tmp.outputStream().use { input.copyTo(it) } }
                        if (tmp.length() > 0 && tmp.renameTo(file).not()) {
                            tmp.copyTo(file, overwrite = true)
                            tmp.delete()
                        }
                        conn.getHeaderField("ETag")?.let { tag.writeText(it) }
                        use(file)
                    }
                    304 -> Unit
                }
                checkedHost = origin
                conn.disconnect()
            } catch (_: Exception) {
                // Offline or an older host: keep whatever font is cached.
            }
        }
    }

    private fun use(file: File) {
        family =
            try {
                FontFamily(Typeface.createFromFile(file))
            } catch (_: Exception) {
                null
            }
    }

    /** Cursor's icon colour ids, as its picker draws them. Default is muted text, as in its sidebar. */
    fun color(id: String): Color? =
        when (id.trim().lowercase()) {
            "", "default" -> null
            "green" -> Color(0xFF3FA266)
            "cyan" -> Color(0xFF81A1C1)
            "blue" -> Color(0xFF7BAFE9)
            "purple" -> Color(0xFF9386F2)
            "magenta" -> Color(0xFFB48EAD)
            "orange" -> Color(0xFFBE7C67)
            "yellow" -> Color(0xFFF1B467)
            "red" -> Color(0xFFFC6B83)
            "brand" -> Color(0xFFF54E00)
            else -> null
        }
}

/** One cursor-icons glyph; nothing when the font has not arrived yet. */
@Composable
fun CursorGlyph(
    glyph: String,
    tint: Color,
    size: Dp = 14.dp,
    modifier: Modifier = Modifier,
) {
    val family = CursorIcons.family ?: return
    val fontSize = with(LocalDensity.current) { size.toSp() }
    Box(modifier = modifier.size(size), contentAlignment = Alignment.Center) {
        Text(
            glyph,
            color = tint,
            fontFamily = family,
            fontSize = fontSize,
            lineHeight = fontSize,
            textAlign = TextAlign.Center,
            maxLines = 1,
        )
    }
}
