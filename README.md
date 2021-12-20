# CodeMirror Interact

A codemirror extension that lets you interact with different values (clicking, dragging, etc).

### Usage

```ts
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { interact, interactRule } from '@replit/codemirror-interact';

new EditorView({
  state: EditorState.create({
    doc: 'const num = 123',
    extensions: [
      interact,
      // number dragger
      interactRule.of({
        regexp: /-?\b\d+\.?\d*\b/g,
        cursor: "ew-resize",
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
