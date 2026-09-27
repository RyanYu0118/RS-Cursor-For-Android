package com.ryanstudio.rscursor.ui.theme

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.rememberTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupPositionProvider
import androidx.compose.ui.window.PopupProperties

private val OverlayShape = RoundedCornerShape(18.dp)
private val ItemShape = RoundedCornerShape(10.dp)

/**
 * A floating glass sheet lit from inside: a deep tint for legibility, two
 * slowly drifting glow orbs, a top sheen and the glass edge — the same light
 * field as the page behind, so a menu reads as part of it, not a grey box.
 */
@Composable
fun ImmersiveGlassSurface(
    modifier: Modifier = Modifier,
    shape: Shape = OverlayShape,
    content: @Composable BoxScope.() -> Unit,
) {
    val light = rememberInfiniteTransition(label = "overlay-light")
    val drift by light.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(7000, easing = LinearEasing), RepeatMode.Reverse),
        label = "overlay-drift",
    )
    Box(
        modifier =
            modifier
                .clip(shape)
                .drawBehind {
                    drawRect(Color(0xEB0C1220))
                    val w = size.width
                    val h = size.height
                    fun glow(cx: Float, cy: Float, r: Float, c: Color) {
                        drawCircle(
                            brush = Brush.radialGradient(listOf(c, c.copy(alpha = 0f)), Offset(cx, cy), r),
                            radius = r,
                            center = Offset(cx, cy),
                        )
                    }
                    val r = maxOf(w, h)
                    glow(w * (0.1f + drift * 0.25f), h * 0.05f, r * 0.75f, RsGlowCyan)
                    glow(w * (0.95f - drift * 0.2f), h * (0.9f - drift * 0.1f), r * 0.7f, RsGlowViolet)
                    glow(w * 0.6f, h * (0.35f + drift * 0.2f), r * 0.45f, RsGlowRose.copy(alpha = 0.18f))
                    drawRect(
                        Brush.verticalGradient(
                            listOf(Color(0x26FFFFFF), Color(0x00FFFFFF)),
                            endY = minOf(h, 90.dp.toPx()),
                        ),
                    )
                }
                .background(GlassPanelBrush, shape)
                .border(1.dp, GlassBorderBrush, shape),
        content = content,
    )
}

/** Where a menu goes: under its anchor, or above it when there is no room. */
private class GlassMenuPosition(
    private val offset: IntOffset,
    private val margin: Int,
    private val onSide: (Boolean) -> Unit,
) : PopupPositionProvider {
    override fun calculatePosition(
        anchorBounds: IntRect,
        windowSize: IntSize,
        layoutDirection: LayoutDirection,
        popupContentSize: IntSize,
    ): IntOffset {
        val x =
            (anchorBounds.left + offset.x)
                .coerceAtMost(windowSize.width - popupContentSize.width - margin)
                .coerceAtLeast(margin)
        val below = anchorBounds.bottom + offset.y
        val up = below + popupContentSize.height > windowSize.height - margin
        val y =
            if (up) {
                (anchorBounds.top - offset.y - popupContentSize.height).coerceAtLeast(margin)
            } else {
                below
            }
        onSide(up)
        return IntOffset(x, y)
    }
}

/**
 * Drop-in for `DropdownMenu`: a lit glass sheet that springs out of its
 * anchor (from above or below, whichever side it opened on) and fades away
 * on close instead of vanishing.
 */
@Composable
fun GlassMenu(
    expanded: Boolean,
    onDismissRequest: () -> Unit,
    modifier: Modifier = Modifier,
    offset: DpOffset = DpOffset(0.dp, 6.dp),
    minWidth: Dp = 208.dp,
    maxWidth: Dp = 320.dp,
    maxHeight: Dp = 460.dp,
    content: @Composable ColumnScope.() -> Unit,
) {
    val visible = remember { MutableTransitionState(false) }
    visible.targetState = expanded
    if (!visible.currentState && !visible.targetState && visible.isIdle) return

    val density = LocalDensity.current
    var openedUp by remember { mutableStateOf(false) }
    val position =
        remember(offset, density) {
            with(density) {
                GlassMenuPosition(
                    IntOffset(offset.x.roundToPx(), offset.y.roundToPx()),
                    8.dp.roundToPx(),
                ) { openedUp = it }
            }
        }
    val transition = rememberTransition(visible, label = "glass-menu")
    val progress by transition.animateFloat(
        transitionSpec = {
            if (targetState) spring(dampingRatio = 0.78f, stiffness = Spring.StiffnessMediumLow) else tween(140)
        },
        label = "glass-menu-progress",
    ) { if (it) 1f else 0f }

    Popup(
        popupPositionProvider = position,
        onDismissRequest = onDismissRequest,
        properties = PopupProperties(focusable = true),
    ) {
        ImmersiveGlassSurface(
            modifier =
                modifier
                    .graphicsLayer {
                        val p = progress
                        alpha = p.coerceIn(0f, 1f)
                        val s = 0.88f + 0.12f * p
                        scaleX = s
                        scaleY = s
                        translationY = (1f - p) * 10.dp.toPx() * if (openedUp) 1f else -1f
                        transformOrigin = TransformOrigin(0.12f, if (openedUp) 1f else 0f)
                    }
                    .width(IntrinsicSize.Max)
                    .widthIn(min = minWidth, max = maxWidth)
                    .heightIn(max = maxHeight),
        ) {
            Column(
                modifier =
                    Modifier
                        .verticalScroll(rememberScrollState())
                        .padding(6.dp),
                content = content,
            )
        }
    }
}

