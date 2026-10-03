export interface EscapeMatch {
    startIndex: number,
    endIndex: number,
    decodedByte: number,
}

export interface DecodedRegion {
    startIndex: number,
    endIndex: number,
    decodedText: string,
}

function createHexByteEscapePattern(): RegExp {
    return /\\x([0-9a-fA-F]{2})/g;
}

function createUnicodeFourDigitEscapePattern(): RegExp {
    return /\\u([0-9a-fA-F]{4})/g;
}

function createUnicodeBraceEscapePattern(): RegExp {
    return /\\u\{([0-9a-fA-F]{1,6})\}/g;
}

function createCombinedEscapeTokenPattern(): RegExp {
    return /\\x[0-9a-fA-F]{2}|\\u\{[0-9a-fA-F]{1,6}\}|\\u[0-9a-fA-F]{4}/g;
}

function createQuotedHexStringPattern(): RegExp {
    return /"((?:\\x[0-9a-fA-F]{2})+)"/g;
}

const plusJoinSeparatorPattern = /\s*\+\s*/;
const commaQuoteSeparatorLiteral = "','";

export function findEscapeTokenRangesInText(sourceText: string): Array<{ startIndex: number, endIndex: number }> {
    const ranges: Array<{ startIndex: number, endIndex: number }> = [];
    const combinedEscapeTokenPattern = createCombinedEscapeTokenPattern();
    let matchResult: RegExpExecArray | null;
    while ((matchResult = combinedEscapeTokenPattern.exec(sourceText)) !== null) {
        ranges.push({
            startIndex: matchResult.index,
            endIndex: matchResult.index + matchResult[0].length,
        });
    }
    return ranges;
}

export function isPositionInsideAnyRange(position: number, ranges: Array<{ startIndex: number, endIndex: number }>): boolean {
    return ranges.some((range) => position >= range.startIndex && position < range.endIndex);
}

function decodeHexByteEscapesToBytes(text: string): number[] {
    const bytes: number[] = [];
    const hexByteEscapePattern = createHexByteEscapePattern();
    let matchResult: RegExpExecArray | null;
    while ((matchResult = hexByteEscapePattern.exec(text)) !== null) {
        bytes.push(parseInt(matchResult[1], 16));
    }
    return bytes;
}

function bytesToUtf8String(bytes: number[]): string {
    const byteBuffer = Buffer.from(bytes);
    return byteBuffer.toString('utf8');
}

function codePointToDisplayCharacter(codePoint: number): string {
    const isPrintableWhitespace = codePoint === 9 || codePoint === 10 || codePoint === 13 || codePoint === 32;
    const isControlCharacter = codePoint < 32 || codePoint === 127;
    if (isControlCharacter && !isPrintableWhitespace) {
        const hexDigits = codePoint.toString(16).toUpperCase().padStart(4, '0');
        return 'U+' + hexDigits;
    }
    return String.fromCodePoint(codePoint);
}

function replaceControlCharactersWithNotation(text: string): string {
    let result = '';
    for (const character of text) {
        const codePoint = character.codePointAt(0) as number;
        result += codePointToDisplayCharacter(codePoint);
    }
    return result;
}

export function decodeSingleEscapeToken(escapeToken: string): string {
    const hexByteMatch = /^\\x([0-9a-fA-F]{2})$/.exec(escapeToken);
    if (hexByteMatch !== null) {
        const codePoint = parseInt(hexByteMatch[1], 16);
        return replaceControlCharactersWithNotation(String.fromCharCode(codePoint));
    }
    const unicodeBraceMatch = /^\\u\{([0-9a-fA-F]{1,6})\}$/.exec(escapeToken);
    if (unicodeBraceMatch !== null) {
        const codePoint = parseInt(unicodeBraceMatch[1], 16);
        return replaceControlCharactersWithNotation(String.fromCodePoint(codePoint));
    }
    const unicodeFourDigitMatch = /^\\u([0-9a-fA-F]{4})$/.exec(escapeToken);
    if (unicodeFourDigitMatch !== null) {
        const codePoint = parseInt(unicodeFourDigitMatch[1], 16);
        return replaceControlCharactersWithNotation(String.fromCharCode(codePoint));
    }
    return escapeToken;
}

