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

    var CommandManager    = brackets.getModule('command/CommandManager');
    var KeyEvent          = brackets.getModule('utils/KeyEvent');
    var EditorManager     = brackets.getModule('editor/EditorManager');
    var KeyBindingManager = brackets.getModule('command/KeyBindingManager');
    var Menus             = brackets.getModule('command/Menus');

    var COMMAND_ID         = 'funcdocr';
    var COMMAND_ID_TAB     = 'funcdocrTab';
    var FUNCTION_REGEXP    = /function(\s+[A-Za-z\$\_][A-Za-z\$\_0-9]*)?\s*\(([^\)]*)\)\s*\{/;
    var INDENTATION_REGEXP = /^([\t\ ]*)/;
    var LINE_COUNT         = 0;

    var PARAM_WRAPPERS = {
        'javascript'   : ['{', '}'],
        'coffeescript' : ['{', '}'],
        'livescript'   : ['{', '}'],
        'php'          : ['', '']
    };


    /**
     * get the current function including .indentation,.type (for prototype),.params,.line
     */
    function getFunction() {
        var results = {};
        var editor  = EditorManager.getCurrentFullEditor();
        var pos     = editor.getCursorPos();
        var line    = editor.document.getRange(
            {
                line : pos.line,
                ch  : 0
            },
            {
                line : pos.line + 1,
                ch   : 0
            }
        );

        var matches = FUNCTION_REGEXP.exec(line);

        if (!matches) {
            return null;
        }

        results.indentation = INDENTATION_REGEXP.exec(line)[0];
        results.parameters  = [];

        var parameters = matches[2].split(',');

        for (var i = 0; i < parameters.length; ++i) {
            var name = parameters[i].trim();

            if (name) {
                results.parameters.push(name);
            }
        }

        return results;
    }

    function generateDocs(func) {
        if (!func) {
            return null;
        }

        var editor  = EditorManager.getCurrentFullEditor();
        var langId  = editor.getLanguageForSelection().getId();
        var wrapper = PARAM_WRAPPERS[langId];

        if (!wrapper) {
            console.warn('Unsupported language: ' . langId);
            return null;
        }

        var output = [
            '/**',
            ' * [[Description]]'
        ];

        // Determine the longest parameter so we can right-pad them
        var maxLength = 0;
        for (var i = 0; i < func.parameters.length; i++) {
            var parameter = func.parameters[i];

            if(parameter.length > maxLength) {
                maxLength = parameter.length;
            }
        }

        // Add the parameter lines
        for (var i = 0; i < func.parameters.length; i++) {
            var parameter = func.parameters[i];

            // Right pad the parameter
            parameter = (parameter + new Array(maxLength).join(' ')).substr(0, maxLength);

            output.push(' * @param ' + wrapper[0] + '[[Type]]' + wrapper[1] + ' ' + parameter + ' [[Description]]');
        }

        // @TODO Make this actually work
        // Add the return line
        if (func.return) {
            output.push(' * @returns ' + wrapper[0] + '[[Type]]' + wrapper[1] + ' [[Description]]')
        }

        output.push(' */');

        return func.indentation + output.join('\n' + func.indentation) + '\n';
    }


    /**
     * Insert the documents and select the first
     * @param {object} docs docs.docs,.cursorPosStart,.cursorPosEnd
     */
    function insertDocs(docs) {
        if (!docs) {
            return;
        }

        var editor = EditorManager.getCurrentFullEditor();
        var pos    = editor.getCursorPos();
        pos.ch     = 0;

        editor._codeMirror.replaceRange(docs, pos);

        // Start at the first line, just before [[Description]]
        var lines     = docs.split('\n');
        var startPos  = editor.getCursorPos();
        startPos.line -= lines.length - 2;
        startPos.ch   = lines[0].length;

        // End just after [[Description]]
        var endPos = Object.create(startPos);
        endPos.ch += '[[Description]]'.length;

        // Set the selection
        editor.setSelection(startPos, endPos);

        EditorManager.focusEditor();
    }


    /**
     * Check for Tab key
     * If it is inside a JS/PHPDoc comment jump to the next [[tag]]
     * @param {object} jqEvent
     * @param {editor} editor Brackets editor
     * @param {object} event key event object
     */
    function handleTab(jqEvent, editor, event) {
        if ((event.type === 'keydown') && (event.keyCode === KeyEvent.DOM_VK_TAB)) {
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
        var docs = editor.document.getRange(pos,{line:LINE_COUNT,ch:0});
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
        insertDocs(generateDocs(getFunction()));
    }


	/**
    * update the keyEvent listener and remove it from the last document
    * @param {object} event event object
    * @param {editor} newEditor Brackets editor
    * @param {editor} oldEditor Brackets editor
    */
    function _updateEditorListener(event, newEditor, oldEditor) {
        // @FIXME This is really buggy, so I disabled it for now
        return;

        if (newEditor) {
            var lines = newEditor.document.getText().split(/\n/);
            LINE_COUNT = lines.length;
            $(newEditor).on('keyEvent', handleTab);
        }

        if (oldEditor) {
            $(oldEditor).off('keyEvent', handleTab);
        }
    }


    CommandManager.register('funcdocr', COMMAND_ID, handleDocumentation);
    KeyBindingManager.addBinding(COMMAND_ID, 'Ctrl-Alt-D');
    KeyBindingManager.addBinding(COMMAND_ID, 'Cmd-Shift-D', 'mac');

    $(EditorManager).on('activeEditorChange', _updateEditorListener);
    $(EditorManager.getCurrentFullEditor()).on('keyEvent', handleTab);
});
