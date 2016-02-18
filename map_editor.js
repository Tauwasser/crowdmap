window.addEventListener('popstate', function (event) {
	var map_name = document.location.hash.substr(1)
	if (map_name) {
		_gotoMap(map_name)
	}
})

function gotoMap(name) {
	document.location.hash = name
}

function _gotoMap(name) {
	var loaded = false
	if (Data.maps[name]) {
		if (Data.maps[name].loaded) {
			view.current_map = name
			var tileset = Data.tilesets[Data.maps[name].header.tileset]
			if (tileset) {
				picker_view.map = name
				picker_view.run()
			}
			view.run()
			loaded = true
		}
	}

	var loading_div = createElement('div', { className: 'loading-splash', })
	view.container.appendChild(loading_div)
	var remove_loading_div = function () {view.container.removeChild(loading_div)}

	var promise = loadMap(name)
	promise.then(remove_loading_div, remove_loading_div)
	promise.then(function () {
		view.current_map = name
		picker_view.map = name
		view.run()
		picker_view.run()
	})
	promise.then(function () {
		return loadMapConnections(name)
	})
	.then(function () {
		view.run()
	})


	return promise
}

function loadMapAndConnections(name) {
	return loadMap(name)
	.then(function () {
		loadMapConnections(name)
	})
}

function loadMapConnections(name) {
	var map = Data.maps[name]
	var promises = []
	for (var dir in map.attributes.connections) {
		var connection = map.attributes.connections[dir]
		promises.push(loadMap(connection.name))
	}
	return Promise.all(promises)
}


function main() {
	init()
}

function init() {
	clear_nojs()
	clear_errors()

	toolbar = Object.create(Toolbar)
	toolbar.init()

	view = Object.create(MapViewer)
	view.init()

	picker_view = Object.create(BlockViewer)
	picker_view.init()

	picker = Object.create(BlockPicker)
	picker.init(picker_view)
	
	painter = Object.create(Painter)
	painter.init(view)

	view.attach(document.body)
	var map_name = document.location.hash.substr(1) || config.default_map
	_gotoMap(map_name)
	.then(function () {
		picker_view.attach(document.body)
		painter.run()
	})
}

function getTileset(map_name) {
	var map = Data.maps[map_name]
	var tileset = Data.tilesets[map.header.tileset]
	return tileset
}

function getTilesetTiles(tileset, roof) {
	if (config.roof_tilesets.indexOf(tileset.id) !== -1) {
		if (typeof roof !== 'undefined') {
			var tilesets = tileset.with_roofs[roof]
			if (typeof tileset !== 'undefined') {
				if (config.roofs[roof] !== -1) {
					return tilesets.tiles
				} else {
					return tilesets.tiles_just_palette
				}
			}
		}
	}
	return tileset.tiles
}

print = console.log.bind(console)

function clearDialogs () {
	var dialogs = document.getElementsByClassName('dialog')
	Array.prototype.map.call(dialogs, function (elem) {
		elem.parentElement.removeChild(elem)
	})
}

function newDialog (parent, id) {
	var div = createElement('div', {id: id, className: 'dialog'})

	var rect = parent.getBoundingClientRect()
	var left = rect.right
	div.style.left = left + 'px'

	return div
}

function newMap (event) {
	var new_id = 'dialog_new'
	var existing = document.getElementById(new_id)

	clearDialogs()

	if (existing) return

	var dialog = newDialog(event.currentTarget, new_id)
	document.body.appendChild(dialog)
	var content = createElement('div', {className: 'map_attributes'})

	var div = createElement('div', {className: 'map_header_item'})
	div.appendChild(createElement('div', {innerHTML: 'label', className: 'map_header_key'}))
	var label_input = createElement('input', {className: 'map_header_param'})
	div.appendChild(label_input)
	content.appendChild(div)

	var div = createElement('div', {className: 'map_header_item'})
	div.appendChild(createElement('div', {innerHTML: 'map group', className: 'map_header_key'}))
	var group_list = createElement('select', {className: 'map_header_param'})
	getMapGroupNames().then(function (names) {
		group_list.innerHTML = ''
		names.map(function (name) {
			group_list.appendChild(createElement('option', {value: name, innerHTML: name}))
		})
		group_list.appendChild(createElement('option', {value: '__new__', innerHTML: 'Add a new group'}))
	})
	div.appendChild(group_list)
	content.appendChild(div)

	var button = createElement('button', {innerHTML: 'yep do it', className: 'map_header_confirm'})
	button.onclick = function (event) {
		var label = label_input.value
		if (!label) return
		var group = group_list.value
		send_command({
			command: 'add_map',
			label: label,
			group: group,
			width: 20,
			height: 20,
			header: config.default_map_header,
			header_2: config.default_map_header_2,
		})
		.then(function () {
			console.log('added ' + label + ' in group ' + group)
			clearDialogs()
			gotoMap(label)
		})
	}

	content.appendChild(button)

	dialog.appendChild(content)
}

function editMapHeader (event) {
	var edit_id = 'dialog_edit'
	var existing = document.getElementById(edit_id)

	clearDialogs()

	if (existing) return
	if (!view.current_map) return

	var map = Data.maps[view.current_map]
	if (!map) return
	if (!map.loaded) return

	var dialog = newDialog(event.currentTarget, edit_id)
	document.body.appendChild(dialog)
	var content = createElement('div', {className: 'map_attributes'})

	var header = map.header
	for (var key in header) {
		if (key === 'label') continue
		if (key === 'tileset') continue
		var value = header[key]
		var div = createElement('div', {className: 'map_header_item'})
		div.appendChild(createElement('div', {innerHTML: key, className: 'map_header_key'}))
		var input = createElement('input', {name: key, value: value, className: 'map_header_param'})
		;(function (input, key) {
		input.addEventListener('change', function (event) {
			if (input.value) {
				var value = input.value
				if (!isNaN(parseInt(value))) {
					value = parseInt(value)
				}
				if (header[key] !== value) {
					header[key] = value
					if (key === 'group') {
						loadMapTileset(view.current_map)
						.then(function () {
							view.run()
							picker_view.run()
						})
					} else {
						view.run()
						picker_view.run()
					}
				}
			}
		})})(input, key)
		div.appendChild(input)
		content.appendChild(div)
	}

	var tileset_preview_image = new Image()
	tileset_preview_image.src = config.getTilesetImagePath(header.tileset)
	tileset_preview_image.setAttribute('validate', 'always')
	var tileset_preview = createElement('div', {className: 'tileset-preview'})
	tileset_preview.appendChild(tileset_preview_image)
	content.appendChild(tileset_preview)

	var tileset_list = tilesetList()
	var selected

	tileset_list.list_promise.then(function (list) {
		list.map(function (elem, i) {
			elem.addEventListener('click', function (event) {
				header.tileset = i
				loadMapTileset(view.current_map)
				.then(function () {
					view.run()
					picker_view.run()
				})
			})
			elem.addEventListener('click', function (event) {
				tileset_preview_image.src = config.getTilesetImagePath(i)
				if (selected === i) {
					content.removeChild(tileset_list.element)
					content.appendChild(tileset_preview)
				} else {
					selected = i
					tileset_list.select(i)
				}
			})
		})
	})

	tileset_preview.addEventListener('click', function (event) {
		if (content.children['tileset_list']) {
			content.removeChild(tileset_list.element)
		} else {
			content.removeChild(tileset_preview)
			selected = header.tileset
			tileset_list.select(selected)
			content.appendChild(tileset_list.element)
		}
	})

	dialog.appendChild(content)
}