function decodeContiguousHexByteRunAsUtf8(hexByteRunText: string): string {
    const bytes = decodeHexByteEscapesToBytes(hexByteRunText);
    const decodedText = bytesToUtf8String(bytes);
    return replaceControlCharactersWithNotation(decodedText);
}

function decodeArbitraryEscapeSequenceRun(runText: string): string {
  const afterBraceEscapes = runText.replace(createUnicodeBraceEscapePattern(), (_fullMatch, hexDigits) => {
      return replaceControlCharactersWithNotation(String.fromCodePoint(parseInt(hexDigits, 16)));
  });
  const afterFourDigitEscapes = afterBraceEscapes.replace(createUnicodeFourDigitEscapePattern(), (_fullMatch, hexDigits) => {
      return replaceControlCharactersWithNotation(String.fromCharCode(parseInt(hexDigits, 16)));
  });
  const afterHexByteEscapes = afterFourDigitEscapes.replace(createHexByteEscapePattern(), (_fullMatch, hexDigits) => {
      return replaceControlCharactersWithNotation(String.fromCharCode(parseInt(hexDigits, 16)));
  });
    return afterHexByteEscapes;
}

interface QuotedHexSegment {
    startIndex: number,
    endIndex: number,
    innerHexText: string,
}

function findQuotedHexStringSegments(sourceText: string): QuotedHexSegment[] {
    const segments: QuotedHexSegment[] = [];
    const quotedHexStringPattern = createQuotedHexStringPattern();
    let matchResult: RegExpExecArray | null;
    while ((matchResult = quotedHexStringPattern.exec(sourceText)) !== null) {
        segments.push({
            startIndex: matchResult.index,
            endIndex: matchResult.index + matchResult[0].length,
            innerHexText: matchResult[1],
        });
    }
    return segments;
}

function textBetweenIsOnlySeparator(sourceText: string, betweenStart: number, betweenEnd: number, separator: RegExp | string): boolean {
    const betweenText = sourceText.slice(betweenStart, betweenEnd);
    if (typeof separator === 'string') {
        return betweenText === separator;
    }
    return separator.test(betweenText);
}

function tryBuildJoinedGroup(
    sourceText: string,
    segments: QuotedHexSegment[],
    startSegmentIndex: number,
    separator: RegExp | string,
): DecodedRegion | null {
    let currentSegmentIndex = startSegmentIndex;
    const decodedParts: string[] = [decodeContiguousHexByteRunAsUtf8(segments[currentSegmentIndex].innerHexText)];
    let groupEndIndex = segments[currentSegmentIndex].endIndex;
    while (currentSegmentIndex + 1 < segments.length) {
        const nextSegment = segments[currentSegmentIndex + 1];
        const isAdjacentWithSeparator = textBetweenIsOnlySeparator(
            sourceText,
            groupEndIndex,
            nextSegment.startIndex,
            separator,
        );
        if (!isAdjacentWithSeparator) {
            break;
        }
        decodedParts.push(decodeContiguousHexByteRunAsUtf8(nextSegment.innerHexText));
        groupEndIndex = nextSegment.endIndex;
        currentSegmentIndex += 1;
    }
    if (currentSegmentIndex === startSegmentIndex) {
        return null;
    }
    return {
        startIndex: segments[startSegmentIndex].startIndex,
        endIndex: groupEndIndex,
        decodedText: decodedParts.join(''),
    };
}

function findJoinedQuotedHexGroups(sourceText: string): DecodedRegion[] {
    const segments = findQuotedHexStringSegments(sourceText);
    const groups: DecodedRegion[] = [];
    let segmentIndex = 0;
    while (segmentIndex < segments.length) {
        const plusJoinedGroup = tryBuildJoinedGroup(sourceText, segments, segmentIndex, plusJoinSeparatorPattern);
        const commaJoinedGroup = tryBuildJoinedGroup(sourceText, segments, segmentIndex, commaQuoteSeparatorLiteral);
        const chosenGroup = pickLongerGroup(plusJoinedGroup, commaJoinedGroup);
        if (chosenGroup !== null) {
            groups.push(chosenGroup);
            segmentIndex = advancePastGroup(segments, segmentIndex, chosenGroup);
            continue;
        }
        groups.push({
            startIndex: segments[segmentIndex].startIndex,
            endIndex: segments[segmentIndex].endIndex,
            decodedText: decodeContiguousHexByteRunAsUtf8(segments[segmentIndex].innerHexText),
        });
        segmentIndex += 1;
    }
    return groups;
}

