import * as vscode from 'vscode';
import { decodeArbitraryTextContainingEscapes, findDecodedRegionContainingPosition } from './decoder';

function getActiveTextEditorOrWarn(): vscode.TextEditor | undefined {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor === undefined) {
        vscode.window.showWarningMessage('Xo Decoder: no active editor.');
    }
    return activeEditor;
}

export async function decodeTokenUnderCursor(): Promise<void> {
    const activeEditor = getActiveTextEditorOrWarn();
    if (activeEditor === undefined) {
        return;
    }
    const cursorPosition = activeEditor.selection.active;
    const lineText = activeEditor.document.lineAt(cursorPosition.line).text;
    const decodedRegion = findDecodedRegionContainingPosition(lineText, cursorPosition.character);
    if (decodedRegion === null) {
        vscode.window.showInformationMessage('Xo Decoder: no escape sequence found at cursor.');
        return;
    }
    const rangeToReplace = new vscode.Range(
        new vscode.Position(cursorPosition.line, decodedRegion.startIndex),
        new vscode.Position(cursorPosition.line, decodedRegion.endIndex),
    );
    await activeEditor.edit((editBuilder: vscode.TextEditorEdit) => {
        editBuilder.replace(rangeToReplace, decodedRegion.decodedText);
    });
}

export async function decodeSelectedText(): Promise<void> {
    const activeEditor = getActiveTextEditorOrWarn();
    if (activeEditor === undefined) {
        return;
    }
    const selection = activeEditor.selection;
    if (selection.isEmpty) {
        vscode.window.showInformationMessage('Xo Decoder: no text selected.');
        return;
    }
    const selectedText = activeEditor.document.getText(selection);
    const decodedText = decodeArbitraryTextContainingEscapes(selectedText);
    await activeEditor.edit((editBuilder: vscode.TextEditorEdit) => {
        editBuilder.replace(selection, decodedText);
    });
}

export async function decodeEntireFile(): Promise<void> {
    const activeEditor = getActiveTextEditorOrWarn();
    if (activeEditor === undefined) {
        return;
    }
    const document = activeEditor.document;
    const fullDocumentRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length),
    );
    const fullDocumentText = document.getText();
    const decodedText = decodeArbitraryTextContainingEscapes(fullDocumentText);
    if (decodedText === fullDocumentText) {
        vscode.window.showInformationMessage('Xo Decoder: no escape sequences found in file.');
        return;
    }
    await activeEditor.edit((editBuilder: vscode.TextEditorEdit) => {
        editBuilder.replace(fullDocumentRange, decodedText);
    });
}