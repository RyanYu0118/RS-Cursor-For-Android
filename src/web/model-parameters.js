/**
 * Parameter sheets Cursor offered when this file was written.
 *
 * The phone paints these itself. It does not ask the open window, so choosing
 * Auto or a model does not press anything on the desktop. When Cursor adds or
 * renames a knob, replace this snapshot.
 */
export const MODEL_PARAMETERS = {
  "grok-4.7": {
    "name": "Grok 4.7",
    "parameters": [
      {
        "id": "context",
        "label": "Context",
        "type": "select",
        "value": "256K",
        "options": [
          "256K",
          "500K"
        ],
        "stored": {
          "256K": "256k",
          "500K": "500k"
        }
      },
      {
        "id": "reasoning_effort",
        "label": "Effort",
        "type": "select",
        "value": "Medium",
        "options": [
          "Low",
          "Medium",
          "High",
          "Extra High"
        ],
        "stored": {
          "Low": "low",
          "Medium": "medium",
          "High": "high",
          "Extra High": "xhigh"
        }
      },
      {
        "id": "fast",
        "label": "Fast",
        "type": "toggle",
        "value": true
      }
    ]
  },
  "grok-4.6": {
    "name": "Grok 4.6",
    "parameters": [
      {
        "id": "effort",
        "label": "Effort",
        "type": "select",
        "value": "Medium",
        "options": [
          "Low",
          "Medium",
          "High",
          "Extra High"
        ],
        "stored": {
          "Low": "low",
          "Medium": "medium",
          "High": "high",
          "Extra High": "xhigh"
        }
      },
      {
        "id": "fast",
        "label": "Fast",
        "type": "toggle",
        "value": true
      }
    ]
  },
  "composer-2.5": {
    "name": "Composer 2.5",
    "parameters": [
      {
        "id": "fast",
        "label": "Fast",
        "type": "toggle",
        "value": false
      }
    ]
  },
  "claude-opus-5-5": {
    "name": "Claude Opus 5.5",
    "parameters": [
      {
        "id": "context",
        "label": "Context",
        "type": "select",
        "value": "300K",
        "options": [
          "300K",
          "1M"
        ],
        "stored": {
          "300K": "300k",
          "1M": "1m"
        }
      },
      {
        "id": "effort",
        "label": "Effort",
        "type": "select",
        "value": "Low",
        "options": [
          "Low",
          "Medium",
          "High",
          "Extra High",
          "Max"
        ],
        "stored": {
          "Low": "low",
          "Medium": "medium",
          "High": "high",
          "Extra High": "xhigh",
          "Max": "max"
        }
      },
      {
        "id": "fast",
        "label": "Fast",
        "type": "toggle",
        "value": false
      }
    ]
  },
  "claude-opus-5": {
    "name": "Claude Opus 5",
    "parameters": [
      {
        "id": "thinking",
        "label": "Thinking",
        "type": "toggle",
        "value": true
      },
      {
        "id": "context",
        "label": "Context",
        "type": "select",
        "value": "300K",
        "options": [
          "300K",
          "1M"
        ],
        "stored": {
          "300K": "300k",
          "1M": "1m"
        }
      },
      {
        "id": "effort",
        "label": "Effort",
        "type": "select",
        "value": "Medium",
        "options": [
          "Low",
          "Medium",
          "High",
          "Extra High",
          "Max"
        ],
        "stored": {
          "Low": "low",
          "Medium": "medium",
          "High": "high",
          "Extra High": "xhigh",
          "Max": "max"
        }
      },
      {
        "id": "fast",
        "label": "Fast",
        "type": "toggle",
        "value": true
      }
    ]
  },
  "claude-opus-4-8": {
    "name": "Claude Opus 4.8",
    "parameters": [
      {
        "id": "thinking",
        "label": "Thinking",
        "type": "toggle",
        "value": false
      },
      {
        "id": "context",
        "label": "Context",
        "type": "select",
        "value": "300K",
        "options": [
          "300K",
          "1M"
        ],
        "stored": {
          "300K": "300k",
          "1M": "1m"
        }
      },
      {
        "id": "effort",
        "label": "Effort",
        "type": "select",
        "value": "Low",
        "options": [
          "Low",
          "Medium",
          "High",
          "Extra High",
          "Max"
        ],
        "stored": {
          "Low": "low",
          "Medium": "medium",
          "High": "high",
          "Extra High": "xhigh",
          "Max": "max"
        }
      },
      {
        "id": "fast",
        "label": "Fast",
        "type": "toggle",
        "value": false
      }
    ]
  },
  "gpt-5.6-sol": {
    "name": "GPT-5.6 Sol",
    "parameters": [
      {
        "id": "context",
        "label": "Context",
        "type": "select",
        "value": "272K",
        "options": [
          "272K",
          "1M"
        ],
        "stored": {
          "272K": "272k",
          "1M": "1m"
        }
      },
      {
        "id": "reasoning",
        "label": "Reasoning",
        "type": "select",
        "value": "None",
        "options": [
          "None",
          "Low",
          "Medium",
          "High",
          "Extra High",
          "Max"
        ],
        "stored": {
          "None": "none",
          "Low": "low",
          "Medium": "medium",
          "High": "high",
          "Extra High": "xhigh",
          "Max": "max"
        }
      },
      {
        "id": "fast",
        "label": "Fast",
        "type": "toggle",
        "value": false
      }
    ]
  },
  "gpt-5.5": {
    "name": "GPT-5.5",
    "parameters": [
      {
        "id": "context",
        "label": "Context",
        "type": "select",
        "value": "272K",
        "options": [
          "272K",
          "1M"
        ],
        "stored": {
          "272K": "272k",
          "1M": "1m"
        }
      },
      {
        "id": "reasoning",
        "label": "Reasoning",
        "type": "select",
        "value": "None",
        "options": [
          "None",
          "Low",
          "Medium",
          "High",
          "Extra High"
        ],
        "stored": {
          "None": "none",
          "Low": "low",
          "Medium": "medium",
          "High": "high",
          "Extra High": "extra-high"
        }
      },
      {
        "id": "fast",
        "label": "Fast",
        "type": "toggle",
        "value": false
      }
    ]
  },
  "claude-fable-5-1": {
    "name": "Claude Fable 5.1",
    "parameters": [
      {
        "id": "thinking",
        "label": "Thinking",
        "type": "toggle",
        "value": false
      },
      {
        "id": "context",
        "label": "Context",
        "type": "select",
        "value": "300K",
        "options": [
          "300K",
          "1M"
        ],
        "stored": {
          "300K": "300k",
          "1M": "1m"
        }
      },
      {
        "id": "effort",
        "label": "Effort",
        "type": "select",
        "value": "Low",
        "options": [
          "Low",
          "Medium",
          "High",
          "Extra High",
          "Max"
        ],
        "stored": {
          "Low": "low",
          "Medium": "medium",
          "High": "high",
          "Extra High": "xhigh",
          "Max": "max"
        }
      }
    ]
  },
  "claude-fable-5": {
    "name": "Claude Fable 5",
    "parameters": [
      {
        "id": "thinking",
        "label": "Thinking",
        "type": "toggle",
        "value": false
      },
      {
        "id": "context",
        "label": "Context",
        "type": "select",
        "value": "300K",
        "options": [
          "300K",
          "1M"
        ],
        "stored": {
          "300K": "300k",
          "1M": "1m"
        }
      },
      {
        "id": "effort",
        "label": "Effort",
        "type": "select",
        "value": "Low",
        "options": [
          "Low",
          "Medium",
          "High",
          "Extra High",
          "Max"
        ],
        "stored": {
          "Low": "low",
          "Medium": "medium",
          "High": "high",
          "Extra High": "xhigh",
          "Max": "max"
        }
      }
    ]
  },
  "grok-4.5": {
    "name": "Grok 4.5",
    "parameters": [
      {
        "id": "effort",
        "label": "Effort",
        "type": "select",
        "value": "Low",
        "options": [
          "Low",
          "Medium",
          "High"
        ],
        "stored": {
          "Low": "low",
          "Medium": "medium",
          "High": "high"
        }
      },
      {
        "id": "fast",
        "label": "Fast",
        "type": "toggle",
        "value": false
      }
    ]
  },
  "gemini-3.8-flash": {
    "name": "Gemini 3.8 Flash",
    "parameters": [
      {
        "id": "reasoning_effort",
        "label": "Effort",
        "type": "select",
        "value": "Low",
        "options": [
          "Low",
          "Medium",
          "High"
        ],
        "stored": {
          "Low": "low",
          "Medium": "medium",
          "High": "high"
        }
      }
    ]
  },
  "gemini-3.7-flash": {
    "name": "Gemini 3.7 Flash",
    "parameters": [
      {
        "id": "effort",
        "label": "Effort",
        "type": "select",
        "value": "Low",
        "options": [
          "Low",
          "Medium",
          "High"
        ],
        "stored": {
          "Low": "low",
          "Medium": "medium",
          "High": "high"
        }
      }
    ]
  },
  "muse-spark-1.3": {
    "name": "Muse Spark 1.3",
    "parameters": [
      {
        "id": "context",
        "label": "Context",
        "type": "select",
        "value": "300K",
        "options": [
          "300K",
          "1M"
        ],
        "stored": {
          "300K": "300k",
          "1M": "1m"
        }
      },
      {
        "id": "effort",
        "label": "Effort",
        "type": "select",
        "value": "Minimal",
        "options": [
          "Minimal",
          "Low",
          "Medium",
          "High",
          "Extra High",
          "Max"
        ],
        "stored": {
          "Minimal": "minimal",
          "Low": "low",
          "Medium": "medium",
          "High": "high",
          "Extra High": "xhigh",
          "Max": "max"
        }
      }
    ]
  },
  "gpt-5.6-terra": {
    "name": "GPT-5.6 Terra",
    "parameters": [
      {
        "id": "context",
        "label": "Context",
        "type": "select",
        "value": "272K",
        "options": [
          "272K",
          "1M"
        ],
        "stored": {
          "272K": "272k",
          "1M": "1m"
        }
      },
      {
        "id": "reasoning",
        "label": "Reasoning",
        "type": "select",
        "value": "None",
        "options": [
          "None",
          "Low",
          "Medium",
          "High",
          "Extra High",
          "Max"
        ],
        "stored": {
          "None": "none",
          "Low": "low",
          "Medium": "medium",
          "High": "high",
          "Extra High": "xhigh",
          "Max": "max"
        }
      },
      {
        "id": "fast",
        "label": "Fast",
        "type": "toggle",
        "value": false
      }
    ]
  },
  "claude-sonnet-5": {
    "name": "Claude Sonnet 5",
    "parameters": [
      {
        "id": "thinking",
        "label": "Thinking",
        "type": "toggle",
        "value": false
      },
      {
        "id": "context",
        "label": "Context",
        "type": "select",
        "value": "300K",
        "options": [
          "300K",
          "1M"
        ],
        "stored": {
          "300K": "300k",
          "1M": "1m"
        }
      },
      {
        "id": "effort",
        "label": "Effort",
        "type": "select",
        "value": "Low",
        "options": [
          "Low",
          "Medium",
          "High",
          "Extra High",
          "Max"
        ],
        "stored": {
          "Low": "low",
          "Medium": "medium",
          "High": "high",
          "Extra High": "xhigh",
          "Max": "max"
        }
      }
    ]
  },
  "claude-sonnet-4-6": {
    "name": "Claude Sonnet 4.6",
    "parameters": [
      {
        "id": "thinking",
        "label": "Thinking",
        "type": "toggle",
        "value": false
      },
      {
        "id": "context",
        "label": "Context",
        "type": "select",
        "value": "200K",
        "options": [
          "200K",
          "1M"
        ],
        "stored": {
          "200K": "200k",
          "1M": "1m"
        }
      },
      {
        "id": "effort",
        "label": "Effort",
        "type": "select",
        "value": "Low",
        "options": [
          "Low",
          "Medium",
          "High",
          "Max"
        ],
        "stored": {
          "Low": "low",
          "Medium": "medium",
          "High": "high",
          "Max": "max"
        }
      }
    ]
  },
  "gpt-5.3-codex": {
    "name": "Codex 5.3",
    "parameters": [
      {
        "id": "reasoning",
        "label": "Reasoning",
        "type": "select",
        "value": "Low",
        "options": [
          "Low",
          "Medium",
          "High",
          "Extra High"
        ],
        "stored": {
          "Low": "low",
          "Medium": "medium",
          "High": "high",
          "Extra High": "extra-high"
        }
      },
      {
        "id": "fast",
        "label": "Fast",
        "type": "toggle",
        "value": false
      }
    ]
  },
  "claude-opus-4-7": {
    "name": "Claude Opus 4.7",
    "parameters": [
      {
        "id": "thinking",
        "label": "Thinking",
        "type": "toggle",
        "value": false
      },
      {
        "id": "context",
        "label": "Context",
        "type": "select",
        "value": "300K",
        "options": [
          "300K",
          "1M"
        ],
        "stored": {
          "300K": "300k",
          "1M": "1m"
        }
      },
      {
        "id": "effort",
        "label": "Effort",
        "type": "select",
        "value": "Low",
        "options": [
          "Low",
          "Medium",
          "High",
          "Extra High",
          "Max"
        ],
        "stored": {
          "Low": "low",
          "Medium": "medium",
          "High": "high",
          "Extra High": "xhigh",
          "Max": "max"
        }
      },
      {
        "id": "fast",
        "label": "Fast",
        "type": "toggle",
        "value": false
      }
    ]
  },
  "gpt-5.4": {
    "name": "GPT-5.4",
    "parameters": [
      {
        "id": "context",
        "label": "Context",
        "type": "select",
        "value": "272K",
        "options": [
          "272K",
          "1M"
        ],
        "stored": {
          "272K": "272k",
          "1M": "1m"
        }
      },
      {
        "id": "reasoning",
        "label": "Reasoning",
        "type": "select",
        "value": "None",
        "options": [
          "None",
          "Low",
          "Medium",
          "High",
          "Extra High"
        ],
        "stored": {
          "None": "none",
          "Low": "low",
          "Medium": "medium",
          "High": "high",
          "Extra High": "extra-high"
        }
      },
      {
        "id": "fast",
        "label": "Fast",
        "type": "toggle",
        "value": false
      }
    ]
  },
  "claude-opus-4-6": {
    "name": "Claude Opus 4.6",
    "parameters": [
      {
        "id": "thinking",
        "label": "Thinking",
        "type": "toggle",
        "value": false
      },
      {
        "id": "context",
        "label": "Context",
        "type": "select",
        "value": "200K",
        "options": [
          "200K",
          "1M"
        ],
        "stored": {
          "200K": "200k",
          "1M": "1m"
        }
      },
      {
        "id": "effort",
        "label": "Effort",
        "type": "select",
        "value": "Low",
        "options": [
          "Low",
          "Medium",
          "High",
          "Max"
        ],
        "stored": {
          "Low": "low",
          "Medium": "medium",
          "High": "high",
          "Max": "max"
        }
      }
    ]
  },
  "claude-opus-4-5": {
    "name": "Claude Opus 4.5",
    "parameters": [
      {
        "id": "thinking",
        "label": "Thinking",
        "type": "toggle",
        "value": false
      }
    ]
  },
  "gpt-5.2": {
    "name": "GPT-5.2",
    "parameters": [
      {
        "id": "reasoning",
        "label": "Reasoning",
        "type": "select",
        "value": "Low",
        "options": [
          "Low",
          "Medium",
          "High",
          "Extra High"
        ],
        "stored": {
          "Low": "low",
          "Medium": "medium",
          "High": "high",
          "Extra High": "extra-high"
        }
      },
      {
        "id": "fast",
        "label": "Fast",
        "type": "toggle",
        "value": false
      }
    ]
  },
  "gpt-5.6-luna": {
    "name": "GPT-5.6 Luna",
    "parameters": [
      {
        "id": "context",
        "label": "Context",
        "type": "select",
        "value": "272K",
        "options": [
          "272K",
          "1M"
        ],
        "stored": {
          "272K": "272k",
          "1M": "1m"
        }
      },
      {
        "id": "reasoning",
        "label": "Reasoning",
        "type": "select",
        "value": "None",
        "options": [
          "None",
          "Low",
          "Medium",
          "High",
          "Extra High",
          "Max"
        ],
        "stored": {
          "None": "none",
          "Low": "low",
          "Medium": "medium",
          "High": "high",
          "Extra High": "xhigh",
          "Max": "max"
        }
      },
      {
        "id": "fast",
        "label": "Fast",
        "type": "toggle",
        "value": false
      }
    ]
  },
  "gemini-3.6-flash": {
    "name": "Gemini 3.6 Flash",
    "parameters": [
      {
        "id": "effort",
        "label": "Effort",
        "type": "select",
        "value": "Minimal",
        "options": [
          "Minimal",
          "Low",
          "Medium",
          "High"
        ],
        "stored": {
          "Minimal": "minimal",
          "Low": "low",
          "Medium": "medium",
          "High": "high"
        }
      }
    ]
  },
  "gpt-5.4-mini": {
    "name": "GPT-5.4 Mini",
    "parameters": [
      {
        "id": "reasoning",
        "label": "Reasoning",
        "type": "select",
        "value": "None",
        "options": [
          "None",
          "Low",
          "Medium",
          "High",
          "Extra High"
        ],
        "stored": {
          "None": "none",
          "Low": "low",
          "Medium": "medium",
          "High": "high",
          "Extra High": "xhigh"
        }
      }
    ]
  },
  "gpt-5.4-nano": {
    "name": "GPT-5.4 Nano",
    "parameters": [
      {
        "id": "reasoning",
        "label": "Reasoning",
        "type": "select",
        "value": "None",
        "options": [
          "None",
          "Low",
          "Medium",
          "High",
          "Extra High"
        ],
        "stored": {
          "None": "none",
          "Low": "low",
          "Medium": "medium",
          "High": "high",
          "Extra High": "xhigh"
        }
      }
    ]
  },
  "claude-haiku-4-5": {
    "name": "Claude Haiku 4.5",
    "parameters": [
      {
        "id": "thinking",
        "label": "Thinking",
        "type": "toggle",
        "value": false
      }
    ]
  },
  "claude-sonnet-4-5": {
    "name": "Claude Sonnet 4.5",
    "parameters": [
      {
        "id": "thinking",
        "label": "Thinking",
        "type": "toggle",
        "value": false
      },
      {
        "id": "context",
        "label": "Context",
        "type": "select",
        "value": "200K",
        "options": [
          "200K"
        ],
        "stored": {
          "200K": "200k"
        }
      }
    ]
  },
  "gpt-5.1": {
    "name": "GPT-5.1",
    "parameters": [
      {
        "id": "reasoning",
        "label": "Reasoning",
        "type": "select",
        "value": "Low",
        "options": [
          "Low",
          "Medium",
          "High"
        ],
        "stored": {
          "Low": "low",
          "Medium": "medium",
          "High": "high"
        }
      }
    ]
  },
  "claude-sonnet-4": {
    "name": "Claude Sonnet 4",
    "parameters": [
      {
        "id": "thinking",
        "label": "Thinking",
        "type": "toggle",
        "value": false
      },
      {
        "id": "context",
        "label": "Context",
        "type": "select",
        "value": "200K",
        "options": [
          "200K"
        ],
        "stored": {
          "200K": "200k"
        }
      }
    ]
  },
  "kimi-k3": {
    "name": "Kimi K3",
    "parameters": [
      {
        "id": "reasoning",
        "label": "Reasoning",
        "type": "select",
        "value": "Low",
        "options": [
          "Low",
          "High",
          "Max"
        ],
        "stored": {
          "Low": "low",
          "High": "high",
          "Max": "max"
        }
      }
    ]
  },
  "glm-5.2": {
    "name": "GLM 5.2",
    "parameters": [
      {
        "id": "reasoning",
        "label": "Reasoning",
        "type": "select",
        "value": "High",
        "options": [
          "High",
          "Max"
        ],
        "stored": {
          "High": "high",
          "Max": "max"
        }
      }
    ]
  }
};

/** Controls for the model id the phone already has selected. */
export function controlsFor(modelId) {
  const raw = String(modelId || '');
  const automatic = raw === 'default' || raw === 'default[]';
  if (automatic) return { status: 'ok', auto: true, model: 'Auto', parameters: [] };
  const stem = raw.replace(/\[.*$/, '');
  const entry = MODEL_PARAMETERS[stem];
  if (!entry) return { status: 'ok', auto: false, model: stem, parameters: [] };
  return {
    status: 'ok',
    auto: false,
    model: entry.name,
    parameters: entry.parameters.map((parameter) => ({ ...parameter })),
  };
}

/** Turn a label the phone shows ("256K") into the value Cursor stores ("256k"). */
export function storedParameterValue(modelId, parameterId, shown) {
  const stem = String(modelId || '').replace(/\[.*$/, '');
  const parameter = MODEL_PARAMETERS[stem]?.parameters.find((item) => item.id === parameterId);
  if (!parameter) return shown;
  if (parameter.type === 'toggle') return shown ? 'true' : 'false';
  return parameter.stored?.[shown] || shown;
}
