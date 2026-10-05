package com.ryanstudio.rscursor.ui.composer

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupPositionProvider
import androidx.compose.ui.window.PopupProperties
import com.ryanstudio.rscursor.data.Catalog
import com.ryanstudio.rscursor.data.ModelControls
import com.ryanstudio.rscursor.data.ModelParameter
import com.ryanstudio.rscursor.ui.theme.RsMuted
import com.ryanstudio.rscursor.ui.theme.RsText

private val MenuShape = RoundedCornerShape(12.dp)
private val RowShape = RoundedCornerShape(8.dp)
private val MenuBg = Color(0xF21A1A1A)
private val RowHover = Color(0xFF2C2C2E)
private val SwitchOn = Color(0xFF3DDC84)

/** Popup sits above the chip, its right edge on the chip's right edge. */
private object ModelMenuPosition : PopupPositionProvider {
    override fun calculatePosition(
        anchorBounds: IntRect,
        windowSize: IntSize,
        layoutDirection: LayoutDirection,
        popupContentSize: IntSize,
    ): IntOffset {
        val margin = 8
        val x = (anchorBounds.right - popupContentSize.width).coerceIn(margin, (windowSize.width - popupContentSize.width - margin).coerceAtLeast(margin))
        val above = anchorBounds.top - popupContentSize.height - 6
        val y = if (above >= margin) above else (anchorBounds.bottom + 6).coerceAtMost(windowSize.height - popupContentSize.height - margin)
        return IntOffset(x, y)
    }
}

/**
 * Cursor's model sheet: Fast, then Context / Effort, then Model.
 * A row with a chevron opens its choices in place.
 */
@Composable
fun ModelMenu(
    expanded: Boolean,
    controls: ModelControls,
    catalog: Catalog,
    currentModelId: String,
    onDismiss: () -> Unit,
    onParameter: (String, Any) -> Unit,
    onModel: (String) -> Unit,
    onAuto: (Boolean) -> Unit,
) {
    var page by remember { mutableStateOf("root") }
    var query by remember { mutableStateOf("") }
    LaunchedEffect(expanded) {
        if (!expanded) page = "root"
    }
    if (!expanded) return
    Popup(
        popupPositionProvider = ModelMenuPosition,
        onDismissRequest = onDismiss,
        properties = PopupProperties(focusable = true),
    ) {
        Column(
            modifier =
                Modifier
                    .width(268.dp)
                    .clip(MenuShape)
                    .background(MenuBg)
                    .border(1.dp, Color.White.copy(alpha = 0.08f), MenuShape)
                    .padding(4.dp),
        ) {
            when {
                page == "models" ->
                    ModelList(
                        query = query,
                        onQuery = { query = it },
                        catalog = catalog,
                        controls = controls,
                        currentModelId = currentModelId,
                        onBack = { page = "root" },
                        onAuto = {
                            onAuto(true)
                            page = "root"
                        },
                        onModel = {
                            onModel(it)
                            page = "root"
                            onDismiss()
                        },
                    )
                page.startsWith("param:") -> {
                    val id = page.removePrefix("param:")
                    val parameter = controls.parameters.find { it.id == id }
                    if (parameter == null) {
                        page = "root"
                    } else {
                        ChoiceList(
                            title = parameter.label,
                            options = parameter.options.ifEmpty { listOf(parameter.value) },
                            selected = parameter.value,
                            onBack = { page = "root" },
                            onPick = {
                                onParameter(parameter.id, it)
                                page = "root"
                            },
                        )
                    }
                }
                else ->
                    RootPage(
                        controls = controls,
                        onToggle = { parameter, on -> onParameter(parameter.id, on) },
                        onOpen = { page = "param:${it.id}" },
                        onOpenModels = {
                            query = ""
                            page = "models"
                        },
                    )
            }
        }
    }
}