function getTilesetNames () {
	return Promise.resolve(range(36))
}

function tilesetList () {

	var div = createElement('div', {id: 'tileset_list', className: 'tileset-list'})

	var list_promise = getTilesetNames()
	.then(function (names) {
		var list = []
		names.map(function (name, i) {
			var container = createElement('div', {className: 'tileset-preview'})
			var image = new Image()
			image.src = config.getTilesetImagePath(i)
			image.setAttribute('validate', 'always')
			container.appendChild(image)
			div.appendChild(container)
			list[i] = image
		})
		return Promise.resolve(list)
	})

	var select = function (selected) {
		getTilesetNames()
		.then(function (names) {
			names.map(function (name, i) {
				var element = div.children[i]
				if (i === selected) {
					element.className = 'tileset-preview selected'
				} else {
					element.className = 'tileset-preview'
				}
			})
		})
	}

	return {
		list_promise: list_promise,
		element: div,
		select: select,
	}
}

function openMap (event) {
	var open_id = 'dialog_open'
	var existing = document.getElementById(open_id)

	clearDialogs()

	if (existing) { return }

	var dialog = newDialog(event.currentTarget, open_id)
	dialog.style.width = '0px'
	document.body.appendChild(dialog)

	var list = createElement('div', {className: 'map_list'})
	dialog.appendChild(list)

	getMapNames()
	.then(function (names) {
		var selected
		var select = function (div) {
			selected = div
			div.className += ' selected'
		}
		var deselect = function (div) {
			selected = undefined
			if (div) div.className = div.className.replace(/\bselected\b/g, '')
		}

		// populate the list with names
		names.map(function (name) {
			var name_div = createElement('div', {className: 'map_name'})
			name_div.innerHTML = name
			name_div.onclick = function (event_) {
				deselect(selected)
				select(name_div)
				gotoMap(name)
			}
			if (view) {
				if (name === view.current_map) {
					select(name_div)
				}
			}
			list.appendChild(name_div)
		})
		dialog.style.width = '400px'
	})
}

function send_command(content) {
	var data = new FormData()
	data.append('json', JSON.stringify(content))

	return request('', {
		method: 'POST',
		data: data,
	})
}

function saveMap (event) {
	var filename = config.getBlockdataPath(view.current_map)

	send_command({
		command: 'save',
		filename: filename,
		data: Data.maps[view.current_map].blockdata,
	})
	.then(function () {
		print( 'saved', filename )
	})
}

function reloadMap (event) {
	return loadMap(view.current_map)
	.then(function () {
		view.run()
		picker_view.run()
		//view.commit()
	})
}

function toggleBrightness (event) {

	var time = {
		day:  'nite',
		nite: 'morn',
		morn: 'day',
	}[config.time]

	setBrightness(time, event.currentTarget)
}

function setBrightness (time, element) {

	if (element) {
		element.children[0].style.color = {
			day:  '#aaa',
			nite: '#666',
			morn: '#888',
		}[time]

		element.children[0].innerHTML = {
			day:  '☀',
			nite: '🌙',
			morn: '☀',
		}[time]
	}

	config.time = time

	var map = Data.maps[view.current_map]
	getTilesetWithRoof(map.header.tileset, map.header.group)
	readTiles(map.header.tileset, map.header.group)
	var connections = map.attributes.connections
	for (var direction in connections) {
		var connection = connections[direction]
		map = Data.maps[connection.name]
		getTilesetWithRoof(map.header.tileset, map.header.group)
	}

	view.run()
	picker_view.run()
}

function undo (event) {
	History.undo()
}

function redo (event) {
	History.redo()
}


function createElement(type, properties) {
	type = type || 'div'
	properties = properties || {}
	var div = document.createElement(type)
	for (var k in properties) {
		div[k] = properties[k]
	}
	return div
}


var Toolbar = {

	init: function () {
		this.element = this.createElement('div', {
			id: 'toolbar',
			className: 'toolbar',
		})
		var ext = this.createElement('div', {
			id: 'toolbar-extended',
			className: 'toolbar_extended',
		})
		this.element.appendChild(ext)

		this.buttons = {}
		for (var k in this.button_defs) {
			var def = this.button_defs[k]
			var button = this.createElement('div')
			button.id = k
			button.className = 'tool'

			def.listeners.forEach(function (listener) {
				button.addEventListener(listener[0], listener[1])
			})

			var icon = this.createElement('div')
			icon.innerHTML = def.icon
			icon.className = 'tool_icon'
			button.appendChild(icon)

			var text = this.createElement('div')
			text.innerHTML = def.text
			text.className = 'tool_desc'
			button.appendChild(text)

			this.buttons[k] = button
			this.element.appendChild(button)
		}

		// Click the bar to hide button text.
		var hider = this.createElement('div')
		hider.style.width = '100%'
		hider.style.height = '100%'
		var self = this
		var hidden = false
		hider.addEventListener('click', function (event) {
			if (hidden) {
				self.element.style.width = '228px'
			} else {
				self.element.style.width = '52px'
			}
			hidden = !hidden
		})
		this.element.appendChild(hider)

		document.body.appendChild(this.element)
	},

	createElement: createElement,

	button_defs: {
		new: {
			icon: '+',
			text: 'New map',
			listeners: [
				['click', newMap],
			],
		},

		edit: {
			icon: '...',
			text: 'Map properties',
			listeners: [
				['click', editMapHeader],
			],
		},

		open: {
			icon: '☰',
			text: 'Map list',
			listeners: [
				['click',  openMap],
			],
		},

		save: {
			icon: '💾', //&#x1f4be;
			text: 'Save map',
			listeners: [
				['click',  saveMap],
			],
		},

		reload: {
			icon: '⟳',
			text: 'Reload',
			listeners: [
				['click',  reloadMap],
			],
		},

		time: {
			icon: '☀',
			text: 'Lighting',
			listeners: [
				['click',  toggleBrightness],
			],
		},

		undo: {
			icon: '↺',
			text: 'Undo',
			listeners: [
				['click',  undo],
			],
		},

		redo: {
			icon: '↻',
			text: 'Redo',
			listeners: [
				['click',  redo],
			],
		},

	},

}


