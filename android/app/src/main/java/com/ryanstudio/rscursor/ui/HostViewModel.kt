package com.ryanstudio.rscursor.ui

import android.app.Application
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.ryanstudio.rscursor.HostPrefs
import com.ryanstudio.rscursor.data.HostRepository
import com.ryanstudio.rscursor.data.HostUiState
import com.ryanstudio.rscursor.data.LocalAttachment
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.ByteArrayOutputStream

class HostViewModel(app: Application) : AndroidViewModel(app) {
    private val repo = HostRepository()
    private val _ui = MutableStateFlow(HostUiState())
    val ui: StateFlow<HostUiState> = _ui.asStateFlow()

    private var unsub: (() -> Unit)? = null

    init {
        unsub = repo.observe { _ui.value = it }
        val host = HostPrefs.get(app)
        repo.setHostUrl(host)
    }

    fun reloadHost() {
        repo.setHostUrl(HostPrefs.get(getApplication()))
    }

    fun attach(id: String) = repo.attach(id)

    fun createSession() = repo.createSession()

    fun createSession(folder: String) = repo.createSession(folder)

    fun openRailItem(chat: com.ryanstudio.rscursor.data.RailChat) = repo.openRailItem(chat)

    fun openPinned(pin: com.ryanstudio.rscursor.data.RailPinned) = repo.openPinned(pin)

    fun pinChat(chat: com.ryanstudio.rscursor.data.RailChat) = repo.pinChat(chat)

    fun unpinChat(chat: com.ryanstudio.rscursor.data.RailChat) = repo.unpinChat(chat)

    fun archiveChat(chat: com.ryanstudio.rscursor.data.RailChat) = repo.archiveChat(chat)

    fun unpinPinned(pin: com.ryanstudio.rscursor.data.RailPinned) = repo.unpinPinned(pin)

    fun archivePinned(pin: com.ryanstudio.rscursor.data.RailPinned) = repo.archivePinned(pin)

    fun toggleRepo(folder: String) = repo.toggleRepo(folder)

    fun setDraft(text: String) = repo.setDraft(text)

    fun send() = repo.sendPrompt()

    fun cancel() = repo.cancel()

    fun setMode(id: String) = repo.setMode(id)

    fun setModel(id: String) = repo.setModel(id)

    fun resolvePermission(requestId: String, optionId: String) =
        repo.resolvePermission(requestId, optionId)

    fun answerQuestion(askId: String, optionId: String) = repo.answerQuestion(askId, optionId)

    fun skipQuestion(askId: String) = repo.skipQuestion(askId)

    fun queueNow(itemId: String) = repo.queueNow(itemId)

    fun queueDrop(itemId: String) = repo.queueDrop(itemId)

    fun queueEdit(itemId: String, text: String) = repo.queueEdit(itemId, text)

    fun loadEarlier() = repo.loadEarlier()

    fun setRailOpen(open: Boolean) = repo.setRailOpen(open)

    fun removeAttachment(index: Int) = repo.removeAttachment(index)

    fun imageUrl(part: com.ryanstudio.rscursor.data.ImagePart) = repo.imageUrl(part)

    fun addImages(uris: List<Uri>) {
        viewModelScope.launch {
            val ctx = getApplication<Application>()
            val parts = ArrayList<LocalAttachment>()
            for (uri in uris) {
                val att = encodeImage(ctx, uri) ?: continue
                parts += att
            }
            if (parts.isNotEmpty()) repo.addAttachments(parts)
        }
    }

    private fun encodeImage(ctx: Application, uri: Uri): LocalAttachment? {
        return try {
            ctx.contentResolver.openInputStream(uri)?.use { input ->
                val bytes = input.readBytes()
                val mime = ctx.contentResolver.getType(uri) ?: "image/jpeg"
                val scaled = scaleDown(bytes, mime)
                LocalAttachment(
                    mimeType = scaled.first,
                    dataBase64 = Base64.encodeToString(scaled.second, Base64.NO_WRAP),
                    displayUri = uri.toString(),
                    name = uri.lastPathSegment ?: "image",
                )
            }
        } catch (_: Exception) {
            null
        }
    }

    /** Keep phone uploads under ~1.5MB so WS prompts stay snappy. */
    private fun scaleDown(bytes: ByteArray, mime: String): Pair<String, ByteArray> {
        if (bytes.size <= 1_500_000) return mime to bytes
        val bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return mime to bytes
        var w = bmp.width
        var h = bmp.height
        val max = 1600
        if (w > max || h > max) {
            val scale = max.toFloat() / maxOf(w, h)
            w = (w * scale).toInt().coerceAtLeast(1)
            h = (h * scale).toInt().coerceAtLeast(1)
        }
        val resized = Bitmap.createScaledBitmap(bmp, w, h, true)
        val out = ByteArrayOutputStream()
        resized.compress(Bitmap.CompressFormat.JPEG, 82, out)
        if (bmp !== resized) bmp.recycle()
        resized.recycle()
        return "image/jpeg" to out.toByteArray()
    }

    override fun onCleared() {
        unsub?.invoke()
        repo.shutdown()
        super.onCleared()
    }
}
