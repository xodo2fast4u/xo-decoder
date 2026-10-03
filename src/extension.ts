import * as vscode from 'vscode';
import { EscapeSequenceHoverProvider } from './hoverProvider';
import { decodeTokenUnderCursor, decodeSelectedText, decodeEntireFile } from './commandHandlers';

export function activate(extensionContext: vscode.ExtensionContext): void {
    const hoverProvider = vscode.languages.registerHoverProvider(
        { scheme: 'file' },
        new EscapeSequenceHoverProvider(),
    );

    const decodeTokenCommand = vscode.commands.registerCommand(
        'xoDecoder.decodeTokenUnderCursor',
        decodeTokenUnderCursor,
    );

    const decodeSelectionCommand = vscode.commands.registerCommand(
        'xoDecoder.decodeSelection',
        decodeSelectedText,
    );

    const decodeEntireFileCommand = vscode.commands.registerCommand(
        'xoDecoder.decodeEntireFile',
        decodeEntireFile,
    );

    extensionContext.subscriptions.push(
        hoverProvider,
        decodeTokenCommand,
        decodeSelectionCommand,
        decodeEntireFileCommand,
    );
}

export function deactivate(): void {
    return undefined;
}