/*
function loadMapProperty(map_name, property) {
	return config.read(property, name)
	.then(function (result) {
		Data.maps[name][property] = result
	})
}
*/

function loadMapEvents(name) {
	return config.readEvents(name)
	.then(function (events) {
		Data.maps[name].events = events
	})
}

function loadMapHeader(name) {
	return getMapHeader(name)
	.then(function (header) {
		Data.maps[name].header = header
	})
}

function createMapHeader() {
	return Object.create(config.default_map_header)
}


function loadMapAttributes(name) {
	return getMapHeader2(name)
	.then(function (attributes) {
		Data.maps[name].attributes = attributes
	})
}

function createMapHeader2() {
	return Object.create(config.default_map_header_2)
}


var Data = {
	maps: {},
	tilesets: {},
	roofs: {},
	files: {},
	changed_files: [],

	loadFile: function (uri, options) {
		var self = this
		return request(uri, options)
		.then(function (data) {
			if (data !== self.files[uri]) {
				if (!self.changed_files.contains(uri)) {
					self.changed_files.push(uri)
				}
			}
			self.files[uri] = data
			return data
		})
	},
}

var History = Object.update([], {
	get: function () {
		return this[this.head]
	},

	redo: function () {
		var min = Math.min
		this.head = min(this.head + 1, this.length - 1)
	},

	undo: function () {
		var max = Math.max
		this.head = max(this.head - 1, 0)
	},

	commit: function (changes) {
		// Cut off alternate futures.
		var min = Math.min
		this.length = min(this.length, this.head + 1)
		this.push(changes)
		this.head += 1
	},
})


var getEventCoord = function (event) {
	var rect = event.target.getBoundingClientRect()
	return {
		x: (event.clientX - rect.left),
		y: (event.clientY - rect.top),
	}
}

function getCanvasSelection (event, canvas, drawcanvas) {
	var selection = getEventCoord(event)
	selection.x *= drawcanvas.width / canvas.width
	selection.y *= drawcanvas.height / canvas.height
	return selection
}

var BlockPicker = {

	init: function (blockViewer) {
		this.viewer = blockViewer
		this.attachPickerMouseEvents()
	},

	getSelection: function (event) {
		this.viewer.getSelection(event)
		this.selection = this.viewer.selection
	},

	attachPickerMouseEvents: function () {
		var self = this
		this.viewer.canvas.addEventListener('mousedown', function (event) {
			event.preventDefault()
		})
		this.viewer.canvas.addEventListener('mousemove', function (event) {
			self.getSelection(event)
		})
		this.viewer.canvas.addEventListener('mouseout', function (event) {
			self.viewer.selection = undefined
		})
		this.viewer.canvas.addEventListener('click', function (event) {
			self.getSelection(event)
			var x = self.selection.x
			var y = self.selection.y
			x = (x - (x % 32)) / 32
			y = (y - (y % 32)) / 32
			var block = y * self.viewer.width + x
			painter.paint_block = block
			event.preventDefault()
		})
	},

}

