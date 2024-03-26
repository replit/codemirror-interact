// TODO: custom style
// TODO: custom state for each rule?
import {
  EditorView,
  ViewPlugin,
  PluginValue,
  Decoration,
} from '@codemirror/view'
import {
  StateEffect,
  StateField,
  Facet,
  MapMode,
} from '@codemirror/state'

interface Target {
  pos: number,
  text: string,
  rule: InteractRule,
}

export interface InteractRule {
  regexp: RegExp,
  cursor?: string,
  style?: any,
  className?: string,
  onClick?: (text: string, setText: (t: string) => void, e: MouseEvent) => void,
  onDrag?: (text: string, setText: (t: string) => void, e: MouseEvent) => void,
  onDragStart?: (text: string, setText: (t: string) => void, e: MouseEvent) => void,
  onDragEnd?: (text: string, setText: (t: string) => void) => void,
}

const interactField = StateField.define<Target | null>({
  create: () => null,
  update: (value, tr) => {
    for (const e of tr.effects) {
      if (e.is(setInteract)) {
        return e.value;
      }
    }

    if (!value) {
      return null
    }

    if (!tr.changes.empty) {
      const newPos = tr.changes.mapPos(value.pos, -1, MapMode.TrackDel)
      const newEnd = tr.changes.mapPos(value.pos + value.text.length, -1, MapMode.TrackDel)

      if (newPos === null || newEnd === null) {
        return null
      }

      // if the text doesn't match anymore, we'll just return null
      // rather than checking if the rule matches again
      if (tr.newDoc.sliceString(newPos, newEnd) !== value.text) {
        return null
      }

      return { ...value, pos: newPos }
    }

    return value
  },

  provide: (field) => [
    EditorView.decorations.from(field, (target) => {
      if (!target) {
        return Decoration.none
      }

      const from = target.pos;
      const to = target.pos + target.text.length;
      const className = target.rule.className;

      return Decoration.set(mark({ className }).range(from, to))
    }),
    EditorView.contentAttributes.from(field, (target) => {
      if (!target || !target.rule.cursor) {
        return { style: '' }
      }

      return { style: `cursor: ${target.rule.cursor}` }
    }),
  ]
})

const setInteract = StateEffect.define<Target | null>();

const mark = (e: { className?: string }) => Decoration.mark({
  class: `cm-interact ${e?.className ?? ''}`
});


const interactTheme = EditorView.theme({
  '.cm-interact': {
    background: 'rgba(128, 128, 255, 0.2)',
    borderRadius: '4px'
  },
});

/**
 * A rule that defines a type of value and its interaction.
 *
 * @example
 * ```
 * // a number dragger
 * interactRule.of({
 *     // the regexp matching the value
 *     regexp: /-?\b\d+\.?\d*\b/g,
 *     // set cursor to 'ew-resize'on hover
 *     cursor: 'ew-resize'
 *     // change number value based on mouse X movement on drag
 *     onDrag: (text, setText, e) => {
 *         const newVal = Number(text) + e.movementX;
 *         if (isNaN(newVal)) return;
 *         setText(newVal.toString());
 *     },
 * })
 * ```
 */
export const interactRule = Facet.define<InteractRule>();

export const interactModKey = Facet.define<ModKey, ModKey>({
  combine: (values) => values[values.length - 1],
});

interface ViewState extends PluginValue {
  target: Target | null,
  dragging: boolean,
  mouseX: number,
  mouseY: number,
  getMatch(): Target | null,
  updateText(target: Target): (text: string) => void,
  setTarget(target: Target | null): void,
  isModKeyDown(e: KeyboardEvent | MouseEvent): boolean,
  startDrag(e: MouseEvent): void,
  endDrag(): void,
}

