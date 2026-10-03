# Xo Decoder

Xo Decoder is a Visual Studio Code extension for previewing and decoding
hexadecimal and Unicode escape sequences in source files. Decoding happens
locally in the editor; the extension does not send file contents anywhere and
does not use telemetry.

## Features

- Preview the decoded text by hovering over an escape sequence.
- Decode the escape sequence or adjacent sequence run at the cursor.
- Decode escape sequences in a selection or throughout the whole file.
- Decode UTF-8 byte sequences written as consecutive `\xNN` escapes.
- Recognize hexadecimal escapes (`\xNN`), four-digit Unicode escapes
  (`\uNNNN`) and braced Unicode code points (`\u{...}`).
- Handle quoted hexadecimal byte strings, including strings joined with `+`
  or the `','` separator.
- Display non-printable control characters as `U+XXXX` notation instead of
  inserting invisible characters.

## Requirements

- Visual Studio Code **1.136.0 or later**
- [Bun](https://bun.sh/) or [Node.js](https://nodejs.org/) with npm to install
  the development dependencies

## Install the packaged extension

This repository includes a packaged extension, `xo-decoder-1.0.0.vsix`.

1. In VS Code, open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2. Run **Extensions: Install from VSIX...**.
3. Select `xo-decoder-1.0.0.vsix` from the project folder.
4. Reload VS Code if prompted.

Alternatively, install it from a terminal:

```bash
code --install-extension xo-decoder-1.0.0.vsix
```

## Use the extension

Open a file and place the cursor on an escape sequence. Hover over it to see a
decoded preview or run one of the commands from the Command Palette:

| Command | Default shortcut |
| --- | --- |
| **Xo Decoder: Decode Token Under Cursor** | `Alt+D` |
| **Xo Decoder: Decode Selected Text** | `Shift+Alt+D` |
| **Xo Decoder: Decode All In File** | `Ctrl+Shift+Alt+D` |

The decode commands replace the selected text in the editor. The whole-file
command leaves the file unchanged and reports when it finds no escape
sequences. Shortcuts can be changed in VS Code's Keyboard Shortcuts editor.

The extension activates automatically for JavaScript, TypeScript, Python, C,
C++ and plaintext documents. Commands can also be invoked from the Command
Palette in other open files.

## Examples

| Input | Decoded result |
| --- | --- |
| `\x48\x69` | `Hi` |
| `\u2764` | `❤` |
| `\u{1F680}` | `🚀` |
| `"\xE2\x9C\x93"` | `✓` |

Consecutive `\xNN` byte escapes are interpreted together as UTF-8, so
multi-byte characters decode correctly. Other adjacent escape sequences are
decoded as a run. For example, control characters such as `\x00` are shown as
`U+0000`.

## Build from source

Clone or download this repository, then install dependencies and compile:

```bash
bun install
bun run compile
```

The generated JavaScript is written to `out/`. To recompile automatically
while editing:

```bash
bun run watch
```

The equivalent npm commands are `npm install`, `npm run compile` and
`npm run watch`.

## Project structure

| Path | Purpose |
| --- | --- |
| `src/decoder.ts` | Finds and decodes supported escape sequences |
| `src/commandHandlers.ts` | Implements the editor decode commands |
| `src/hoverProvider.ts` | Provides decoded previews on hover |
| `src/extension.ts` | Registers commands and the hover provider |
| `out/` | Compiled extension JavaScript |

## Privacy

Xo Decoder processes text locally in VS Code. It has telemetry disabled and
does not transmit editor contents over the network.