var BlockViewer = {

	get size () {
		return this.tileset.blockdata.length
	},
	get blockdata () {
		return this.tileset.blockdata
	},
	get height () {
		return Math.ceil(this.size / this.width)
	},
	get tileset () {
		return Data.tilesets[Data.maps[this.map].header.tileset]
	},

	init: function () {
		var self = this

		this.width = 4

		this.meta_w = 4
		this.meta_h = 4
		this.tile_w = 8
		this.tile_h = 8

		this.canvas = createElement('canvas', {
			id: 'picker',
			className: 'picker',
		})

		this.drawcanvas = createElement('canvas')

		this.scale = 1

		this.container = createElement('div', {
			id: 'pickerbar',
			className: 'pickerbar',
		})
		this.container.appendChild(this.canvas)

		this.wrapper = createElement('div', {
			id: 'picker-wrapper',
			className: 'picker-wrapper',
		})
		this.wrapper.appendChild(this.container)

	},

	attach: function (container) {
		container = container || document.body
		replaceChild(container, this.wrapper)
	},

	run: function () {
		var self = this
		function draw () {
			self.running = false
			self.draw()
			window.requestAnimationFrame(draw)
			self.running = true
		}
		self.redraw = true
		if (!self.running) {
			window.requestAnimationFrame(draw)
		}
	},

	draw: function () {
		if (this.tileset) {

			var dimensions = {
				width:  this.width  * this.meta_w * this.tile_w,
				height: this.height * this.meta_h * this.tile_h,
			}

			Object.update(this.drawcanvas, dimensions, { careful: true })

			dimensions.width  *= this.scale
			dimensions.height *= this.scale
			Object.update(this.canvas, dimensions, { careful: true })

			if (this.redraw) {
				this.render()
				this.redraw = false
			}

			var context = this.canvas.getContext('2d')
			context.drawImage(
				this.drawcanvas,
				0, 0, this.drawcanvas.width, this.drawcanvas.height,
				0, 0, this.canvas.width, this.canvas.height
			)

			this.drawSelection()
		}
	},

	render: function () {
		for (var y = 0; y < this.height; y++)
		for (var x = 0; x < this.width; x++) {
			var block = y * this.width + x
			this.drawMetatile(x, y, block)
		}
		this.drawBlockNumbers()
	},

	drawBlockNumbers: function () {
		var drawcontext = this.drawcanvas.getContext('2d')
		drawcontext.save()
		drawcontext.font = '8px Segoe UI Symbol, sans-serif'
		drawcontext.fillStyle = 'white'
		drawcontext.strokeStyle = 'black'
		drawcontext.lineWidth = 3
		drawcontext.textBaseline = 'top'
		var i = 0
		for (var y = 0; y < this.height; y++)
		for (var x = 0; x < this.width; x++) {
			var text_x = x * this.meta_w * this.tile_w
			var text_y = y * this.meta_h * this.tile_h
			var text = i.toString(16).toUpperCase()
			drawcontext.strokeText(text, text_x, text_y)
			drawcontext.fillText(text, text_x, text_y)
			i += 1
		}
		drawcontext.restore()
	},

	drawMetatile: function (x, y, block) {
		drawMetatile({
			x: x,
			y: y,
			block: block,
			tileset: this.tileset,
			roof: Data.maps[this.map].header.group,
			permission: Data.maps[this.map].header.permission,
			context: this.drawcanvas.getContext('2d'),
			tile_w: this.tile_w,
			tile_h: this.tile_h,
			meta_w: this.meta_w,
			meta_h: this.meta_h,
		})
	},

	getSelection: function (event) {
		this.selection = getCanvasSelection(event, this.canvas, this.drawcanvas)
	},

	drawSelection: function () {
		if (!this.selection) return

		var context = this.canvas.getContext('2d')
		var self = this
		var fillRect = function (x, y, w, h) {
			x *= self.scale
			y *= self.scale
			w *= self.scale
			h *= self.scale
			context.fillRect(x, y, w, h)
		}

		var x = this.selection.x
		var y = this.selection.y

		var tile_w = this.tile_w
		var tile_h = this.tile_h
		var block_w = tile_w * this.meta_w
		var block_h = tile_h * this.meta_h

		context.save()
		context.globalCompositeOperation = 'lighten'
		context.fillStyle = 'rgba(255, 80, 80, 20)'
		x = x - x % block_w
		y = y - y % block_h
		var w = block_w
		var h = block_h
		fillRect(x, y, w, h)
		//context.fillRect(x - x % tile_w, y - y % tile_h, tile_w, tile_h)
		context.restore()

	},

}

var Painter = {

	init: function (viewer) {
		this.viewer = viewer
	},

	run: function () {
		var self = this

		this.viewer.canvas.addEventListener('mouseup', function (event) {
			self.mousedown = false
			event.preventDefault()
		})
		this.viewer.canvas.addEventListener('mouseout', function (event) {
			self.viewer.selection = undefined
		})
		this.viewer.canvas.addEventListener('mousemove', function (event) {
			event.preventDefault()
			self.update(event)
		})
		this.viewer.canvas.addEventListener('mousedown', function (event) {
			event.preventDefault()
			self.mousedown = true
			self.update(event)
		})
		this.viewer.canvas.addEventListener('mouseup', function (event) {
			//self.viewer.commit()
		})
		this.viewer.canvas.addEventListener('contextmenu', function (event) {
			event.preventDefault()
		})

		this.attachResize()
	},

	attachResize: function () {
		var self = this
		var round = Math.round
		makeResizable(self.viewer.container, undefined /* all directions */, function (props) {
			var event = props.event
			var x = event.clientX, y = event.clientY

			var map = Data.maps[self.viewer.current_map]
			var x1 = 0, y1 = 0, x2 = map.width, y2 = map.height
			var xd = props.xd, yd = props.yd

			var w = self.viewer.meta_w * self.viewer.tile_w * self.viewer.scale
			var h = self.viewer.meta_h * self.viewer.tile_h * self.viewer.scale

			var rect = self.viewer.container.getBoundingClientRect()
			if (xd < 0) x1 += round((x - rect.left)   / w)
			if (xd > 0) x2 += round((x - rect.right)  / w)
			if (yd < 0) y1 += round((y - rect.top)    / h)
			if (yd > 0) y2 += round((y - rect.bottom) / h)

			crop(x1, y1, x2, y2)
			self.viewer.redraw = true
		})
	},

	update: function (event) {
		this.viewer.getSelection(event)
		if (this.mousedown) {
			var x = this.viewer.selection.x
			var y = this.viewer.selection.y
			x = (x - (x % 32)) / 32
			y = (y - (y % 32)) / 32
			x -= this.viewer.origin.x
			y -= this.viewer.origin.y
			if (isRightClick(event)) {
				this.pick(getBlock(this.viewer.current_map, x, y))
			} else {
				this.paint(x, y)
			}
		}
	},

	pick: function (block) {
		this.paint_block = block
	},

	paint: function (x, y, block) {
		if (typeof block === 'undefined') block = this.paint_block
		setBlock(this.viewer.current_map, x, y, block)
	},

}

var makeResizable = (function () {

	var styles = {
		n:  { top:    -1, left:   0, right:  0,  height: 1, },
		s:  { bottom: -1, left:   0, right:  0,  height: 1, },
		e:  { right:  -1, top:    0, bottom: 0,  width:  1, },
		w:  { left:   -1, top:    0, bottom: 0,  width:  1, },
		ne: { top:    -1, right: -1, width:  1,  height: 1, },
		nw: { top:    -1, left:  -1, width:  1,  height: 1, },
		se: { bottom: -1, right: -1, width:  1,  height: 1, },
		sw: { bottom: -1, left:  -1, width:  1,  height: 1, },
	}

	return function (element, directions, callback) {
		directions = directions || ['n','s','e','w','ne','nw','se','sw']
		directions.map(function (direction) {
			var elem = createElement('div', {
				id: direction,
				className: 'resize-bar',
			})
			var style = styles[direction]
			for (var attribute in style) {
				style[attribute] *= 5
				style[attribute] += 'px'
			}
			Object.update(elem.style, style)
			elem.style.cursor = direction + '-resize'
			elem.addEventListener('mousedown', start)
			element.appendChild(elem)

			var x, y, w, h
			function start (event) {
				event.preventDefault()
				var style = window.getComputedStyle(element)
				x = event.clientX
				y = event.clientY
				w = parseInt(style.width)
				h = parseInt(style.height)
				document.addEventListener('mousemove', drag, false)
				document.addEventListener('mouseup', stop, false)
			}
			function drag (event) {
				var yd = direction.contains('n') ? -1 : direction.contains('s') ? 1 : 0
				var xd = direction.contains('w') ? -1 : direction.contains('e') ? 1 : 0

				if (callback) {
					callback({ event: event, x:x, y:y, w:w, h:h, xd:xd, yd:yd })
				} else {
					if (xd) element.style.width = (w - x + event.clientX * xd) + 'px'
					if (yd) element.style.height = (h - y + event.clientY * yd) + 'px'
				}
			}
			function stop (event) {
				document.removeEventListener('mousemove', drag, false)
				document.removeEventListener('mouseup', stop, false)
			}
		})
	}
})()

