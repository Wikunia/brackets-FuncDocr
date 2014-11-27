// =========================================================================
// Hint Manager
// =========================================================================

/**
 * DocrHint constructor
 * @param {Object} importFuncs functions that will be used in this class and must be imported
 */
function DocrHint(importFuncs) {
	var docrHintThis = this;
	$.each(importFuncs, function(key,func) {
		docrHintThis[key] = func;
	});
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
		switch(this.selection) {
			case "[[Type]]":
				this.implicitChar = "[[Type]]";
				return true;
			case "[[Link]]":
				this.implicitChar = "[[Link]]";
				return true;
			default:
				if (implicitChar == '@') {
					this.removeSelection = true;
					this.implicitChar = "@";
					return true;
				}
		}
	}
	return false;
};

/**
 * Get the hints for a selection
 * uses {@link removeWrongHints	removeWrongHints}
 * @param   {String} implicitChar implicit character
 * @returns {Object} hintManager object
 */
DocrHint.prototype.getHints = function (implicitChar) {
	var hints;
	this.match = this.editor.document.getRange(this.pos,this.editor.getCursorPos());

	this.hintText = '';
	this.removeSelection = true;
	this.boolSetSelection = false;
	this.deleteFirstNChars = 0;

	switch(this.implicitChar) {
		case "[[Type]]":
			hints = [
				"Number",
				"String",
				"Boolean",
				"Array",
				"Object",
				"RegExp",
				"Function"
			];
			break;
		case "[[Link]]":
			var functionList = this.createFunctionList();
			var functionSignature = this.getFunctionCodeTypes(this.editor,{line:this.insideDocPos.end,ch:0},[]);
			var bestFuncs = [];
			var otherFuncs = [];
			for (var i = 0; i < functionList.length; i++) {
				var regexFuncTest = new RegExp('\[^a-zA-Z0-9\]'+functionList[i].name+'\\(');
				// remove the function name
				functionSignature.code = functionSignature.code.substr(functionSignature.code.indexOf('{'));
				if (regexFuncTest.test(functionSignature.code)) {
					bestFuncs.push(functionList[i].name);
				} else {
					otherFuncs.push(functionList[i].name);
				}
			}
			hints = bestFuncs.concat(otherFuncs);
			break;
		case "@":
			var line = this.editor.document.getRange({line:this.pos.line,ch:0},this.pos);
			hints = [];
			var match = /{\s*@$/.exec(line);
			if (match) {
				this.deleteFirstNChars = 1;
				hints.push("@link [[Link]] [[Description]]}");
			} else {
				this.deleteFirstNChars = 1;
				if (this.editor.getLanguageForSelection().getId() == "php") {
					hints.push("@link [[Link]] [[Description]]");
				} else {
					hints.push("{@link [[Link]] [[Description]]}");
				}
			}
			this.boolSetSelection = true;
			break;
	}


	this.removeSelection = (this.removeSelection && this.match != '') ? false : this.removeSelection;

	hints = this.removeWrongHints(hints);

	return {
		hints: hints,
		match: this.match,
		selectInitial: true,
		handleWideResults: false
	};
}


/**
 * Remove hints that doesn't match the current this.match
 * @param   {Array} hints hints that are availabe
 * @returns {Array} hints that matches this.match
 */
DocrHint.prototype.removeWrongHints = function(hints) {
	var result = [];
	for(var i = 0; i < hints.length; i++) {
		if (hints[i].indexOf(this.match) >= 0) {
			result.push(hints[i]);
		}
	}
	return result;
}




 /**
 * Inserts the hint
 */
DocrHint.prototype.insertHint = function (hint) {
	// Document objects represent file contents
	var currentDoc = this.editor.document;

	// Where the range end that should be replaced
	var start 	= {line: this.pos.line , ch: this.pos.ch - this.deleteFirstNChars};
	var end 	= {line: this.pos.line , ch: this.pos.ch + ((this.removeSelection) ? this.selection.length : this.match.length)};


	// Add some text in our document
	currentDoc.replaceRange(hint, start, end);

	if (this.boolSetSelection && hint.indexOf("@link") >= 0) {
		var match = /\[\[[a-z]+\]\]/i.exec(hint);
		if (match) {
			this.setSelection(this.editor,
				{line:this.pos.line,ch:this.pos.ch-this.deleteFirstNChars+match.index+match[0].length},
				{line:this.pos.line,ch:this.pos.ch-this.deleteFirstNChars+match.index});
		}
	}

};
