/**
 * [[Description]]
 * @param   {[[Type]]} author   [[Description]]
 * @param   {[[Type]]} children [[Description]]
 * @returns {[[Type]]} [[Description]]
 */
var Comment = React.createClass({
  render: function() {
    return (
      <div className="comment">
        <h2 className="commentAuthor">
          {this.props.author}
        </h2>
        {this.props.children}
      </div>
    );
  }
});

React.render(
  <Comment author="Jeffery Deaver" children="no"/>,
  document.getElementById('content')
);


function resize() {
	var height = $("body").height();
	var width = $("body").width();
	$("#recipeIndex").outerHeight(height);
	$("#content").outerHeight(height);
}

/**
 * 
 */
var SearchBar = React.createClass({
	hover: function() {
		var opacity = parseInt($("#searchBar").css("opacity"));
		switch(opacity) {
			case 0:
				$("#searchBar").animate({
					opacity:1
				}, 200);
				break;
			case 1:
				$("#searchBar").animate({
					opacity:0
				}, 200);
				break;
		}
	},
	submit: function(e) {
		e.preventDefault();
		var query = this.refs.input.getDOMNode().value;
		App.newQuery(query);
	},
	render: function() {
		return (
			<div id="searchBar">
				<form onSubmit={this.submit}>
				<input id="searchInput" ref="input" 
						type="text" onMouseOver={this.hover} onMouseOut={this.hover} placeholder="Zutat" />
				</form>	
			</div>
			
		);
	}
});

var RecipeName = React.createClass({
	click: function() {
		var id = this.refs.name.getDOMNode().id.substr(6);
		App.changedIndexId(id);
	},
	render: function() {	
		return (
			<div className="recipeIndexId">
				<span id={"recipe"+this.props.recipe.id}  onClick={this.click} ref="name">{this.props.recipe.name}</span> 
			</div>
		);
	}
});


var RecipeIndexPart = React.createClass({
	componentDidMount: function() {
		resize();
	},
	render: function() {
		var recipes = this.props.recipes.map(function(recipe) {
			return <RecipeName recipe={recipe} />;
		}.bind(this));
		return (
			<div>
				<strong id={"letter"+this.props.recipes[0].name.substr(0,1)}>{this.props.recipes[0].name.substr(0,1)}</strong>
				<div className="recipeIndexPart">
				  {recipes}  
				</div>
			</div>
		);
	}
});

var Menu = React.createClass({
	getInitialState: function() {
		return {recipeNames: []};
	},	
	componentDidMount: function() {
		resize();
		$.ajax({
		  url: 'get/names.php',
		  dataType: 'json',
		  success: function(recipeNames) {
			this.setState({recipeNames: recipeNames});
		  }.bind(this),
		  error: function(xhr, status, err) {
			console.error(status, err.toString());
		  }.bind(this)
		});
		resize();
	},
	letterChange: function(letter) {
		$("#recipeIndex").animate({
			scrollTop: $("#recipeIndex").scrollTop()+$("#letter"+letter).offset().top
		},2000, 'swing');
	},
	render: function() {
		if (this.state.recipeNames.length == 0) {
			return <div></div>;
		}
		
		return (
			<div>
				<SearchBar/>
				<div id="recipeIndex">
					<RecipeList recipes={this.state.recipeNames} indexId={this.changeIndexId} />
				</div>
			</div>
		);
	}
});


/**
 * [[Description]]
 * @param {[[Type]]} recipes [[Description]]
 */
var RecipeList = React.createClass({
	render: function() {	
		var lastName = this.props.recipes[0].name.trim();
		var recipes = [];
		var recipeParts = [];
		var letters = [];
		$.each(this.props.recipes, function(i, recipe) {
			recipeName = recipe.name.trim();
			if (recipeName.charAt(0).toLowerCase() != lastName.charAt(0).toLowerCase()) {
				letters.push(lastName.charAt(0).toUpperCase());
				recipeParts.push(<RecipeIndexPart indexId={this.changeIndexId} recipes={recipes}/>);	
				recipes = [];			 
			}
			recipes.push(recipe);
			lastName = recipeName;
		}.bind(this));
		letters.push(lastName.charAt(0).toUpperCase());
		recipeParts.push(<RecipeIndexPart indexId={this.changeIndexId} recipes={recipes}/>);
						 
						 
		return (<div>{recipeParts}</div>);
	}
});							