function setBlock (name, x, y, block) {
	var map = Data.maps[name]
	if (x >= 0 && x < map.width)
	if (y >= 0 && y < map.height) {
		map.blockdata[x + y * map.width] = block
	}
}

function getBlock (name, x, y) {
	var map = Data.maps[name]
	return map.blockdata[x + y * map.width]
}

var MapViewer = {
	init: function () {
		this.canvas = createElement('canvas', {
			id: 'map_viewer',
			className: 'map_viewer',
		})

		this.drawcanvas = createElement('canvas')

		this.container = createElement('div', { className: 'view_container' })
		this.container.appendChild(this.canvas)

		this.wrapper = createElement('div', { className: 'view-wrapper' })
		this.wrapper.appendChild(this.container)

		this.scale = 1

		this.meta_w = 4
		this.meta_h = 4
		this.tile_w = 8
		this.tile_h = 8

		this.origin = {
			x: 3,
			y: 3,
		}

		var self = this
		this.canvas.addEventListener('click', function (event) {
			self.getSelection(event)
			var x = self.selection.x / 32
			var y = self.selection.y / 32

			var connections = Data.maps[self.current_map].attributes.connections
			var connect = false
			for (var direction in connections) {
				var connection = connections[direction]
				var info = getConnectionInfo(connection, Data.maps[self.current_map], Data.maps[connection.name])
				if (info)
				if (x >= info.x1 && x < info.x2)
				if (y >= info.y1 && y < info.y2) {
					connect = connection
					break
				}
			}
			if (connect) {
				print(connect.direction + ' to ' + connect.name)
				gotoMap(connect.name)
			}
			event.preventDefault()
		})
	},

	attach: function (container) {
		container = container || document.body
		replaceChild(container, this.wrapper)
	},

	run: function () {
		var self = this
		function draw () {
			self.running = false
			self.draw()
			window.requestAnimationFrame(draw)
			self.running = true
		}
		self.redraw = true
		if (!self.running) {
			window.requestAnimationFrame(draw)
		}
	},

	draw: function () {
		if (this.current_map && Data.maps[this.current_map]) {
			if (this.redraw) {
				this.blockdata = []
				this.redraw = false
			}
			this.renderMap(this.current_map)
			this.renderEvents()
		}
	},

	renderMap: function (map) {

		var width = Data.maps[map].width
		var height = Data.maps[map].height
		var dimensions = {
			width:  (6 + width)  * this.meta_w * this.tile_w,
			height: (6 + height) * this.meta_h * this.tile_h,
		}

		Object.update(this.drawcanvas, dimensions, { careful: true })

		dimensions.width  *= this.scale
		dimensions.height *= this.scale
		Object.update(this.canvas, dimensions, { careful: true })

		this.drawMap(map)
		this.drawMapBorder(map)
		this.drawConnections(map)

		var context = this.canvas.getContext('2d')
		context.drawImage(
			this.drawcanvas,
			0, 0, this.drawcanvas.width, this.drawcanvas.height,
			0, 0, this.canvas.width, this.canvas.height
		)

		this.drawSelection()
		this.darkenMapBorder()

	},

	getCurrentMap: function () {
		return Data.maps[this.current_map]
	},

	renderEvents: function () {
		var all_npcs = this.getAllEvents()

		all_npcs.forEach(function (npc) {
			if (npc.image_path && npc.element) {
				var bg = 'url(' + npc.image_path + ')'
				if (bg !== npc.element.style.background) {
					npc.element.style.background = bg
				}
			}
		})

		all_npcs.forEach(function (npc) {
			if (npc.element) {
				npc.element.style.left = (parseInt(npc.x) + 6) * 16 + 'px'
				npc.element.style.top = (parseInt(npc.y) + 6) * 16 + 'px'
			}
		})

		this.addNewEvents()
	},

	getEvents: function () {
		var events = this.getCurrentMap().events
		return events || {}
	},

	getAllEvents: function () {
		var events = this.getEvents()
		var all_npcs = [].concat(
			events.npcs || [],
			events.warps || [],
			events.traps || [],
			events.signs || []
		)
		return all_npcs
	},

	addNewEvents: function () {
		// Remove any unused events, without re-adding existing ones.

		var all_npcs = this.getAllEvents()

		var container = this.container
		var children = this.container.children

		function is_npc (child) {
			var classes = ['npc', 'warp', 'sign', 'trap']
			for (var i = 0; i < classes.length; i++) {
				if (child.className.indexOf(classes[i]) !== -1) {
					return true
				}
			}
			return false
		}

		// Get a list of all the events.
		var remove = []
		for (var i = 0; i < children.length; i++) {
			var child = children[i]
			if (is_npc(child)) {
				remove.push(child)
			}
		}

		// Remove existing events from the list, and add events who don't exist yet.
		all_npcs.forEach(function (npc) {
			var index = remove.indexOf(npc.element)
			if (index !== -1) {
				remove.splice(index, 1)
			} else {
				container.appendChild(npc.element)
			}
		})

		remove.forEach(function (child) {
			container.removeChild(child)
		})

	},

	drawMap: function (map) {
		var height = Data.maps[map].height
		var width = Data.maps[map].width
		for (var y = 0; y < height; y++)
		for (var x = 0; x < width; x++) {
			this.drawMetatile(map, x, y)
		}
	},

	drawConnections: function (map) {

		var connections = Data.maps[map].attributes.connections
		for (var c in connections) {
			var connection = connections[c]
			if (!Data.maps[connection.name]) {
				continue
			}
			if (!Data.maps[connection.name].loaded) {
				continue
			}
			var info = getConnectionInfo(connection, Data.maps[map], Data.maps[connection.name])
			if (!info) {
				continue
			}

			var strip_x = info.strip_x
			var strip_y = info.strip_y
			var strip_width = info.strip_width
			var strip_height = info.strip_height
			var other_start = info.other_start

			var direction = connection.direction
			var other_map = Data.maps[connection.name]

			if (other_map.blockdata) {
				for (var y = strip_y; y < strip_y + strip_height; y++)
				for (var x = strip_x; x < strip_x + strip_width; x++) {
					if (other_map.blockdata) {

						var block = other_map.blockdata[
							other_start
							+ (x - strip_x)
							+ (y - strip_y) * other_map.width
						]

						/* connections compete with border, so maybe force for now */
						//this.setBlock(x, y, -1) // force
						this.drawMetatile(connection.name, x, y, block)
					}
				}
			}
		}
	},

	drawMapBorder: function (map) {
		var border_block = Data.maps[map].attributes.border_block
		var width = Data.maps[map].width
		var height = Data.maps[map].height
		for (var y = -3; y < height + 3; y++)
		for (var x = -3; x < width + 3; x++) {
			if (y >= 0 && y < height) {
				if (x >= 0 && x < width) {
					x = width
				}
			}
			this.drawMetatile(map, x, y, border_block)
		}
	},

	darkenMapBorder: function () {

		var map = this.current_map
		var width = Data.maps[map].width
		var height = Data.maps[map].height

		var block_w = this.tile_w * this.meta_w
		var block_h = this.tile_h * this.meta_h

		var context = this.canvas.getContext('2d')
		var self = this
		var fillRect = function (x, y, w, h) {
			x *= self.scale * block_w
			y *= self.scale * block_h
			w *= self.scale * block_w
			h *= self.scale * block_h
			context.fillRect(x, y, w, h)
		}

		var connections = Data.maps[map].attributes.connections
		var cinfo = {}
		for (var c in connections) {
			var connection = connections[c]
			var info = getConnectionInfo(connection, Data.maps[map], Data.maps[connection.name])
			if (info) {
				cinfo[c] = info
			}
		}

		context.save()
		context.fillStyle = 'rgba(0, 0, 0, 0.2)'
		for (var y = 0; y < height + 6; y++)
		for (var x = 0; x < width + 6; x++) {
			if (y >= 3 && y < height + 3)
			if (x >= 3 && x < width + 3) {
				continue
			}
			var in_connection = false
			for (var dir in cinfo) {
				var c = cinfo[dir]
				if (y >= c.strip_y + 3 && y < c.strip_y + 3 + c.strip_height)
				if (x >= c.strip_x + 3 && x < c.strip_x + 3 + c.strip_width) {
					in_connection = true
					break
				}
			}
			if (in_connection) {
				continue
			}
			fillRect(x, y, 1, 1)
		}
		context.restore()
	},

	getSelection: function (event) {
		this.selection = getCanvasSelection(event, this.canvas, this.drawcanvas)
	},

	drawSelection: function () {

		if (!this.selection) {
			return
		}

		var context = this.canvas.getContext('2d')
		var self = this
		var fillRect = function (x, y, w, h) {
			x *= self.scale
			y *= self.scale
			w *= self.scale
			h *= self.scale
			context.fillRect(x, y, w, h)
		}

		var x = this.selection.x
		var y = this.selection.y

		var tile_w = this.tile_w
		var tile_h = this.tile_h
		var block_w = tile_w * this.meta_w
		var block_h = tile_h * this.meta_h

		context.save()

		context.globalCompositeOperation = 'lighten'

		context.fillStyle = 'rgba(255, 80, 80, 20)'
		fillRect(x - x % block_w, y - y % block_h, block_w, block_h)

		context.fillStyle = 'rgba(255, 170, 170, 20)'
		fillRect(x - x % tile_w,  y - y % tile_h,  tile_w,  tile_h)

		context.fillStyle = 'rgba(255, 80, 80, 20)'
		var connections = Data.maps[this.current_map].attributes.connections
		for (var direction in connections) {
			var connection = connections[direction]
			var info = getConnectionInfo(connection, Data.maps[this.current_map], Data.maps[connection.name])
			if (!info) continue

			var x1 = info.x1 * block_w
			var x2 = info.x2 * block_w
			var y1 = info.y1 * block_h
			var y2 = info.y2 * block_h
			if (x >= x1 && x < x2)
			if (y >= y1 && y < y2) {
				fillRect(x1, y1, x2-x1, y2-y1)
			}
		}

		context.restore()

	},

	getBlock: function (x, y) {
		var row = this.blockdata[x + 3]
		if (!row) {
			return undefined
		}
		return row[y + 3]
	},

	setBlock: function (x, y, block) {
		var width = Data.maps[this.current_map].width
		if (!this.blockdata[x + 3]) {
			this.blockdata[x + 3] = new Array(width + 6)
		}
		this.blockdata[x + 3][y + 3] = block
	},

	blockChanged: function (x, y, block) {
		return this.getBlock(x, y) !== block
	},

	drawMetatile: function (map, x, y, block, options) {
		map = map || this.current_map

		if (typeof block === 'undefined') {
			block = getBlock(map, x, y)
		}

		if (!this.blockChanged(x, y, block)) {
			return false
		} else {
			this.setBlock(x, y, block)
		}

		var border_block = Data.maps[map].attributes.border_block
		block = block || border_block

		x += this.origin.x
		y += this.origin.y

		var meta_w = this.meta_w
		var meta_h = this.meta_h
		var tile_w = this.tile_w
		var tile_h = this.tile_h

		drawMetatile({
			x: x,
			y: y,
			block: block,
			tileset: getTileset(map),
			roof: Data.maps[map].header.group,
			permission: Data.maps[map].header.permission,
			context: this.drawcanvas.getContext('2d'),
			tile_w: tile_w,
			tile_h: tile_h,
			meta_w: meta_w,
			meta_h: meta_h,
		})

		if (options) {
			var block_w = meta_w * tile_w
			var block_h = meta_h * tile_h
			var drawcontext = this.drawcanvas.getContext('2d')
			drawcontext.save()
			Object.update(drawcontext, options)
			drawcontext.fillRect(x * block_w, y * block_h, block_w, block_h)
			drawcontext.restore()
		}

		return true
	},
}

