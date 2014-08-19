# FuncDocr

A brackets extension to generate JS/PHPDocs for your functions.

## How to Use
* Open a JS or PHP file
* set your cursor on a function declaration
	* `function cool(stuff)`
* Use the ShortCut `Ctrl-Alt-D` to start the documentation

The extension will provide a function documentation:
```javascript
/**
 * [[Description]]
 * @param {[[Type]]} stuff [[Description]]
 */
function cool(stuff)
```
`[[Description]]` will be selected so you can start to type.
To jump to the next `[[tag]]` you can use `Tab`.

Have fun and stay tuned!


## Next
* check if the function already has JS/PHPDocs
* add `@return` 
* try to guess the `[[Type]]` values




