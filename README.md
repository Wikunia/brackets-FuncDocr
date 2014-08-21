# FuncDocr

A brackets extension to generate JS/PHPDocs for your functions.

## How to Use
* Open a JS or PHP file
* set your cursor on a function declaration
	* `function cool(stuff)`
* Use the ShortCut `Ctrl-Alt-D` (Win) or `Cmd-Shift-D` (Mac) to start the documentation

The extension will provide a function documentation:
```javascript
/**
 * [[Description]]
 * @param {[[Type]]} stuff [[Description]]
 */
function cool(stuff)
```
`[[Description]]` will be selected so you can start to type. To jump to the next `[[tag]]` you can use `Tab` or jump to the last with `Shift-Tab`.

You will get hints for the `[[Type]]` tag.
![Type hints](https://cloud.githubusercontent.com/assets/4931746/3998983/b3eba9ba-294c-11e4-988b-4330735635fd.png)



Have fun and stay tuned!




## Next
* check if the function already has JS/PHPDocs
* add `@return` 
* try to guess the `[[Type]]` values




