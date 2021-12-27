# CodeMirror Interact

A codemirror extension that lets you interact with different values (clicking, dragging, etc).

[demo](https://replit.com/@slmjkdbtl/codemirror-interact)

### Usage

```ts
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { interact, interactRule } from '@replit/codemirror-interact';

// hold Alt and drag / click values
new EditorView({
  state: EditorState.create({
    doc: 'const num = 123',
    extensions: [
      // the plugin controlling the behavior (will do nothing without any interactRule)
      interact,
      // a rule for a number dragger
      interactRule.of({
        // the regexp matching the value
        regexp: /-?\b\d+\.?\d*\b/g,
        // set cursor to "ew-resize" on hover
        cursor: "ew-resize",
        // change number value based on mouse X movement on drag
        onDrag: (text, setText, e) => {
          const newVal = Number(text) + e.movementX;
          if (isNaN(newVal)) return;
          setText(newVal.toString());
        },
      }),
    ],
  }),
  parent: document.querySelector('#editor'),
});

```
