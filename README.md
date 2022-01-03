# CodeMirror Interact

A codemirror extension that lets you interact with different values (clicking, dragging, etc).

https://user-images.githubusercontent.com/9929523/147966613-270cdece-564f-4906-b6e8-b48975a0d9e2.mp4

[demo](https://replit.com/@slmjkdbtl/codemirror-interact)

### Usage

```ts
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import interact from '@replit/codemirror-interact';

// hold Alt and drag / click values
new EditorView({
  state: EditorState.create({
    doc: 'const num = 123',
    extensions: [
      interact({
        rules: [
          // a rule for a number dragger
          {
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
          }
        ],
      }),
    ],
  }),
  parent: document.querySelector('#editor'),
});