var drawMetatile = function (props) {
	/*
	props: {x, y, block, tileset, context, tile_w, tile_h, meta_w, meta_h[, roof, permission]}
	*/

	var tiles = getTilesetTiles(props.tileset, props.roof)

	var block_w = props.tile_w * props.meta_w
	var block_h = props.tile_h * props.meta_h
	var block = props.block < props.tileset.metatiles.length ? props.block : 0
	var metatile = props.tileset.metatiles[block]
	if (!metatile) return false
	var row_index = 0
	var tile_y = 0
	for (var y = 0; y < props.meta_h; y++) {
	for (var x = 0; x < props.meta_w; x++) {
		var cur_tile = metatile[x + row_index]
		if (cur_tile >= 0x80) {
			cur_tile -= 0x20
		}
		if (cur_tile >= tiles.length) {
			cur_tile = 0
		}
		var tile = tiles[cur_tile]
		props.context.drawImage(
			tile,
			props.x * block_w + x * props.tile_w,
			props.y * block_h + tile_y
		)
	}
		row_index += props.meta_w
		tile_y += props.tile_h
	}
	return true
}

function loadMapDimensions (name) {
	return getMapDimensions(name)
	.then(function (data) {
		Data.maps[name].group = data.group
		Data.maps[name].num = data.num
		Data.maps[name].width = data.width
		Data.maps[name].height = data.height
	})
}

