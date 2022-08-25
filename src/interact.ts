// TODO: don't use document.style.cursor
// TODO: custom style
// TODO: custom state for each rule?
import {
  EditorView,
  ViewPlugin,
  PluginValue,
  DecorationSet,
  Decoration,
} from '@codemirror/view'
import {
  StateEffect,
  Facet,
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
  onClick?: (text: string, setText: (t: string) => void, e: MouseEvent) => void,
  onDrag?: (text: string, setText: (t: string) => void, e: MouseEvent) => void,
}

const mark = Decoration.mark({ class: 'cm-interact'});
const setInteract = StateEffect.define<Target | null>();

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
  dragging: Target | null,
  hovering: Target | null,
  mouseX: number,
  mouseY: number,
  deco: DecorationSet,
  getMatch(): Target | null,
  updateText(target: Target): (text: string) => void,
  highlight(target: Target): void,
  unhighlight(): void,
  isModKeyDown(e: KeyboardEvent | MouseEvent): boolean,
}

const interactViewPlugin = ViewPlugin.define<ViewState>((view) => ({

  dragging: null,
  hovering: null,
  mouseX: 0,
  mouseY: 0,
  deco: Decoration.none,

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
        changes: {
          from: target.pos,
          to: target.pos + target.text.length,
          insert: text,
        },
      });
      target.text = text;
    };
  },

  // highlight a target (e.g. currently dragging or hovering)
  highlight(target) {
    if (target.rule.cursor) {
      document.body.style.cursor = target.rule.cursor;
    }
    view.dispatch({
      effects: setInteract.of(target),
    });
  },

  unhighlight() {
    document.body.style.cursor = 'auto'
    view.dispatch({
      effects: setInteract.of(null),
    });
  },

  isModKeyDown(e) {
    const modkey = view.state.facet(interactModKey);
    switch (modkey) {
      case "alt": return e.altKey;
      case "shift": return e.shiftKey;
      case "ctrl": return e.ctrlKey;
      case "meta": return e.metaKey;
    }
    throw new Error(`Invalid mod key: ${modkey}`)
  },

  update(update) {
    for (const tr of update.transactions) {
      for (const e of tr.effects) {
        if (e.is(setInteract)) {
          const decos = e.value ? mark.range(
            e.value.pos,
            e.value.pos + e.value.text.length
          ) : [];
          this.deco = Decoration.set(decos);
        }
      }
    }
  },

}), {

  decorations: (v) => v.deco,

  eventHandlers: {

    mousedown(e, view) {

      if (!this.isModKeyDown(e)) return;
      const match = this.getMatch();
      if (!match) return;
      e.preventDefault();

      if (match.rule.onClick) {
        match.rule.onClick(match.text, this.updateText(match), e);
      };

      if (match.rule.onDrag) {
        this.dragging = {
          rule: match.rule,
          pos: match.pos,
          text: match.text,
        };
      }

    },

    mousemove(e, view) {

      this.mouseX = e.clientX;
      this.mouseY = e.clientY;

      if (!this.isModKeyDown(e)) return;

      if (this.dragging) {
        this.highlight(this.dragging);
        if (this.dragging.rule.onDrag) {
          this.dragging.rule.onDrag(this.dragging.text, this.updateText(this.dragging), e);
        }
      } else {
        this.hovering = this.getMatch();
        if (this.hovering) {
          this.highlight(this.hovering);
        } else {
          this.unhighlight();
        }
      }

    },

    mouseup(e, view) {
      this.dragging = null;
      if (!this.hovering) {
        this.unhighlight();
      }
    },

    mouseleave(e, view) {
      this.hovering = null;
      this.dragging = null;
      this.unhighlight();
    },

    keydown(e, view) {
      if (!this.isModKeyDown(e)) return;
      this.hovering = this.getMatch();
      if (this.hovering) {
        this.highlight(this.hovering);
      }
    },

    keyup(e, view) {
      if (!this.isModKeyDown(e)) {
        this.unhighlight();
      }
    },

  },
})

type ModKey =
  | "alt"
  | "shift"
  | "meta"
  | "ctrl"

interface InteractConfig {
  rules?: InteractRule[],
  key?: ModKey,
}

const interact = (cfg: InteractConfig = {}) => [
  interactTheme,
  interactViewPlugin,
  interactModKey.of(cfg.key ?? "alt"),
  (cfg.rules ?? []).map((r) => interactRule.of(r)),
];

export default interact;