/** One row of a glass menu; presses light up instead of rippling grey. */
@Composable
fun GlassMenuItem(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    detail: String = "",
    enabled: Boolean = true,
    selected: Boolean = false,
    indent: Dp = 0.dp,
    trailing: (@Composable RowScope.() -> Unit)? = null,
) {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val fill =
        when {
            pressed -> Color.White.copy(alpha = 0.14f)
            selected -> RsAccent.copy(alpha = 0.16f)
            else -> Color.Transparent
        }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier =
            modifier
                .fillMaxWidth()
                .clip(ItemShape)
                .background(fill, ItemShape)
                .clickable(interactionSource = source, indication = null, enabled = enabled, onClick = onClick)
                .padding(start = 10.dp + indent, end = 10.dp, top = 9.dp, bottom = 9.dp),
    ) {
        if (icon != null) {
            Icon(
                icon,
                contentDescription = null,
                tint = if (selected) RsAccent else RsText.copy(alpha = if (enabled) 0.86f else 0.4f),
                modifier = Modifier.size(18.dp),
            )
            Spacer(modifier = Modifier.width(10.dp))
        }
        Text(
            text,
            fontSize = 14.sp,
            color = if (enabled) (if (selected) RsAccent else RsText) else RsMuted,
            maxLines = 1,
            modifier = Modifier.weight(1f, fill = false),
        )
        if (detail.isNotBlank()) {
            Spacer(modifier = Modifier.width(8.dp))
            Text(detail, fontSize = 12.sp, color = RsMuted, maxLines = 1)
        }
        if (trailing != null) {
            Spacer(modifier = Modifier.weight(1f))
            Spacer(modifier = Modifier.width(8.dp))
            trailing()
        }
    }
}

/** A muted caption row inside a glass menu (state, not an action). */
@Composable
fun GlassMenuNote(text: String, indent: Dp = 0.dp) {
    Text(
        text,
        fontSize = 12.sp,
        color = RsMuted,
        modifier = Modifier.padding(start = 10.dp + indent, end = 10.dp, top = 6.dp, bottom = 6.dp),
    )
}

/** Hairline between groups: brighter in the middle, like light on an edge. */
@Composable
fun GlassMenuDivider() {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 5.dp)
                .height(1.dp)
                .background(
                    Brush.horizontalGradient(
                        listOf(Color.Transparent, Color.White.copy(alpha = 0.18f), Color.Transparent),
                    ),
                ),
    )
}

/**
 * A row that folds a submenu open underneath it: the chevron turns and the
 * children slide down and fade in.
 */
@Composable
fun GlassSubmenu(
    text: String,
    icon: ImageVector?,
    open: Boolean,
    onToggle: () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    val turn by animateFloatAsState(if (open) 90f else 0f, tween(200), label = "chevron")
    GlassMenuItem(
        text = text,
        icon = icon,
        onClick = onToggle,
        selected = open,
        trailing = {
            Icon(
                Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = null,
                tint = RsMuted,
                modifier = Modifier.size(18.dp).rotate(turn),
            )
        },
    )
    AnimatedVisibility(
        visible = open,
        enter = expandVertically(spring(stiffness = Spring.StiffnessMediumLow)) + fadeIn(tween(180, delayMillis = 40)),
        exit = shrinkVertically(tween(160)) + fadeOut(tween(120)),
    ) {
        Column(modifier = Modifier.fillMaxWidth(), content = content)
    }
}

/** What a glass dialog's body and buttons can call to close with the exit animation. */
class GlassDialogScope internal constructor(private val close: (() -> Unit) -> Unit) {
    /** Animate out, then run [after] (usually the caller's own dismiss). */
    fun dismiss(after: () -> Unit) = close(after)
}

/**
 * A centred glass card over an animated, light-tinted scrim. It rises and
 * fades in when shown; [GlassDialogScope.dismiss] plays it back out before the
 * caller removes it, so closing is a motion too.
 */
