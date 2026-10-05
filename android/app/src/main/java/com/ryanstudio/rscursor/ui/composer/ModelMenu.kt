package com.ryanstudio.rscursor.ui.composer

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.rememberTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextStyle
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
import com.ryanstudio.rscursor.ui.theme.ImmersiveGlassSurface
import com.ryanstudio.rscursor.ui.theme.RsAccent
import com.ryanstudio.rscursor.ui.theme.RsMuted
import com.ryanstudio.rscursor.ui.theme.RsText

private val RowShape = RoundedCornerShape(10.dp)
private val SwitchOn = Color(0xFF3DDC84)

/** Above the chip, right edges aligned; below it only when there is no room. */
private class ModelMenuPosition(private val onSide: (Boolean) -> Unit) : PopupPositionProvider {
    override fun calculatePosition(
        anchorBounds: IntRect,
        windowSize: IntSize,
        layoutDirection: LayoutDirection,
        popupContentSize: IntSize,
    ): IntOffset {
        val margin = 8
        val x =
            (anchorBounds.right - popupContentSize.width)
                .coerceAtMost(windowSize.width - popupContentSize.width - margin)
                .coerceAtLeast(margin)
        val above = anchorBounds.top - popupContentSize.height - 8
        val up = above >= margin
        onSide(up)
        val y = if (up) above else (anchorBounds.bottom + 8).coerceAtMost(windowSize.height - popupContentSize.height - margin)
        return IntOffset(x, y)
    }
}