function getMapDimensions (name) {

	var map_constant = Data.maps[name].attributes.map

	return getMapConstantsText().then(function (text) {
		var group = 0
		var num = 0
		var r = new rgbasm()
		r.macros.newgroup = function (values) {
			group += 1
			num = 0
		}
		r.macros.mapgroup = function (values) {
			if (map_constant === values.shift()) {
				return {
					group: group,
					num: num,
					height: values.shift(),
					width: values.shift()
				}
			}
		}
		return r.read(text) || false
	})
}

function loadMap(name) {
	if (!Data.maps[name]) {
		Data.maps[name] = {}
	}
	var header_promise = Promise.all([
		loadMapHeader(name),
		loadMapAttributes(name),
	])
	var map_promise = header_promise.then(function () {
		return Promise.all([
			loadBlockdata(name),
			loadMapTileset(name),
			loadMapDimensions(name)
		])
	})
	var event_promise = header_promise.then(function () {
		return loadMapEvents(name)
	})
	event_promise.then(function () {
		parseEvents(Data.maps[name].events)
	})
	return Promise.all([
		header_promise,
		map_promise,
		event_promise,
	])
	.then(function () {
		Data.maps[name].loaded = true
	})
}

function loadBlockdata (name) {
	return request(config.getBlockdataPath(name), { binary: true, cache: false })
	.then(function (blockdata) {
		Data.maps[name].blockdata = blockdata
	})
}

function loadMapTileset (name) {
	return Promise.all([
		loadTileset(Data.maps[name].header.tileset),
		loadMapRoof(name)
	])
	.then(function () {
		getTilesetWithRoof(Data.maps[name].header.tileset, Data.maps[name].header.group)
	})
}

function getConnectionInfo (connection, map, other) {

	if (!map) return false
	if (!other) return false

	var direction = connection.direction

	var strip_y = {
		north: -3,
		south: map.height,
		west: connection.align,
		east: connection.align,
	}[direction]

	var strip_x = {
		north: connection.align,
		south: connection.align,
		west: -3,
		east: map.width,
	}[direction]

	var strip_length = connection.strip_length

	var strip_height = {
		north: 3,
		south: 3,
		west: strip_length,
		east: strip_length,
	}[direction]

	var strip_width = {
		north: strip_length,
		south: strip_length,
		west: 3,
		east: 3,
	}[direction]

	var other_start = {
		north: connection.offset + other.width * (other.height - 3),
		south: connection.offset,
		west: other.width * connection.offset + other.width - 3,
		east: other.width * connection.offset,
	}[direction]

	var x1 = strip_x + 3
	var x2 = x1 + strip_width
	var y1 = strip_y + 3
	var y2 = y1 + strip_height

	return {
		strip_y: strip_y,
		strip_x: strip_x,
		strip_width: strip_width,
		strip_height: strip_height,
		other_start: other_start,
		x1: x1,
		x2: x2,
		y1: y1,
		y2: y2,
	}
}

function getMapBlock(map, x, y) {
	if (!map.blockdata) return -1
	return map.blockdata[x + y * map.width]
}

function setMapBlock(map, x, y, block) {
	if (y >= 0 && y < map.height)
	if (x >= 0 && x < map.width) {
		map.blockdata[x + y * map.width] = block
	}
}


function imagePromise(image) {
	return new Promise( function (resolve, reject) {
		image.onload = resolve
		image.onerror = reject
	})
}

function loadTileset (id) {
	if (!Data.tilesets[id]) {
		Data.tilesets[id] = { id: id, }
	}
	return Promise.all([
		loadMetatiles(id),
		loadPalmap(id),
		loadPalette(id),
		loadTilesetImage(id)
	])
	.then(function () {
		readTiles(id)
	})
}

function loadMetatiles(id) {
	return request(config.getMetatilePath(id), { binary: true })
	.then(function (data) {
		return serializeMetatiles(data)
	})
	.then(function (metatiles) {
		Data.tilesets[id].metatiles = metatiles
		Data.tilesets[id].blockdata = range(metatiles.length)
	})
}

function loadPalmap(id) {
	return request(config.getPalmapPath(id))
	.then(function (data) {
		return serializePalmap(data)
	}, function () {
		return [].concat(
			new Array(0x60).fill(0),
			new Array(0x80).fill(8)
		)
	})
	.then(function (palmap) {
		Data.tilesets[id].palmap = palmap
	})
}

function loadPalette(id) {
	return request(config.getPalettePath(id))
	.then(function (text) {
		var all_palettes = readPalette(text)
		var palettes = {}
		var times = ['morn', 'day', 'nite', 'dark']
		times.forEach(function (time, i) {
			var index = i * 8
			palettes[time] = all_palettes.slice(index, index + 8)
		})
		return palettes
	})
	.then(function (palettes) {
		Data.tilesets[id].palettes = palettes
	})
}

