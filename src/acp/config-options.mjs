/**
 * ACP `configOptions` are the protocol's declarative pickers.
 *
 * Cursor's agent answers `session/new` with `models` and `modes`; opencode
 * answers with `configOptions` — a list of select widgets whose categories
 * name what they choose. Auto's web and Telegram pickers speak one shape, so
 * this flattens either into `{ models, modes }` and remembers which config id
 * to set when a choice comes back.
 *
 * Only `select` options are modelled; a `boolean` config would need a switch,
 * which Auto does not draw yet.
 */

/** Model list from a config option whose category/id names the model. */
function modelOption(list) {
  return list.find((c) => c?.type === 'select' && (c.category === 'model' || c.id === 'model'));
}

/** Mode list from a config option whose category/id names the mode. */
function modeOption(list) {
  return list.find((c) => c?.type === 'select' && (c.category === 'mode' || c.id === 'mode'));
}

/**
 * @param {Array<object>} configOptions the `session.configOptions` array
 * @returns {{
 *   models: { availableModels: Array<{modelId:string,name:string,description?:string}>,
 *             currentModelId: string } | null,
 *   modes: { availableModes: Array<{id:string,name:string,description?:string}>,
 *            currentModeId: string } | null,
 *   modelConfigId: string | null,
 *   modeConfigId: string | null,
 * }}
 */
export function normalizeConfigOptions(configOptions = []) {
  const list = Array.isArray(configOptions) ? configOptions.filter(Boolean) : [];
  const model = modelOption(list);
  const mode = modeOption(list);

  return {
    models: model
      ? {
          availableModels: (model.options || [])
            .filter((o) => o && o.value != null)
            .map((o) => ({
              modelId: o.value,
              name: o.name || o.value,
              ...(o.description ? { description: o.description } : {}),
            })),
          currentModelId: model.currentValue ?? null,
        }
      : null,
    modes: mode
      ? {
          availableModes: (mode.options || [])
            .filter((o) => o && o.value != null)
            .map((o) => ({
              id: o.value,
              name: o.name || o.value,
              ...(o.description ? { description: o.description } : {}),
            })),
          currentModeId: mode.currentValue ?? null,
        }
      : null,
    modelConfigId: model?.id || null,
    modeConfigId: mode?.id || null,
  };
}

/**
 * Which config option a picker wants, for a session's remembered ids.
 *
 * @param {object} runtime a session runtime that carries `configIds`
 * @param {'model'|'mode'} picker
 * @returns {string|null}
 */
export function configIdFor(runtime, picker) {
  if (picker === 'model') return runtime?.modelConfigId || 'model';
  if (picker === 'mode') return runtime?.modeConfigId || 'mode';
  return null;
}