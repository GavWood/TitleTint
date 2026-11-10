# Title Tint

Tint VS Code's title bar per project, so you can tell windows apart at a glance.

The colour is saved in the workspace's settings (`workbench.colorCustomizations`), so each folder or workspace keeps its own and anyone who opens it with the same settings sees it too.

## Using it

- Click **Title Tint** at the left of the status bar to open the picker. Arrow keys preview each colour live; Enter keeps it, Esc puts the old one back.
- Or right-click in an editor, an editor tab or the Explorer and choose **Title Tint**.
- Or run any **Title Tint** command from the Command Palette.

## Colours

| Choice | What it does |
| --- | --- |
| **Dark colours** | Ten deep tones with white text: red, orange, amber, green, teal, blue, indigo, purple, pink, slate. |
| **Light colours** | The same ten as pale tones with dark text. |
| **Auto** | A hue made from the project's name, so the same project always gets the same colour. |
| **Random** | A random hue at the tone's depth; in the picker, press Enter again to re-roll. |
| **Custom hex** | Any colour, such as `#1565c0` or `#16c`. The text turns dark or light to suit it. |
| **Clear** | Removes the tint and goes back to the theme's title bar. |

The inactive title bar is a muted version of the same colour, so you can still tell which window has focus.

Title Tint changes only the four `titleBar.*` colours and leaves any other colour customisations alone.

## Requirements

- VS Code 1.80 or later.
- A folder or workspace must be open, because the colour is saved per project.
- On Windows and Linux, the title bar has to be VS Code's own: `"window.titleBarStyle": "custom"`, which is the default.

## Building

```sh
npm install
npm run package    # makes title-tint-VERSION.vsix
```

Install the `.vsix` with **Extensions: Install from VSIX…** or `code --install-extension title-tint-VERSION.vsix`.

## Licence

MIT. See [LICENSE](LICENSE).