@Composable
private fun RootPage(
    controls: ModelControls,
    onToggle: (ModelParameter, Boolean) -> Unit,
    onOpen: (ModelParameter) -> Unit,
    onOpenModels: () -> Unit,
) {
    val parameters = controls.parameters
    val ordered = parameters.filter { it.id == "fast" } + parameters.filter { it.id != "fast" }
    if (controls.auto && ordered.isEmpty()) {
        Text(
            "Balanced quality and speed, recommended for most tasks",
            color = RsMuted,
            fontSize = 12.sp,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
        )
    }
    for (parameter in ordered) {
        if (parameter.type == "toggle") {
            MenuRow(label = parameter.label, onClick = { onToggle(parameter, !parameter.on) }) {
                MiniSwitch(on = parameter.on)
            }
        } else {
            MenuRow(label = parameter.label, onClick = { onOpen(parameter) }) {
                ValueChevron(parameter.value)
            }
        }
    }
    MenuRow(label = "Model", onClick = onOpenModels) {
        ValueChevron(if (controls.auto) "Auto" else controls.model.ifBlank { "Choose" })
    }
}

@Composable
private fun ChoiceList(
    title: String,
    options: List<String>,
    selected: String,
    onBack: () -> Unit,
    onPick: (String) -> Unit,
) {
    MenuRow(label = "‹ $title", onClick = onBack) {}
    for (option in options) {
        MenuRow(label = option, onClick = { onPick(option) }) {
            if (option == selected) Text("✓", color = RsText, fontSize = 14.sp)
        }
    }
}

@Composable
private fun ModelList(
    query: String,
    onQuery: (String) -> Unit,
    catalog: Catalog,
    controls: ModelControls,
    currentModelId: String,
    onBack: () -> Unit,
    onAuto: () -> Unit,
    onModel: (String) -> Unit,
) {
    MenuRow(label = "‹ Model", onClick = onBack) {}
    BasicTextField(
        value = query,
        onValueChange = onQuery,
        singleLine = true,
        textStyle = androidx.compose.ui.text.TextStyle(color = RsText, fontSize = 14.sp),
        cursorBrush = SolidColor(RsText),
        decorationBox = { inner ->
            Box(Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                if (query.isEmpty()) Text("Search models", color = RsMuted, fontSize = 14.sp)
                inner()
            }
        },
        modifier = Modifier.fillMaxWidth(),
    )
    val needle = query.trim().lowercase()
    Column(
        modifier =
            Modifier
                .height(320.dp)
                .verticalScroll(rememberScrollState()),
    ) {
        if (needle.isEmpty() || "auto".contains(needle)) {
            MenuRow(label = "Auto", onClick = onAuto) {
                if (controls.auto) Text("✓", color = RsText, fontSize = 14.sp)
            }
        }
        for (model in catalog.models) {
            if (model.id == "default[]" || model.id == "default") continue
            if (needle.isNotEmpty() && !model.name.lowercase().contains(needle)) continue
            val selected = !controls.auto && model.id == currentModelId
            MenuRow(label = model.name, onClick = { onModel(model.id) }) {
                if (selected) Text("✓", color = RsText, fontSize = 14.sp)
            }
        }
    }
}

@Composable
private fun MenuRow(
    label: String,
    onClick: () -> Unit,
    trailing: @Composable () -> Unit,
) {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RowShape)
                .background(if (pressed) RowHover else Color.Transparent)
                .clickable(interactionSource = source, indication = null, onClick = onClick)
                .padding(horizontal = 12.dp, vertical = 10.dp),
    ) {
        Text(
            label,
            color = RsText,
            fontSize = 14.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        trailing()
    }
}

@Composable
private fun ValueChevron(value: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            value,
            color = RsMuted,
            fontSize = 13.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(" ›", color = RsMuted, fontSize = 14.sp)
    }
}

@Composable
private fun MiniSwitch(on: Boolean) {
    Box(
        modifier =
            Modifier
                .padding(start = 12.dp)
                .size(width = 36.dp, height = 22.dp)
                .clip(CircleShape)
                .background(if (on) SwitchOn else Color(0xFF3A3A3C)),
    ) {
        Box(
            modifier =
                Modifier
                    .align(Alignment.CenterStart)
                    .padding(2.dp)
                    .offset(x = if (on) 14.dp else 0.dp)
                    .size(18.dp)
                    .clip(CircleShape)
                    .background(Color.White),
        )
    }
}