function loadTilesetImage(id) {
	var image = new Image()
	image.src = config.getTilesetImagePath(id)
	image.setAttribute('validate', 'always')
	return imagePromise(image)
	.then(function () {
		Data.tilesets[id].image = image
	})
}

function readTiles(id) {
	var tileset = Data.tilesets[id]
	var palette = tileset.palettes[config.time]
	var tiles = colorizeTiles(tileset.image, palette, tileset.palmap)
	Data.tilesets[id].tiles = tiles
}

function serializeMetatiles (data) {
	var meta_w = 4
	var meta_h = 4
	var metatiles = subdivide(data, meta_w * meta_h)
	return metatiles
}

function serializePalmap (data) {
	var colors = ['gray', 'red', 'green', 'water', 'yellow', 'brown', 'roof', 'text']
	var getColor = function (color) { return colors.indexOf(color.toLowerCase()) }

	var list = []
	var r = new rgbasm()
	r.macros.tilepal = function (values) {
		var bank = values.shift()
		while (values.length) {
			list.push((bank << 3) | getColor(values.shift()))
		}
	}
	r.macros.db = function (values) {
		while (values.length) {
			var value = values.shift()
			list.push((value >> 4) & 0xf)
			list.push(value & 0xf)
		}
	}
	r.read(data)
	return list
}

function readPalette (text, colors_per_pal) {
	if (typeof colors_per_pal === 'undefined') colors_per_pal = 4
	var palettes = subdivide(serializeRGB(text), colors_per_pal)
	return palettes
}


function loadMapRoof (map_name) {
	var map = Data.maps[map_name]
	return loadRoof(map.header.group)
}

function loadRoof (roof) {
	if (!Data.roofs[roof]) {
		Data.roofs[roof] = {}
	}
	return Promise.all([
		loadRoofPalette(roof),
		loadRoofImage(roof)
	])
	.then(function () {
		//readRoofTiles(roof)
	})
}

function loadRoofPalette (roof) {
	return request(config.getRoofPalettePath(roof))
	.then(function (text) {
		var all_palettes = readPalette(text, 2)
		var palettes = {}
		var times = ['morn', 'day', 'nite', 'dark']
		times.forEach(function (time, i) {
			var index = roof * 2 + (i >> 1)
			palettes[time] = all_palettes[index]
		})
		return palettes
	})
	.then(function (palettes) {
		Data.roofs[roof].palettes = palettes
	})
}

function loadRoofImage(roof) {
	var image = new Image()
	image.src = config.getRoofImagePath(roof)
	image.setAttribute('validate', 'always')
	return imagePromise(image)
	.then(function () {
		Data.roofs[roof].image = image
	})
}

function readRoofTiles(roof) {
	var roof = Data.roofs[roof]
	var palette = roof.palettes[config.time]
	var tiles = colorizeTiles(roof.image, palette)
	roof.tiles = tiles
}


function getTilesetWithRoof (id, r) {
	var tileset = Data.tilesets[id]
	var roof = Data.roofs[r]
	if (!tileset.with_roofs) {
		tileset.with_roofs = {}
	}
	if (!tileset.with_roofs[r]) {
		tileset.with_roofs[r] = {}
	}

	var palette = tileset.palettes[config.time].slice()
	var roof_palette = roof.palettes[config.time]
	if (typeof roof_palette !== 'undefined') {
		palette[6] = palette[6].slice()
		palette[6][1] = roof_palette[0]
		palette[6][2] = roof_palette[1]
	}

	var tiles = colorizeTiles(tileset.image, palette, tileset.palmap)
	tileset.with_roofs[r].tiles_just_palette = tiles

	var roof_tiles = colorizeTiles(roof.image, [palette[6]])
	tiles = mergeRoofTiles(tiles.slice(), roof_tiles)
	tileset.with_roofs[r].tiles = tiles
}

function mergeRoofTiles(tiles, roof_tiles) {
	roof_tiles.forEach(function (tile, i) {
		tiles[i + config.roof_start] = tile
	})
	return tiles
}


function serializeRGB(text) {
	var colors = []
	var r = new rgbasm()
	r.macros.RGB = function (values) {
		colors.push(values.map(function (x) { return x * 8.25 }))
	}
	r.read(text)
	return colors
}

function colorizeTiles(img, palette, palmap) {

	var image = getRawImage(img)
	var data = image.imageData
	var width = image.width
	var height = image.height

	var tiles = []

	var x1 = 0, y1 = 0, x2, y2
	var pal
	for (var tile = 0; y1 < height; tile++) {

		x2 = x1 + 8
		y2 = y1 + 8

		if (palmap) {
			var i = palmap[tile >= 0x60 ? tile + 0x20 : tile]
			pal = palette[i & 7]
		} else {
			pal = palette[0]
		}

		var tileImage = colorize(image, pal, x1, y1, x2, y2)
		var tileCanvas = createElement('canvas', { width: 8, height: 8 })
		tileCanvas.getContext('2d').putImageData(tileImage, 0, 0)
		tiles.push(tileCanvas)

		x1 += 8
		if (x1 >= width) {
			x1 = 0
			y1 += 8
		}
	}

	return tiles

}

function colorize(image, palette, x1, y1, x2, y2) {
	var data = image.data
	var width = image.width
	var height = image.height
	if (x1 === undefined) x1 = 0
	if (y1 === undefined) y1 = 0
	if (x2 === undefined) x2 = width
	if (y2 === undefined) y2 = height
	var template = getImageTemplate(x2 - x1, y2 - y1)
	var px, pi, color
	for (var y = y1; y < y2; y++)
	for (var x = x1; x < x2; x++) {
		px = (x + y * width) * 4
		tx = ((x - x1) + (y - y1) * (x2 - x1)) * 4
		pi = 3 - data[px+0] / 85
		color = palette[pi]
		template.data[tx+0] = color[0]|0
		template.data[tx+1] = color[1]|0
		template.data[tx+2] = color[2]|0
		template.data[tx+3] = data[px+3]
	}
	return template
}


function getRawImage(img) {
	var ctx = createElement('canvas', { width: img.width, height: img.height }).getContext('2d')
	ctx.drawImage(img, 0, 0)
	var imageData = ctx.getImageData(0, 0, img.width, img.height)
	return imageData
}

function getImageTemplate(width, height) {
	var ctx = createElement('canvas', { width: width, height: height }).getContext('2d')
	return ctx.createImageData(width, height)
}


