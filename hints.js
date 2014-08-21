// =========================================================================
// Hint Manager
// =========================================================================

/**
* @constructor
*/
function DocrHint() {

}

/**
 * Checks, if it is possible to give hints.
 */
DocrHint.prototype.hasHints = function (editor, implicitChar) {
	this.editor = editor;
	this.selection = editor.getSelectedText();
	this.pos = editor.getCursorPos();
	this.hintText = '';
	this.removeSelection = true;
	switch(this.selection) {
		case "[[Type]]":
			return true;
		default:
			return false;
	}
};

/**
 * Get the hints for a selection
 */
DocrHint.prototype.getHints = function (implicitChar) {
	var hints;
	switch(this.selection) {
		case "[[Type]]":
			hints = [
				"Number",
				"String",
				"Boolean",
				"Array",
				"Object"
			];
	}

	this.match = this.editor.document.getRange(this.pos,this.editor.getCursorPos());
	this.removeSelection = (this.removeSelection && this.match != '') ? false : this.removeSelection;
	hints = this.sortHints(hints);

	return {
		hints: hints,
		match: this.match,
		selectInitial: true,
		handleWideResults: false
	};
}


DocrHint.prototype.sortHints = function(hints) {
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
	var end = {line: this.pos.line , ch: this.pos.ch + ((this.removeSelection) ? this.selection.length : this.match.length)};

	// Add some text in our document
	currentDoc.replaceRange(hint, this.pos, end);

};
