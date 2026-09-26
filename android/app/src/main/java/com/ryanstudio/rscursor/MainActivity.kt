package com.ryanstudio.rscursor

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ryanstudio.rscursor.ui.HostViewModel
import com.ryanstudio.rscursor.ui.shell.AppScaffold
import com.ryanstudio.rscursor.ui.theme.RsCursorTheme

/**
 * Native Compose shell for Auto: rail, transcript, composer, + menu.
 * Host stays on the computer; this Activity is a WS/REST client.
 */
class MainActivity : ComponentActivity() {
    private val vm: HostViewModel by viewModels()

    private val openSettings =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            vm.reloadHost()
        }

    private val pickImages =
        registerForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(8)) { uris ->
            if (uris.isNotEmpty()) vm.addImages(uris)
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            RsCursorTheme {
                val state by vm.ui.collectAsStateWithLifecycle()
                AppScaffold(
                    state = state,
                    onOpenChat = vm::openRailItem,
                    onOpenPinned = vm::openPinned,
                    onPinChat = vm::pinChat,
                    onUnpinChat = vm::unpinChat,
                    onArchiveChat = vm::archiveChat,
                    onUnpinPinned = vm::unpinPinned,
                    onArchivePinned = vm::archivePinned,
                    onNewSession = { vm.createSession() },
                    onNewInFolder = { folder -> vm.createSession(folder) },
                    onToggleRepo = vm::toggleRepo,
                    onSettings = {
                        openSettings.launch(Intent(this, SettingsActivity::class.java))
                    },
                    onOpenWeb = {
                        startActivity(Intent(this, WebShellActivity::class.java))
                    },
                    onDraftChange = vm::setDraft,
                    onSend = vm::send,
                    onCancel = vm::cancel,
                    onPickFiles = {
                        pickImages.launch(
                            PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
                        )
                    },
                    onRemoveAttachment = vm::removeAttachment,
                    onMode = vm::setMode,
                    onModel = vm::setModel,
                    onPermission = vm::resolvePermission,
                    onAnswer = vm::answerQuestion,
                    onSkipQuestion = vm::skipQuestion,
                    onQueueNow = vm::queueNow,
                    onQueueDrop = vm::queueDrop,
                    onQueueEdit = vm::queueEdit,
                    onLoadEarlier = vm::loadEarlier,
                    onRailOpen = vm::setRailOpen,
                    imageUrl = vm::imageUrl,
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Settings may have changed host while we were paused via back stack.
        if (HostPrefs.get(this) != vm.ui.value.hostUrl) {
            vm.reloadHost()
        }
    }
}