var Recipe = React.createClass({
	getInitialState: function() {
		return {id: false,name: "",recipe: ""};
	},
	update: function(props,bRender) {
		if (typeof bRender === "undefined") bRender = false;
		if (typeof props === "undefined") props = this.props;
		
		console.log('receiveProps: ',props);
		console.log('bRender: ',bRender);
		if (props.id) {
			console.log('receivedID: '+props.id);
			$.ajax({
			  url: 'get/recipe.php',
			  data: {id: props.id},
			  dataType: 'json',
			  success: function(recipe) {
				console.log(recipe);
				this.setState({id: props.id,name: recipe.name,recipe: recipe.recipe});
				if (bRender) this.render();
			  }.bind(this),
			  error: function(xhr, status, err) {
				console.error(status, err);
			  }.bind(this)
			});
		}	
	},
	componentWillMount: function() {
		this.update();
	},
	componentWillReceiveProps: function(newProps) {
		console.log('recipe receives new props');
		this.update(newProps,true);
	},
	render: function() {	
	  console.log('state: ',this.state);
	  if (this.state.id === false) {
		 return <div></div>; 
	  }
		
	  return (
		 <div>
			<h1>{this.state.name}</h1>
		  	<div>
		  		{this.state.recipe}
		  	</div>
		 </div>
	  );
	}
});	
		
		
var SearchContent = React.createClass({
	getInitialState: function() {
		return {recipes: []};
	},
	componentWillReceiveProps: function(nextProps) {
		console.log('receiveProps: ',nextProps);
		this.search(nextProps.query);
	},
	componentWillMount: function() {
		console.log('willMount: '+this.props.query); 
		this.search(this.props.query);
	},
	search: function(query) {
		if (query) {
			console.log('query: '+query);
			$.ajax({
			  url: 'get/search.php',
			  data: {query: query},
			  dataType: 'json',
			  success: function(recipes) {
				this.setState({recipes: recipes});
			  }.bind(this),
			  error: function(xhr, status, err) {
				console.error(status, err.toString());
			  }.bind(this)
			});
		}		
	},
	render: function() {
	  if (this.state.recipes.length == 0) {
		 return <div></div>; 
	  }
		
	  return (
		 <div>
			<RecipeList recipes={this.state.recipes}/>
		 </div>
	  );
	}
});			
	
		
var Content = React.createClass({
	getInitialState: function() {
		return {section: "recipe", recipeId: false, query: ""};
	},
	changeIndexId: function(id) {
		console.log('indexId: '+id);
		this.setState({section: "recipe", recipeId: id, query: ""});
	},
	componentWillMount: function() {
		this.setState(this.props);	
	},
	componentWillReceiveProps: function(nextProps) {
		this.setState(nextProps);
	},
	render: function() {	
		console.log('states: ',this.state);
		switch(this.state.section) {
			case "recipe":	  
				console.log('show recipe');
				return (
					<Recipe id={this.state.recipeId} />
				);
				break;
			case "search":	
				return (
					<SearchContent query={this.state.query}/>
				);
				break;
			default:
				return (<div></div>);
		}
	}
});	
		
var Structure = React.createClass({
	getInitialState: function() {
		return {recipeId:false,section: "",query: ""};	
	},
	componentDidMount: function() {
		resize();
		window.addEventListener('resize',resize);
	},
	querySubmit: function(query) {
		console.log('query: '+query);
		this.setState({section: "search",query: query});
	},
	componentWillReceiveProps: function(nextProps) {
		console.log('nextPros: ',nextProps);
		this.setState(nextProps.props);
	},
	render: function() {	
	  return (
		 <div> 
			 <div id="menu">
				<Menu/>
			 </div>
			 <div id="content">
				<Content section={this.state.section} recipeId={this.state.recipeId} query={this.state.query} />
			 </div>
		 </div>
	  );
	}
});		

App.render({});