const interactViewPlugin = ViewPlugin.define<ViewState>((view) => ({

  target: null,
  dragging: false,
  mouseX: 0,
  mouseY: 0,

  // Get current match under cursor from all rules
  getMatch() {

    const rules = view.state.facet(interactRule);
    const pos = view.posAtCoords({ x: this.mouseX, y: this.mouseY });
    if (!pos) return null;
    const line = view.state.doc.lineAt(pos);
    const lpos = pos - line.from;
    let match = null;

    for (const rule of rules) {
      for (const m of line.text.matchAll(rule.regexp)) {
        if (m.index === undefined) continue;
        const text = m[0];
        if (!text) continue;
        const start = m.index;
        const end = m.index + text.length;
        if (lpos < start || lpos > end) continue;
        // If there are overlap matches from different rules, use the smaller one
        if (!match || text.length < match.text.length) {
          match = {
            rule: rule,
            pos: line.from + start,
            text: text,
          };
        }
      }
    }

    return match;
  },

  updateText(target) {
    return (text) => {
      view.dispatch({
        effects: setInteract.of({ ...target, text }),
        changes: {
          from: target.pos,
          to: target.pos + target.text.length,
          insert: text,
        },
      });
    };
  },

  setTarget(target) {
    this.target = target;
    view.dispatch({ effects: setInteract.of(target) });
  },

  isModKeyDown(e) {
    const modkey = view.state.facet(interactModKey);

    const isMac = Boolean(window.navigator) &&
      window.navigator.userAgent.includes('Macintosh');

    switch (modkey) {
      case "alt": return e.altKey;
      case "shift": return e.shiftKey;
      case "ctrl": return e.ctrlKey;
      case "meta": return e.metaKey;
      case "mod": return isMac ? e.metaKey : e.ctrlKey;
    }

    throw new Error(`Invalid mod key: ${modkey}`)
  },

  update(update) {
    const target = update.state.field(interactField, false)

    // the field isn't mounted
    if (target === undefined) {
      return
    }

    if (this.target !== target) {
      this.target = target
      if (target === null) {
        this.endDrag();
      }
    }
  },

  startDrag(e: MouseEvent) {
    if (this.dragging) return
    if (!this.target) return;
    this.dragging = true
    if (!this.target.rule.onDragStart) return;
    this.target.rule.onDragStart(this.target.text, this.updateText(this.target), e);
  },

  endDrag() {
    if (!this.dragging) return
    this.dragging = false
    if (!this.target?.rule.onDragEnd) return;
    this.target.rule.onDragEnd(this.target.text, this.updateText(this.target));
  },

}), {
  eventHandlers: {
    mousedown(e, _view) {
      if (!this.isModKeyDown(e)) return;
      if (!this.target) return;

      e.preventDefault();

      if (this.target.rule.onClick) {
        this.target.rule.onClick(
          this.target.text,
          (text) => {
            this.target && this.updateText(this.target)(text);
          },
          e
        );
      }

      if (this.target.rule.onDrag) {
        this.startDrag(e);
      }
    },

    mousemove(e, _view) {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;

      if (!this.isModKeyDown(e)) {
        if (this.target) {
          this.setTarget(null);
        }

        return
      }

      if (this.target && this.dragging) {
        if (this.target.rule.onDrag) {
          this.target.rule.onDrag(this.target.text, this.updateText(this.target), e);
        }
      } else {
        this.setTarget(this.getMatch());
      }

    },

    mouseup(e, _view) {
      this.endDrag();

      if (this.target && !this.isModKeyDown(e)) {
        this.setTarget(null)
      }

      if (this.isModKeyDown(e)) {
        this.setTarget(this.getMatch());
      }
    },

    mouseleave(e, _view) {
      this.endDrag();
      if (this.target) {
        this.setTarget(null)
      }
    },

    // TODO: fix these keybindings
    // these currently don't do anything because CodeMirror's keybinding
    // system prevents these events from firing.

    keydown(e, _view) {
      if (!this.target && this.isModKeyDown(e)) {
        this.setTarget(this.getMatch());
      }
    },

    keyup(e, _view) {
      if (this.target && !this.isModKeyDown(e)) {
        this.endDrag();
        this.setTarget(null)
      }
    },

  },
})

type ModKey =
  | "alt"
  | "shift"
  | "meta"
  | "ctrl"
  | "mod";

interface InteractConfig {
  rules?: InteractRule[],
  key?: ModKey,
}

const interact = (cfg: InteractConfig = {}) => [
  interactField,
  interactTheme,
  interactViewPlugin,
  interactModKey.of(cfg.key ?? "alt"),
  (cfg.rules ?? []).map((r) => interactRule.of(r)),
];

export default interact;
