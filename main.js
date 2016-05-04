/* @flow */
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
    var DocumentManager     = brackets.getModule('document/DocumentManager');
    var JSUtils             = brackets.getModule("language/JSUtils");
    var KeyBindingManager   = brackets.getModule('command/KeyBindingManager');
    var Menus               = brackets.getModule('command/Menus');
    var Dialogs				= brackets.getModule('widgets/Dialogs');
    var PreferencesManager	= brackets.getModule('preferences/PreferencesManager');
    var Menus          		= brackets.getModule("command/Menus");
    var MainViewManager		= brackets.getModule("view/MainViewManager");
    var ExtensionUtils		= brackets.getModule('utils/ExtensionUtils');

    var prefDialogHTML		= require('text!dialog/prefs.html');

    var allDefinitions 		= {
         default: 		require('text!definitions/default.json'),
         javascript: 	require('text!definitions/js.json'),
         jsx:		 	require('text!definitions/js.json'), // use the js file
         php: 			require('text!definitions/php.json')
    }
    var definitions;

    ExtensionUtils.loadStyleSheet(module, 'dialog/css/prefs.css');


    var COMMAND_ID          = 'funcdocr';
    var COMMAND_ID_SETTINGS = 'funcdocr.settings';

    var PREDEFINED_FUNCTIONS = ['if','switch','for','foreach','while'];
    
    var BEFORE_FUNCTION_STARTS =  /[\t ]*/;
    var ONLY_ONE_LINEBREAK = /[\t ]*\s??[\t ]*/;

    var FUNCTION_FORM_VAR 	= /(?:var)?\s*[A-Za-z\$\_][A-Za-z\$\_0-9]*\s*=/; // var stuff =
    var FUNCTION_FORM_OBJ 	= /(?:[A-Za-z\$\_][A-Za-z\$\_0-9]*\.)+(?:prototype\.)?[A-Za-z\$\_][A-Za-z\$\_0-9]*\s*=/; // abc.stuff =
    var FUNCTION_FORM_CLASS	= /[A-Za-z\$\_][A-Za-z\$\_0-9]*:/; // sayName:
    var FUNCTION_PS			= /(?:export\s+(?:default|const)?)?(?:(?:(?:(?:public )?(?:static )?|private (?:static )?|protected (?:static ))|(?:(?:static )?public |(?:static )?private |(?:static )?protected))[\t ]*\s??[\t ]*)/;
    
    var FUNCTION_ES6_66 = /^\s*[(]?(\s*|(?:\s*[A-Za-z\$\_][A-Za-z\$\_\.0-9]*,?)+)[)]?\s*?=>\s*\{/;
    
    var FUNCTION_FORM_VAR_PLUS_NAME 	= /(?:var)?\s*([A-Za-z\$\_][A-Za-z\$\_0-9]*)\s*=/; // var stuff =
    var FUNCTION_FORM_OBJ_PLUS_NAME 	= /(?:[A-Za-z\$\_][A-Za-z\$\_0-9]*\.)+(?:prototype\.)?([A-Za-z\$\_][A-Za-z\$\_0-9]*)\s*=/; // abc.stuff =
    var FUNCTION_FORM_CLASS_PLUS_NAME	= /([A-Za-z\$\_][A-Za-z\$\_0-9]*):/; // sayName:
    
    var FUNCTION_ES6_66_PLUS_NAME = /^\s*[(]?(\s*|(?:\s*([A-Za-z\$\_][A-Za-z\$\_\.0-9]*),?)+)[)]?\s*?=>\s*\{/;
    
    var FUNCTION_FORM_ES6 = new RegExp(
        FUNCTION_FORM_VAR.source+FUNCTION_ES6_66.source+ONLY_ONE_LINEBREAK.source
    );
    
    var FUNCTION_FORM_VAR_COMPLETE = new RegExp(
        FUNCTION_FORM_VAR.source+FUNCTION_PS.source+'?'+ONLY_ONE_LINEBREAK.source
    );
    
    var FUNCTION_FORM_OBJ_COMPLETE = new RegExp(
        FUNCTION_FORM_OBJ.source+FUNCTION_PS.source+'?'+ONLY_ONE_LINEBREAK.source
    );
    
    var FUNCTION_FORM_CLASS_COMPLETE = new RegExp(
        FUNCTION_FORM_CLASS.source+FUNCTION_PS.source+'?'+ONLY_ONE_LINEBREAK.source
    );
    
    var FUNCTION_FORM_ES6_PLUS_NAME = new RegExp(
        FUNCTION_FORM_VAR_PLUS_NAME.source+FUNCTION_ES6_66_PLUS_NAME.source+ONLY_ONE_LINEBREAK.source
    );
    
    var FUNCTION_FORM_VAR_COMPLETE_PLUS_NAME = new RegExp(
        FUNCTION_FORM_VAR_PLUS_NAME.source+FUNCTION_PS.source+'?'+ONLY_ONE_LINEBREAK.source
    );
    
    var FUNCTION_FORM_OBJ_COMPLETE_PLUS_NAME = new RegExp(
        FUNCTION_FORM_OBJ_PLUS_NAME.source+FUNCTION_PS.source+'?'+ONLY_ONE_LINEBREAK.source
    );
    
    var FUNCTION_FORM_CLASS_COMPLETE_PLUS_NAME = new RegExp(
        FUNCTION_FORM_CLASS_PLUS_NAME.source+FUNCTION_PS.source+'?'+ONLY_ONE_LINEBREAK.source
    );
    
    var FUNCTION_FORM_NORMAL = new RegExp(
        FUNCTION_PS.source+'?(?:function\\*?\\s+)?(?:[A-Za-z\\$\\_][A-Za-z\\$\\_0-9]*)'
    );
        
    var FUNCTION_FORM_NORMAL_PLUS = new RegExp(
        FUNCTION_PS.source+'?(?:[A-Za-z\\$\\_][A-Za-z\\$\\_0-9]*):\\s+(?:function\\*?\\s+)?(?:[A-Za-z\\$\\_][A-Za-z\\$\\_0-9]*)'
    );
    
    var FUNCTION_FORM_NORMAL_PLUS_NAME = new RegExp(
        FUNCTION_PS.source+'?(?:function\\*?\\s+)?([A-Za-z\\$\\_][A-Za-z\\$\\_0-9]*)'
    );
        
    var FUNCTION_FORM_NORMAL_PLUS_PLUS_NAME = new RegExp(
        FUNCTION_PS.source+'?(?:[A-Za-z\\$\\_][A-Za-z\\$\\_0-9]*):\\s+(?:function\\*?\\s+)?([A-Za-z\\$\\_][A-Za-z\\$\\_0-9]*)'
    );
    
    
    var FUNCTION_NAME = /(?:\s+(?:[A-Za-z\$\_][A-Za-z\$\_0-9]*))/;
    
        
    var FUNCTION_WO_PARAM   = new RegExp('^'+BEFORE_FUNCTION_STARTS.source+'(?:(?:'+FUNCTION_FORM_NORMAL.source+'|'+FUNCTION_FORM_NORMAL_PLUS.source+'|'+FUNCTION_FORM_VAR_COMPLETE.source+'function\\*?|'+FUNCTION_FORM_OBJ_COMPLETE.source+'function\\*?'+FUNCTION_NAME.source+'?|'+FUNCTION_FORM_CLASS_COMPLETE.source+'function\\*?)'+ONLY_ONE_LINEBREAK.source+')');

    var FUNCTION_WO_PARAM_PLUS_NAME   = new RegExp('^'+BEFORE_FUNCTION_STARTS.source+'(?:(?:'+FUNCTION_FORM_NORMAL_PLUS_NAME.source+'|'+FUNCTION_FORM_NORMAL_PLUS_PLUS_NAME.source+'|'+FUNCTION_FORM_VAR_COMPLETE_PLUS_NAME.source+'function\\*?|'+FUNCTION_FORM_OBJ_COMPLETE_PLUS_NAME.source+'function\\*?'+FUNCTION_NAME.source+'?|'+FUNCTION_FORM_CLASS_COMPLETE_PLUS_NAME.source+'function\\*?)'+ONLY_ONE_LINEBREAK.source+')');
        
    var DEEP_FUNCTION_CHECK	= new RegExp(BEFORE_FUNCTION_STARTS.source+'([A-Za-z\\$\\_][A-Za-z\\$\\_0-9]*)');

    var FUNCTION_PARAM         = /\s*\(([^{};]*)\)\s*\{/; // will be validated in checkIfFunction
    var FUNCTION_REGEXP		= new RegExp(FUNCTION_WO_PARAM.source+FUNCTION_PARAM.source+'|'+FUNCTION_FORM_ES6.source);
    var FUNCTION_REGEXP_PLUS_NAME	= new RegExp(FUNCTION_WO_PARAM_PLUS_NAME.source+FUNCTION_PARAM.source+'|'+FUNCTION_FORM_ES6_PLUS_NAME.source);
    var FUNCTION_REGEXP_EXTRA_MATCHES = new RegExp(FUNCTION_WO_PARAM.source+'('+FUNCTION_PARAM.source+')');
    var FUNCTION_REGEXP_EXTRA_MATCHES_PLUS_NAME = new RegExp(FUNCTION_WO_PARAM_PLUS_NAME.source+'('+FUNCTION_PARAM.source+')');

    console.log(FUNCTION_REGEXP);
    
    var INDENTATION_REGEXP  = /^([\t\ ]*)/;

    var DOCBLOCK_BOUNDARY   = /[A-Za-z\[\]]/;
    var DOCBLOCK_START      = /^\s*\/\*\*/;
    var DOCBLOCK_MIDDLE     = /^\s*\*/;
    var DOCBLOCK_MIDDLE_EMPTY = /^\s*\*$/;
    var DOCBLOCK_END        = /^\s*\*\//;
    var DOCBLOCK_FIELD      = /(\[\[[^\]]+\]\])/;
    var DOCBLOCK_LAST_FIELD = /.*(\[\[[^\]]+\]\])/;
    var DOCBLOCK_PAR_LINE 	= /(\s+\*\s+@param\s+)([^ ]+\s+)([^ ]+\s+)(.*)/;
    var DOCBLOCK_RET_LINE 	= /(\s+\*\s+@returns?\s+)([^ ]+\s+)/;
    var DOCBLOCK_AT_LINE 	= /(\s+\*\s+@([a-zA-Z]*)\s+)([^ ]+\s*)/;
    var DOCBLOCK_MULTI_LINE = /^(\s*)(\*)(\s+)/;

    var TYPEOF_LONG 		= /^if\s*\(\s*typeof\s*(.*?)===?\s+["']undefined["']\s*\)\s*\{?\s*(.*?)=(.*)/;
    var TYPEOF_SHORT		= /^(.*?)\s*=\s*\(\s*typeof\s*(.*?)([!=])==?\s+["']undefined["']\s*\)?\s*\?(.*?):(.*)/;
    var TYPEOF_TRUE_SHORT	= /(\S+)\s*=\s*\(\s*typeof\s*(.*?)===?\s+["']undefined["']\s*\)\s*\|\|\s*(\S+)/;
    var OR_DEFAULT			= /(\S+)\s*=\s*(\S+)\s*\|\|\s*(\S+)/;

    var SHORTCUT_REGEX		= /^((Cmd|Ctrl|Alt|Shift)-){1,3}\S$/i;

    // reactjs
    var REACTJS_FUNCTION    = new RegExp('^\\s*'+FUNCTION_FORM_VAR.source+'\\s*React\\.createClass\\(\\{');
    var REACTJS_PROPS	    = /[^a-zA-Z0-9]this\.props\.([a-zA-Z_$][0-9a-zA-Z_$]*)/g;


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
        'jsx'   : ['{', '}'],
        'javascript'   : ['{', '}'],
        'coffeescript' : ['{', '}'],
        'livescript'   : ['{', '}'],
        'php'          : ['', '']
    };
    var SUPPORTED_LANGS  = Object.keys(PARAM_WRAPPERS);

    var _prefs = PreferencesManager.getExtensionPrefs('funcdocr');
    _prefs.definePreference('shortcut', 'string', 'Ctrl-Alt-D');
    _prefs.definePreference('shortcutMac', 'string', 'Ctrl-Shift-D');
    _prefs.definePreference('autoindent_enter', 'boolean', true);
    _prefs.definePreference('autoindent_tab', 'boolean', true);
    _prefs.definePreference('author_auto', 'boolean', true);
    _prefs.definePreference('atName', 'string', '');

    var existingKeyBindings;

    var langId;
    var hintOpen = false; // hintManager not open

    
    // =========================================================================
    // Doc Block Generation
    // =========================================================================

    /**
     * Handle the shortcut to create a doc block
     */
    function handleDocBlock() {
        var editor      = EditorManager.getCurrentFullEditor();
        langId  		= editor.getLanguageForSelection().getId();

        if (SUPPORTED_LANGS.indexOf(langId) < 0) {
            return;
        }
        var signatureObj = getFunctionSignature();
        if (signatureObj) {
            insertDocBlock(generateDocBlock(signatureObj));
        } else {
            return;   
        }
    }

    /**
     * Get the signature of the currently selected function
     * @returns {Object} [.description],[.parameter],[.returns]
     */
    function getFunctionSignature() {
        var editor      = EditorManager.getCurrentFullEditor();
        var position    = editor.getCursorPos();
        var document    = editor.document;
        var lineBefore  = document.getLine(position.line-1);
        var code 		= editor.document.getRange({ch:0,line:position.line},{ch:0,line:editor.lineCount()});
        
        var docExists   = DOCBLOCK_END.test(lineBefore) ? true : false;
        
        var matches     = FUNCTION_REGEXP.exec(code);
        
        if (!matches) {
            return null;   
        }
        
        if (!matches[1]) {
            matches.splice(1,1); 
        }

        var name_matches     = FUNCTION_REGEXP_PLUS_NAME.exec(code);
        if (!name_matches) {
            return null;   
        }
        var funcName;
        if (name_matches[1]) {
            funcName = name_matches[1];
        } else if (name_matches[2]) {
            funcName = name_matches[2];
        } else if (name_matches[3]) {
            funcName = name_matches[3];
        } else if (name_matches[4]) {
            funcName = name_matches[4];
        } else if (name_matches[5]) {
            funcName = name_matches[5];
        }
        
        var signature   = {};
        // defaults
        signature.indentation = INDENTATION_REGEXP.exec(code)[0];
        signature.parameters  = [];
        signature.returns = {bool: false};

        if (!matches) {
            // try other function types
            signature = getReactSignature(signature,editor,position,code);
        } else {
            signature = getNormalSignature(signature,editor,position,matches);
        }
        if (!signature) {
            return null;
        }

        if (!deepFunctionCheck(matches)) {
            return null;   
        }
        
        if (docExists) { // try to update the doc block (parameter added or deleted)
            var doc = getExistingDocSignature(document,position);
            var docStartLine = doc.startLine;
            var docSignature = doc.signature;

            // merge the docSignature into signature
            if (docSignature.description != '') {
                signature.description = docSignature.description;
            }
            var docSigKeys = Object.keys(docSignature);
            for(var k = 0; k < docSigKeys.length; k++) {
                if (docSigKeys[k] !== 'returns' && docSigKeys[k] !== 'parameters') {
                    signature[docSigKeys[k]] = docSignature[docSigKeys[k]];
                }
            }
            
            for (var i = 0; i < docSignature.parameters.length; i++) {
                var paramIndex = keyIndexOf(signature.parameters,'name',docSignature.parameters[i].name);
                if (paramIndex >= 0) {
                    if (signature.parameters[paramIndex].optional && signature.parameters[paramIndex].default !== false) {
                        signature.parameters[paramIndex].description = docSignature.parameters[i].description;
                        signature.parameters[paramIndex].type		 = docSignature.parameters[i].type;
                    } else {
                        signature.parameters[paramIndex] = docSignature.parameters[i];
                    }
                }
            }
            if (signature.returns.bool) {
                if (docSignature.returns.bool) {
                    if (docSignature.returns.type == '[[Type]]') {
                        signature.returns.description = docSignature.returns.description;
                    } else {
                        signature.returns = docSignature.returns;
                    }
                }
                signature.returns.bool = true;
            }
        }
        return {signature: signature, funcName: funcName, docExists: docExists ? {start: docStartLine, end: position.line} : false };
    }

    function getNormalSignature(signature,editor,position,matches) {
        var parameters 	= specialSplitComma(matches[1]);

        for (var i = 0; i < parameters.length; ++i) {
            var name = parameters[i].trim();

            if (name) {
                signature.parameters.push({name:name,title:name});
            }
        }		

        // get the function code and returns (Object)
        var codeTypes = getFunctionCodeTypes(editor,position,signature.parameters);
        if (codeTypes) {
            console.log('throw throws: ',codeTypes.throws);
            signature.throws = codeTypes.throws;
            
            signature.returns = codeTypes.returns;
            for (var i = 0; i < codeTypes.paramTypes.length; i++) { // add the paramTypes to signature.parameters
                signature.parameters[i].type = codeTypes.paramTypes[i];
            }
            if (signature.parameters.length > 0) {
                // check if parameters are optional (default values)
                signature.parameters = $.extend([],signature.parameters,checkParamsOptional(codeTypes.code,signature.parameters));
            }
        }
        return signature;
    }

    function getReactSignature(signature,editor,position,currentLine) {
        var matches     = REACTJS_FUNCTION.exec(currentLine);		
        if (!matches) {
            return false;
        }

        // get the props as parameters
        var codeTypes = getFunctionCodeTypes(editor,position,signature.parameters);

        var props;
        var aProps 		= [];
        var paramNames  = [];
        while ((props = REACTJS_PROPS.exec(codeTypes.code)) !== null) {
            if (aProps.indexOf(props[1]) < 0) {
                signature.parameters.push({name:props[1], title: props[1]});
                aProps.push(props[1]);
                paramNames.push({name:'this.props.'+props[1]});
            }
        }
        var codeTypes = getFunctionCodeTypes(editor,position,paramNames);
        if (codeTypes) {
            signature.returns = codeTypes.returns;
            for (var i = 0; i < codeTypes.paramTypes.length; i++) { // add the paramTypes to signature.parameters
                signature.parameters[i].type = codeTypes.paramTypes[i];
            }
        }
        signature.returns = {bool: true, type: "HTML"};
        return signature;
    }

    /**
     * Get the existing doc tags
     * uses {@link getCurrentDocTags getCurrentDocTags}
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

        var commentTags = lines.join('\n').split(/[\n]\s*@/);

        tags.description = commentTags[0]; // the first (without @ is the description/summary)
        
        var t = 1;
        if (commentTags.length == 1) {
            tags.returns = {bool: false};
        }
        


        var params = [];
        // start with the index directly after the description ends
        for (var i = t; i < commentTags.length; i++) {
            // get params
            if (commentTags[i].substr(0,5) === 'param') {
                var param_parts = commentTags[i].split(/(\s)+/);

                var param = {};
                // get the split delimiters
                var delimiters = param_parts.filter(function(v,i) { return ((i % 2) === 1); });
                param_parts = param_parts.filter(function(v,i) { return ((i % 2 === 0)); });
                
                // if the variable is optional it will start with '[' and there might be '=' inside the '['
                // => change param_parts so that param_parts[2] is the "name" starting with '[' and ending with ']'
                if (param_parts[2].charAt(0) == '[') {
                    while (param_parts.length >= 4) {
                        if (param_parts[2].charAt(param_parts[2].length-1) == ']') {
                            break;   
                        }
                        param_parts[2]+=delimiters[3]+param_parts[3];
                        param_parts.splice(3,1);
                        delimiters.splice(3,1);
                    }
                }
                    
                // 0 = param, [1 = type], 2 = title 3- = description
                switch(langId) {
                    case "jsx":
                    case "javascript":
                    case "coffeescript":
                    case "livescript":
                        if (param_parts[1].charAt(0) != '{') {
                            param_parts.splice(1,0,false);  // add the type false
                            delimiters.splice(1,0,'');  // no delimuter
                            param.type = false;
                        } else {
                            // get the correct ending }
                            for (var p = 1; p < param_parts.length; p++) {
                                if (param_parts[p].slice(-1) == '}') {
                                    break;
                                }
                            }
                            var type = param_parts[1];
                            for (var t = 2; t <= p; t++) {
                                type += delimiters[t-1] + param_parts[t];
                            }
                            param.type = type.substring(1,type.length-1); // remove { }
                            // delete mulitline parts from type so param_parts[2] is the title
                            param_parts.splice(2,p-1);
                            delimiters.splice(2,p-1); // and remove the delimiters
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
                param.name		= param_parts[2];
                param.title 	= param_parts[2];
                param.optional 	= false;
                if (param.name.charAt(0) == '[' && param.name.charAt(param.name.length-1) == ']') {
                    // remove '[' beginning and ']' at the end
                    param.name = param.name.substr(1,param.name.length-2);
                    var split = param.name.split('=');
                    param.name = split[0];
                    param.optional = true;
                    if (split.length > 1) {
                        param.default = split[1];
                    }
                }
                param.description   = param_parts[3];
                for (var j = 4; j < param_parts.length; j++) {
                    param.description += delimiters[j-1] + param_parts[j];
                }
                param.description = (typeof param.description === "undefined") ? '' : param.description;
                params.push(param);
            }
            // get all other specified tags (not param/return) 
            if (commentTags[i].substr(0,6) !== 'return' && commentTags[i].substr(0,5) !== 'param') {
                var currentTag;
                if (commentTags[i].indexOf(' ') < 0) {
                    currentTag = commentTags[i];
                } else {
                    currentTag = commentTags[i].substr(0,commentTags[i].indexOf(' '));
                }
                var tabs = getTabsForATag(currentTag);
                var tagRegex = getRegexForATag(currentTag);
                var tagTabsMatches = tagRegex.exec('@'+commentTags[i]);
                if (!(currentTag in tags)) {
                    tags[currentTag] = [];
                }
                var tagTabObj = {};
                for (var tt = 1; tt < tagTabsMatches.length; tt++) {
                    tagTabObj[tabs[tt-1]] = tagTabsMatches[tt].trim();   
                }
                tags[currentTag].push(tagTabObj);
            }
            
            
            

            if (commentTags[i].substr(0,6) === 'return') {
                if (commentTags[i].substr(0,7) === 'returns') {
                    var  return_tag = commentTags[i].substr(7).trim(); // delete returns and trim
                } else {
                    var  return_tag = commentTags[i].substr(6).trim(); // delete return and trim
                }
                if(return_tag.charAt(0) == '{') {
                    // get the correct end Curly
                    var bracketCount = 1;
                    for (var t = 1; t < return_tag.length; t++) {
                        if (return_tag.charAt(t) == '{') bracketCount++;
                        else if (return_tag.charAt(t) == '}') bracketCount--;
                        if (bracketCount === 0) break;
                    }
                    var endCurly = t;
                    tags.returns = {description: return_tag.substr(endCurly+1).trim(),type:return_tag.substring(1,endCurly).replace(/[ \n]*$/,'')};
                }else {
                    var firstSpace = return_tag.indexOf(' ');
                    tags.returns = {type: (firstSpace >= 0) ? return_tag.substr(0,firstSpace) : return_tag.substr(0),
                                    description: return_tag.substr(firstSpace+1).trim()};
                }
                tags.returns.bool = true;
                break; // no @ after return[s]
            } else {
                tags.returns = {bool: false};
            }
        }
        tags.parameters = params;
        return tags;
    }

    /**
     * Generate the doc block for a function signature
     * @param   {Object} signature: .description,.parameter,.returns, docExists: false|Object
     * @returns {String} the doc block with the correct indentation
     */
    function generateDocBlock(signatureObj) {
        var signature = signatureObj.signature;
        if (!signature) {
            return null;
        }
        
        
        var editor  = EditorManager.getCurrentFullEditor();
        var wrapper = PARAM_WRAPPERS[langId];

        var output = ['/**'];

        // add description
        signature.description = "description" in signature ? signature.description.split(/\n/) : ['[[Description]]'];
        for (var d = 0; d < signature.description.length; d++) {
            output.push(' * '+signature.description[d]);
        }

        var author = _prefs.get('atName');
        var authors = [];
        if ("author" in signature) {
            for (var i = 0; i < signature.author.length; i++) {
                authors.push(signature.author[i].author);   
            }
        }
        if (!("private" in signature) && signatureObj.funcName.charAt(0) == "_") {
            output.push(' * @private');    
        }
        if (_prefs.get('author_auto') && author != '' && 
            (authors.length == 0 || authors.indexOf(author) < 0)) {
            output.push(' * @author '+author);    
        }
        
        // Determine the longest parameter and the longest type so we can right-pad them
        var maxPadding = getMaxPadding(signature);
        var maxTypeLength = maxPadding[1];
        var maxParamLength = maxPadding[2];

        // returns or return
        var returnDocName = 'returns';
        if (langId == 'php') {
            returnDocName = 'return';
        }

        // if returns is set show align the types of params and returns
        var tagRightSpace = signature.returns.bool ? times(' ',returnDocName.length-'param'.length+1) : ' ';

        var sigKeys = Object.keys(signature);
        
        for (var sk = 0; sk < sigKeys.length; sk++) {
            var sigKey = sigKeys[sk];
            if (sigKey !== 'parameters' && sigKey !== 'returns' && sigKey !== 'indentation' && sigKey !== 'description') {
                for (var ski = 0; ski < signature[sigKey].length; ski++) {
                    var cTag = signature[sigKey][ski];
                    var tagDef = getTagDef(sigKey);
                    if (!tagDef) {
                        break;
                    }
                    var outputLine = tagDef.replace(/\[\[([a-zA-Z]*)\]\]/g,function(match,p1) {
                        if (p1.toLowerCase() in cTag) {
                            return cTag[p1.toLowerCase()];
                        } else {
                            return '[['+p1+']]';
                        }
                    });
                    
                    
                    if ("description" in signature[sigKey][ski]) {
                        var tagRegex = getRegexForATag(sigKey);
                        var tagTabsMatches = tagRegex.exec(outputLine);
                        var length = outputLine.length - tagTabsMatches[tagTabsMatches.length-1].length; 
                        outputLine = outputLine.replace(/\n/g, function(match) {
                            return '\n * '+times(' ',length);
                        });
                    }
                    output.push(' * '+ outputLine);
                }
            }
        }
        
        
        
        // Add the parameter lines
        for (var i = 0; i < signature.parameters.length; i++) {
            var parameter = signature.parameters[i];

            parameter.description 	= parameter.description	? parameter.description.split(/\n/) : ['[[Description]]'];

            // get the right spaces for title and type
            parameter.titleRightSpace	= new Array(maxParamLength + 2 - parameter.title.length).join(' ');

             // singleline
            if (parameter.type.length == 1) {
                parameter.typeRightSpace 	= new Array(maxTypeLength + 2 - parameter.type[0].length).join(' ');
                output.push(' * @param'+ tagRightSpace + wrapper[0] + parameter.type[0] + wrapper[1] +
                            parameter.typeRightSpace + parameter.title + parameter.titleRightSpace +parameter.description[0]);
            } else { // multiline
                output.push(' * @param' + tagRightSpace + wrapper[0]);
                parameter.typeIndent = new Array(output[output.length-1].length-3).join(' ');
                for (var t = 0; t < parameter.type.length; t++) {
                    output.push(' *   ' + parameter.typeIndent + parameter.type[t]);
                }
                parameter.typeRightSpace 	= new Array(maxTypeLength+2).join(' ');
                output.push(' * ' + parameter.typeIndent + wrapper[1] +
                            parameter.typeRightSpace + parameter.title + parameter.titleRightSpace +parameter.description[0]);
            }
            parameter.descriptionIndent = new Array(output[output.length-1].length-2-parameter.description[0].length).join(' ');
            for (var d = 1; d < parameter.description.length; d++) {
                output.push(' * ' + parameter.descriptionIndent + parameter.description[d]);
            }
        }

        // Add the return line
        if (signature.returns.bool) {
            signature.returns.description = signature.returns.description ? signature.returns.description.split(/\n/) : ['[[Description]]'];



            // singleline
            if (signature.returns.type.length == 1) {
                signature.returns.typeRightSpace = new Array(maxTypeLength + 2 - signature.returns.type[0].length).join(' ');
                output.push(' * @' + returnDocName + ' ' + wrapper[0] + signature.returns.type[0] + wrapper[1] +
                            signature.returns.typeRightSpace + signature.returns.description[0]);
                signature.returns.descriptionIndent = new Array(output[output.length-1].length-2-signature.returns.description[0].length).join(' ');
            } else { // multiline
                output.push(' * @' + returnDocName + ' ' + wrapper[0]);
                signature.returns.typeIndent = new Array(output[output.length-1].length-3).join(' ');
                for (var t = 0; t < signature.returns.type.length; t++) {
                    output.push(' *   ' + signature.returns.typeIndent + signature.returns.type[t]);
                }
                output.push(' * ' + signature.returns.typeIndent + wrapper[1]);
                signature.returns.descriptionIndent = '';
                output.push(' * ' + signature.returns.descriptionIndent + signature.returns.description[0]);
            }

            for (var d = 1; d < signature.returns.description.length; d++) {
                output.push(' * ' + signature.returns.descriptionIndent + signature.returns.description[d]);
            }
        }

        output.push(' */');
        return {signature: signature.indentation + output.join('\n' + signature.indentation) + '\n', docExists: signatureObj.docExists};
    }

    /**
     * Get the maximum padding for param types and titles
     * @param   {Object} signature .parameters,.returns
     * @returns {Array}  0: maximum length of @... , 1: maximum of first [[]] etc
     */
    function getMaxPadding(signature) {
        var result = [];
        var maxParamLength = 0;
        var maxTypeLength = 0;
        
        for (var i = 0; i < signature.parameters.length; i++) {
            var parameter 	= signature.parameters[i]; // parameter changes => signature changes
            parameter.type 	= parameter.type ? parameter.type.trim().split(/\n/) : ['[[Type]]'];

            if (parameter.title.length > maxParamLength) {
                maxParamLength = parameter.title.length;
            }

            // check every line
            for (var p = 0; p < parameter.type.length; p++) {
                if (parameter.type[p].length > maxTypeLength) {
                    maxTypeLength = parameter.type[p].length;
                }
            }
        }

        if (signature.returns.bool) {
            signature.returns.type 	= signature.returns.type ? signature.returns.type.trim().split(/\n/) : ['[[Type]]'];
            // check every line
            for (var p = 0; p < signature.returns.type.length; p++) {
                if (signature.returns.type[p].length > maxTypeLength) {
                    maxTypeLength = signature.returns.type[p].length;
                }
            }
        }
        return [8,maxTypeLength,maxParamLength];
    }


    function insertDocBlock(docBlockObj) {
        var docBlock = docBlockObj.signature;
        if (!docBlock) {
            return;
        }

        var editor   = EditorManager.getCurrentFullEditor();
        var docExists = docBlockObj.docExists;
        if (docExists) {
            var doc = DocumentManager.getCurrentDocument();
            doc.batchOperation(function () {
                editor._codeMirror.replaceRange('', {ch: 0, line: docExists.start}, {ch: 0, line: docExists.end});
                var position = editor.getCursorPos();
                position.ch  = 0;
                editor._codeMirror.replaceRange(docBlock, position);
            });
        } else {
            var position = editor.getCursorPos();
            position.ch  = 0;
            editor._codeMirror.replaceRange(docBlock, position);
        }



        

        // Start at the first line, just before [[Description]]
        var lines         = docBlock.split('\n');
        var endPosition   = editor.getCursorPos();
        var startPosition = Object.create(endPosition);
        startPosition.line -= lines.length - 2;
        startPosition.ch    = lines[0].length;

        // jump to te first [[Tag]]
        var docBlockPos = {
            start: 	startPosition.line-1,
            end:	endPosition.line-1
        };
        var nextField = getNextField({start:startPosition,end:startPosition},false,docBlockPos);

        if (nextField) {
            setSelection(editor,nextField[0],nextField[1]);
        }

        MainViewManager.focusActivePane();
    }
    
    // =========================================================================
    // Click Handling
    // =========================================================================
    
    /**
     * Handle the click event, allowing selecting of fields within doc block
     * @param {Object} event click event
     */
    function handleClick(event) {
        var editor  = EditorManager.getCurrentFullEditor();
        langId  	= editor.getLanguageForSelection().getId();
        var selection = editor.getSelection();
        if (event.type === 'dblclick') {
            var docBlockPos = insideDocBlock(getPosition(selection,false));
            handleDoubleClick(editor, event, docBlockPos);
        }
    }

    // =========================================================================
    // Key Handling (Enter,Tab)
    // =========================================================================

    /**
     * Handle the key Event jump to handleEnter,handleTab (inside a doc block)
     * or generate a docblock if the currentLine is /** or do nothing
     * @param {Object} event key event
     */
    function handleKey(event) {
        var editor  = EditorManager.getCurrentFullEditor();
        langId  	= editor.getLanguageForSelection().getId();

        if (SUPPORTED_LANGS.indexOf(langId) < 0) {
            return;
        }
        var selection = editor.getSelection();
        var backward  = event.shiftKey;
        if ((event.type === 'keydown' && event.keyCode === KeyEvent.DOM_VK_TAB) ||
            (event.type === 'keyup' && (event.keyCode === KeyEvent.DOM_VK_RETURN ||
                                        event.keyCode === KeyEvent.DOM_VK_BACK_SPACE))) {
            var docBlockPos = insideDocBlock(getPosition(selection,backward));
            if (docBlockPos && event.keyCode === KeyEvent.DOM_VK_TAB) {
                handleTab(editor,event,docBlockPos);
            } else if (event.keyCode === KeyEvent.DOM_VK_RETURN && !hintOpen) {	// no docBlock needed (check it later)
                // Check for /** in the current line
                var currentLineNr = editor.getCursorPos().line;
                // line - 1 because this triggers after the enter
                var lastLine 	  = editor.document.getLine(currentLineNr-1);
                var nextLine 	  = editor.document.getLine(currentLineNr+1);

                // last part (the OR) is for the reasonable comments extension by Peter Flynn
                if (DOCBLOCK_START.test(lastLine) && (!DOCBLOCK_MIDDLE.test(nextLine) || DOCBLOCK_END.test(nextLine))) {
                    // currentLine is empty or *
                    var currentLine = editor.document.getLine(currentLineNr);
                    var code 		= editor.document.getRange({ch:0,line:currentLineNr+1},{ch:0,line:editor.lineCount()});
                    var func_matches= checkIfFunction(code);
                    if (func_matches !== false || REACTJS_FUNCTION.test(code)) {
                        if (deepFunctionCheck(func_matches)) {
                            editor.setCursorPos(currentLineNr+1,0);
                            // delete /** and the next empty row
                            editor.document.replaceRange(
                                '',
                                {line:currentLineNr-1,ch:0},
                                {line:currentLineNr+1,ch:0}
                            );
                            handleDocBlock();
                        }
                    } else { // for reasonable comments by Peter Flynn
                        var nextLine = editor.document.getLine(currentLineNr+1);
                        var code 	 = editor.document.getRange({ch:0,line:currentLineNr+2},{ch:0,line:editor.lineCount()});
                        if (currentLine.trim() == '*' && nextLine.trim() == '*/') {
                            var func_matches= checkIfFunction(code);
                            if (func_matches !== false || REACTJS_FUNCTION.test(code)) {
                                if (deepFunctionCheck(func_matches)) {
                                    editor.setCursorPos(currentLineNr+2,0);
                                    handleDocBlock();
                                }
                            }
                        }
                    }
                } else {
                    handleEnter(editor);
                }
            } else if (event.keyCode === KeyEvent.DOM_VK_BACK_SPACE && !hintOpen) {
                // Handle backspace of entire line, keeping cursor within doc block
                var currentLineNr = editor.getCursorPos().line;
                var currentLine = editor.document.getLine(currentLineNr);

                // Using DOCBLOCK_MIDDLE_EMPTY, because we only want to remove lines
                // that are empty.
                if (DOCBLOCK_MIDDLE_EMPTY.test(currentLine)) {
                    var lastLine = editor.document.getLine(currentLineNr-1);
                    editor.document.replaceRange(
                            '',
                            {line:currentLineNr,ch:0},
                            {line:currentLineNr+1,ch:0}
                        );
                    editor.setCursorPos(currentLineNr-1, lastLine.length);
                }
            }

        }
        hintOpen = CodeHintManager.isOpen();
    }
    
    /**
     * Check if the curent line is really a function
     * @param   {String}        line the maybe function line
     * @returns {Array|Boolean} false if no function otherwise the a regexp array (FUNCTION_REGEXP)
     */
    function checkIfFunction(line) {
        var result      = FUNCTION_REGEXP_EXTRA_MATCHES.exec(line); 
        if (!result) {
            result      = FUNCTION_REGEXP.exec(line); 
            if (!result || result.length < 3 || result[2] === false) {
                return false; 
            }
        } else {
            if (result.length < 3 || result[2] === false) {
                return false; 
            }   
        }
        var param = result[2];
        
        var lastI = 0;
        var openStringCh = "";
        var lastStringCh = "";
        var closedBrackets = 0;
        for (var i = 0; i < param.length; i++) {
            if ((param[i] == "'" || param[i] == '"') && openStringCh == "" && lastStringCh != "\\") {
                openStringCh = param[i];   
                lastStringCh = param[i]; 
                continue;
            }        
            if (param[i] == "'" && openStringCh == "'" && lastStringCh != "\\") {
                openStringCh = "";      
            } else if (param[i] == '"' && openStringCh == '"' && lastStringCh != "\\") {
                openStringCh = "";      
            } else if (param[i] == "\\" && lastStringCh != "\\") {
                lastStringCh = "\\";
                continue;
            } else if (param[i] == "\\" && lastStringCh == "\\") {
                lastStringCh = "";
                continue;
            } else if (param[i] == ")" && openStringCh == "") {
                closedBrackets++;
                lastI = i+1;
            }
            lastStringCh = param[i]; 
        }
        if (closedBrackets != 0) {
            return false;        
        }
        return result;
    }

    /**
     * Check if the given match is really a function and not an if or for loop
     * @param   {Array}   matches matches generated with FUNCTION_REGEXP
     * @returns {Boolean} true => is function, false => is no function
     */
    function deepFunctionCheck(matches) {
        if (matches) {
            var func_begin_matches    = DEEP_FUNCTION_CHECK.exec(matches[0]);
            // check for things like if,for,foreach,while...
            if (func_begin_matches) {
                var noFuncs = PREDEFINED_FUNCTIONS;
                if (noFuncs.indexOf(func_begin_matches[1]) >= 0) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * Get the current position based on the selection and backward or not
     * @param   {Object}  selection current selection
     * @param   {Boolean} backward  true => back
     * @returns {Object}  position (.ch,.line)
     */
    function getPosition(selection,backward) {
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
        return position;
    }
    
    /**
     * Finds the word boundary based on current selection, useful to evaluate current selection.
     * @param   {Object}   position
     * @param   {String} Character to find in current line
     * @returns {Object} Updated position
     */
    function getCharacterBoundary(position, char, backwards) {
        if (backwards === undefined) {
            backwards = true;
        }
        var editor    = EditorManager.getCurrentFullEditor();
        var document  = editor.document;

        var currentLine = document.getLine(position.line);
        var boundaryPosition = {};
        $.extend(boundaryPosition, position);

        while (currentLine.charAt(boundaryPosition.ch) !== char) {
            boundaryPosition.ch += backwards ? -1 : 1;

            if (boundaryPosition.ch < 0) {
                boundaryPosition.ch = 0;
                break;
            } else if(boundaryPosition.ch >= currentLine.length) {
                boundaryPosition.ch = currentLine.length - 1;
                break;
            }
        }
        
        return boundaryPosition;
    }

    /**
     * Get the the tabs for a tag
     * @param   {String} tag the name of the tag
     * @returns {Array}  the tabs like description,type 
     */
    function getTabsForATag(tag) {
        var tagDef = getTagDef(tag);
        if (!tagDef) {
            return [];   
        }
        
        var tabs = [];
        var regex = /\[\[([a-z]*)\]\]/gi;
        var counter = 0;
        var tabName;
        while ((tabName = regex.exec(tagDef)) !== null) {
            tabs.push(tabName[1].toLowerCase());
        }
        return tabs;
    }
    
    /**
     * Generate a regex for a tag like /@param \[\[([\S])\]\]/ for @param [[Type]]
     * @param   {String} tag name of the tag
     * @returns {Array}  regex or false if there is no tag inside the definitions/ folder
     */
    function getRegexForATag(tag) {
        var tagDef = getTagDef(tag);
        if (!tagDef) {
            return false;   
        }
        
        var regex = tagDef.replace(/\[\[([a-zA-Z]*)\]\]/g,function(match,p1) {
            if (p1 == 'Type') {
                return '(\\S*)';   
            } else {
                return '([\\S\\s]*)';   
            }
        });
        return RegExp(regex);
    }
    
    /**
     * Get the definition for a tag name using the definitions/ folder 
     * @param   {String}         tag name of the tag
     * @returns {String|Boolean} def or false if non exists
     */
    function getTagDef(tag) {
        var editor  = EditorManager.getCurrentFullEditor();
        langId  	= editor.getLanguageForSelection().getId();
        
        if (allDefinitions[langId] === undefined) {
            definitions = allDefinitions.default;
        } else {
            definitions = allDefinitions[langId];
        }

        var tags = definitions.tags;
        if (!(tag in tags)) { 
            return false;
        }
        
        return tags[tag];
    }
    
    // =========================================================================
    // Enter Handling
    // =========================================================================

    /**
     * Handle the enter key when within a doc block
     * @param {editor} editor Brackets editor
     */
    function handleEnter(editor,abc,def) {
        var editor  	= EditorManager.getCurrentFullEditor();
        var document 	= editor.document;
        var position	= editor.getCursorPos();
        var lastLine 	= document.getLine(position.line-1); // before enter
        var currentLine = document.getLine(position.line); // after enter
        if (_prefs.get('autoindent_enter')) {
            enterAfter(editor,lastLine,currentLine,position);
        }
    }

    /**
     * Insert * in the line after line and padding
     * @param {Object} editor      brackets editor
     * @param {String} lastLine    line before enter
     * @param {String} currentLine line after enter
     * @param {Object} position    current position
     */
    function enterAfter(editor,lastLine,currentLine,position) {
        if (DOCBLOCK_MIDDLE.test(lastLine) || DOCBLOCK_START.test(lastLine)) {
            if (DOCBLOCK_START.test(lastLine)) {
                var replaceMatch = /^(\s*)\/\*\*?/.exec(lastLine);
                var replaceLength = replaceMatch[1].length+2;
                var padding = replaceMatch[1]+' \*';
                editor.document.replaceRange(
                    padding,
                    {line:position.line,ch:0},
                    {line:position.line,ch:replaceLength}
                );
                return;
            }


            // get the correct wrapper ({} for JS or '' for PHP)
            var wrapper 		= PARAM_WRAPPERS[langId];
            var paddingRegex 	= new RegExp('^(\\s+)\\* @(param|returns?)\\s+'+wrapper[0]+'.+'+wrapper[1]+'\\s+([^ ]+\\s+)');
            var paddingRegexElse= new RegExp('^(\\s+)\\* @([a-zA-Z]*)\\s+([^ ]+\\s*)');
            var match 			= paddingRegex.exec(lastLine);
            var length          = false;
            if (!match) {
                match = paddingRegexElse.exec(lastLine);  
                // get the number of tabs for the specified jsDoc tag
                if (match) {
                    /* var tabs = getTabsForATag(match[2]);
                    var nrOfTabs = tabs.length;
                    if (nrOfTabs === 1) {
                        paddingRegexElse= new RegExp('^(\\s+)\\* @[a-zA-Z]*\\s+([^ ]+\\s*)');
                    } else {
                        paddingRegexElse= new RegExp('^(\\s+)\\* @[a-zA-Z]*\\s+([^ ]+\\s+){'+(nrOfTabs-1)+'}([^ ]+\\s*)');
                    }
                    match 			= paddingRegexElse.exec(lastLine);
                    console.log('tabs: ',tabs);*/
                    
                    /// current best version
                    var tagRegex = getRegexForATag(match[2]);
                    if (tagRegex) {
                        var tagTabsMatches = tagRegex.exec(lastLine);
                        length = lastLine.length - tagTabsMatches[tagTabsMatches.length-1].length-1;                    
                    } else {
                        match = false;
                    }
                }
            }
            
//            console.log('match: ',match);

            if (match) {
                if (length === false) {
                    length 		 = match[0].length-match[1].length;
                    // there is no title for @returns
                    if (match.length > 3 && match[2].indexOf('return') == 0) {
                        length -= match[3].length;
                    }
                }
            } else { // for the second enter there is no * @param or @returns
                paddingRegex = new RegExp('^(\\s+)\\*\\s+');
                match 		 = paddingRegex.exec(lastLine);
                if (match) {
                    length 	 = match[0].length-match[1].length;
                }
            }
            if (match) {
                // get the number of characters thats need to be replaced
                var replaceMatch = /^\s*(\*)?\s*/.exec(currentLine);
                var replaceLength = replaceMatch[0].length;
                var padding = match[1]+'\*'+new Array(length).join(' ');
                editor.document.replaceRange(
                    padding,
                    {line:position.line,ch:0},
                    {line:position.line,ch:replaceLength}
                );
            }
        }
    }
    
    // =========================================================================
    // Double click Handling
    // =========================================================================
    
    /**
     * Handle double clicking within a doc block
     * @param {editor} editor      Brackets editor
     * @param {event}  event       keyEvent
     * @param {object} docBlockPos (.start,.end) docBlock line start and end
     */
    function handleDoubleClick(editor, event, docBlockPos) {
        var document = editor.document;
        var selection = editor.getSelection();
        var position = getPosition(selection, false);

        selectField(editor, position);
    } 

    // =========================================================================
    // Tab Handling
    // =========================================================================

    /**
     * Handle the tab key when within a doc block
     * @param {editor} editor      Brackets editor
     * @param {event}  event       keyEvent
     * @param {object} docBlockPos (.start,.end) docBlock line start and end
     */
    function handleTab(editor,event,docBlockPos) {
        var selection = editor.getSelection();
        var backward  = event.shiftKey;
        var document  = editor.document;
        // get current doc block
        var doc 	  = document.getRange({
                            line: docBlockPos.start+1, // without /**
                            ch: 0
                        },{
                            line: docBlockPos.end, // without */
                            ch:0
                        });
        // get doc signature
        var tags = getCurrentDocTags(doc.split('\n'));
        // get the maximum paddings
        var maxPadding = getMaxPadding(tags);
        if (_prefs.get('autoindent_tab')) {
            updatePadding(editor,docBlockPos,tags,maxPadding);
        }

        var nextField = getNextField(selection, backward, docBlockPos);

        if (nextField) {
            setSelection(editor,nextField[0],nextField[1]);
            event.preventDefault();
        }
    }

    /**
     * Update the padding for parameter types and title and return type
     * @param {Object} editor        brackets editor
     * @param {Object} docBlockPos   docBlock position (.start,.end)
     * @param {Object} tags          current doc tags
     * @param {Array}  maxPaddingArr maximum padding see {@link getMaxPadding}
     */
    function updatePadding(editor,docBlockPos,tags,maxPaddingArr) {
        var document = editor.document;
        var maxPadding = [];
        var lastMatch = false;
        maxPadding[0] = maxPaddingArr[1] + PARAM_WRAPPERS[langId][0].length + PARAM_WRAPPERS[langId][1].length+1; // one space
        maxPadding[1] = maxPaddingArr[2] + 1; // one space
        for (var i = docBlockPos.start; i <= docBlockPos.end; i++) {
            var match;
            var line         = document.getLine(i);
            var paramMatch   = DOCBLOCK_PAR_LINE.exec(line);
            var returnMatch  = DOCBLOCK_RET_LINE.exec(line);
            var atMatch      = DOCBLOCK_AT_LINE.exec(line);
            var nrOfPaddings = 2; // for params (for return 1 (no title padding)

            var index             = false;
            var currentPadding    = false;
            var currentMaxPadding = false;
            if ((!paramMatch && !returnMatch) && (atMatch || lastMatch == '@')) {
                // Trello todo: better padding for other @ lines [55bdeafc5ac7da95998cae75]
                lastMatch = '@';
                continue; // don't change the padding for '@' lines at the moment    
            }
            
            
            if ((paramMatch || returnMatch || lastMatch) && !DOCBLOCK_END.test(line)) {
                if (paramMatch) {
                    match = paramMatch;
                    lastMatch = 'param';
                } else if (returnMatch) {
                    match 		 = returnMatch;
                    lastMatch 	 = match[1].indexOf('returns') >= 0 ? 'returns' : 'return';
                    nrOfPaddings = 1;
                } else {
                    nrOfPaddings = 1;
                    match 		 = DOCBLOCK_MULTI_LINE.exec(line);
                    index 		 = match[0].length;

                    currentPadding    = match[3].length;
                    currentMaxPadding = 2+lastMatch.length+1+maxPadding[0]+maxPadding[1]; // 2= ' @' 1 => one space before type
                }
                for (var m = 0; m < nrOfPaddings; m++) {
                    if (!index) {
                      if (m == 0)
                        index = match[1].length + match[2].length;
                      else
                        index = match[1].length + maxPadding[0] + match[3].length;
                    }
                    if (!currentPadding) {
                        currentPadding = match[m+2].length;
                    }
                    if (!currentMaxPadding) {
                        currentMaxPadding = maxPadding[m];
                    }
                    // add padding
                    if (currentPadding < currentMaxPadding) {
                        var addPadding = new Array(currentMaxPadding-currentPadding+1).join(' ');
                        editor._codeMirror.replaceRange(
                            addPadding,{
                                line:i,
                                ch:index
                            }, {
                                line:i,
                                ch:index
                            }
                        );
                    } else if (currentPadding > currentMaxPadding) {
                        // remove padding
                        editor._codeMirror.replaceRange(
                            '',{
                                line:i,
                                ch:index-(currentPadding-currentMaxPadding)
                            }, {
                                line:i,
                                ch:index
                            }
                        );
                    }
                    // reset variables for the next loop pass
                    index 			  = false;
                    currentPadding    = false;
                    currentMaxPadding = false;
                }
            }
        }
    }

    /**
     * Gets the	next tabbable field within the doc block based on the cursor's position
     * @param   {Object}  selection   selected Text position {start<.ch,.line>,end<.ch,.line>}
     * @param   {Boolean} backward    Set to true to search backward
     * @param   {Object}  docBlockPos start and end position of the docBlock
     * @param   {Boolean} stop        Set to true stop looping back around to search again
     * @returns {array}   start position,end position (.ch,.line)
     */
    function getNextField(selection, backward, docBlockPos, stop) {
        var editor    	= EditorManager.getCurrentFullEditor();
        var document 	= editor.document;
        var lineCount 	= editor.lineCount();

        var position	= getPosition(selection,backward);
        var start 		= docBlockPos.start;
        var end 		= docBlockPos.end;

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

                field = [endPosition, startPosition];
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

            return getNextField(loopSelection, backward, docBlockPos, true);
        }

        return field;
    }

    // =========================================================================
    // Analyze Function Code
    // =========================================================================

    /**
     * Get the code of a function at positon and check if the function returns a value
     * Try to guess the parameter types
     * @param   {Object}         editor   Brackets editor
     * @param   {Object}         position current position (.ch,.line)
     * @param   {Array|Object}   params   function parameters
     * @returns {Object|Boolean} .code = code of function, .returns (Boolean) true if function returns, .paramTypes (Array) Type of parameter
     */
    function getFunctionCodeTypes(editor,position,params) {
        var code = editor.document.getRange({ch:0,line:position.line},{ch:0,line:editor.lineCount()});
        var delimiter = false;
        var bracketCount = 0;
        var returns = {bool:false,type:false};
        var paramsFirstChars = [];
        var line = 0;

        for (var i = 0; i < params.length; i++) {
            paramsFirstChars.push(params[i].name.charAt(0));
        }

        var paramIndex;
        var paramTypes = [];
        var throws = [];
        var exTypes = [];

        if (allDefinitions[langId] === undefined) {
            definitions = allDefinitions.default;
        } else {
            definitions = allDefinitions[langId];
        }

        var types = definitions.types;

        for (var i = 0; i < code.length; i++) {
            var char = code.charAt(i);

            // get code types
            if (langId != "php" && ((paramIndex = paramsFirstChars.indexOf(char)) >= 0)) {
                if (delimiter == '') {
                    while (paramIndex >= 0) { // parameters can start with the same char
                        // check for currentParameter.
                        if (code.substr(i,params[paramIndex].name.length+1) == params[paramIndex].name+'.') {
                            var functionAfterParam = /^([a-z]*)(\()?/i.exec(code.substr(i+params[paramIndex].name.length+1));
                            // check for properties
                            if (!functionAfterParam[2]) {
                                if (PROPERTIES.indexOf(functionAfterParam[1]) === -1) {
                                    paramTypes[paramIndex] = types["object"];
                                }
                            } else { // check for functions
                                if (STRING_FUNCTIONS.indexOf(functionAfterParam[1]) !== -1) {
                                    paramTypes[paramIndex] = types["string"];
                                } else if (ARRAY_FUNCTIONS.indexOf(functionAfterParam[1]) !== -1) {
                                    paramTypes[paramIndex] = types["array"];
                                } else if (OBJECT_FUNCTIONS.indexOf(functionAfterParam[1]) !== -1) {
                                    paramTypes[paramIndex] = types["object"];
                                } else if (REGEXP_FUNCTIONS.indexOf(functionAfterParam[1]) !== -1) {
                                    paramTypes[paramIndex] = types["regexp"];
                                }
                            }
                        }
                        paramIndex = paramsFirstChars.indexOf(char,paramIndex+1); // next parameter with the correct first char
                    }
                }
            }


            switch (char) {
                // throw ne        
                case 't':    
                    if (delimiter == "" && /\sthrow new /.test(code.substr(i-1,11))) {
                        var matches = /\s*?([\s\S]*?)(\([\s\S]*?\))?;/.exec(code.substr(i+10));
                        if (matches) {
                            var exType = matches[1].trim();
                            if (exTypes.indexOf(exType) == -1) {
                                throws.push({extype: exType});
                                exTypes.push(exType);
                            }
                        }                        
                    }
                    break;
                    
                // returns?    
                case 'r':
                    if (delimiter == "" && /\sreturn[\[{ ]/.test(code.substr(i-1,8))) {
                        returns.bool = true;
                        // try to get the return type
                        var matches = /\s*?([\s\S]*?);/.exec(code.substr(i+7));
                        if (matches) {
                            var returnText = matches[1].trim();
                            var addType;
                            if (returnText == "false" || returnText == "true") {
                                addType = types["boolean"];
                                if (returns.type) {
                                    if (returns.type.indexOf(addType) == -1) returns.type += '|'+addType;
                                } else returns.type = addType;
                            } else if (returnText.charAt(0) == '{') {
                                addType = types["object"];
                                if (returns.type) {
                                    if (returns.type.indexOf(addType) == -1) returns.type += '|'+addType;
                                } else returns.type = addType;
                            } else if (returnText.charAt(0) == "[") {
                                addType = types["array"]
                                if (returns.type) {
                                    if (returns.type.indexOf(addType) == -1) returns.type += '|'+addType;
                                } else returns.type = addType;
                            } else if (returnText.charAt(0) == "'" || returnText.charAt(0) == '"') {
                                addType = types["string"]
                                if (returns.type) {
                                    if (returns.type.indexOf(addType) == -1) returns.type += '|'+addType;
                                } else returns.type = addType;
                            }
                        }
                    }
                    break;

                case '"':
                case "'":
                    if (delimiter) {
                        if (char === delimiter) // closing ' or "
                            delimiter = false;
                    }
                    else delimiter = char; // starting ' or "
                    break;
                case '/':
                    if (!delimiter) {
                        var lookahead = code.charAt(++i);
                        switch (lookahead) {
                            case '/': // comment
                                var endComment = regexIndexOf(code,/\n/,i);
                                i = endComment > i ? endComment+1 : i;
                                break;
                            case '*': // start of comment (/*)
                                var endComment = regexIndexOf(code,/\*\//,i);
                                i = endComment > i ? endComment+2 : i;
                                break;
                            default:
                                // check for regular expression
                                if (/[|&-+*%!=(;?,<>~]\s*$/.test(code.substring(0,i-1))) { // i-1 because ++i for lookahead
                                    var endRegex = /[^\\](?:[\\]{2})*\//;
                                    var endRegexMatch = endRegex.exec(code.substring(i,code.indexOf('\n',i)));
                                    i += endRegexMatch ? endRegexMatch.index+endRegexMatch[0].length : 0;
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
                                returns: returns,
                                paramTypes: paramTypes,
                                throws: throws
                            }
                        }
                    }
            } // switch
        } // for
        return false;
    }

    /**
     * split the input into params (not possible to split by ',' directly)
     * @param   {String} input 
     * @returns {Array}  splitted input
     */
    function specialSplitComma(input) {
        var parameters = [];
        var lastI = 0;
        var openStringCh = "";
        var lastStringCh = "";
        if (!input) {
            return [];   
        }
        
        for(var i = 0; i < input.length; i++) {
            if ((input[i] == "'" || input[i] == '"') && openStringCh == "" && lastStringCh != "\\") {
                openStringCh = input[i];   
                lastStringCh = input[i]; 
                continue;
            }        
            if (input[i] == "'" && openStringCh == "'" && lastStringCh != "\\") {
                openStringCh = "";      
            } else if (input[i] == '"' && openStringCh == '"' && lastStringCh != "\\") {
                openStringCh = "";      
            } else if (input[i] == "\\" && lastStringCh != "\\") {
                lastStringCh = "\\";
                continue;
            } else if (input[i] == "\\" && lastStringCh == "\\") {
                lastStringCh = "";
                continue;
            } else if (input[i] == "," && openStringCh == "") {
                parameters.push(input.substring(lastI,i));
                lastI = i+1;
            }
            lastStringCh = input[i]; 
        } 
        parameters.push(input.substring(lastI));   
        return parameters;   
    }
    
    /**
     * Check if params are optional and have default values
     * @param   {String} code   code of the function
     * @param   {Object} params all parameters of the function
     * @returns {Object} expand the parameter object. New keys for some params: 'optional' (bool),'default',.title
     */
    function checkParamsOptional(code,params) {
        if (langId === "php") {
            code = code.substring(code.indexOf('(')+1,code.indexOf(')'));
            var parameters = specialSplitComma(code);
            for (var i = 0; i < parameters.length; i++) {
                params[i].title = params[i].name;
                var paramParts = params[i].name.split('=');
                if (paramParts.length == 2) {
                    params[i].title		= '['+params[i].title+']';
                    params[i].optional 	= true;
                    params[i].default 	= paramParts[1];
                    params[i].name 		= paramParts[0];
                }
            }
            return params;
        }

        // delete code before first { (function definition) and last }
        // => only code inside the function
        code = code.substr(code.indexOf('{')+1);
        code = code.substring(0,code.lastIndexOf('}'));
        // split the code into expressions (';')
        var expressions = code.split(/[;}]/);
        var i = 0;
        // first expression needs to include 'typeof'
        while (i < expressions.length) {
            if (/[^0-9a-z_]typeof[^0-9a-z_]/i.test(expressions[i]) || /(\S+)\s*=\s*(\S+)\s*\|\|\s*(\S+)/i.test(expressions[i])) {
                expressions[i] = expressions[i].trim();
                // TYPEOF_SHORT_TRUE =>
                // variable = typeof variable === "undefined" || variable
                var matchTrueShort 	= TYPEOF_TRUE_SHORT.exec(expressions[i]);

                // TYPEOF_LONG =>
                // if typeof variable ===? undefined variable = default
                var matchLong 	= TYPEOF_LONG.exec(expressions[i]);
                             
                
                // TYPEOF_SHORT =>
                // variable = typeof variable === "undefined" ? variable : default
                // or variable = typeof variable !== "undefined" ? default : variable
                var matchShort 	= TYPEOF_SHORT.exec(expressions[i]);
                // or variable = variable || default
                var matchOr		= OR_DEFAULT.exec(expressions[i]);
                var match;
                if (matchTrueShort) {
                    match = matchTrueShort;
                    for (var j = 1; j < match.length; j++) {
                        match[j] = match[j].trim();
                    }
                    if ((match[1] == match[2]) && (match[1]  == match[3])) {
                        var variable = match[1];
                        var paramIndex = keyIndexOf(params,'name',variable);
                        if (paramIndex >= 0) {
                            params[paramIndex].optional = true;
                            params[paramIndex].default = true;
                            params[paramIndex].title = '['+params[paramIndex].name+'='+params[paramIndex].default+']';
                        }
                    }
                } else if (matchLong || matchOr) {
                    match = matchLong ? matchLong : matchOr;
                    for (var j = 1; j < match.length; j++) {
                        match[j] = match[j].trim();
                    }
                    var firstVariable = match[1];
                    var secondVariable = match[2];
                    var defaultVal = match[3];
                    // variable == variable
                    if (firstVariable == secondVariable) {
                        var paramIndex = keyIndexOf(params,'name',firstVariable);
                        if (paramIndex >= 0) {
                            params[paramIndex].optional = true;
                            params[paramIndex].default = defaultVal;
                            params[paramIndex].title = '['+params[paramIndex].name+'='+params[paramIndex].default+']';
                        }
                    }
                } else if (matchShort) {
                    // variable = typeof variable === "undefined" ? default : variable
                    // or variable = typeof variable !== "undefined" ? variable : default
                    match = matchShort;
                    for (var j = 1; j < match.length; j++) {
                        match[j] = match[j].trim();
                    }
                    // variable == variable
                    if (match[1] == match[2] && (match[1] == match[4] || match[1] == match[5])) {
                        var variable = match[1];
                        var paramIndex = keyIndexOf(params,'name',variable);
                        if (paramIndex >= 0) {
                            params[paramIndex].optional = true;
                            if (match[3] == '!') {
                                params[paramIndex].default = match[5];
                            } else {
                                params[paramIndex].default = match[4];
                            }
                            params[paramIndex].title = '['+params[paramIndex].name+'='+params[paramIndex].default+']';
                        }
                    }
                }
            }
            i++;
        }


        return params;
    }


    function regexIndexOf (string, regex, startpos) {
        var indexOf = string.substring(startpos || 0).search(regex);
        return (indexOf >= 0) ? (indexOf + (startpos || 0)) : indexOf;
    }

    /**
     * Open the preference dialog where the user can change the shortcut
     */
    function openPrefDialog() {
        var dialog = Dialogs.showModalDialogUsingTemplate(prefDialogHTML),
            $dialog	= dialog.getElement();

        if (!_prefs.get('autoindent_enter')) {
            $dialog.find("#cb_autoindent_enter").prop('checked',true);
        }
        if (!_prefs.get('autoindent_tab')) {
            $dialog.find("#cb_autoindent_tab").prop('checked',true);
        }
        
        if (_prefs.get('author_auto')) {
            $dialog.find("#cb_author_auto").prop('checked',true);
        }
        
        var prefsAtName = _prefs.get('atName');
        if (prefsAtName != '') {
            $dialog.find("#atName").val(prefsAtName);
        }

        // Reminder: The "wrong" shortcut shows this dialog
        if (_prefs.get('shortcut') in existingKeyBindings) {
            $dialog.find("#shortcutError").html('This shortcut is already in use, please choose another');
        }
        
        $dialog.find("#shortcut").val(_prefs.get('shortcut')).on('input', function () {
            if (!SHORTCUT_REGEX.test($(this).val())) {
                $dialog.find("#shortcutError").html('Please enter a valid shortcut!');
                $dialog.find("#prefs_save_btn").prop('disabled', true);
            } else if ($(this).val() in existingKeyBindings) {
                $dialog.find("#shortcutError").html('This shortcut is already in use!');
                $dialog.find("#prefs_save_btn").prop('disabled', true);
            } else {
                $dialog.find("#shortcutError").html('');
                $dialog.find("#prefs_save_btn").prop('disabled', false);
            }
        });

        dialog.done(function (id) {
            if (id === 'save') {
                var shortcut = $dialog.find("#shortcut").val();
                if (shortcut != _prefs.get('shortcut') && shortcut != _prefs.get('shortcutMac')) {
                    _prefs.set('shortcut', shortcut);
                    _prefs.set('shortcutMac', shortcut);

                    var menuEdit = Menus.getMenu(Menus.AppMenuBar.EDIT_MENU);
                    menuEdit.removeMenuItem(COMMAND_ID);
                    menuEdit.addMenuItem(COMMAND_ID,[{key: _prefs.get('shortcut')},{key: _prefs.get('shortcutMac'), platform: 'mac'}]);
                }
                _prefs.set('autoindent_enter', !$dialog.find("#cb_autoindent_enter").prop('checked'));
                _prefs.set('autoindent_tab', !$dialog.find("#cb_autoindent_tab").prop('checked'));
                _prefs.set('author_auto', $dialog.find("#cb_author_auto").prop('checked'));
                _prefs.set('atName', $dialog.find("#atName").val());
            }
        });
    }

    /**
     * Check if the current selection is inside a doc block
     * @param   {Object}         position the current position
     * @returns {Boolean|Object} Object(.start,.end) => inside, false => outside
     */
    function insideDocBlock(position) {
        var editor    = EditorManager.getCurrentFullEditor();
        var document  = editor.document;
        var lineCount = editor.lineCount();

        // Snap to word boundary
        position = getCharacterBoundary(position, ' ');

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
            return false;
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
            return false;
        }

        // we are in a doc block
        return {start: start, end: end};
    }

    /**
     * Contains a list of information about functions for a single document.
     * @return {?Array.<FileLocation>}
     */
    function createFunctionList() {
        var doc = DocumentManager.getCurrentDocument();
        if (!doc) {
            return;
        }

        var functionList = [];
        var docText = doc.getText();
        var lines = docText.split("\n");
        var functions = JSUtils.findAllMatchingFunctionsInText(docText, "*");
        return functions;
    }

    function setSelection(editor,posStart,posEnd) {
        // center the selection if it's not in the centered area and not at the top
        // => center only if the next tag is at the bottom
        editor.setSelection(posStart, posEnd, true, 1);
        CommandManager.execute(Commands.SHOW_CODE_HINTS);
    }
    
    /**
     * Selects a given field based on the current position in the document
     * @param {Object}   editor
     * @param {Object}   position Current position in document
     */
    function selectField(editor, position) {
        var document = editor.document;
        var currentLine = document.getLine(position.line);
        // Find start of field
        var startPosition = getCharacterBoundary(position, '[');
        // Move to first '['
        startPosition.ch -= 1;
        // Verify there are two '['
        if (currentLine.charAt(startPosition.ch) === '[') {
            var endPosition = getCharacterBoundary(startPosition, ']', false);
            endPosition.ch += 1;
            // Verify there are two ']'
            if (currentLine.charAt(endPosition.ch) === ']') {
                // Highlight field as long as cursor is within field
                if (position.ch >= startPosition.ch && position.ch <= endPosition.ch) {
                    endPosition.ch += 1;
                    // Start with endPosition to ensure the selected cursor is at the start of the field
                    setSelection(editor, endPosition, startPosition);
                    event.preventDefault(); 
                }   
            }
        }
    }

    /////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////     Prototypes    //////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Find the position of an needle in an array of objects for a special key
     * @param   {Array}  array  the array
     * @param   {String} key    key which should be checked against the needle
     * @param   {String} needle string that should be array[i][key]
     * @returns {Number} return the positon i if needle was found otherwise -1
     */
    function keyIndexOf(array,key,needle) {
        for (var i = 0; i < array.length; i++) {
            if (array[i][key] == needle) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Return the given string*times
     * @param   {String} string the string that should be used
     * @param   {Number} times  nr of repetition
     * @returns {String} string,string,...,*times
     */
    function times(string,times) {
        var result = string;
        for (var i = 1; i < times; i++) {
            result += string;
        }
        return result;
    }


    AppInit.appReady(function () {
        var DocrHint = require('hints');

        var defKeys = Object.keys(allDefinitions);
        for (var i = 0; i < defKeys.length; i++) {
            allDefinitions[defKeys[i]] = JSON.parse(allDefinitions[defKeys[i]]);
        }
        allDefinitions.jsx			= allDefinitions.javascript;
        allDefinitions.coffeescript = allDefinitions.javascript;
        allDefinitions.livescript 	= allDefinitions.javascript;


        CommandManager.register('Funcdocr Annotate', COMMAND_ID, handleDocBlock);
        CommandManager.register('FuncDocr Settings', COMMAND_ID_SETTINGS, openPrefDialog);

        var menuView = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU);
        var menuEdit = Menus.getMenu(Menus.AppMenuBar.EDIT_MENU);
        menuView.addMenuItem(COMMAND_ID_SETTINGS);

        existingKeyBindings = KeyBindingManager.getKeymap();
        if (_prefs.get('shortcut') in existingKeyBindings && existingKeyBindings[_prefs.get('shortcut')].commandID != COMMAND_ID) {
            openPrefDialog();
        } else {
            menuEdit.addMenuItem(COMMAND_ID,[{key: _prefs.get('shortcut')},{key: _prefs.get('shortcutMac'), platform: 'mac'}]);
        }




        var editorHolder = $("#editor-holder")[0];
        if (editorHolder) {
            editorHolder.addEventListener("keydown", handleKey, true);
            editorHolder.addEventListener("keyup", handleKey, true);
            editorHolder.addEventListener("dblclick", handleClick, true)
        }

        var docrHints = new DocrHint({
            insideDocBlock:insideDocBlock,createFunctionList:createFunctionList,
            getFunctionCodeTypes:getFunctionCodeTypes,setSelection:setSelection,
            FUNCTION_REGEXP:FUNCTION_REGEXP
        });

        CodeHintManager.registerHintProvider(docrHints, ["javascript", "coffeescript", "livescript" ,"php", "jsx"], 0);
    });


});
