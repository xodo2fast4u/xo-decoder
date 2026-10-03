import * as vscode from 'vscode';
import { findDecodedRegionContainingPosition } from './decoder';

export class EscapeSequenceHoverProvider implements vscode.HoverProvider {
    public provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): vscode.ProviderResult<vscode.Hover> {
        const lineText = document.lineAt(position.line).text;
        const decodedRegion = findDecodedRegionContainingPosition(lineText, position.character);
        if (decodedRegion === null) {
            return undefined;
        }
        const rangeStart = new vscode.Position(position.line, decodedRegion.startIndex);
        const rangeEnd = new vscode.Position(position.line, decodedRegion.endIndex);
        const hoverRange = new vscode.Range(rangeStart, rangeEnd);
        const hoverMarkdown = new vscode.MarkdownString();
        hoverMarkdown.appendCodeblock(decodedRegion.decodedText, 'text');
        return new vscode.Hover(hoverMarkdown, hoverRange);
    }
}