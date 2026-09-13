# SPEC: Close the quick-open popups on a click outside them

status: approved

## Objective

`quick-open-dialog` and `recent-files-dialog` (`desktop/src/index.html`) don't close
on a click outside their content — the standard `<dialog>` backdrop click does
nothing by default; only `Escape` currently closes them. Add the standard behavior:
a click on the backdrop closes the dialog, the same as pressing Escape. Scoped to
these two popups specifically — the app's form-style dialogs (New Task, Commit,
Settings, ...) are deliberately left untouched, since discarding a half-filled form
on an accidental outside click would lose work Escape-closing a quick-open picker
never risks.

## Structure

- **`desktop/src/main.js`**: one shared `click` listener attached to both dialogs
  (`document.getElementById('quick-open-dialog')`,
  `document.getElementById('recent-files-dialog')`), using the standard `<dialog>`
  pattern — a click whose `event.target` is the dialog element itself (not a
  descendant) means the click landed on the backdrop, since every real control inside
  the dialog is a descendant element, never the dialog root itself.

## Style

```js
function closeDialogOnBackdropClick(event) {
  if (event.target === event.currentTarget) event.currentTarget.close();
}
document.getElementById('quick-open-dialog')?.addEventListener('click', closeDialogOnBackdropClick);
document.getElementById('recent-files-dialog')?.addEventListener('click', closeDialogOnBackdropClick);
```

## Test strategy

- `node --check desktop/src/main.js`.
- Contract-test addition in `tests/desktop-ui-contract.test.ts`: the shared handler
  exists and is attached to both dialogs.
- **Manual verification is mandatory before this task is called done**: in
  `npm run desktop:dev`, open each popup, click outside its content (on the dimmed
  backdrop), confirm it closes exactly like pressing Escape; confirm clicking inside
  the popup's own content (the input, a result row, empty space within the dialog's
  own box) never closes it.

## Boundaries

**Always:** scoped to these two popups only.

**Never:** never touches any other `<dialog>` in the app — form-style dialogs keep
their current behavior (no close on outside click) unless separately requested.
