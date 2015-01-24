// =========================================================================
// Hint Manager
// =========================================================================
define(['text!definitions/default.json',
        'text!definitions/js.json',
        'text!definitions/php.json'],
    function (defaultDef, javascriptDef, phpDef) {
        var DocumentManager     = brackets.getModule('document/DocumentManager');
		var EditorManager       = brackets.getModule('editor/EditorManager');

		/**
         * Parse Documentation Definitions, used to populate tag suggestions
         */
        var DOC_DEFINITIONS = {
            default: JSON.parse(defaultDef),
            javascript: JSON.parse(javascriptDef),
            php: JSON.parse(phpDef)
        };
        DOC_DEFINITIONS.coffeescript = DOC_DEFINITIONS.javascript;
        DOC_DEFINITIONS.livescript 	 = DOC_DEFINITIONS.javascript;
    
        var DOCBLOCK_STATIC_HINTS = /(\[\[[^\]]+\<[^\]]+\>\]\])/;
        var DOCBLOCK_FIELD = /(\[\[[^\]]+\]\])/;
        var CALLBACK = /\/\*\*[\s\S]*?@callback\s(\S*?)\s[\s\S]*?\*\//g;
        var FUNC_DEFINITION_ROW = /^[\S\s]*?\*\/([\S\s]*?){/g;
		var FUNC_DEFINITION	    = /(var (.*)=\s*(?:function(.*)|React.createClass\s*\((?:.*))|function (.*?)|(.*?):\s*?function(.*?)|([^.]*?)\.(prototype\.)?([^.]*?)\s*?=\s*?function(.*?))/;
		var REGEX_END			= /(\n|\r|$)/;


        /**
         * DocrHint constructor
         * @param {Object} importFuncs functions that will be used in this class and must be imported
         */
        function DocrHint(importFuncs) {

            var docrHintThis = this;
            $.each(importFuncs, function (key, func) {
                docrHintThis[key] = func;
            });

            docrHintThis.docDefinitions = DOC_DEFINITIONS;
        }

        /**
         * Checks, if it is possible to give hints inside the current docblock.
         * @param   {editor}  editor       current brackets editor
         * @param   {String}  implicitChar implicit character
         * @returns {Boolean} true for has hints otherwise false
         */
        DocrHint.prototype.hasHints = function (editor, implicitChar) {
            this.editor = editor;
            this.selection = editor.getSelectedText();
            this.pos = editor.getCursorPos();
            this.insideDocPos = this.insideDocBlock(this.pos);
            if (this.insideDocPos) {
                this.pos = editor.getCursorPos();
                switch (this.selection) {
                case "[[Type]]":
                    this.implicitChar = "[[Type]]";
                    return true;
                case "[[Link]]":
                    this.implicitChar = "[[Link]]";
                    return true;
				 case "[[callLink]]":
                    this.implicitChar = "[[callLink]]";
                    return true;
                default:
                    if (implicitChar == '@') {
                        this.removeSelection = true;
                        this.implicitChar = "@";
                        return true;
                    } else if (DOCBLOCK_STATIC_HINTS.exec(this.selection)) {
                        this.removeSelection = true;
                        this.implicitChar = this.selection;
                        return true;
                    }
                }
            }
            return false;
        };

        /**
         * @cal
         * Get the hints for a selection
         * uses {@link removeWrongHints	removeWrongHints}
         * @param   {String} implicitChar implicit character
         * @returns {Object} hintManager object
         */
        DocrHint.prototype.getHints = function () {
            var hints = [];
            this.match = this.editor.document.getRange(this.pos, this.editor.getCursorPos());

            this.hintText = '';
            this.removeSelection = true;
            this.boolSetSelection = false;
            this.deleteFirstNChars = 0;

			var language 	= this.editor.getLanguageForSelection().getId();
            var definitions = this.docDefinitions;
			
			if (definitions[language] === undefined) {
				definitions = definitions.default;
			} else {
				definitions = definitions[language];
			}
			
            switch (this.implicitChar) {
            case "[[Type]]":
				var defKeys = Object.keys(definitions.types);
				for (var i = 0; i < defKeys.length; i++) {
					hints.push(definitions.types[defKeys[i]]);
				}
				// Check for callbacks in the current file
				var currentDoc = DocumentManager.getCurrentDocument().getText();
				var callback = null;
				while((callback = CALLBACK.exec(currentDoc)) != null) {
					hints.push(callback[1]);
				}

                break;
			case "[[callLink]]":
				var editor 	 	= EditorManager.getCurrentFullEditor();
				var code 	 	= editor.document.getRange(this.pos,{ch:0,line:editor.lineCount()});
				var funcNameRow = FUNC_DEFINITION_ROW.exec(code);
				if (funcNameRow) {
					var funcName = getFuncName(funcNameRow[1]);
					hints.push(funcName);
				}
				// no break get all link possibilities as well!
            case "[[Link]]":
                var functionList = this.createFunctionList();
                var functionSignature = this.getFunctionCodeTypes(this.editor, {
                    line: this.insideDocPos.end,
                    ch: 0
                }, []);
                var bestFuncs = [];
                var otherFuncs = [];
                for (var i = 0; i < functionList.length; i++) {
                    var regexFuncTest = new RegExp('\[^a-zA-Z0-9\]' + functionList[i].name + '\\(');
                    // remove the function name
                    functionSignature.code = functionSignature.code.substr(functionSignature.code.indexOf('{'));
                    if (regexFuncTest.test(functionSignature.code)) {
                        bestFuncs.push(functionList[i].name);
                    } else {
                        otherFuncs.push(functionList[i].name);
                    }
                }
                hints.push.apply(hints, bestFuncs.concat(otherFuncs));
                break;
            case "@":
                var line = this.editor.document.getRange({
                    line: this.pos.line,
                    ch: 0
                }, this.pos);

                var match = /{\s*@$/.exec(line);

                if (match) {
                    this.deleteFirstNChars = 2;
                } else {
                    this.deleteFirstNChars = 1;
                }

              

                for (var tag in definitions.tags) {
                    hints.push(definitions.tags[tag]);
                }

                this.boolSetSelection = true;
                break;
            default:
                // Here we have static suggestions included in the tag (i.e. [[Access<protected|public|private>]])
                var hintsStartIndex = this.implicitChar.indexOf('<');
                var hintsStopIndex = this.implicitChar.indexOf('>');
                    
                if (hintsStartIndex !== -1 && hintsStopIndex !== -1 && hintsStopIndex > hintsStartIndex) {
                    var hintsRaw = this.implicitChar.substring(hintsStartIndex+1, hintsStopIndex);
                    hints = hintsRaw.split('|');
                }
                break;
            }


            this.removeSelection = (this.removeSelection && this.match !== '') ? false : this.removeSelection;

            hints = this.removeWrongHints(hints);

            return {
                hints: hints,
                match: this.match,
                selectInitial: true,
                handleWideResults: false
            };
        };

		/**
		 * Return the function name for a special row
		 * Array.prototype.abc = function() { => abc
		 * function cool() { => cool
		 * @param   {String} row row where the function is declared
		 * @returns {String} the function name
		 */
		function getFuncName(row) {
			// multiline,caseinsensitive
			var regex = new RegExp(FUNC_DEFINITION.source + REGEX_END.source , 'mi');

			var matches 		= null;
			var multicomment 	= null;
			var match_func 		= false;
			matches = regex.exec(row);
			if (matches) {
				// matches[0] = all
				// matches[2] = '''function_name''' or matches[4] if matches[2] undefined or matches[5] if both undefined
				// get the function name
				// start_pos
				for (var i = 0; i < matches.length; i++) {
					if (matches[i]) {
						matches[i] = matches[i].trim();
					}
				}
				if (matches[2]) {
					match_func = matches[2].trim();
				} else if (matches[4]) {
					match_func = matches[4].trim();
				} else if (matches[5]) {
					match_func = matches[5].trim();
				}  else if (matches[7]) {
					// prototype or static
					if (matches[8] == "prototype.") {
						match_func = matches[9];
					} else if (!matches[8]) {
						match_func = matches[9];
					}
				}
				if (match_func) {
					var end_func_name = match_func.search(/( |\(|$)/);
					if (end_func_name >= 0) {
						match_func = match_func.substring(0,end_func_name).trim();
					}
				}
			}
			return match_func;
		}

        /**
         * Remove hints that doesn't match the current this.match
         * @param   {Array} hints hints that are availabe
         * @returns {Array} hints that matches this.match
         */
        DocrHint.prototype.removeWrongHints = function (hints) {
            var result = [];
            for (var i = 0; i < hints.length; i++) {
                if (hints[i].indexOf(this.match) >= 0) {
                    result.push(hints[i]);
                }
            }
            return result;
        };

        /**
         * Inserts the hint
         */
        DocrHint.prototype.insertHint = function (hint) {
            // Document objects represent file contents
            var currentDoc = this.editor.document;

            // Where the range end that should be replaced
            var start = {
                line: this.pos.line,
                ch: this.pos.ch - this.deleteFirstNChars
            };
            var end = {
                line: this.pos.line,
                ch: this.pos.ch + ((this.removeSelection) ? this.selection.length : this.match.length)
            };


            // Add some text in our document
            currentDoc.replaceRange(hint, start, end);

            var hintContainsField = DOCBLOCK_FIELD.exec(hint);
            if (this.boolSetSelection && hintContainsField) {
                var match = /\[\[[a-z]+\]\]/i.exec(hint);
                if (match) {
                    var selectionEnd = this.pos.ch - this.deleteFirstNChars + match.index;
                    var selectionStart = selectionEnd + match[0].length;
                    this.setSelection(this.editor, {
                        line: this.pos.line,
                        ch: selectionStart
                    }, {
                        line: this.pos.line,
                        ch: selectionEnd
                    });
                }
            }

        };

        return DocrHint;
    });