@Composable
fun GlassDialog(
    onDismissRequest: () -> Unit,
    title: String,
    modifier: Modifier = Modifier,
    width: Dp = 420.dp,
    actions: (@Composable RowScope.(GlassDialogScope) -> Unit)? = null,
    content: @Composable GlassDialogScope.() -> Unit,
) {
    val visible = remember { MutableTransitionState(false).apply { targetState = true } }
    var pending by remember { mutableStateOf<(() -> Unit)?>(null) }
    val scope = remember { GlassDialogScope { after -> pending = after; visible.targetState = false } }
    val dismissLatest by rememberUpdatedState(onDismissRequest)

    LaunchedEffect(visible.currentState, visible.isIdle) {
        if (visible.isIdle && !visible.currentState && !visible.targetState) {
            val after = pending
            pending = null
            after?.invoke()
        }
    }

    Dialog(
        onDismissRequest = { scope.dismiss(dismissLatest) },
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        (LocalView.current.parent as? DialogWindowProvider)?.window?.setDimAmount(0f)
        val transition = rememberTransition(visible, label = "glass-dialog")
        val p by transition.animateFloat(
            transitionSpec = {
                if (targetState) spring(dampingRatio = 0.8f, stiffness = Spring.StiffnessMediumLow) else tween(160)
            },
            label = "glass-dialog-progress",
        ) { if (it) 1f else 0f }
        Box(
            contentAlignment = Alignment.Center,
            modifier =
                Modifier
                    .fillMaxSize()
                    .graphicsLayer { alpha = p.coerceIn(0f, 1f) }
                    .background(
                        Brush.radialGradient(
                            listOf(Color(0x6620304F), Color(0xB3050810)),
                            radius = 1600f,
                        ),
                    )
                    .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {
                        scope.dismiss(dismissLatest)
                    }
                    .imePadding(),
        ) {
            ImmersiveGlassSurface(
                shape = RoundedCornerShape(22.dp),
                modifier =
                    modifier
                        .graphicsLayer {
                            val s = 0.9f + 0.1f * p
                            scaleX = s
                            scaleY = s
                            translationY = (1f - p) * 24.dp.toPx()
                        }
                        .padding(horizontal = 24.dp)
                        .widthIn(max = width)
                        .fillMaxWidth()
                        .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {},
            ) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 18.dp),
                ) {
                    Text(title, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = RsText, maxLines = 1)
                    scope.content()
                    if (actions != null) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth(),
                        ) { actions(scope) }
                    }
                }
            }
        }
    }
}

/** A pill button for glass dialogs; `primary` glows in the accent. */
@Composable
fun GlassButton(
    text: String,
    onClick: () -> Unit,
    primary: Boolean = false,
    enabled: Boolean = true,
) {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val shape = RoundedCornerShape(12.dp)
    val fill =
        when {
            primary -> Brush.linearGradient(listOf(RsAccent.copy(alpha = if (pressed) 0.55f else 0.38f), RsAccentSoft.copy(alpha = 0.3f)))
            else -> Brush.linearGradient(listOf(Color.White.copy(alpha = if (pressed) 0.16f else 0.07f), Color.White.copy(alpha = 0.03f)))
        }
    Box(
        contentAlignment = Alignment.Center,
        modifier =
            Modifier
                .clip(shape)
                .background(fill, shape)
                .border(1.dp, GlassBorderBrush, shape)
                .clickable(interactionSource = source, indication = null, enabled = enabled, onClick = onClick)
                .padding(horizontal = 16.dp, vertical = 9.dp),
    ) {
        Text(
            text,
            fontSize = 14.sp,
            fontWeight = if (primary) FontWeight.SemiBold else FontWeight.Normal,
            color = if (enabled) RsText else RsMuted,
        )
    }
}

/** Text field colours that sit on glass: clear fill, lit accent edge. */
@Composable
fun glassFieldColors() =
    OutlinedTextFieldDefaults.colors(
        focusedTextColor = RsText,
        unfocusedTextColor = RsText,
        focusedBorderColor = RsAccent.copy(alpha = 0.6f),
        unfocusedBorderColor = Color.White.copy(alpha = 0.16f),
        cursorColor = RsAccent,
        focusedContainerColor = Color.White.copy(alpha = 0.04f),
        unfocusedContainerColor = Color.White.copy(alpha = 0.03f),
        focusedPlaceholderColor = RsMuted,
        unfocusedPlaceholderColor = RsMuted,
    )

/** A single-line glass text field. */
@Composable
fun GlassTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    trailing: (@Composable () -> Unit)? = null,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        singleLine = true,
        placeholder = if (placeholder.isBlank()) null else ({ Text(placeholder) }),
        trailingIcon = trailing,
        keyboardOptions = keyboardOptions,
        keyboardActions = keyboardActions,
        shape = RoundedCornerShape(12.dp),
        colors = glassFieldColors(),
        modifier = modifier.fillMaxWidth(),
    )
}

/** A small glass chip; selected ones glow in the accent. */
@Composable
fun GlassChoiceChip(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(10.dp)
    Box(
        modifier =
            Modifier
                .clip(shape)
                .background(if (selected) RsAccent.copy(alpha = 0.22f) else Color.White.copy(alpha = 0.05f), shape)
                .border(1.dp, if (selected) RsAccent.copy(alpha = 0.7f) else Color.White.copy(alpha = 0.12f), shape)
                .clickable(onClick = onClick)
                .padding(horizontal = 10.dp, vertical = 6.dp),
    ) {
        Text(text, fontSize = 12.sp, color = if (selected) RsAccent else RsText)
    }
}