function pickLongerGroup(firstGroup: DecodedRegion | null, secondGroup: DecodedRegion | null): DecodedRegion | null {
    if (firstGroup === null) {
        return secondGroup;
    }
    if (secondGroup === null) {
        return firstGroup;
    }
    return firstGroup.endIndex >= secondGroup.endIndex ? firstGroup : secondGroup;
}

function advancePastGroup(segments: QuotedHexSegment[], currentSegmentIndex: number, group: DecodedRegion): number {
    let nextIndex = currentSegmentIndex;
    while (nextIndex < segments.length && segments[nextIndex].endIndex <= group.endIndex) {
        nextIndex += 1;
    }
    return nextIndex;
}

function rangesOverlap(firstStart: number, firstEnd: number, secondStart: number, secondEnd: number): boolean {
    return firstStart < secondEnd && secondStart < firstEnd;
}

export function findAllDecodedRegionsInText(sourceText: string): DecodedRegion[] {
    const joinedGroups = findJoinedQuotedHexGroups(sourceText);
    const looseEscapeTokenRanges = findEscapeTokenRangesInText(sourceText);
    const regions: DecodedRegion[] = [...joinedGroups];
    for (const tokenRange of looseEscapeTokenRanges) {
        const isCoveredByJoinedGroup = joinedGroups.some((group) => {
            return rangesOverlap(tokenRange.startIndex, tokenRange.endIndex, group.startIndex, group.endIndex);
        });
        if (isCoveredByJoinedGroup) {
            continue;
        }
        const alreadyHasRegionAtStart = regions.some((region) => region.startIndex === tokenRange.startIndex);
        if (alreadyHasRegionAtStart) {
            continue;
        }
        regions.push(buildLooseRunRegion(sourceText, tokenRange, looseEscapeTokenRanges));
    }
    regions.sort((firstRegion, secondRegion) => firstRegion.startIndex - secondRegion.startIndex);
    return mergeAdjacentOverlappingRegions(regions);
}

function buildLooseRunRegion(
    sourceText: string,
    startingTokenRange: { startIndex: number, endIndex: number },
    allTokenRanges: Array<{ startIndex: number, endIndex: number }>,
): DecodedRegion {
    let runEndIndex = startingTokenRange.endIndex;
    let foundExtension = true;
    while (foundExtension) {
        foundExtension = false;
        for (const candidateRange of allTokenRanges) {
            if (candidateRange.startIndex === runEndIndex) {
                runEndIndex = candidateRange.endIndex;
                foundExtension = true;
            }
        }
    }
    const runText = sourceText.slice(startingTokenRange.startIndex, runEndIndex);
    return {
        startIndex: startingTokenRange.startIndex,
        endIndex: runEndIndex,
        decodedText: decodeArbitraryEscapeSequenceRun(runText),
    };
}

function mergeAdjacentOverlappingRegions(sortedRegions: DecodedRegion[]): DecodedRegion[] {
    const merged: DecodedRegion[] = [];
    for (const region of sortedRegions) {
        const previousRegion = merged[merged.length - 1];
        if (previousRegion !== undefined && region.startIndex < previousRegion.endIndex) {
            continue;
        }
        merged.push(region);
    }
    return merged;
}

export function findDecodedRegionContainingPosition(sourceText: string, position: number): DecodedRegion | null {
    const allRegions = findAllDecodedRegionsInText(sourceText);
    return allRegions.find((region) => position >= region.startIndex && position <= region.endIndex) ?? null;
}

export function decodeArbitraryTextContainingEscapes(text: string): string {
    const regions = findAllDecodedRegionsInText(text);
    if (regions.length === 0) {
        return decodeArbitraryEscapeSequenceRun(text);
    }
    let result = '';
    let cursor = 0;
    for (const region of regions) {
        result += text.slice(cursor, region.startIndex);
        result += region.decodedText;
        cursor = region.endIndex;
    }
    result += text.slice(cursor);
    return result;
}