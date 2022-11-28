/* webgpu-utils@0.0.1, license MIT */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.webgpuUtils = {}));
})(this, (function (exports) { 'use strict';

    /**
     * @author Brendan Duncan / https://github.com/brendan-duncan
     */

    class Token {
        constructor(type, lexeme, line) {
            this._type = type;
            this._lexeme = lexeme;
            this._line = line;
        }

        toString() {
            return this._lexeme;
        }
    }

    Token.EOF = { name: "EOF", type: "token", rule: -1 };

    let Keyword = {};

    class WgslScanner {
        constructor(source) {
            this._source = source || "";
            this._tokens = [];
            this._start = 0;
            this._current = 0;
            this._line = 1;
        }

        scanTokens() {
            while (!this._isAtEnd()) {
                this._start = this._current;
                if (!this.scanToken())
                    throw `Invalid syntax at line ${this._line}`;
            }

            this._tokens.push(new Token(Token.EOF, "", this._line));
            return this._tokens;
        }

        scanToken() {
            // Find the longest consecutive set of characters that match a rule.
            let lexeme = this._advance();

            // Skip line-feed, adding to the line counter.
            if (lexeme == "\n") {
                this._line++;
                return true;
            }

            // Skip whitespace
            if (this._isWhitespace(lexeme)) {
                return true;
            }

            if (lexeme == "/") {
                // If it's a // comment, skip everything until the next line-feed.
                if (this._peekAhead() == "/") {
                    while (lexeme != "\n") {
                        if (this._isAtEnd())
                            return true;
                        lexeme = this._advance();
                    }
                    // skip the linefeed
                    this._line++;
                    return true;
                } else if (this._peekAhead() == "*") {
                    // If it's a /* block comment, skip everything until the matching */,
                    // allowing for nested block comments.
                    this._advance();
                    let commentLevel = 1;
                    while (commentLevel > 0) {
                        if (this._isAtEnd())
                            return true;
                        lexeme = this._advance();
                        if (lexeme == "\n") {
                            this._line++;
                        } else if (lexeme == "*") {
                            if (this._peekAhead() == "/") {
                                this._advance();
                                commentLevel--;
                                if (commentLevel == 0) {
                                    return true;
                                }
                            }
                        } else if (lexeme == "/") {
                            if (this._peekAhead() == "*") {
                                this._advance();
                                commentLevel++;
                            }
                        }
                    }
                    return true;
                }
            }

            let matchToken = null;

            for (;;) {
                let matchedToken = this._findToken(lexeme);

                // The exception to "longest lexeme" rule is '>>'. In the case of 1>>2, it's a shift_right.
                // In the case of array<vec4<f32>>, it's two greater_than's (one to close the vec4,
                // and one to close the array).
                // I don't know of a great way to resolve this, so '>>' is special-cased and if
                // there was a less_than up to some number of tokens previously, and the token prior to
                // that is a keyword that requires a '<', then it will be split into two greater_than's;
                // otherwise it's a shift_right.
                if (lexeme == ">" && this._peekAhead() == ">") {
                    let foundLessThan = false;
                    let ti = this._tokens.length - 1;
                    for (let count = 0; count < 4 && ti >= 0; ++count, --ti) {
                        if (this._tokens[ti]._type == Token.less_than) {
                            if (ti > 0 && Token.template_types.indexOf(this._tokens[ti - 1]._type) != -1) {
                                foundLessThan = true;
                            }
                            break;
                        }
                    }
                    // If there was a less_than in the recent token history, then this is probably a
                    // greater_than.
                    if (foundLessThan) {
                        this._addToken(matchedToken);
                        return true;
                    }
                }

                // The current lexeme may not match any rule, but some token types may be invalid for
                // part of the string but valid after a few more characters.
                // For example, 0x.5 is a hex_float_literal. But as it's being scanned,
                // "0" is a int_literal, then "0x" is invalid. If we stopped there, it would return
                // the int_literal "0", but that's incorrect. So if we look forward a few characters,
                // we'd get "0x.", which is still invalid, followed by "0x.5" which is the correct
                // hex_float_literal. So that means if we hit an non-matching string, we should look
                // ahead up to two characters to see if the string starts matching a valid rule again.
                if (!matchedToken) {
                    let lookAheadLexeme = lexeme;
                    let lookAhead = 0;
                    const maxLookAhead = 2;
                    for (let li = 0; li < maxLookAhead; ++li) {
                        lookAheadLexeme += this._peekAhead(li);
                        matchedToken = this._findToken(lookAheadLexeme);
                        if (matchedToken) {
                            lookAhead = li;
                            break;
                        }
                    }

                    if (!matchedToken) {
                        if (!matchToken)
                            return false;
                        this._current--;
                        this._addToken(matchToken);
                        return true;
                    }

                    lexeme = lookAheadLexeme;
                    this._current += lookAhead + 1;
                }

                matchToken = matchedToken;

                if (this._isAtEnd())
                    break;

                lexeme += this._advance();
            }

            // We got to the end of the input stream. Then the token we've ready so far is it.
            if (matchToken === null)
                return false;

            this._addToken(matchToken);
            return true;
        }

        _findToken(lexeme) {
            for (const name in Keyword) {
                const token = Keyword[name];
                if (this._match(lexeme, token.rule)) {
                    return token;
                }
            }
            for (const name in Token.Tokens) {
                const token = Token.Tokens[name];
                if (this._match(lexeme, token.rule)) {
                    return token;
                }
            }
            return null;
        }

        _match(lexeme, rule) {
            if (typeof(rule) == "string") {
                if (rule == lexeme) {
                    return true;
                }
            } else {
                // regex
                const match = rule.exec(lexeme);
                if (match && match.index == 0 && match[0] == lexeme)
                    return true;
            }
            return false;
        }

        _isAtEnd() {
            return this._current >= this._source.length;
        }

        _isWhitespace(c) {
            return c == " " || c == "\t" || c == "\r";
        }

        _advance(amount) {
            let c = this._source[this._current];
            amount = amount || 0;
            amount++;
            this._current += amount;
            return c;
        }

        _peekAhead(offset) {
            offset = offset || 0;
            if (this._current + offset >= this._source.length) return "\0";
            return this._source[this._current + offset];
        }

        _addToken(type) {
            const text = this._source.substring(this._start, this._current);
            this._tokens.push(new Token(type, text, this._line));
        }
    }

    Token.WgslTokens = {
        decimal_float_literal:
            /((-?[0-9]*\.[0-9]+|-?[0-9]+\.[0-9]*)((e|E)(\+|-)?[0-9]+)?f?)|(-?[0-9]+(e|E)(\+|-)?[0-9]+f?)/,
        hex_float_literal:
            /-?0x((([0-9a-fA-F]*\.[0-9a-fA-F]+|[0-9a-fA-F]+\.[0-9a-fA-F]*)((p|P)(\+|-)?[0-9]+f?)?)|([0-9a-fA-F]+(p|P)(\+|-)?[0-9]+f?))/,
        int_literal:
            /-?0x[0-9a-fA-F]+|0|-?[1-9][0-9]*/,
        uint_literal:
            /0x[0-9a-fA-F]+u|0u|[1-9][0-9]*u/,
        ident:
            /[a-zA-Z][0-9a-zA-Z_]*/,
        and:
            '&',
        and_and:
            '&&',
        arrow :
            '->',
        attr:
            '@',
        attr_left:
            '[[',
        attr_right:
            ']]',
        forward_slash:
            '/',
        bang:
            '!',
        bracket_left:
            '[',
        bracket_right:
            ']',
        brace_left:
            '{',
        brace_right:
            '}',
        colon:
            ':',
        comma:
            ',',
        equal:
            '=',
        equal_equal:
            '==',
        not_equal:
            '!=',
        greater_than:
            '>',
        greater_than_equal:
            '>=',
        shift_right:
            '>>',
        less_than:
            '<',
        less_than_equal:
            '<=',
        shift_left:
            '<<',
        modulo:
            '%',
        minus:
            '-',
        minus_minus:
            '--',
        period:
            '.',
        plus:
            '+',
        plus_plus:
            '++',
        or:
            '|',
        or_or:
            '||',
        paren_left:
            '(',
        paren_right:
            ')',
        semicolon:
            ';',
        star:
            '*',
        tilde:
            '~',
        underscore:
            '_',
        xor:
            '^',

        plus_equal:
            '+=',
        minus_equal:
            '-=',
        times_equal:
            '*=',
        division_equal:
            '/=',
        modulo_equal:
            '%=',
        and_equal:
            '&=',
        or_equal:
            '|=',
        xor_equal:
            '^=',
        shift_right_equal:
            '>>=',
        shift_left_equal:
            '<<=',
    };

    Token.WgslKeywords = [
        "array",
        "atomic",
        "bool",
        "f32",
        "i32",
        "mat2x2",
        "mat2x3",
        "mat2x4",
        "mat3x2",
        "mat3x3",
        "mat3x4",
        "mat4x2",
        "mat4x3",
        "mat4x4",
        "ptr",
        "sampler",
        "sampler_comparison",
        "struct",
        "texture_1d",
        "texture_2d",
        "texture_2d_array",
        "texture_3d",
        "texture_cube",
        "texture_cube_array",
        "texture_multisampled_2d",
        "texture_storage_1d",
        "texture_storage_2d",
        "texture_storage_2d_array",
        "texture_storage_3d",
        "texture_depth_2d",
        "texture_depth_2d_array",
        "texture_depth_cube",
        "texture_depth_cube_array",
        "texture_depth_multisampled_2d",
        "u32",
        "vec2",
        "vec3",
        "vec4",
        "bitcast",
        "block",
        "break",
        "case",
        "continue",
        "continuing",
        "default",
        "discard",
        "else",
        "elseif",
        "enable",
        "fallthrough",
        "false",
        "fn",
        "for",
        "function",
        "if",
        "let",
        "const",
        "loop",
        "while",
        "private",
        "read",
        "read_write",
        "return",
        "storage",
        "switch",
        "true",
        "type",
        "uniform",
        "var",
        "workgroup",
        "write",
        "r8unorm",
        "r8snorm",
        "r8uint",
        "r8sint",
        "r16uint",
        "r16sint",
        "r16float",
        "rg8unorm",
        "rg8snorm",
        "rg8uint",
        "rg8sint",
        "r32uint",
        "r32sint",
        "r32float",
        "rg16uint",
        "rg16sint",
        "rg16float",
        "rgba8unorm",
        "rgba8unorm_srgb",
        "rgba8snorm",
        "rgba8uint",
        "rgba8sint",
        "bgra8unorm",
        "bgra8unorm_srgb",
        "rgb10a2unorm",
        "rg11b10float",
        "rg32uint",
        "rg32sint",
        "rg32float",
        "rgba16uint",
        "rgba16sint",
        "rgba16float",
        "rgba32uint",
        "rgba32sint",
        "rgba32float",
        "static_assert"
    ];

    Token.WgslReserved = [
        "asm",
        "bf16",
        "do",
        "enum",
        "f16",
        "f64",
        "handle",
        "i8",
        "i16",
        "i64",
        "mat",
        "premerge",
        "regardless",
        "typedef",
        "u8",
        "u16",
        "u64",
        "unless",
        "using",
        "vec",
        "void"
    ];

    function _InitTokens() {
        Token.Tokens = {};
        for (let token in Token.WgslTokens) {
            Token.Tokens[token] = {
                name: token,
                type: "token",
                rule: Token.WgslTokens[token],
                toString: function() { return token; }
            };
            Token[token] = Token.Tokens[token];
        }

        for (let i = 0, l = Token.WgslKeywords.length; i < l; ++i) {
            Keyword[Token.WgslKeywords[i]] = {
                name: Token.WgslKeywords[i],
                type: "keyword",
                rule: Token.WgslKeywords[i],
                toString: function() { return Token.WgslKeywords[i]; }
            };
        }

        for (let i = 0, l = Token.WgslReserved.length; i < l; ++i) {
            Keyword[Token.WgslReserved[i]] = {
                name: Token.WgslReserved[i], 
                type: "reserved",
                rule: Token.WgslReserved[i],
                toString: function() { return Token.WgslReserved[i]; }
            };
        }

        // WGSL grammar has a few keywords that have different token names than the strings they
        // represent. Aliasing them here.

        Keyword.int32 = Keyword.i32;
        Keyword.uint32 = Keyword.u32;
        Keyword.float32 = Keyword.f32;
        Keyword.pointer = Keyword.ptr;

        // The grammar has a few rules where the rule can match to any one of a given set of keywords
        // or tokens. Defining those here.

        Token.storage_class = [
            Keyword.function,
            Keyword.private,
            Keyword.workgroup,
            Keyword.uniform,
            Keyword.storage
        ];
        
        Token.access_mode = [
            Keyword.read,
            Keyword.write,
            Keyword.read_write
        ];
        
        Token.sampler_type = [
            Keyword.sampler,
            Keyword.sampler_comparison
        ];
        
        Token.sampled_texture_type = [
            Keyword.texture_1d,
            Keyword.texture_2d,
            Keyword.texture_2d_array,
            Keyword.texture_3d,
            Keyword.texture_cube,
            Keyword.texture_cube_array
        ];
        
        Token.multisampled_texture_type = [
            Keyword.texture_multisampled_2d
        ];
        
        Token.storage_texture_type = [
            Keyword.texture_storage_1d,
            Keyword.texture_storage_2d,
            Keyword.texture_storage_2d_array,
            Keyword.texture_storage_3d
        ];
        
        Token.depth_texture_type = [
            Keyword.texture_depth_2d,
            Keyword.texture_depth_2d_array,
            Keyword.texture_depth_cube,
            Keyword.texture_depth_cube_array,
            Keyword.texture_depth_multisampled_2d
        ];

        Token.any_texture_type = [
            ...Token.sampled_texture_type,
            ...Token.multisampled_texture_type,
            ...Token.storage_texture_type,
            ...Token.depth_texture_type
        ];

        Token.texel_format = [
            Keyword.r8unorm,
            Keyword.r8snorm,
            Keyword.r8uint,
            Keyword.r8sint,
            Keyword.r16uint,
            Keyword.r16sint,
            Keyword.r16float,
            Keyword.rg8unorm,
            Keyword.rg8snorm,
            Keyword.rg8uint,
            Keyword.rg8sint,
            Keyword.r32uint,
            Keyword.r32sint,
            Keyword.r32float,
            Keyword.rg16uint,
            Keyword.rg16sint,
            Keyword.rg16float,
            Keyword.rgba8unorm,
            Keyword.rgba8unorm_srgb,
            Keyword.rgba8snorm,
            Keyword.rgba8uint,
            Keyword.rgba8sint,
            Keyword.bgra8unorm,
            Keyword.bgra8unorm_srgb,
            Keyword.rgb10a2unorm,
            Keyword.rg11b10float,
            Keyword.rg32uint,
            Keyword.rg32sint,
            Keyword.rg32float,
            Keyword.rgba16uint,
            Keyword.rgba16sint,
            Keyword.rgba16float,
            Keyword.rgba32uint,
            Keyword.rgba32sint,
            Keyword.rgba32float
        ];

        Token.const_literal = [
            Token.int_literal,
            Token.uint_literal,
            Token.decimal_float_literal,
            Token.hex_float_literal,
            Keyword.true,
            Keyword.false
        ];

        Token.literal_or_ident = [
            Token.ident,
            Token.int_literal,
            Token.uint_literal,
            Token.decimal_float_literal,
            Token.hex_float_literal,
        ];

        Token.element_count_expression = [
            Token.int_literal,
            Token.uint_literal,
            Token.ident
        ];

        Token.template_types = [
            Keyword.vec2,
            Keyword.vec3,
            Keyword.vec4,
            Keyword.mat2x2,
            Keyword.mat2x3,
            Keyword.mat2x4,
            Keyword.mat3x2,
            Keyword.mat3x3,
            Keyword.mat3x4,
            Keyword.mat4x2,
            Keyword.mat4x3,
            Keyword.mat4x4,
            Keyword.atomic,

            Keyword.bitcast,

            ...Token.any_texture_type,
        ];

        // The grammar calls out 'block', but attribute grammar is defined to use a 'ident'.
        // The attribute grammar should be ident | block.
        Token.attribute_name = [
            Token.ident,
            Keyword.block,
        ];

        Token.assignment_operators = [
            Token.equal,
            Token.plus_equal,
            Token.minus_equal,
            Token.times_equal,
            Token.division_equal,
            Token.modulo_equal,
            Token.and_equal,
            Token.or_equal,
            Token.xor_equal,
            Token.shift_right_equal,
            Token.shift_left_equal
        ];

        Token.increment_operators = [
            Token.plus_plus,
            Token.minus_minus
        ];
    }
    _InitTokens();

    /**
     * @author Brendan Duncan / https://github.com/brendan-duncan
     */

    class AST {
        constructor(type, options) {
            this._type = type;
            if (options) {
                for (let option in options) {
                    this[option] = options[option];
                }
            }
        }
    }

    class WgslParser {
        constructor() {
            this._tokens = [];
            this._current = 0;
        }

        parse(tokensOrCode) {
            this._initialize(tokensOrCode);

            let statements = [];
            while (!this._isAtEnd()) {
                const statement = this._global_decl_or_directive();
                if (!statement)
                    break;
                statements.push(statement);
            }
            return statements;
        }

        _initialize(tokensOrCode) {
            if (tokensOrCode) {
                if (typeof(tokensOrCode) == "string") {
                    const scanner = new WgslScanner(tokensOrCode);
                    this._tokens = scanner.scanTokens();
                } else {
                    this._tokens = tokensOrCode;
                }
            } else {
                this._tokens = [];
            }
            this._current = 0;
        }

        _error(token, message) {
            console.error(token, message);
            return { token, message, toString: function() { return `${message}`; } };
        }

        _isAtEnd() { return this._current >= this._tokens.length || this._peek()._type == Token.EOF; }

        _match(types) {
            if (types.length === undefined) {
                if (this._check(types)) {
                    this._advance();
                    return true;
                }
                return false;
            }

            for (let i = 0, l = types.length; i < l; ++i) {
                const type = types[i];
                if (this._check(type)) {
                    this._advance();
                    return true;
                }
            }

            return false;
        }

        _consume(types, message) {
            if (this._check(types)) return this._advance();
            throw this._error(this._peek(), message);
        }

        _check(types) {
            if (this._isAtEnd()) return false;
            if (types.length !== undefined) {
                let t = this._peek()._type;
                return types.indexOf(t) != -1;
            }
            return this._peek()._type == types;
        }

        _advance() {
            if (!this._isAtEnd()) this._current++;
            return this._previous();
        }

        _peek() {
            return this._tokens[this._current];
        }

        _previous() {
            return this._tokens[this._current - 1];
        }

        _global_decl_or_directive() {
            // semicolon
            // global_variable_decl semicolon
            // global_constant_decl semicolon
            // type_alias semicolon
            // struct_decl
            // function_decl
            // enable_directive

            // Ignore any stand-alone semicolons
            while (this._match(Token.semicolon) && !this._isAtEnd());

            if (this._match(Keyword.type)) {
                const type = this._type_alias();
                this._consume(Token.semicolon, "Expected ';'");
                return type;
            }

            if (this._match(Keyword.enable)) {
                const enable = this._enable_directive();
                this._consume(Token.semicolon, "Expected ';'");
                return enable;
            }

            // The following statements have an optional attribute*
            const attrs = this._attribute();

            if (this._check(Keyword.var)) {
                const _var = this._global_variable_decl();
                _var.attributes = attrs;
                this._consume(Token.semicolon, "Expected ';'.");
                return _var;
            }

            if (this._check(Keyword.let)) {
                const _let = this._global_constant_decl();
                _let.attributes = attrs;
                this._consume(Token.semicolon, "Expected ';'.");
                return _let;
            }

            if (this._check(Keyword.struct)) {
                const _struct = this._struct_decl();
                _struct.attributes = attrs;
                return _struct;
            }

            if (this._check(Keyword.fn)) {
                const _fn = this._function_decl();
                _fn.attributes = attrs;
                return _fn;
            }
            
            return null;
        }

        _function_decl() {
            // attribute* function_header compound_statement
            // function_header: fn ident paren_left param_list? paren_right (arrow attribute* type_decl)?
            if (!this._match(Keyword.fn))
                return null;

            const name = this._consume(Token.ident, "Expected function name.").toString();

            this._consume(Token.paren_left, "Expected '(' for function arguments.");

            const args = [];
            if (!this._check(Token.paren_right)) {
                do {
                    if (this._check(Token.paren_right))
                        break;
                    const argAttrs = this._attribute();

                    const name = this._consume(Token.ident, "Expected argument name.").toString();

                    this._consume(Token.colon, "Expected ':' for argument type.");
                    
                    const typeAttrs = this._attribute();
                    const type = this._type_decl();
                    type.attributes = typeAttrs;

                    args.push(new AST("arg", { name, attributes: argAttrs, type }));
                } while (this._match(Token.comma));
            }

            this._consume(Token.paren_right, "Expected ')' after function arguments.");

            let _return = null;
            if (this._match(Token.arrow)) {
                const attrs = this._attribute();
                _return = this._type_decl();
                _return.attributes = attrs;
            }

            const body = this._compound_statement();

            return new AST("function", { name, args, return: _return, body });
        }

        _compound_statement() {
            // brace_left statement* brace_right
            const statements = [];
            this._consume(Token.brace_left, "Expected '{' for block.");
            while (!this._check(Token.brace_right)) {
                const statement = this._statement();
                if (statement)
                    statements.push(statement);
            }
            this._consume(Token.brace_right, "Expected '}' for block.");

            return statements;
        }

        _statement() {
            // semicolon
            // return_statement semicolon
            // if_statement
            // switch_statement
            // loop_statement
            // for_statement
            // func_call_statement semicolon
            // variable_statement semicolon
            // break_statement semicolon
            // continue_statement semicolon
            // discard semicolon
            // assignment_statement semicolon
            // compound_statement
            // increment_statement semicolon
            // decrement_statement semicolon
            // static_assert_statement semicolon

            // Ignore any stand-alone semicolons
            while (this._match(Token.semicolon) && !this._isAtEnd());

            if (this._check(Keyword.if))
                return this._if_statement();

            if (this._check(Keyword.switch))
                return this._switch_statement();

            if (this._check(Keyword.loop))
                return this._loop_statement();

            if (this._check(Keyword.for))
                return this._for_statement();

            if (this._check(Keyword.while))
                return this._while_statement();

            if (this._check(Keyword.static_assert))
                return this._static_assert_statement();

            if (this._check(Token.brace_left))
                return this._compound_statement();

            let result = null;
            if (this._check(Keyword.return))
                result = this._return_statement();
            else if (this._check([Keyword.var, Keyword.let, Keyword.const]))
                result = this._variable_statement();
            else if (this._match(Keyword.discard))
                result = new AST("discard");
            else if (this._match(Keyword.break))
                result = new AST("break");
            else if (this._match(Keyword.continue))
                result = new AST("continue");
            else 
                result = this._increment_decrement_statement() || this._func_call_statement() || this._assignment_statement();
            
            if (result != null)
                this._consume(Token.semicolon, "Expected ';' after statement.");

            return result;
        }
        
        _static_assert_statement() {
            if (!this._match(Keyword.static_assert))
                return null;
            let expression = this._optional_paren_expression();
            return new AST("static_assert", { expression });
        }

        _while_statement() {
            if (!this._match(Keyword.while))
                return null;
            let condition = this._optional_paren_expression();
            const block = this._compound_statement();
            return new AST("while", { condition, block });
        }

        _for_statement() {
            // for paren_left for_header paren_right compound_statement
            if (!this._match(Keyword.for))
                return null;

            this._consume(Token.paren_left, "Expected '('.");

            // for_header: (variable_statement assignment_statement func_call_statement)? semicolon short_circuit_or_expression? semicolon (assignment_statement func_call_statement)?
            const init = !this._check(Token.semicolon) ? this._for_init() : null;
            this._consume(Token.semicolon, "Expected ';'.");
            const condition = !this._check(Token.semicolon) ? this._short_circuit_or_expression() : null;
            this._consume(Token.semicolon, "Expected ';'.");
            const increment = !this._check(Token.paren_right) ? this._for_increment() : null;

            this._consume(Token.paren_right, "Expected ')'.");

            const body = this._compound_statement();

            return new AST("for", { init, condition, increment, body });
        }

        _for_init() {
            // (variable_statement assignment_statement func_call_statement)?
            return this._variable_statement() || this._func_call_statement() || this._assignment_statement();
        }

        _for_increment() {
            // (assignment_statement func_call_statement increment_statement)?
            return this._func_call_statement() || this._increment_decrement_statement() || this._assignment_statement();
        }

        _variable_statement() {
            // variable_decl
            // variable_decl equal short_circuit_or_expression
            // let (ident variable_ident_decl) equal short_circuit_or_expression
            // const (ident variable_ident_decl) equal short_circuit_or_expression
            if (this._check(Keyword.var)) {
                const _var = this._variable_decl();
                let value = null;
                if (this._match(Token.equal))
                    value = this._short_circuit_or_expression();

                return new AST("var", { var: _var, value });
            }

            if (this._match(Keyword.let)) {
                const name = this._consume(Token.ident, "Expected name for let.").toString();
                let type = null;
                if (this._match(Token.colon)) {
                    const typeAttrs = this._attribute();
                    type = this._type_decl();
                    type.attributes = typeAttrs;
                }
                this._consume(Token.equal, "Expected '=' for let.");
                const value = this._short_circuit_or_expression();
                return new AST("let", { name, type, value });
            }

            if (this._match(Keyword.const)) {
                const name = this._consume(Token.ident, "Expected name for const.").toString();
                let type = null;
                if (this._match(Token.colon)) {
                    const typeAttrs = this._attribute();
                    type = this._type_decl();
                    type.attributes = typeAttrs;
                }
                this._consume(Token.equal, "Expected '=' for const.");
                const value = this._short_circuit_or_expression();
                return new AST("const", { name, type, value });
            }

            return null;
        }

        _increment_decrement_statement() {
            const savedPos = this._current;

            const _var = this._unary_expression();
            if (_var == null)
                return null;

            if (!this._check(Token.increment_operators)) {
                this._current = savedPos;
                return null;
            }

            const type = this._consume(Token.increment_operators, "Expected increment operator");

            return new AST("increment", { type, var: _var });
        }

        _assignment_statement() {
            // (unary_expression underscore) equal short_circuit_or_expression
            let _var = null;

            if (this._check(Token.brace_right))
                return null;

            let isUnderscore = this._match(Token.underscore);
            if (!isUnderscore)
                _var = this._unary_expression();

            if (!isUnderscore && _var == null)
                return null;

            const type = this._consume(Token.assignment_operators, "Expected assignment operator.");

            const value = this._short_circuit_or_expression();

            return new AST("assign", { type, var: _var, value });
        }

        _func_call_statement() {
            // ident argument_expression_list
            if (!this._check(Token.ident))
                return null;

            const savedPos = this._current;
            const name = this._consume(Token.ident, "Expected function name.");
            const args = this._argument_expression_list();

            if (args === null) {
                this._current = savedPos;
                return null;
            }

            return new AST("call", { name, args });
        }

        _loop_statement() {
            // loop brace_left statement* continuing_statement? brace_right
            if (!this._match(Keyword.loop))
                return null;

            this._consume(Token.brace_left, "Expected '{' for loop.");

            // statement*
            const statements = [];
            let statement = this._statement();
            while (statement !== null) {
                statements.push(statement);
                statement = this._statement();
            }

            // continuing_statement: continuing compound_statement
            let continuing = null;
            if (this._match(Keyword.continuing))
                continuing = this._compound_statement();

            this._consume(Token.brace_right, "Expected '}' for loop.");

            return new AST("loop", { statements, continuing });
        }

        _switch_statement() {
            // switch optional_paren_expression brace_left switch_body+ brace_right
            if (!this._match(Keyword.switch))
                return null;

            const condition = this._optional_paren_expression();
            this._consume(Token.brace_left);
            const body = this._switch_body();
            if (body == null || body.length == 0)
                throw this._error(this._previous(), "Expected 'case' or 'default'.");
            this._consume(Token.brace_right);
            return new AST("switch", { condition, body });
        }

        _switch_body() {
            // case case_selectors colon brace_left case_body? brace_right
            // default colon brace_left case_body? brace_right
            const cases = [];
            if (this._match(Keyword.case)) {
                this._consume(Keyword.case);
                const selector = this._case_selectors();
                this._consume(Token.colon, "Exected ':' for switch case.");
                this._consume(Token.brace_left, "Exected '{' for switch case.");
                const body = this._case_body();
                this._consume(Token.brace_right, "Exected '}' for switch case.");
                cases.push(new AST("case", { selector, body }));
            }

            if (this._match(Keyword.default)) {
                this._consume(Token.colon, "Exected ':' for switch default.");
                this._consume(Token.brace_left, "Exected '{' for switch default.");
                const body = this._case_body();
                this._consume(Token.brace_right, "Exected '}' for switch default.");
                cases.push(new AST("default", { body }));
            }

            if (this._check([Keyword.default, Keyword.case])) {
                const _cases = this._switch_body();
                cases.push(_cases[0]);
            }

            return cases;
        }

        _case_selectors() {
            // const_literal (comma const_literal)* comma?
            const selectors = [this._consume(Token.const_literal, "Expected constant literal").toString()];
            while (this._match(Token.comma)) {
                selectors.push(this._consume(Token.const_literal, "Expected constant literal").toString());
            }
            return selectors;
        }

        _case_body() {
            // statement case_body?
            // fallthrough semicolon
            if (this._match(Keyword.fallthrough)) {
                this._consume(Token.semicolon);
                return [];
            }

            const statement = this._statement();
            if (statement == null)
                return [];

            const nextStatement = this._case_body();
            if (nextStatement.length == 0)
                return [statement];

            return [statement, nextStatement[0]];
        }

        _if_statement() {
            // if optional_paren_expression compound_statement elseif_statement? else_statement?
            if (!this._match(Keyword.if))
                return null;

            const condition = this._optional_paren_expression();
            const block = this._compound_statement();

            let elseif = null;
            if (this._match(Keyword.elseif))
                elseif = this._elseif_statement();

            let _else = null;
            if (this._match(Keyword.else))
                _else = this._compound_statement();

            return new AST("if", { condition, block, elseif, else: _else });
        }

        _elseif_statement() {
            // else_if optional_paren_expression compound_statement elseif_statement?
            const elseif = [];
            const condition = this._optional_paren_expression();
            const block = this._compound_statement();
            elseif.push(new AST("elseif", { condition, block }));
            if (this._match(Keyword.elseif))
                elseif.push(this._elseif_statement()[0]);
            return elseif;
        }

        _return_statement() {
            // return short_circuit_or_expression?
            if (!this._match(Keyword.return))
                return null;
            const value = this._short_circuit_or_expression();
            return new AST("return", { value: value });
        }

        _short_circuit_or_expression() {
            // short_circuit_and_expression
            // short_circuit_or_expression or_or short_circuit_and_expression
            let expr = this._short_circuit_and_expr();
            while (this._match(Token.or_or)) {
                expr = new AST("compareOp", {
                    operator: this._previous().toString(),
                    left: expr,
                    right: this._short_circuit_and_expr()
                });
            }
            return expr;
        }

        _short_circuit_and_expr() {
            // inclusive_or_expression
            // short_circuit_and_expression and_and inclusive_or_expression
            let expr = this._inclusive_or_expression();
            while (this._match(Token.and_and)) {
                expr = new AST("compareOp", {
                    operator: this._previous().toString(),
                    left: expr,
                    right: this._inclusive_or_expression()
                });
            }
            return expr;
        }

        _inclusive_or_expression() {
            // exclusive_or_expression
            // inclusive_or_expression or exclusive_or_expression
            let expr = this._exclusive_or_expression();
            while (this._match(Token.or)) {
                expr = new AST("binaryOp", {
                    operator: this._previous().toString(),
                    left: expr,
                    right: this._exclusive_or_expression()
                });
            }
            return expr;
        }

        _exclusive_or_expression() {
            // and_expression
            // exclusive_or_expression xor and_expression
            let expr = this._and_expression();
            while (this._match(Token.xor)) {
                expr = new AST("binaryOp", {
                    operator: this._previous().toString(),
                    left: expr,
                    right: this._and_expression()
                });
            }
            return expr;
        }

        _and_expression() {
            // equality_expression
            // and_expression and equality_expression
            let expr = this._equality_expression();
            while (this._match(Token.and)) {
                expr = new AST("binaryOp", {
                    operator: this._previous().toString(),
                    left: expr,
                    right: this._equality_expression()
                });
            }
            return expr;
        }
        
        _equality_expression() {
            // relational_expression
            // relational_expression equal_equal relational_expression
            // relational_expression not_equal relational_expression
            const expr = this._relational_expression();
            if (this._match([Token.equal_equal, Token.not_equal])) {
                return new AST("compareOp", {
                    operator: this._previous().toString(),
                    left: expr,
                    right: this._relational_expression()
                });
            }
            return expr;
        }

        _relational_expression() {
            // shift_expression
            // relational_expression less_than shift_expression
            // relational_expression greater_than shift_expression
            // relational_expression less_than_equal shift_expression
            // relational_expression greater_than_equal shift_expression
            let expr = this._shift_expression();
            while (this._match([Token.less_than, Token.greater_than, Token.less_than_equal,
                                Token.greater_than_equal])) {
                expr = new AST("compareOp", {
                    operator: this._previous().toString(),
                    left: expr,
                    right: this._shift_expression()
                });
            }
            return expr;
        }

        _shift_expression() {
            // additive_expression
            // shift_expression shift_left additive_expression
            // shift_expression shift_right additive_expression
            let expr = this._additive_expression();
            while (this._match([Token.shift_left, Token.shift_right])) {
                expr = new AST("binaryOp", {
                    operator: this._previous().toString(),
                    left: expr,
                    right: this._additive_expression()
                });
            }
            return expr;
        }

        _additive_expression() {
            // multiplicative_expression
            // additive_expression plus multiplicative_expression
            // additive_expression minus multiplicative_expression
            let expr = this._multiplicative_expression();
            while (this._match([Token.plus, Token.minus])) {
                expr = new AST("binaryOp", {
                    operator: this._previous().toString(),
                    left: expr,
                    right: this._multiplicative_expression()
                });
            }
            return expr;
        }

        _multiplicative_expression() {
            // unary_expression
            // multiplicative_expression star unary_expression
            // multiplicative_expression forward_slash unary_expression
            // multiplicative_expression modulo unary_expression
            let expr = this._unary_expression();
            while (this._match([Token.star, Token.forward_slash, Token.modulo])) {
                expr = new AST("binaryOp", {
                    operator: this._previous().toString(),
                    left: expr,
                    right: this._unary_expression()
                });
            }
            return expr;
        }

        _unary_expression() {
            // singular_expression
            // minus unary_expression
            // bang unary_expression
            // tilde unary_expression
            // star unary_expression
            // and unary_expression
            if (this._match([Token.minus, Token.bang, Token.tilde, Token.star, Token.and])) {
                return new AST("unaryOp", {
                    operator: this._previous().toString(), right: this._unary_expression() });
            }
            return this._singular_expression();
        }

        _singular_expression() {
            // primary_expression postfix_expression ?
            const expr = this._primary_expression();
            const p = this._postfix_expression();
            if (p)
                expr.postfix = p;
            return expr;
        }

        _postfix_expression() {
            // bracket_left short_circuit_or_expression bracket_right postfix_expression?
            if (this._match(Token.bracket_left)) {
                const expr = this._short_circuit_or_expression();
                this._consume(Token.bracket_right, "Expected ']'.");
                const p = this._postfix_expression();
                if (p)
                    expr.postfix = p;
                return expr;
            }

            // period ident postfix_expression?
            if (this._match(Token.period)) {
                const name = this._consume(Token.ident, "Expected member name.");
                const p = this._postfix_expression();
                if (p)
                    name.postfix = p;
                return name;
            }

            return null;
        }

        _primary_expression() {
            // ident argument_expression_list?
            if (this._match(Token.ident)) {
                const name = this._previous().toString();
                if (this._check(Token.paren_left)) {
                    const args = this._argument_expression_list();
                    return new AST("call_expr", { name, args });
                }
                return new AST("variable_expr", { name });
            }

            // const_literal
            if (this._match(Token.const_literal)) {
                return new AST("literal_expr", { value: this._previous().toString() });
            }

            // paren_expression
            if (this._check(Token.paren_left)) {
                return this._paren_expression();
            }

            // bitcast less_than type_decl greater_than paren_expression
            if (this._match(Keyword.bitcast)) {
                this._consume(Token.less_than, "Expected '<'.");
                const type = this._type_decl();
                this._consume(Token.greater_than, "Expected '>'.");
                const value = this._paren_expression();
                return new AST("bitcast_expr", { type, value });
            }

            // type_decl argument_expression_list
            const type = this._type_decl();
            const args = this._argument_expression_list();
            return new AST("typecast_expr", { type, args });
        }

        _argument_expression_list() {
            // paren_left ((short_circuit_or_expression comma)* short_circuit_or_expression comma?)? paren_right
            if (!this._match(Token.paren_left))
                return null;

            const args = [];
            do {
                if (this._check(Token.paren_right))
                    break;
                const arg = this._short_circuit_or_expression();
                args.push(arg);
            } while (this._match(Token.comma));
            this._consume(Token.paren_right, "Expected ')' for agument list");

            return args;
        }

        _optional_paren_expression() {
            // [paren_left] short_circuit_or_expression [paren_right]
            this._match(Token.paren_left);
            const expr = this._short_circuit_or_expression();
            this._match(Token.paren_right);
            return new AST("grouping_expr", { contents: expr });
        }

        _paren_expression() {
            // paren_left short_circuit_or_expression paren_right
            this._consume(Token.paren_left, "Expected '('.");
            const expr = this._short_circuit_or_expression();
            this._consume(Token.paren_right, "Expected ')'.");
            return new AST("grouping_expr", { contents: expr });
        }

        _struct_decl() {
            // attribute* struct ident struct_body_decl
            if (!this._match(Keyword.struct))
                return null;

            const name = this._consume(Token.ident, "Expected name for struct.").toString();

            // struct_body_decl: brace_left (struct_member comma)* struct_member comma? brace_right
            this._consume(Token.brace_left, "Expected '{' for struct body.");
            const members = [];
            while (!this._check(Token.brace_right)) {
                // struct_member: attribute* variable_ident_decl
                const memberAttrs = this._attribute();

                const memberName = this._consume(Token.ident, "Expected variable name.").toString();

                this._consume(Token.colon, "Expected ':' for struct member type.");

                const typeAttrs = this._attribute();
                const memberType = this._type_decl();
                memberType.attributes = typeAttrs;
                
                if (!this._check(Token.brace_right))
                    this._consume(Token.comma, "Expected ',' for struct member.");
                else
                    this._match(Token.comma); // trailing comma optional.

                members.push(new AST("member", {
                    name: memberName,
                    attributes: memberAttrs,
                    type: memberType
                }));
            }

            this._consume(Token.brace_right, "Expected '}' after struct body.");

            return new AST("struct", { name, members });
        }

        _global_variable_decl() {
            // attribute* variable_decl (equal const_expression)?
            const _var = this._variable_decl();
            if (this._match(Token.equal))
                _var.value = this._const_expression();
            return _var;
        }

        _global_constant_decl() {
            // attribute* let (ident variable_ident_decl) global_const_initializer?
            if (!this._match(Keyword.let))
                return null;

            const name = this._consume(Token.ident, "Expected variable name");
            let type = null;
            if (this._match(Token.colon)) {
                const attrs = this._attribute();
                type = this._type_decl();
                type.attributes = attrs;
            }
            let value = null;
            if (this._match(Token.equal)) {
                value = this._const_expression();
            }
            return new AST("let", { name: name.toString(), type, value });
        }

        _const_expression() {
            // type_decl paren_left ((const_expression comma)* const_expression comma?)? paren_right
            // const_literal
            if (this._match(Token.const_literal))
                return this._previous().toString();
            
            const type = this._type_decl();

            this._consume(Token.paren_left, "Expected '('.");

            let args = [];
            while (!this._check(Token.paren_right)) {
                args.push(this._const_expression());
                if (!this._check(Token.comma))
                    break;
                this._advance();
            }

            this._consume(Token.paren_right, "Expected ')'.");

            return new AST("create", { type, args });
        }

        _variable_decl() {
            // var variable_qualifier? (ident variable_ident_decl)
            if (!this._match(Keyword.var))
                return null;

            // variable_qualifier: less_than storage_class (comma access_mode)? greater_than
            let storage = null;
            let access = null;
            if (this._match(Token.less_than)) {
                storage = this._consume(Token.storage_class, "Expected storage_class.").toString();
                if (this._match(Token.comma))
                    access = this._consume(Token.access_mode, "Expected access_mode.").toString();
                this._consume(Token.greater_than, "Expected '>'.");
            }

            const name = this._consume(Token.ident, "Expected variable name");
            let type = null;
            if (this._match(Token.colon)) {
                const attrs = this._attribute();
                type = this._type_decl();
                type.attributes = attrs;
            }

            return new AST("var", { name: name.toString(), type, storage, access });
        }

        _enable_directive() {
            // enable ident semicolon
            const name = this._consume(Token.ident, "identity expected.");
            return new AST("enable", { name: name.toString() });
        }

        _type_alias() {
            // type ident equal type_decl
            const name = this._consume(Token.ident, "identity expected.");
            this._consume(Token.equal, "Expected '=' for type alias.");
            const alias = this._type_decl();
            return new AST("alias", { name: name.toString(), alias });
        }

        _type_decl() {
            // ident
            // bool
            // float32
            // int32
            // uint32
            // vec2 less_than type_decl greater_than
            // vec3 less_than type_decl greater_than
            // vec4 less_than type_decl greater_than
            // mat2x2 less_than type_decl greater_than
            // mat2x3 less_than type_decl greater_than
            // mat2x4 less_than type_decl greater_than
            // mat3x2 less_than type_decl greater_than
            // mat3x3 less_than type_decl greater_than
            // mat3x4 less_than type_decl greater_than
            // mat4x2 less_than type_decl greater_than
            // mat4x3 less_than type_decl greater_than
            // mat4x4 less_than type_decl greater_than
            // atomic less_than type_decl greater_than
            // pointer less_than storage_class comma type_decl (comma access_mode)? greater_than
            // array_type_decl
            // texture_sampler_types

            if (this._check([Token.ident, ...Token.texel_format, Keyword.bool, Keyword.float32, Keyword.int32, Keyword.uint32])) {
                const type = this._advance();
                return new AST("type", { name: type.toString() });
            }
            
            if (this._check(Token.template_types)) {
                let type = this._advance().toString();
                let format = null;
                let access = null;
                if (this._match(Token.less_than)) {
                    format = this._type_decl();
                    access = null;
                    if (this._match(Token.comma))
                        access = this._consume(Token.access_mode, "Expected access_mode for pointer").toString();
                    this._consume(Token.greater_than, "Expected '>' for type.");
                }
                return new AST(type, { name: type, format, access });
            }

            // pointer less_than storage_class comma type_decl (comma access_mode)? greater_than
            if (this._match(Keyword.pointer)) {
                let pointer = this._previous().toString();
                this._consume(Token.less_than, "Expected '<' for pointer.");
                const storage = this._consume(Token.storage_class, "Expected storage_class for pointer");
                this._consume(Token.comma, "Expected ',' for pointer.");
                const decl = this._type_decl();
                let access = null;
                if (this._match(Token.comma))
                    access = this._consume(Token.access_mode, "Expected access_mode for pointer").toString();
                this._consume(Token.greater_than, "Expected '>' for pointer.");
                return new AST("pointer", { name: pointer, storage: storage.toString(), decl, access });
            }

            // texture_sampler_types
            let type = this._texture_sampler_types();
            if (type)
                return type;

            // The following type_decl's have an optional attribyte_list*
            const attrs = this._attribute();

            // attribute* array less_than type_decl (comma element_count_expression)? greater_than
            if (this._match(Keyword.array)) {
                const array = this._previous();
                this._consume(Token.less_than, "Expected '<' for array type.");
                const format = this._type_decl();
                let count = null;
                if (this._match(Token.comma))
                    count = this._consume(Token.element_count_expression, "Expected element_count for array.").toString();
                this._consume(Token.greater_than, "Expected '>' for array.");

                return new AST("array", { name: array.toString(), attributes: attrs, format, count });
            }

            return null;
        }

        _texture_sampler_types() {
            // sampler_type
            if (this._match(Token.sampler_type))
                return new AST("sampler", { name: this._previous().toString() });

            // depth_texture_type
            if (this._match(Token.depth_texture_type))
                return new AST("sampler", { name: this._previous().toString() });

            // sampled_texture_type less_than type_decl greater_than
            // multisampled_texture_type less_than type_decl greater_than
            if (this._match(Token.sampled_texture_type) || 
                this._match(Token.multisampled_texture_type)) {
                const sampler = this._previous();
                this._consume(Token.less_than, "Expected '<' for sampler type.");
                const format = this._type_decl();
                this._consume(Token.greater_than, "Expected '>' for sampler type.");
                return new AST("sampler", { name: sampler.toString(), format });
            }

            // storage_texture_type less_than texel_format comma access_mode greater_than
            if (this._match(Token.storage_texture_type)) {
                const sampler = this._previous();
                this._consume(Token.less_than, "Expected '<' for sampler type.");
                const format = this._consume(Token.texel_format, "Invalid texel format.").toString();
                this._consume(Token.comma, "Expected ',' after texel format.");
                const access = this._consume(Token.access_mode, "Expected access mode for storage texture type.").toString();
                this._consume(Token.greater_than, "Expected '>' for sampler type.");
                return new AST("sampler", { name: sampler.toString(), format, access });
            }

            return null;
        }

        _attribute() {
            // attr ident paren_left (literal_or_ident comma)* literal_or_ident paren_right
            // attr ident

            let attributes = [];

            while (this._match(Token.attr))
            {
                const name = this._consume(Token.attribute_name, "Expected attribute name");
                const attr = new AST("attribute", { name: name.toString() });
                if (this._match(Token.paren_left)) {
                    // literal_or_ident
                    attr.value = this._consume(Token.literal_or_ident, "Expected attribute value").toString();
                    if (this._check(Token.comma)) {
                        this._advance();
                        attr.value = [attr.value];
                        do {
                            const v = this._consume(Token.literal_or_ident, "Expected attribute value").toString();
                            attr.value.push(v);
                        } while (this._match(Token.comma));
                    }
                    this._consume(Token.paren_right, "Expected ')'");
                }
                attributes.push(attr);
            }

            // Deprecated:
            // attr_left (attribute comma)* attribute attr_right
            while (this._match(Token.attr_left)) {
                if (!this._check(Token.attr_right)) {
                    do {
                        const name = this._consume(Token.attribute_name, "Expected attribute name");
                        const attr = new AST("attribute", { name: name.toString() });
                        if (this._match(Token.paren_left)) {
                            // literal_or_ident
                            attr.value = this._consume(Token.literal_or_ident, "Expected attribute value").toString();
                            if (this._check(Token.comma)) {
                                this._advance();
                                attr.value = [attr.value];
                                do {
                                    const v = this._consume(Token.literal_or_ident, "Expected attribute value").toString();
                                    attr.value.push(v);
                                } while (this._match(Token.comma));
                            }
                            this._consume(Token.paren_right, "Expected ')'");
                        }
                        attributes.push(attr);
                    } while (this._match(Token.comma));

                }
                // Consume ]]
                this._consume(Token.attr_right, "Expected ']]' after attribute declarations");
            }

            if (attributes.length == 0)
                return null;

            return attributes;
        }
    }

    /**
     * @author Brendan Duncan / https://github.com/brendan-duncan
     */

    class WgslReflect {
        constructor(code) {
            if (code)
                this.initialize(code);
        }

        initialize(code) {
            const parser = new WgslParser();
            this.ast = parser.parse(code);

            // All top-level structs in the shader.
            this.structs = [];
            // All top-level uniform vars in the shader.
            this.uniforms = [];
            // All top-level storage vars in the shader.
            this.storage = [];
            // All top-level texture vars in the shader;
            this.textures = [];
            // All top-level sampler vars in the shader.
            this.samplers = [];
            // All top-level functions in the shader.
            this.functions = [];
            // All top-level type aliases in the shader.
            this.aliases = [];
            // All entry functions in the shader: vertex, fragment, and/or compute.
            this.entry = {
                vertex: [],
                fragment: [],
                compute: []
            };

            for (const node of this.ast) {
                if (node._type == "struct")
                    this.structs.push(node);

                if (node._type == "alias")
                    this.aliases.push(node);

                if (this.isUniformVar(node)) {
                    const group = this.getAttribute(node, "group");
                    node.group = group && group.value ? parseInt(group.value) : 0;
                    const binding = this.getAttribute(node, "binding");
                    node.binding = binding && binding.value ? parseInt(binding.value) : 0;
                    this.uniforms.push(node);
                }

                if (this.isStorageVar(node)) {
                    const group = this.getAttribute(node, "group");
                    node.group = group && group.value ? parseInt(group.value) : 0;
                    const binding = this.getAttribute(node, "binding");
                    node.binding = binding && binding.value ? parseInt(binding.value) : 0;
                    this.storage.push(node);
                }

                if (this.isTextureVar(node)) {
                    const group = this.getAttribute(node, "group");
                    node.group = group && group.value ? parseInt(group.value) : 0;
                    const binding = this.getAttribute(node, "binding");
                    node.binding = binding && binding.value ? parseInt(binding.value) : 0;
                    this.textures.push(node);
                }

                if (this.isSamplerVar(node)) {
                    const group = this.getAttribute(node, "group");
                    node.group = group && group.value ? parseInt(group.value) : 0;
                    const binding = this.getAttribute(node, "binding");
                    node.binding = binding && binding.value ? parseInt(binding.value) : 0;
                    this.samplers.push(node);
                }

                if (node._type == "function") {
                    this.functions.push(node);
                    const vertexStage = this.getAttribute(node, "vertex");
                    const fragmentStage = this.getAttribute(node, "fragment");
                    const computeStage = this.getAttribute(node, "compute");
                    const stage = vertexStage || fragmentStage || computeStage;
                    if (stage) {
                        node.inputs = this._getInputs(node);
                        if (this.entry[stage.name])
                            this.entry[stage.name].push(node);
                        else
                            this.entry[stage.name] = [node];
                    }
                }
            }
        }

        isTextureVar(node) {
            return node._type == "var" && WgslReflect.TextureTypes.indexOf(node.type.name) != -1;
        }

        isSamplerVar(node) {
            return node._type == "var" && WgslReflect.SamplerTypes.indexOf(node.type.name) != -1;
        }

        isUniformVar(node) {
            return node && node._type == "var" && node.storage == "uniform";
        }

        isStorageVar(node) {
            return node && node._type == "var" && node.storage == "storage";
        }

        _getInputs(args, inputs) {
            if (args._type == "function")
                args = args.args;
            if (!inputs)
                inputs = [];

            for (const arg of args) {
                const input = this._getInputInfo(arg);
                if (input)
                    inputs.push(input);
                const struct = this.getStruct(arg.type);
                if (struct)
                    this._getInputs(struct.members, inputs);
            }

            return inputs;
        }

        _getInputInfo(node) {
            const location = this.getAttribute(node, "location") || this.getAttribute(node, "builtin");
            if (location) {
                let input = {
                    name: node.name,
                    type: node.type,
                    input: node,
                    locationType: location.name,
                    location: this._parseInt(location.value)
                };
                const interpolation = this.getAttribute(node, "interpolation");
                if (interpolation)
                    input.interpolation = interpolation.value;
                return input;
            }
            return null;
        }

        _parseInt(s) {
            const n = parseInt(s);
            return isNaN(n) ? s : n;
        }

        getAlias(name) {
            if (!name) return null;
            if (name.constructor === AST) {
                if (name._type != "type")
                    return null;
                name = name.name;
            }
            for (const u of this.aliases) {
                if (u.name == name)
                    return u.alias;
            }
            return null;
        }

        getStruct(name) {
            if (!name) return null;
            if (name.constructor === AST) {
                if (name._type == "struct")
                    return name;
                if (name._type != "type")
                    return null;
                name = name.name;
            }
            for (const u of this.structs) {
                if (u.name == name)
                    return u;
            }
            return null;
        }

        getAttribute(node, name) {
            if (!node || !node.attributes) return null;
            for (let a of node.attributes) {
                if (a.name == name)
                    return a;
            }
            return null;
        }

        getBindGroups() {
            const groups = [];

            function _makeRoom(group, binding) {
                if (group >= groups.length)
                    groups.length = group + 1;
                if (groups[group] === undefined)
                    groups[group] = [];

                if (binding >= groups[group].length)
                    groups[group].length = binding + 1;
            }

            for (const u of this.uniforms) {
                _makeRoom(u.group, u.binding);
                const group = groups[u.group];
                group[u.binding] = { type: 'buffer', resource: this.getUniformBufferInfo(u) };
            }
            
            for (const u of this.storage) {
                _makeRoom(u.group, u.binding);
                const group = groups[u.group];
                group[u.binding] = { type: 'storage', resource: this.getStorageBufferInfo(u) };
            }

            for (const t of this.textures) {
                _makeRoom(t.group, t.binding);
                const group = groups[t.group];
                group[t.binding] = { type: 'texture', resource: t };
            }

            for (const t of this.samplers) {
                _makeRoom(t.group, t.binding);
                const group = groups[t.group];
                group[t.binding] = { type: 'sampler', resource: t };
            }

            return groups;
        }

        getStorageBufferInfo(node) {
            if (!this.isStorageVar(node))
                return null;

            let group = this.getAttribute(node, "group");
            let binding = this.getAttribute(node, "binding");

            group = group && group.value ? parseInt(group.value) : 0;
            binding = binding && binding.value ? parseInt(binding.value) : 0;

            let info = this._getUniformInfo(node);

            return {
                ...info,
                group,
                binding,
            }
        }

        /// Returns information about a struct type, null if the type is not a struct.
        /// {
        ///     name: String,
        ///     type: Object,
        ///     align: Int,
        ///     size: Int,
        ///     members: Array,
        ///     isArray: Bool
        ///     isStruct: Bool
        /// }
        getStructInfo(node) {
            if (!node)
                return null;
     
            const struct = node._type === 'struct' ? node : this.getStruct(node.type);
            if (!struct)
                return null;

            let offset = 0;
            let lastSize = 0;
            let lastOffset = 0;
            let structAlign = 0;
            let buffer = { name: node.name, type: node.type, align: 0, size: 0, members: [] };

            for (let mi = 0, ml = struct.members.length; mi < ml; ++mi) {
                let member = struct.members[mi];
                let name = member.name;

                let info = this.getTypeInfo(member);
                if (!info)
                    continue;

                let type = member.type;
                let align = info.align;
                let size = info.size;
                offset = this._roundUp(align, offset + lastSize);
                lastSize = size;
                lastOffset = offset;
                structAlign = Math.max(structAlign, align);
                let isArray = member.type._type === "array";
                let s = this.getStruct(type) || (isArray ? this.getStruct(member.type.format.name) : null);
                let isStruct = !!s;
                let si = isStruct ? this.getStructInfo(s) : undefined;
                let arrayStride = si?.size ?? isArray ? this.getTypeInfo(member.type.format)?.size : this.getTypeInfo(member.type)?.size;
                
                let arrayCount = parseInt(member.type.count ?? 0);
                let members = isStruct ? si?.members : undefined;

                let u = { name, offset, size, type, member, isArray, arrayCount, arrayStride, isStruct, members };
                buffer.members.push(u);
            }

            buffer.size = this._roundUp(structAlign, lastOffset + lastSize);
            buffer.align = structAlign;
            buffer.isArray = false;
            buffer.isStruct = true;
            buffer.arrayCount = 0;

            return buffer;
        }

        _getUniformInfo(node) {
            let info = this.getStructInfo(node);
            if (info)
                return info;

            info = this.getTypeInfo(node.type);
            if (!info)
                return info;

            let s = this.getStruct(node.type.format?.name);
            let si = s ? this.getStructInfo(s) : undefined;

            info.isArray = node.type._type === "array";
            info.isStruct = !!s;
                    
            info.members = info.isStruct ? si?.members : undefined;
            info.name = node.name;
            info.type = node.type;
            info.arrayStride = si?.size ?? info.isArray ?
                this.getTypeInfo(node.type.format)?.size :
                this.getTypeInfo(node.type)?.size;
            info.arrayCount = parseInt(node.type.count ?? 0);
            return info;
        }

        getUniformBufferInfo(node) {
            if (!this.isUniformVar(node))
                return null;

            let group = this.getAttribute(node, "group");
            let binding = this.getAttribute(node, "binding");

            group = group && group.value ? parseInt(group.value) : 0;
            binding = binding && binding.value ? parseInt(binding.value) : 0;

            let info = this._getUniformInfo(node);

            return {
                ...info,
                group,
                binding,
            }
        }

        getTypeInfo(type) {
            if (!type)
                return undefined;

            let explicitSize = 0;
            const sizeAttr = this.getAttribute(type, "size");
            if (sizeAttr)
                explicitSize = parseInt(sizeAttr.value);

            let explicitAlign = 0;
            const alignAttr = this.getAttribute(type, "align");
            if (alignAttr)
                explicitAlign = parseInt(alignAttr.value);

            if (type._type == "member")
                type = type.type;

            if (type._type == "type") {
                const alias = this.getAlias(type.name);
                if (alias) {
                    type = alias;
                } else {
                    const struct = this.getStruct(type.name);
                    if (struct)
                        type = struct;
                }
            }

            const info = WgslReflect.TypeInfo[type.name];
            if (info) {
                return {
                    align: Math.max(explicitAlign, info.align),
                    size: Math.max(explicitSize, info.size)
                };
            }
            
            if (type.name == "array") {
                let align = 8;
                let size = 8;
                // Type                 AlignOf(T)          Sizeof(T)
                // array<E, N>          AlignOf(E)          N * roundUp(AlignOf(E), SizeOf(E))
                // array<E>             AlignOf(E)          N * roundUp(AlignOf(E), SizeOf(E))  (N determined at runtime)
                //
                // @stride(Q)
                // array<E, N>          AlignOf(E)          N * Q
                //
                // @stride(Q)
                // array<E>             AlignOf(E)          Nruntime * Q
                //const E = type.format.name;
                const E = this.getTypeInfo(type.format);
                if (E) {
                    size = E.size;
                    align = E.align;
                }

                const N = parseInt(type.count || 1);

                const stride = this.getAttribute(type, "stride");
                if (stride)
                    size = N * parseInt(stride.value);
                else
                    size = N * this._roundUp(align, size);

                if (explicitSize)
                    size = explicitSize;

                return {
                    align: Math.max(explicitAlign, align),
                    size: Math.max(explicitSize, size)
                };
            }

            if (type._type == "struct") {
                let align = 0;
                let size = 0;
                // struct S     AlignOf:    max(AlignOfMember(S, M1), ... , AlignOfMember(S, MN))
                //              SizeOf:     roundUp(AlignOf(S), OffsetOfMember(S, L) + SizeOfMember(S, L))
                //                          Where L is the last member of the structure
                let offset = 0;
                let lastSize = 0;
                let lastOffset = 0;
                for (const m of type.members) {
                    const mi = this.getTypeInfo(m);
                    align = Math.max(mi.align, align);
                    offset = this._roundUp(mi.align, offset + lastSize);
                    lastSize = mi.size;
                    lastOffset = offset;
                }
                size = this._roundUp(align, lastOffset + lastSize);

                return {
                    align: Math.max(explicitAlign, align),
                    size: Math.max(explicitSize, size)
                };
            }

            return null;
        }

        _roundUp(k, n) {
            return Math.ceil(n / k) * k;
        }
    }


    // Type                 AlignOf(T)          Sizeof(T)
    // i32, u32, or f32     4                   4
    // atomic<T>            4                   4
    // vec2<T>              8                   8
    // vec3<T>              16                  12
    // vec4<T>              16                  16
    // mat2x2<f32>          8                   16
    // mat3x2<f32>          8                   24
    // mat4x2<f32>          8                   32
    // mat2x3<f32>          16                  32
    // mat3x3<f32>          16                  48
    // mat4x3<f32>          16                  64
    // mat2x4<f32>          16                  32
    // mat3x4<f32>          16                  48
    // mat4x4<f32>          16                  64
    WgslReflect.TypeInfo = {
        "i32": { align: 4, size: 4 },
        "u32": { align: 4, size: 4 },
        "f32": { align: 4, size: 4 },
        "atomic": { align: 4, size: 4 },
        "vec2": { align: 8, size: 8 },
        "vec3": { align: 16, size: 12 },
        "vec4": { align: 16, size: 16 },
        "mat2x2": { align: 8, size: 16 },
        "mat3x2": { align: 8, size: 24 },
        "mat4x2": { align: 8, size: 32 },
        "mat2x3": { align: 16, size: 32 },
        "mat3x3": { align: 16, size: 48 },
        "mat4x3": { align: 16, size: 64 },
        "mat2x4": { align: 16, size: 32 },
        "mat3x4": { align: 16, size: 48 },
        "mat4x4": { align: 16, size: 64 },
    };

    WgslReflect.TextureTypes = Token.any_texture_type.map((t) => { return t.name; });
    WgslReflect.SamplerTypes = Token.sampler_type.map((t) => { return t.name; });

    const roundUpToMultipleOf = (v, multiple) => (((v + multiple - 1) / multiple) | 0) * multiple;
    // TODO: fix better?
    const isTypedArray = (arr) => arr && typeof arr.length === 'number' && arr.buffer instanceof ArrayBuffer && typeof arr.byteLength === 'number';
    class TypedArrayViewGenerator {
        arrayBuffer;
        byteOffset;
        constructor(sizeInBytes) {
            this.arrayBuffer = new ArrayBuffer(sizeInBytes);
            this.byteOffset = 0;
        }
        align(alignment) {
            this.byteOffset = roundUpToMultipleOf(this.byteOffset, alignment);
        }
        pad(numBytes) {
            this.byteOffset += numBytes;
        }
        getView(Ctor, numElements) {
            const view = new Ctor(this.arrayBuffer, this.byteOffset, numElements);
            this.byteOffset += view.byteLength;
            return view;
        }
    }
    const typeInfo = {
        i32: { numElements: 1, align: 4, size: 4, type: 'i32', View: Int32Array },
        u32: { numElements: 1, align: 4, size: 4, type: 'u32', View: Uint32Array },
        f32: { numElements: 1, align: 4, size: 4, type: 'f32', View: Float32Array },
        f16: { numElements: 1, align: 2, size: 2, type: 'u16', View: Uint16Array },
        'vec2<i32>': { numElements: 2, align: 8, size: 8, type: 'i32', View: Int32Array },
        'vec2<u32>': { numElements: 2, align: 8, size: 8, type: 'u32', View: Uint32Array },
        'vec2<f32>': { numElements: 2, align: 8, size: 8, type: 'f32', View: Float32Array },
        'vec2': { numElements: 2, align: 8, size: 8, type: 'f32', View: Float32Array },
        'vec2<f16>': { numElements: 2, align: 4, size: 4, type: 'u16', View: Uint16Array },
        'vec3<i32>': { numElements: 3, align: 16, size: 12, type: 'i32', View: Int32Array },
        'vec3<u32>': { numElements: 3, align: 16, size: 12, type: 'u32', View: Uint32Array },
        'vec3<f32>': { numElements: 3, align: 16, size: 12, type: 'f32', View: Float32Array },
        'vec3': { numElements: 3, align: 16, size: 12, type: 'f32', View: Float32Array },
        'vec3<f16>': { numElements: 3, align: 8, size: 6, type: 'u16', View: Uint16Array },
        'vec4<i32>': { numElements: 4, align: 16, size: 16, type: 'i32', View: Int32Array },
        'vec4<u32>': { numElements: 4, align: 16, size: 16, type: 'u32', View: Uint32Array },
        'vec4<f32>': { numElements: 4, align: 16, size: 16, type: 'f32', View: Float32Array },
        'vec4': { numElements: 4, align: 16, size: 16, type: 'f32', View: Float32Array },
        'vec4<f16>': { numElements: 4, align: 8, size: 8, type: 'u16', View: Uint16Array },
        // AlignOf(vecR)	SizeOf(array<vecR, C>)
        'mat2x2<f32>': { numElements: 8, align: 8, size: 16, type: 'f32', View: Float32Array },
        'mat2x2': { numElements: 8, align: 8, size: 16, type: 'f32', View: Float32Array },
        'mat2x2<f16>': { numElements: 4, align: 4, size: 8, type: 'u16', View: Uint16Array },
        'mat3x2<f32>': { numElements: 8, align: 8, size: 24, type: 'f32', View: Float32Array },
        'mat3x2': { numElements: 8, align: 8, size: 24, type: 'f32', View: Float32Array },
        'mat3x2<f16>': { numElements: 8, align: 4, size: 12, type: 'u16', View: Uint16Array },
        'mat4x2<f32>': { numElements: 8, align: 8, size: 32, type: 'f32', View: Float32Array },
        'mat4x2': { numElements: 8, align: 8, size: 32, type: 'f32', View: Float32Array },
        'mat4x2<f16>': { numElements: 8, align: 4, size: 16, type: 'u16', View: Uint16Array },
        'mat2x3<f32>': { numElements: 12, align: 16, size: 32, type: 'f32', View: Float32Array },
        'mat2x3': { numElements: 12, align: 16, size: 32, type: 'f32', View: Float32Array },
        'mat2x3<f16>': { numElements: 12, align: 8, size: 16, type: 'u16', View: Uint16Array },
        'mat3x3<f32>': { numElements: 12, align: 16, size: 48, type: 'f32', View: Float32Array },
        'mat3x3': { numElements: 12, align: 16, size: 48, type: 'f32', View: Float32Array },
        'mat3x3<f16>': { numElements: 12, align: 8, size: 24, type: 'u16', View: Uint16Array },
        'mat4x3<f32>': { numElements: 16, align: 16, size: 64, type: 'f32', View: Float32Array },
        'mat4x3': { numElements: 16, align: 16, size: 64, type: 'f32', View: Float32Array },
        'mat4x3<f16>': { numElements: 16, align: 8, size: 32, type: 'u16', View: Uint16Array },
        'mat2x4<f32>': { numElements: 16, align: 16, size: 32, type: 'f32', View: Float32Array },
        'mat2x4': { numElements: 16, align: 16, size: 32, type: 'f32', View: Float32Array },
        'mat2x4<f16>': { numElements: 16, align: 8, size: 16, type: 'u16', View: Uint16Array },
        'mat3x4<f32>': { numElements: 16, align: 16, size: 48, type: 'f32', View: Float32Array },
        'mat3x4': { numElements: 16, align: 16, size: 48, type: 'f32', View: Float32Array },
        'mat3x4<f16>': { numElements: 16, align: 8, size: 24, type: 'u16', View: Uint16Array },
        'mat4x4<f32>': { numElements: 16, align: 16, size: 64, type: 'f32', View: Float32Array },
        'mat4x4': { numElements: 16, align: 16, size: 64, type: 'f32', View: Float32Array },
        'mat4x4<f16>': { numElements: 16, align: 8, size: 32, type: 'u16', View: Uint16Array },
    };
    /**
     * Creates a set of named TypedArray views on an ArrayBuffer
     * @param structDef Definition of the various types of views.
     * @param arrayBuffer Optional ArrayBuffer to use (if one provided one will be created)
     * @param offset Optional offset in existing ArrayBuffer to start the views.
     * @returns A bunch of named TypedArray views and the ArrayBuffer
     */
    function makeTypedArrayViews(structDef, arrayBuffer, offset) {
        const baseOffset = offset || 0;
        const buffer = arrayBuffer || new ArrayBuffer(structDef.size);
        const makeViews = (structDef) => {
            if (Array.isArray(structDef)) {
                return structDef.map(elemDef => makeViews(elemDef));
            }
            else if (typeof structDef === 'string') {
                throw Error('unreachable');
            }
            else if (structDef.fields) {
                const views = {};
                for (const [name, def] of Object.entries(structDef.fields)) {
                    //const { size, offset, type } = def as IntrinsicDefinition;
                    views[name] = makeViews(def);
                    //if (typeof type === 'string') {
                    //    const { view } = typeInfo[type];
                    //    const numElements = size / view.BYTES_PER_ELEMENT;
                    //    views[name] = new view(buffer, baseOffset + offset, numElements);
                    //} else {
                    //    views[name] = makeViews(def as StructDefinition);
                    //}
                }
                return views;
            }
            else {
                const { size, offset, type } = structDef;
                const { View } = typeInfo[type];
                const numElements = size / View.BYTES_PER_ELEMENT;
                return new View(buffer, baseOffset + offset, numElements);
            }
        };
        return { views: makeViews(structDef), arrayBuffer: buffer };
    }
    /**
     * Given a set of TypeArrayViews and matching JavaScript data
     * sets the content of the views.
     * @param data The new values
     * @param views TypedArray views as returned from {@link makeTypedArrayViews}
     */
    function setStructuredView(data, views) {
        if (data === undefined) {
            return;
        }
        else if (isTypedArray(views)) {
            const view = views;
            if (view.length === 1 && typeof data === 'number') {
                view[0] = data;
            }
            else {
                view.set(data);
            }
        }
        else if (Array.isArray(views)) {
            const asArray = views;
            data.forEach((newValue, ndx) => {
                setStructuredView(newValue, asArray[ndx]);
            });
        }
        else {
            const asViews = views;
            for (const [key, newValue] of Object.entries(data)) {
                const view = asViews[key];
                if (view) {
                    setStructuredView(newValue, view);
                }
            }
        }
    }
    /**
     * Given a StructDefinition, create matching TypedArray views
     * @param structDef A StructDefinition as returned from {@link makeShaderDataDefinitions}
     * @param arrayBuffer Optional ArrayBuffer for the views
     * @param offset Optional offset into the ArrayBuffer for the views
     * @returns TypedArray views for the various named fields of the structure as well
     *    as a `set` function to make them easy to set, and the arrayBuffer
     */
    function makeStructuredView(structDef, arrayBuffer, offset = 0) {
        const views = makeTypedArrayViews(structDef, arrayBuffer, offset);
        return {
            ...views,
            set(data) {
                setStructuredView(data, views.views);
            },
        };
    }
    function addMember(reflect, m, offset) {
        if (m.isArray) {
            if (m.isStruct) {
                return [
                    m.name,
                    new Array(m.arrayCount).fill(0).map((_, ndx) => {
                        return addMembers(reflect, m.members, m.size / m.arrayCount, offset + (m.offset || 0) + m.size / m.arrayCount * ndx);
                    }),
                ];
            }
            else {
                return [
                    m.name,
                    {
                        offset: offset + (m.offset || 0),
                        size: m.size,
                        type: m.type.format.name,
                        numElements: m.arrayCount,
                    },
                ];
            }
        }
        else if (m.isStruct) {
            return [
                m.name,
                addMembers(reflect, m.members, m.size, offset + (m.offset || 0)),
            ];
        }
        else {
            return [
                m.name,
                {
                    offset: offset + (m.offset || 0),
                    size: m.size,
                    type: m.type?.name || m.name,
                },
            ];
        }
    }
    function addMembers(reflect, members, size, offset = 0) {
        const fields = Object.fromEntries(members.map(m => {
            return addMember(reflect, m, offset);
        }));
        return {
            fields,
            size,
        };
    }
    /**
     * Given a WGSL shader, returns data definitions for structures,
     * uniforms, and storage buffers
     *
     * Example:
     *
     * ```js
     * const code = `
     * struct MyStruct {
     *    color: vec4<f32>,
     *    brightness: f32,
     *    kernel: array<f32, 9>,
     * };
     * @group(0) @binding(0) var<uniform> myUniforms: MyUniforms;
     * `;
     * const defs = makeShaderDataDefinitions(code);
     * const myUniformValues = makeStructuredView(defs.uniforms.myUniforms);
     *
     * myUniformValues.set({
     *   color: [1, 0, 1, 1],
     *   brightness: 0.8,
     *   kernel: [
     *      1, 0, -1,
     *      2, 0, -2,
     *      1, 0, -1,
     *   ],
     * });
     * device.queue.writeBuffer(uniformBuffer, 0, myUniformValues.arrayBuffer);
     * ```
     *
     * @param code WGSL shader. Note: it is not required for this to be a complete shader
     * @returns definitions of the structures by name. Useful for passing to {@link makeStructuredView}
     */
    function makeShaderDataDefinitions(code) {
        const reflect = new WgslReflect(code);
        const structs = Object.fromEntries(reflect.structs.map(struct => {
            const info = reflect.getStructInfo(struct);
            return [struct.name, addMembers(reflect, info.members, info.size)];
        }));
        const uniforms = Object.fromEntries(reflect.uniforms.map(uniform => {
            const info = reflect.getUniformBufferInfo(uniform);
            return [uniform.name, addMember(reflect, info, 0)[1]];
        }));
        const storages = Object.fromEntries(reflect.storage.map(uniform => {
            const info = reflect.getStorageBufferInfo(uniform);
            return [uniform.name, addMember(reflect, info, 0)[1]];
        }));
        return {
            structs,
            storages,
            uniforms,
        };
    }
    const s_views = new WeakMap();
    function getViewsByCtor(arrayBuffer) {
        let viewsByCtor = s_views.get(arrayBuffer);
        if (!viewsByCtor) {
            viewsByCtor = new Map();
            s_views.set(arrayBuffer, viewsByCtor);
        }
        return viewsByCtor;
    }
    function getView(arrayBuffer, Ctor) {
        const viewsByCtor = getViewsByCtor(arrayBuffer);
        let view = viewsByCtor.get(Ctor);
        if (!view) {
            view = new Ctor(arrayBuffer);
            viewsByCtor.set(Ctor, view);
        }
        return view;
    }
    function setStructuredValues(fieldDef, data, arrayBuffer, offset = 0) {
        const asIntrinsicDefinition = fieldDef;
        if (asIntrinsicDefinition.type) {
            const type = typeInfo[asIntrinsicDefinition.type];
            const view = getView(arrayBuffer, type.View);
            const index = (offset + asIntrinsicDefinition.offset) / view.BYTES_PER_ELEMENT;
            if (typeof data === 'number') {
                view[index] = data;
            }
            else {
                view.set(data, index);
            }
        }
        else if (Array.isArray(fieldDef)) {
            // It's IntrinsicDefinition[] or StructDefinition[]
            data.forEach((newValue, ndx) => {
                setStructuredValues(fieldDef[ndx], newValue, arrayBuffer, offset);
            });
        }
        else {
            // It's StructDefinition
            const asStructDefinition = fieldDef;
            for (const [key, newValue] of Object.entries(data)) {
                const fieldDef = asStructDefinition.fields[key];
                if (fieldDef) {
                    setStructuredValues(fieldDef, newValue, arrayBuffer, offset);
                }
            }
        }
    }

    exports.TypedArrayViewGenerator = TypedArrayViewGenerator;
    exports.isTypedArray = isTypedArray;
    exports.makeShaderDataDefinitions = makeShaderDataDefinitions;
    exports.makeStructuredView = makeStructuredView;
    exports.makeTypedArrayViews = makeTypedArrayViews;
    exports.roundUpToMultipleOf = roundUpToMultipleOf;
    exports.setStructuredValues = setStructuredValues;
    exports.setStructuredView = setStructuredView;

}));
//# sourceMappingURL=webgpu-utils.js.map
