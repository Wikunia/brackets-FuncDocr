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


    var CommandManager      = brackets.getModule("command/CommandManager"),
        KeyEvent        	= brackets.getModule("utils/KeyEvent"),
        EditorManager       = brackets.getModule("editor/EditorManager"),
        KeyBindingManager   = brackets.getModule("command/KeyBindingManager"),
        Menus               = brackets.getModule("command/Menus");


    var COMMAND_ID  = "funcdocr";
    var COMMAND_ID_TAB  = "funcdocrTab";
    var nrOfLines = 0;
    
    var REGEX_PATTERNS = {
        comment: '\\/\\*.*\\*\\/',
       	names: '[$A-Za-z_][0-9A-Za-z_$]*'
    };

    
    /**
     * Insert the documents and select the first
     * @param {object} docs docs.docs,.cursorPosStart,.cursorPosEnd
     */
    function insertDocs(docs) {
        var editor = EditorManager.getCurrentFullEditor();
        var pos    = editor.getCursorPos();
        pos.ch = 0;
 
        editor._codeMirror.replaceRange(docs.docs, pos);

		// set new cursor position
		console.log(docs.cursorPosStart);
		console.log(docs.cursorPosEnd);
		editor.setSelection(docs.cursorPosStart,docs.cursorPosEnd);
		
        EditorManager.focusEditor();
        
    }

    /**
     * get the current function including .name,.prefixSpaces,.type (for prototype),.params,.line
     */
    function getFunction() {
        var func = {};
        var editor = EditorManager.getCurrentFullEditor(),
            pos    = editor.getCursorPos(),
            functionDeclarationRegex = /^(\s*?)(var (.*?)=[ \(]*?function\s*?\((.*?)\)|function\s*?(.*?)\s*?\((.*?)\)|(.*?):\s*?function\s*?\((.*?)\)|(.*?)\.prototype\.(.*?)\s*?=\s*?function\s*?\((.*?)\))/;
		
		var functionLine = editor.document.getRange( {line: pos.line, ch:0},{line:pos.line+1,ch:0});
		var matches = functionDeclarationRegex.exec(functionLine);
		console.log(matches);
		// matches[0] = input
		// matches[1] = tabs and spaces 
		// matches[2] = input without prefix
		// var declaration
			// matches[3] = function name
			// matches[4] = parmaeters like abc,def
		// normal declaration
			// matches[5] = function name
			// matches[6] = parameters
		// requirejs declaration
			// matches[7] = function name
			// matches[8] = parameters
		// prototype declaration
			// matches[9] = type (String,Array,...) 
			// matches[10] = function name
			// matches[11] = parameters
		// get the function name
		// start_pos
		var match_func = false;
		var match_params = false;
		var match_type = false;
		if (matches[3]) {
			match_func = matches[3].trim();
			match_params = matches[4].trim();
		} else if (matches[5]) {
			match_func = matches[5].trim();
			match_params = matches[6].trim();
		} else if (matches[7]) {
			match_func = matches[7].trim();
			match_params = matches[8].trim();
		}  else if (matches[9]) {
			match_type = matches[9].trim();
			match_func = matches[10].trim();
			match_params = matches[11].trim();
		}
		if (match_func) {	
			console.log(matches);
			func.prefixSpaces = matches[1];
			func.name = match_func;
			func.type = match_type;
			var params = match_params.split(',');
			func.params = [];
			func.line = pos.line;
			if (params.length > 1 || params[0].trim() != "") {
				for (var i = 0; i < params.length; i++) {
					func.params.push(params[i].trim());	
				}
			}
			return func;
		}
		return null;
    }
    
    


    
    function generateDocs(func) {
        
        var output = [];
        output.push("/**");

		
        // Add description
        output.push(" * [[Description]]");
		
        var editor = EditorManager.getCurrentFullEditor();
		var langId = editor.getLanguageForSelection().getId();
        
       
        if (langId == "javascript" || langId == "coffeescript" || langId == "livescript") {
				// Add parameters
				if (func.params.length > 0) {
					for (var i = 0; i < func.params.length; i++) {
						output.push(" * @param {[[Type]]} " + func.params[i] + " [[Description]]");
					}
				}

				if ("return" in func) output.push(" * @returns {[[Type]]} [[Description]]");
		} else if (langId == "php") {
			// Add parameters
			if (func.params.length > 0) {
				for (var i = 0; i < func.params.length; i++) {
					output.push(" * @param [[Type]] " + func.params[i] + " [[Description]]");
				}
			}

			if ("return" in func) output.push(" * @return [[Type]] [[Description]]");
		}
        
        output.push(" */");
        
		var cursorPosStart = {line:func.line+1, ch: func.prefixSpaces.length+3}; // +1 for description line, + 3 for " * " 
		console.log(cursorPosStart);
		var cursorPosEnd = {line:cursorPosStart.line, ch: cursorPosStart.ch+15}; // + 15 for "[[Description]]"
        return {docs:func.prefixSpaces + output.join("\n" + func.prefixSpaces) + "\n",cursorPosStart: cursorPosStart,cursorPosEnd: cursorPosEnd};
    }

    

    
   
    /**
     * Check for Tab key 
     * If it is inside a JS/PHPDoc comment jump to the next [[tag]]
     * @param {object} jqEvent 
     * @param {editor} editor Brackets editor
     * @param {object} event key event object	
     */
    function handleTab(jqEvent, editor, event) {
		if ((event.type === "keydown") && (event.keyCode === KeyEvent.DOM_VK_TAB)) { 
			var pos    = editor.getCursorPos();
			
			var nextPosRange = getNextTabPos(editor,pos);
			if (nextPosRange !== false) {
				console.log(nextPosRange);
				editor.setSelection(nextPosRange[0], nextPosRange[1]);				
				
			    event.preventDefault();
			}
		}
	}
			
	
	/**
	 * Get the next Tab position
	 * @param {editor} editor Brackets editor
	 * @param {object} pos pos.ch and pos.line
	 */
	function getNextTabPos(editor,pos) {
		console.log(editor.document);
		console.log(pos);
		var docs = editor.document.getRange(pos,{line:nrOfLines,ch:0});
		docs = docs.substr(0,docs.indexOf('*/')+2);
		console.log(docs);
	    
		// shrinkText 
		var commentRegEx = /^(?![\s\S]*\/\*\*)([\s\S]*?)\*\//;
		var matches = commentRegEx.exec(docs);
		if (!matches) return false;
		docs = matches[1];
		
		// get the next [[
		var nextPosExec = /\[\[(.*?)\]\]/.exec(docs);
		if (nextPosExec === null) return false;
	
		console.log(nextPosExec);
		var nextPos = nextPosExec.index;
	
		// get line and ch
		var currentPos = 0;
		var nextPosLine = 0;
		var nextPosCh = 0;
		var lines = docs.split(/\n/);
		while (true) {
			var currentLineLength = lines[nextPosLine].length+1; // +1 for \n
			var newCurrentPos = currentPos + currentLineLength;
			if (nextPos <= newCurrentPos) {
				nextPosCh = nextPos-currentPos;
				break;
			}
			nextPosLine++;
			currentPos = newCurrentPos;
		}
		if (nextPosLine == 0) nextPosCh += pos.ch;
		return [{line: pos.line+nextPosLine, ch: nextPosCh},{line: pos.line+nextPosLine, ch:nextPosCh+nextPosExec[0].length}];
	}
    

    /**
     * Insert the documentation if a function exists
     */
    function handleDocumentation() {
        var func = getFunction();
        
        if (func === null) {
            return;
        }
        
        var documentation = generateDocs(func);
        console.log(documentation);
        insertDocs(documentation);
    }


	 /**
	  * update the keyEvent listener and remove it from the last document
	  * @param {object} event event object
	  * @param {editor} newEditor Brackets editor
	  * @param {editor} oldEditor Brackets editor
	  */
	 function _updateEditorListener(event, newEditor, oldEditor) {
        if (newEditor) {
			var lines = newEditor.document.getText().split(/\n/);
			nrOfLines = lines.length;
            $(newEditor).on("keyEvent", handleTab);
        }
        
        if (oldEditor) {
            $(oldEditor).off("keyEvent", handleTab);
        }
    }
	
	
	CommandManager.register("funcdocr", COMMAND_ID, handleDocumentation);
	KeyBindingManager.addBinding(COMMAND_ID, "Ctrl-Alt-D");
	
	$(EditorManager).on("activeEditorChange", _updateEditorListener);
	$(EditorManager.getCurrentFullEditor()).on("keyEvent", handleTab);

});