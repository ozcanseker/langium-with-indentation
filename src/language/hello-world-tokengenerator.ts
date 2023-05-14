import _ from "lodash";

import { AbstractLangiumParser, AstNode, DefaultTokenBuilder, isTokenTypeDictionary, LangiumParser, LangiumServices, LexerResult, ParseResult, TokenBuilderOptions } from "langium";
import { AbstractElement, Action, Grammar, ParserRule, TerminalRule } from "langium/lib/grammar/generated/ast";
import { terminalRegex } from 'langium/lib/grammar/internal-grammar-util';
import { Lexer, TokenType, createToken, createTokenInstance, IToken, Lexer as ChevrotainLexer, TokenTypeDictionary, TokenVocabulary } from 'chevrotain';
import { DefaultLexer } from "langium";

// Some global variables, should be a better way of doing this.
let indentStack = [0]
const matchIndent = _.partialRight(matchIndentBase, "indent")
const matchOutdent = _.partialRight(matchIndentBase, "dedent")

const INDENT = createToken({
    name: "INDENT",
    pattern: matchIndent,
    // custom token patterns should explicitly specify the line_breaks option
    line_breaks: false
})
const DEDENT = createToken({
    name: "DEDENT",
    pattern: matchOutdent,
    // custom token patterns should explicitly specify the line_breaks option
    line_breaks: false
})


export class HelloWorldLexer extends DefaultLexer {
    constructor(services: LangiumServices){
        super(services);
    }

    override tokenize(text: string): LexerResult {
        let chevrotainResult = super.tokenize(text);
        let newlines = text.split(/\r\n|\r|\n/).length;
        let match = text.match(/.*$/)?.length;
        match = match ? match : 0;

        //add remaining Outdents
        while (indentStack.length > 1) {
            chevrotainResult.tokens.push(
                createTokenInstance(DEDENT, "DEDENT", text.length, text.length, newlines, newlines, match, match)
                // createTokenInstance(DEDENT, "DEDENT", text.length, text.length, 10, 10, 0, 0)
            )
            indentStack.pop()
        }

        indentStack = [0];

        return chevrotainResult;
    }
}

export class HelloWorldTokenBuilder extends DefaultTokenBuilder {
    // de standaard implementatie van defaulth plaats spaces aan het begin, dit si fout
    override buildTokens(grammar: Grammar, options?: TokenBuilderOptions): TokenVocabulary {
        let tokens: TokenType[] = super.buildTokens(grammar, options) as TokenType[];

        let updatedTokens: TokenType[] = [];
        let tokenWithSpaces: TokenType | null = null;

        for (const token of tokens) {
            if (token.name === "SPACES") {
                tokenWithSpaces = token;
            } else {
                updatedTokens.push(token);
            }
        }

        if (tokenWithSpaces) {
            updatedTokens.push(tokenWithSpaces);
        }

        return updatedTokens;
    }

    // bouw eigen terminal tokens
    protected override buildTerminalToken(terminal: TerminalRule): TokenType {
        let group: string | undefined;
        const regex = terminalRegex(terminal);

        if (terminal.hidden) {
            // Only skip tokens that are able to accept whitespace
            group = new RegExp(regex).test(' ') ? Lexer.SKIPPED : 'hidden';
        }

        let token;
        if (terminal.name == "NEWLINE") {
            token = createToken({
                name: "NEWLINE",
                pattern: /\n|\r\n?/,
                group: "nl"
            })
        } else if (terminal.name == "INDENT") {
            token = INDENT;
        } else if (terminal.name == "DEDENT") {
            token = DEDENT;
        } else if (terminal.name == "SPACES") {
            token = createToken({
                name: "SPACES",
                pattern: / +/,
                group: Lexer.SKIPPED
            })
        } else {
            token = { name: terminal.name, GROUP: group, PATTERN: new RegExp(regex) };
        }

        if (!group) {
            // 'undefined' is not a valid value for `GROUP`; therefore, we have to delete it
            delete token.GROUP;
        }

        return token;
    }
}

function matchIndentBase(text: string, offset: number, matchedTokens: IToken[], groups: any, type: string) {
    const noTokensMatchedYet = _.isEmpty(matchedTokens);
    const newLines: Array<IToken> = groups.nl;
    const noNewLinesMatchedYet = _.isEmpty(newLines);
    const isFirstLine = noTokensMatchedYet && noNewLinesMatchedYet;

    // Weird construction to get it working with typescript
    let last_newline = _.last(newLines);
    if (!last_newline) {
        last_newline = { startOffset: -100 } as IToken;
    }

    const isStartOfLine =
        // only newlines matched so far
        (noTokensMatchedYet && !noNewLinesMatchedYet) ||
        // Both newlines and other Tokens have been matched AND the offset is just after the last newline
        (!noTokensMatchedYet && !noNewLinesMatchedYet && offset === last_newline.startOffset + 2);

    // indentation can only be matched at the start of a line.
    if (isFirstLine || isStartOfLine) {
        let match;
        let currIndentLevel: number | undefined = undefined;

        const wsRegExp = /[ -]+/y;
        wsRegExp.lastIndex = offset;
        match = wsRegExp.exec(text);

        // possible non-empty indentation
        if (match !== null) {
            currIndentLevel = match[0].length
        }
        // "empty" indentation means indentLevel of 0.
        else {
            currIndentLevel = 0
        }

        const prevIndentLevel = _.last(indentStack);

        if (prevIndentLevel == undefined) {
            throw Error();
        }

        // deeper indentation
        if (currIndentLevel > prevIndentLevel && type === "indent") {
            indentStack.push(currIndentLevel)
            return match
        }
        // shallower indentation
        else if (currIndentLevel < prevIndentLevel && type === "dedent") {
            const matchIndentIndex = _.findLastIndex(
                indentStack,
                (stackIndentDepth) => stackIndentDepth === currIndentLevel
            );

            // any outdent must match some previous indentation level.
            if (matchIndentIndex === -1) {
                throw Error(`invalid outdent at offset: ${offset}`)
            }

            const numberOfDedents = indentStack.length - matchIndentIndex - 1;

            // This is a little tricky
            // 1. If there is no match (0 level indent) than this custom token
            //    matcher would return "null" and so we need to add all the required outdents ourselves.
            // 2. If there was match (> 0 level indent) than we need to add minus one number of outsents
            //    because the lexer would create one due to returning a none null result.
            let iStart = match !== null ? 1 : 0
            for (let i = iStart; i < numberOfDedents; i++) {
                indentStack.pop()
                matchedTokens.push(
                    createTokenInstance(DEDENT, "DEDENT", NaN, NaN, NaN, NaN, NaN, NaN)
                )
            }

            // even though we are adding fewer outdents directly we still need to update the indent stack fully.
            if (iStart === 1) {
                indentStack.pop()
            }
            return match
        } else {
            // same indent, this should be lexed as simple whitespace and ignored
            return null
        }
    } else {
        // indentation cannot be matched under other circumstances
        return null
    }
}