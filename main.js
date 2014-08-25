/*
 * Copyright (c) 2012 Adobe Systems Incorporated. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 */


/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

/** extension to generate JSDoc annotations for functions */
define(function (require, exports, module) {
    'use strict';

	var AppInit            	= brackets.getModule("utils/AppInit");
    var CodeHintManager     = brackets.getModule("editor/CodeHintManager");
    var CommandManager      = brackets.getModule('command/CommandManager');
	var Commands            = brackets.getModule("command/Commands");
    var KeyEvent            = brackets.getModule('utils/KeyEvent');
    var EditorManager       = brackets.getModule('editor/EditorManager');
    var KeyBindingManager   = brackets.getModule('command/KeyBindingManager');
    var Menus               = brackets.getModule('command/Menus');

    var COMMAND_ID          = 'funcdocr';
    var COMMAND_ID_TAB      = 'funcdocrTab';
    var FUNCTION_REGEXP     = /function(?:\s+[A-Za-z\$\_][A-Za-z\$\_0-9]*)?\s*\(([^\)]*)\)\s*\{/;
    var INDENTATION_REGEXP  = /^([\t\ ]*)/;

    var DOCBLOCK_BOUNDARY   = /[A-Za-z\[\]]/;
    var DOCBLOCK_START      = /^\s*\/\*\*/;
    var DOCBLOCK_MIDDLE     = /^\s*\*/;
    var DOCBLOCK_END        = /^\s*\*\//;
    var DOCBLOCK_FIELD      = /(\[\[[^\]]+\]\])/;
    var DOCBLOCK_LAST_FIELD = /.*(\[\[[^\]]+\]\])/;

	var PROPERTIES 			= ['arity', 'caller', 'constructor', 'length', 'prototype'];
	var STRING_FUNCTIONS	= ['charAt', 'charCodeAt', 'codePointAt', 'contains', 'endsWith',
							   'localeCompare', 'match', 'normalize', 'repeat', 'replace', 'search',
							   'split', 'startsWith', 'substr', 'substring', 'toLocaleLowerCase',
							   'toLocaleUpperCase', 'toLowerCase', 'toUpperCase', 'trim', 'valueOf'];
	var ARRAY_FUNCTIONS		= ['fill', 'pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift', 'join'];
	var OBJECT_FUNCTIONS 	= ['create', 'defineProperty', 'defineProperties', 'freeze', 'getOwnPropertyDescriptor',
							   'getOwnPropertyNames', 'getOwnPropertySymbols', 'getPrototypeOf', 'isExtensible',
							   'isFrozen', 'isSealed', 'keys', 'preventExtensions', 'seal', 'setPrototypeOf'];
	var REGEXP_FUNCTIONS 	= ['exec','test'];

    var PARAM_WRAPPERS = {
        'javascript'   : ['{', '}'],
        'coffeescript' : ['{', '}'],
        'livescript'   : ['{', '}'],
        'php'          : ['', '']
    };

	var langId;

    // =========================================================================
    // Doc Block Generation
    // =========================================================================


    /**
     * Handle the shortcut to create a doc block
     */
    function handleDocBlock() {
        insertDocBlock(generateDocBlock(getFunctionSignature()));
    }

    /**
     * Get the signature of the currently selected function
     * @returns {Object} [.description],[.parameter],[.returns]
     */
    function getFunctionSignature() {
        var editor      = EditorManager.getCurrentFullEditor();
		langId  		= editor.getLanguageForSelection().getId();
        var position    = editor.getCursorPos();
        var document    = editor.document;
        var lineBefore  = document.getLine(position.line-1);
        var currentLine = document.getLine(position.line);
        var matches     = FUNCTION_REGEXP.exec(currentLine);
        var docExists   = DOCBLOCK_END.test(lineBefore) ? true : false;

        var signature   = {};

        if (!matches) {
            return null;
        }

        signature.indentation = INDENTATION_REGEXP.exec(currentLine)[0];
        signature.parameters  = [];

        var parameters = matches[1].split(',');

        for (var i = 0; i < parameters.length; ++i) {
            var name = parameters[i].trim();

            if (name) {
                signature.parameters.push({title:name});
            }
        }

		// default
		signature.returns = {bool: false};

		// get the function code and returns (Boolean)
		var codeTypes = getFunctionCodeTypes(editor,position,signature.parameters);
		if (codeTypes) {
			signature.returns = {bool:codeTypes.returns};
			for (var i = 0; i < codeTypes.paramTypes.length; i++) { // add the paramTypes to signature.parameters
				signature.parameters[i].type = codeTypes.paramTypes[i];
			}
		}


		if (docExists) { // try to update the doc block (parameter added or deleted)
			var doc = getExistingDocSignature(document,position);
			var docStartLine = doc.startLine;
			var docSignature = doc.signature;

			// merge the docSignature into signature
			if (docSignature.description != '') {
				signature.description = docSignature.description;
			}
			var parameterTitles = [];
			signature.parameters.forEach(function(o){parameterTitles.push(o.title);} );

			for (var i = 0; i < docSignature.parameters.length; i++) {
				var paramIndex;
				if ((paramIndex = parameterTitles.indexOf(docSignature.parameters[i].title)) >= 0) {
					signature.parameters[paramIndex] = docSignature.parameters[i];
				}
			}
			if (signature.returns.bool) {
				signature.returns = docSignature.returns ? docSignature.returns : {};
				signature.returns.bool = true;
			}
			editor._codeMirror.replaceRange('', {ch: 0, line: docStartLine}, {ch: 0, line: position.line});
		}

        return signature;
    }

	/**
	 * Get the existing doc tags
	 * @param   {document} document brackets document
	 * @param   {Object}   position current cursor position
	 * @returns {Object}   get startLine of the doc and the tags (.signature)
	 */
	function getExistingDocSignature(document,position) {
		// get start line of documentation
		var i = 1;
		var currentLine = document.getLine(position.line-i);
		var docLines = [];
		while (!DOCBLOCK_START.test(currentLine)) {
			docLines.push(currentLine);
			i++;
			currentLine = document.getLine(position.line-i);
		}
		docLines.reverse();
		return {startLine: position.line-i, signature: getCurrentDocTags(docLines)};
	}

	/**
	 * Get all tags that are set in the existing doc block
	 * @param   {Array}  lines doc block lines
	 * @returns {Object} tags .descriptions,.params,.returns
	 */
	function getCurrentDocTags(lines) {
		var tags = {};

		// trim lines
		for (var i = 0; i < lines.length; i++) {
			lines[i] = lines[i].trim(); // trim each line
			if (lines[i].substr(0,2) == "*/") { lines = lines.slice(0,i); break; }
			lines[i] = lines[i].replace(/^\*/,'').trim(); // delete * at the beginning and trim line again
		}

		var commentTags = lines.join('\n').split('@');

		tags.description = commentTags[0].replace(/\n*$/,''); // the first (without @ is the description/summary)

		var params = [];
		for (var i = 1; i < commentTags.length; i++) {
			// get params
			if (commentTags[i].substr(0,5) === 'param') {
				var param_parts = commentTags[i].split(/(\s)+/);

				var param = {};
				// get the split delimiters
				var delimiters = param_parts.filter(function(v,i) { return ((i % 2) === 1); });
				param_parts = param_parts.filter(function(v,i) { return ((i % 2 === 0)); });


				// 0 = param, [1 = type], 2 = title 3- = description
				switch(langId) {
					case "javascript":
					case "coffeescript":
					case "livescript":
						if (param_parts[1].charAt(0) != '{') {
							param_parts.splice(1,0,false);  // add the type false
							param.type = false;
						} else {
							param.type = param_parts[1].substring(1,param_parts[1].length-1); // remove { }
						}
					break;
					case "php":
						if (param_parts[1].charAt(0) == '$') {
							param_parts.splice(1,0,false);  // add the type false
							param.type = false;
						} else {
							if (param_parts[1].charAt(0) == '{') {
								param.type = param_parts[1].substring(1,param_parts[1].length-1);
							} else {
								param.type = param_parts[1];
							}
						}
					break;
				}
				param.title			= param_parts[2];
				param.description   = param_parts[3];
				for (var j = 4; j < param_parts.length; j++) {
					param.description += delimiters[j-1] + param_parts[j];
				}
				param.description = param.description.replace(/\n*$/,'');
				params.push(param);
			}


			if (commentTags[i].substr(0,6) === 'return') {
				if (commentTags[i].substr(0,7) === 'returns') {
					var  return_tag = commentTags[i].substr(7).trim(); // delete returns and trim
				} else {
					var  return_tag = commentTags[i].substr(6).trim(); // delete return and trim
				}
				if(return_tag.charAt(0) == '{') {
					var endCurly = return_tag.indexOf('}');
					tags.returns = {description: return_tag.substr(endCurly+1).trim(),type:return_tag.substring(1,endCurly)};
				}else {
					var firstSpace = return_tag.indexOf(' ');
					tags.returns = {type: (firstSpace >= 0) ? return_tag.substr(0,firstSpace) : return_tag.substr(0),
									description: return_tag.substr(firstSpace+1).trim()};
				}
			}
		}
		tags.parameters = params;
		return tags;
	}

    /**
     * Generate the doc block for a function signature
     * @param   {Object} signature .description,.parameter,.returns
     * @returns {String} the doc block with the correct indentation
     */
    function generateDocBlock(signature) {
        if (!signature) {
            return null;
        }

        var editor  = EditorManager.getCurrentFullEditor();
        var wrapper = PARAM_WRAPPERS[langId];

        if (!wrapper) {
            console.warn('Unsupported language: ' . langId);
            return null;
        }

        var output = ['/**'];

		// add description
		signature.description = "description" in signature ? signature.description.split(/\n/) : ['[[Description]]'];
		output.push(' * '+signature.description[0]);
		for (var d = 1; d < signature.description.length; d++) {
			output.push(' * '+signature.description[d]);
		}


        // Determine the longest parameter and the longest type so we can right-pad them
        var maxParamLength = 0;
        var maxTypeLength = 0;
        for (var i = 0; i < signature.parameters.length; i++) {
            var parameter = signature.parameters[i];
			parameter.type 			= parameter.type  ? parameter.type : '[[Type]]';

            if (parameter.title.length > maxParamLength) {
                maxParamLength = parameter.title.length;
            }
			if (parameter.type.length > maxTypeLength) {
                maxTypeLength = parameter.type.length;
            }
        }
		if (signature.returns.bool) {
			signature.returns.type 	= signature.returns.type ? signature.returns.type : '[[Type]]';
			maxTypeLength 			= signature.returns.type.length > maxTypeLength ? signature.returns.type.length : maxTypeLength;
		}



		// if returns is set show align the types of params and returns
		var tagRightSpace = signature.returns.bool ? '   ' : ' ';

        // Add the parameter lines
        for (var i = 0; i < signature.parameters.length; i++) {
            var parameter = signature.parameters[i];

            // get the right spaces for title and type
            parameter.titleRightSpace		= new Array(maxParamLength + 2 - parameter.title.length).join(' ');
            parameter.typeRightSpace 		= new Array(maxTypeLength + 2 - parameter.type.length).join(' ');

			parameter.description 	= parameter.description	? parameter.description : '[[Description]]';
            output.push(' * @param'+ tagRightSpace + wrapper[0] + parameter.type + wrapper[1] +
						parameter.typeRightSpace + parameter.title + parameter.titleRightSpace +parameter.description);
        }

        // Add the return line
        if (signature.returns.bool) {
			signature.returns.description 			= signature.returns.description ? signature.returns.description : '[[Description]]';
			signature.returns.typeRightSpace 		= new Array(maxTypeLength + 2 - signature.returns.type.length).join(' ');
            output.push(' * @returns ' + wrapper[0] + signature.returns.type + wrapper[1] +
						signature.returns.typeRightSpace + signature.returns.description);
        }

        output.push(' */');

        return signature.indentation + output.join('\n' + signature.indentation) + '\n';
    }



    /**
     * Insert the docBlock
     * @param {String} docBlock the generated doc block
     */
    function insertDocBlock(docBlock) {
        if (!docBlock) {
            return;
        }

        var editor   = EditorManager.getCurrentFullEditor();
        var position = editor.getCursorPos();
        position.ch  = 0;

        editor._codeMirror.replaceRange(docBlock, position);

        // Start at the first line, just before [[Description]]
        var lines           = docBlock.split('\n');
		var startPosition   = editor.getCursorPos();
		startPosition.line -= lines.length - 2;
        startPosition.ch    = lines[0].length;

		// jump to te first [[Tag]]
		var nextField = getNextField({start:startPosition,end:startPosition},false);

        if (nextField) {
             editor.setSelection(nextField[1], nextField[0]); // set the selection
		}

        EditorManager.focusEditor();
    }


    // =========================================================================
    // Tab Handling
    // =========================================================================


    /**
     * Handle the tab key when within a doc block
     * @param {object} event  jQuery event object
     * @param {editor} editor Brackets editor
     * @param {object} event  Event object
     */
    function handleTab($event, editor, event) {
        if (event.type === 'keydown' && event.keyCode === KeyEvent.DOM_VK_TAB) {
            var editor    = EditorManager.getCurrentFullEditor();
            var selection = editor.getSelection();
            var backward  = event.shiftKey;
            var nextField = getNextField(selection, backward);

            if (nextField) {
                editor.setSelection(nextField[1], nextField[0]); // set the selection
				CommandManager.execute(Commands.SHOW_CODE_HINTS);
                event.preventDefault();
            }
        }
    }


    /**
     * Gets the next tabbable field within the doc block based on the cursor's position
     * @param   {Object}  selection selected Text psoition {start<.ch,.line>,end<.ch,.line>
     * @param   {Boolean} backward  Set to true to search backward
     * @param   {Boolean} stop      Set to true stop looping back around to search again
     * @returns {array}   start position,end position (.ch,.line)
     */
    function getNextField(selection, backward, stop) {
        var editor    = EditorManager.getCurrentFullEditor();
        var document  = editor.document;
        var lineCount = editor.lineCount();

        // Determine the cursor position based on the selection
        var position;

        if (selection.start.line !== selection.end.line) {
            position = selection.start.line > selection.end.line ? selection.start : selection.end;
        }
        else {
            position = selection.start.ch > selection.end.ch ? selection.start : selection.end;
        }

        // Reverse the position if we're moving backward
        if (backward) {
            position = position === selection.start ? selection.end : selection.start;
        }

        // Snap to the word boundary
        var currentLine = document.getLine(position.line);

        while (currentLine.charAt(position.ch).match(DOCBLOCK_BOUNDARY)) {
            position.ch -= 1;

            if(position.ch < 0) {
                position.ch = 0;
                break;
            }
            else if(position.ch >= currentLine.length) {
                position.ch = currentLine.length - 1;
                break;
            }
        }

        // Search for the start of the doc block
        var start = null;

        for (var i = position.line; i >= 0; --i) {
            var line = document.getLine(i);

            // Check for the start of the doc block
            if (line.match(DOCBLOCK_START)) {
                start = i;
                break;
            }

            // Make sure we're still in a doc block
            if (!line.match(DOCBLOCK_MIDDLE) && !line.match(DOCBLOCK_END)) {
                break;
            }
        }

        // If no start was found, we're not in a doc block
        if (start === null) {
            return null;
        }

        // Search for the end of the doc block
        var end = null;

        for (var i = position.line; i < lineCount; ++i) {
            var line = document.getLine(i);

            // Check for the end of the doc block
            if (line.match(DOCBLOCK_END)) {
                end = i;
                break;
            }

            // Make sure we're still in a doc block
            if (!line.match(DOCBLOCK_START) && !line.match(DOCBLOCK_MIDDLE)) {
                break;
            }
        }

        // If no end was found, we're not in a doc block
        if (end === null) {
            return null;
        }

        // Search for the next field
        var limit     = backward ? position.line - start : end - position.line;
        var direction = backward ? -1 : 1;
        var field     = null;

        for (var i = 0; i < limit; ++i) {
            var lineNumber   = position.line + (i * direction);
            var line         = document.getLine(lineNumber);
            var start_offset = 0;
            var end_offset   = line.length;

            // If we're testing the cursor's line, we need to ignore text in front/behind based on the direction
            if (lineNumber === position.line) {
                start_offset = backward ? 0 : position.ch;
                end_offset   = backward ? position.ch : undefined;
            }

            // Find the field using regexp
            var testLine = line.substr(start_offset, end_offset);
            var pattern  = backward ? DOCBLOCK_LAST_FIELD : DOCBLOCK_FIELD;
            var match    = pattern.exec(testLine);

            if (match) {
                var index = backward ? testLine.lastIndexOf(match[1]) : testLine.indexOf(match[1]);

                var startPosition = {
                    line : lineNumber,
                    ch   : index + start_offset
                };

                var endPosition = {
                    line : lineNumber,
                    ch   : index + match[1].length + start_offset
				};

                field = backward ? [endPosition, startPosition] : [startPosition, endPosition];
                break;
            }
        }

        // If no field was found, loop back around
        if (field === null && !stop) {
            var loopPosition = {
                line : backward ? end : start,
                ch   : 0
            }

            var loopSelection = {
                start : loopPosition,
                end   : loopPosition
            };

            return getNextField(loopSelection, backward, true);
        }

        return field;
    }


    // =========================================================================
    // Initialization
    // =========================================================================

    /**
     * Add/Remove listeners when the editor changes
     * @param {object} event     Event object
     * @param {editor} newEditor Brackets editor
     * @param {editor} oldEditor Brackets editor
     */
    function updateEditorListeners(event, newEditor, oldEditor) {
        $(oldEditor).off('keyEvent', handleTab);
        $(newEditor).on('keyEvent', handleTab);
    }

	// =========================================================================
    // Analyze Function Code
    // =========================================================================

	/**
	 * Get the code of a function at positon and check if the function returns a value
	 * Try to guess the parameter types
	 * @param   {Object} editor   Brackets editor
	 * @param   {Object} position current position (.ch,.line)
	 * @param   {Object} params   function parameters
	 * @returns {Object} .code = code of function, .returns (Boolean) true if function returns, .paramTypes (Array) Type of parameter
	 */
	function getFunctionCodeTypes(editor,position,params) {
		var code = editor.document.getRange({ch:0,line:position.line},{ch:0,line:editor.lineCount()});
		var length = code.length;
		var delimiter = '';
		var bracketCount = 0;
		var returnStatement = false;
		var paramsFirstChars = [];

		for (var i = 0; i < params.length; i++) {
			paramsFirstChars.push(params[i].title.charAt(0));
		}

		var paramIndex;
		var paramTypes = [];

		for (var i = 0; i < length; i++) {
			var char = code.charAt(i);

			// get code types
			if (langId != "php" && ((paramIndex = paramsFirstChars.indexOf(char)) >= 0)) {
				if (delimiter == '') {
					while (paramIndex >= 0) { // parameters can start with the same char
						// check for currentParameter.
						if (code.substr(i,params[paramIndex].title.length+1) == params[paramIndex].title+'.') {
							var functionAfterParam = /^([a-z]*)(\()?/i.exec(code.substr(i+params[paramIndex].title.length+1));
							// check for properties
							if (!functionAfterParam[2]) {
								if (PROPERTIES.indexOf(functionAfterParam[1]) === -1) {
									paramTypes[paramIndex] = 'Object';
								}
							} else { // check for functions
								if (STRING_FUNCTIONS.indexOf(functionAfterParam[1]) !== -1) {
									paramTypes[paramIndex] = 'String';
								} else if (ARRAY_FUNCTIONS.indexOf(functionAfterParam[1]) !== -1) {
									paramTypes[paramIndex] = 'Array';
								} else if (OBJECT_FUNCTIONS.indexOf(functionAfterParam[1]) !== -1) {
									paramTypes[paramIndex] = 'Object';
								} else if (REGEXP_FUNCTIONS.indexOf(functionAfterParam[1]) !== -1) {
									paramTypes[paramIndex] = 'RegExp';
								}
							}
						}
						paramIndex = paramsFirstChars.indexOf(char,paramIndex+1); // next parameter with the correct first char
					}
				}
			}


			switch (char) {
				case 'r':
					if (delimiter == "" && code.substr(i,6) == "return" && code.charAt(i+6) != ";") returnStatement = true;
					break;

				case '"':
				case "'":
					if (delimiter) {
						if (char === delimiter) // closing ' or "
							delimiter = '';
					}
					else delimiter = char; // starting ' or "
					break;
				case '/':
					if (delimiter == '') {
						var lookahead = code.charAt(++i);
						switch (lookahead) {
							case '/': // comment
								var endComment = code.regexIndexOf(/\n/,i);
								i = endComment > i ? endComment+2 : i;
								break;
							case '*': // start of comment (/*)
								var endComment = code.regexIndexOf(/\*\//,i);
								i = endComment > i ? endComment+2 : i;
								break;
							default:
								// check for regular expression
								if (/[-+*%!=(;?,<>~]\s*$/.test(code.substring(0,i-1))) { // i-1 because ++i for lookahead
									var endRegex = /[^\\](?:[\\]{2})*\//;
									var endRegexMatch = endRegex.exec(code.substring(i,code.indexOf('\n',i)));
									i += endRegex ? endRegexMatch.index+endRegexMatch[0].length : 0;
								}
						}
					}
					break;
				case '\\':
					switch (delimiter) {
					case '"':
					case "'":
					case "\\":
						i++;
					}
					break;
				case '{':
					if (!delimiter) {
						bracketCount++;
					}
					break;
				case '}':
					if (!delimiter) {
						bracketCount--;
						if (bracketCount === 0) {
							return {
								code:code.substr(0,i+1),
								returns: returnStatement,
								paramTypes: paramTypes
							}
						}
					}
			} // switch
    	} // for
		return false;
	}


	String.prototype.regexIndexOf = function(regex, startpos) {
		var indexOf = this.substring(startpos || 0).search(regex);
		return (indexOf >= 0) ? (indexOf + (startpos || 0)) : indexOf;
	}

	AppInit.appReady(function () {
		require('hints');

		CommandManager.register('funcdocr', COMMAND_ID, handleDocBlock);
		KeyBindingManager.addBinding(COMMAND_ID, 'Ctrl-Alt-D');
		KeyBindingManager.addBinding(COMMAND_ID, 'Cmd-Shift-D', 'mac');

		$(EditorManager).on('activeEditorChange', updateEditorListeners);
		$(EditorManager.getCurrentFullEditor()).on('keyEvent', handleTab);

		var docrHints = new DocrHint();
		CodeHintManager.registerHintProvider(docrHints, ["javascript", "coffeescript", "livescript" ,"php"], 0);
	});
});