/**
 * Cursor's model sheet: Fast, then Context / Effort, then Model.
 * A row with a chevron slides its choices in from the right.
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
    val visible = remember { MutableTransitionState(false) }
    visible.targetState = expanded
    LaunchedEffect(visible.currentState, visible.isIdle) {
        if (!visible.currentState && visible.isIdle) page = "root"
    }
    if (!visible.currentState && !visible.targetState && visible.isIdle) return

    var openedUp by remember { mutableStateOf(true) }
    val position = remember { ModelMenuPosition { openedUp = it } }
    val transition = rememberTransition(visible, label = "model-menu")
    val progress by transition.animateFloat(
        transitionSpec = {
            if (targetState) spring(dampingRatio = 0.78f, stiffness = Spring.StiffnessMediumLow) else tween(140)
        },
        label = "model-menu-progress",
    ) { if (it) 1f else 0f }

    Popup(
        popupPositionProvider = position,
        onDismissRequest = onDismiss,
        properties = PopupProperties(focusable = true),
    ) {
        ImmersiveGlassSurface(
            modifier =
                Modifier
                    .graphicsLayer {
                        val p = progress
                        alpha = p.coerceIn(0f, 1f)
                        val s = 0.88f + 0.12f * p
                        scaleX = s
                        scaleY = s
                        translationY = (1f - p) * 10.dp.toPx() * if (openedUp) 1f else -1f
                        transformOrigin = TransformOrigin(0.9f, if (openedUp) 1f else 0f)
                    }
                    .width(272.dp),
        ) {
            AnimatedContent(
                targetState = page,
                transitionSpec = {
                    val forward = initialState == "root"
                    val enter =
                        slideInHorizontally(spring(dampingRatio = 0.86f, stiffness = Spring.StiffnessMediumLow)) {
                            if (forward) it / 3 else -it / 3
                        } + fadeIn(tween(180))
                    val exit =
                        slideOutHorizontally(tween(160)) { if (forward) -it / 4 else it / 4 } + fadeOut(tween(120))
                    (enter togetherWith exit).using(SizeTransform(clip = false))
                },
                label = "model-menu-page",
                modifier = Modifier.padding(6.dp),
            ) { shown ->
                Column {
                    when {
                        shown == "models" ->
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
                                    onDismiss()
                                },
                            )
                        shown.startsWith("param:") -> {
                            val parameter = controls.parameters.find { it.id == shown.removePrefix("param:") }
                            if (parameter != null) {
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
                GlowSwitch(on = parameter.on)
            }
        } else {
            MenuRow(label = parameter.label, onClick = { onOpen(parameter) }) {
                ValueChevron(parameter.value)
            }
        }
    }
    if (ordered.isNotEmpty()) GlassRule()
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
    MenuRow(label = "‹  $title", muted = true, onClick = onBack) {}
    for (option in options) {
        MenuRow(label = option, selected = option == selected, onClick = { onPick(option) }) {
            if (option == selected) Check()
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
    MenuRow(label = "‹  Model", muted = true, onClick = onBack) {}
    BasicTextField(
        value = query,
        onValueChange = onQuery,
        singleLine = true,
        textStyle = TextStyle(color = RsText, fontSize = 14.sp),
        cursorBrush = SolidColor(RsAccent),
        decorationBox = { inner ->
            Box(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 4.dp, vertical = 2.dp)
                    .clip(RowShape)
                    .background(Color.White.copy(alpha = 0.07f))
                    .padding(horizontal = 10.dp, vertical = 8.dp),
            ) {
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
                .heightIn(max = 320.dp)
                .verticalScroll(rememberScrollState()),
    ) {
        if (needle.isEmpty() || "auto".contains(needle)) {
            MenuRow(label = "Auto", selected = controls.auto, onClick = onAuto) {
                if (controls.auto) Check()
            }
        }
        for (model in catalog.models) {
            if (model.id == "default[]" || model.id == "default") continue
            if (needle.isNotEmpty() && !model.name.lowercase().contains(needle)) continue
            val selected = !controls.auto && model.id == currentModelId
            MenuRow(label = model.name, selected = selected, onClick = { onModel(model.id) }) {
                if (selected) Check()
            }
        }
    }
}

/** A glass row: a press lights it, the chosen one keeps a faint accent wash. */
@Composable
private fun MenuRow(
    label: String,
    onClick: () -> Unit,
    selected: Boolean = false,
    muted: Boolean = false,
    trailing: @Composable () -> Unit,
) {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val fill by animateColorAsState(
        when {
            pressed -> Color.White.copy(alpha = 0.14f)
            selected -> RsAccent.copy(alpha = 0.16f)
            else -> Color.Transparent
        },
        animationSpec = tween(120),
        label = "model-row-fill",
    )
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RowShape)
                .background(fill, RowShape)
                .clickable(interactionSource = source, indication = null, onClick = onClick)
                .padding(horizontal = 12.dp, vertical = 10.dp),
    ) {
        Text(
            label,
            color = if (muted) RsMuted else if (selected) RsAccent else RsText,
            fontSize = 14.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        trailing()
    }
}

@Composable
private fun GlassRule() {
    Box(
        Modifier
            .padding(horizontal = 8.dp, vertical = 4.dp)
            .fillMaxWidth()
            .size(height = 1.dp, width = 0.dp)
            .background(Color.White.copy(alpha = 0.10f)),
    )
}

@Composable
private fun Check() {
    Text("✓", color = RsAccent, fontSize = 14.sp)
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
        Text("  ›", color = RsMuted, fontSize = 14.sp)
    }
}

/** Track eases to green and the thumb springs across, like Cursor's switch. */
@Composable
private fun GlowSwitch(on: Boolean) {
    val thumb by animateDpAsState(
        if (on) 14.dp else 0.dp,
        animationSpec = spring(dampingRatio = 0.7f, stiffness = Spring.StiffnessMedium),
        label = "switch-thumb",
    )
    val track by animateColorAsState(
        if (on) SwitchOn else Color.White.copy(alpha = 0.16f),
        animationSpec = tween(160),
        label = "switch-track",
    )
    Box(
        modifier =
            Modifier
                .padding(start = 12.dp)
                .size(width = 36.dp, height = 22.dp)
                .clip(CircleShape)
                .background(track),
    ) {
        Box(
            modifier =
                Modifier
                    .align(Alignment.CenterStart)
                    .padding(2.dp)
                    .offset(x = thumb)
                    .size(18.dp)
                    .clip(CircleShape)
                    .background(Color.White),
        )
    }
}
