// Common API code.

if (typeof addEvent != 'function')
{
	var addEvent = function(o, t, f, l)
	{
		var d = 'addEventListener', n = 'on' + t, rO = o, rT = t, rF = f, rL = l;
		if (o[d] && !l) return o[d](t, f, false);
		if (!o._evts) o._evts = {};
		if (!o._evts[t])
		{
			o._evts[t] = o[n] ? { b: o[n] } : {};
			o[n] = new Function('e',
				'var r = true, o = this, a = o._evts["' + t + '"], i; for (i in a) {' +
				'o._f = a[i]; r = o._f(e||window.event) != false && r; o._f = null;' +
				'} return r');
			if (t != 'unload') addEvent(window, 'unload', function() {
				removeEvent(rO, rT, rF, rL);
			});
		}
		if (!f._i) f._i = addEvent._i++;
		o._evts[t][f._i] = f;
	};
	addEvent._i = 1;
	var removeEvent = function(o, t, f, l)
	{
		var d = 'removeEventListener';
		if (o[d] && !l) return o[d](t, f, false);
		if (o._evts && o._evts[t] && f._i) delete o._evts[t][f._i];
	};
}

function cancelEvent(e, c)
{
	e.returnValue = false;
	if (e.preventDefault) e.preventDefault();
	if (c)
	{
		e.cancelBubble = true;
		if (e.stopPropagation) e.stopPropagation();
	}
};



// *** DRAG/RESIZE CODE ***

function DragResize(myName, config)
{
	var props = {
		myName: myName,                  // Name of the object.
		enabled: true,                   // Global toggle of drag/resize.
		handles: ['tl', 'tm', 'tr',
			'ml', 'mr', 'bl', 'bm', 'br'],  // Array of drag handles: top/mid/bot/right.
		allowDragging: true,             // Allow dragging of element
		allowResizing: true,             // Allow resizing of element
		node: null,                      // REQUIRED: Element which should be draggable/resizable (set in .apply())
		element: null,                   // The currently selected this.element.
		handle: null,                    // Active this.handle reference of the this.element.
		minWidth: 10, minHeight: 10,     // Minimum pixel size of elements.
		minLeft: 0, maxLeft: 9999,       // Bounding box area, in pixels.
		minTop: 0, maxTop: 9999,
		gridX: 1, gridY: 1,              // Grid granularity.
		zIndex: 1,                       // The highest Z-Index yet allocated.
		mouseX: 0, mouseY: 0,            // Current mouse position, recorded live.
		lastMouseX: 0, lastMouseY: 0,    // Last processed mouse positions.
		mOffX: 0, mOffY: 0,              // A known offset between position & mouse.
		elmX: 0, elmY: 0,                // this.element position.
		elmW: 0, elmH: 0,                // this.element size.
		allowBlur: true,                 // Whether to allow automatic blur onclick.
		ondragfocus: null,               // Event handler functions.
		ondragstart: null,
		ondragmove: null,
		ondragend: null,
		ondragblur: null
	};

	for (var p in props)
		this[p] = (typeof config[p] == 'undefined') ? props[p] : config[p];
};

DragResize.prototype.apply = function(node) {
	this.node = node;
	var obj = this;
	addEvent(document, 'mousedown', function(e) { obj.mouseDown(e) } );
	addEvent(document, 'mousemove', function(e) { obj.mouseMove(e) } );
	addEvent(document, 'mouseup', function(e) { obj.mouseUp(e) } );
	addEvent(document, 'touchstart', function(e) { obj.mouseDown(e) } );
	addEvent(document, 'touchmove', function(e) { obj.mouseMove(e) } );
	addEvent(document, 'touchend', function(e) { obj.mouseUp(e) } );
}

DragResize.prototype.select = function(newElement) {
	// Selects an this.element for dragging.
	if (!document.getElementById || !this.enabled) return;

	// Activate and record our new dragging this.element.
	if (newElement && (newElement != this.element) && this.enabled)
	{
		this.element = newElement;
		// Elevate it and give it resize handles.
		this.element.style.zIndex = ++this.zIndex;
		if (this.allowResizing && this.resizeHandleSet) this.resizeHandleSet(this.element, true);
		// this.handle (badly) right/bottom positioned elements.
		var eCS = this.element.currentStyle || window.getComputedStyle(this.element, null);
		if (eCS.right)
		{
			this.element.style.left = this.element.offsetLeft + 'px';
			this.element.style.right = '';
		}
		if (eCS.bottom)
		{
			this.element.style.top = this.element.offsetTop + 'px';
			this.element.style.bottom = '';
		}
		// Record this.element attributes for mouseMove().
		this.elmX = parseInt(this.element.style.left);
		this.elmY = parseInt(this.element.style.top);
		this.elmW = this.element.clientWidth || this.element.offsetWidth;
		this.elmH = this.element.clientHeight || this.element.offsetHeight;
		if (this.ondragfocus) this.ondragfocus();
	}
};

DragResize.prototype.deselect = function(delHandles) {
	// Immediately stops dragging an this.element. If 'delHandles' is true, this
	// remove the handles from the this.element and clears the this.element flag,
	// completely resetting the this.element.

	if (!document.getElementById || !this.enabled) return;

	if (delHandles)
	{
		if (this.ondragblur) this.ondragblur();
		if (this.resizeHandleSet) this.resizeHandleSet(this.element, false);
		this.element = null;
	}

	this.handle = null;
	this.mOffX = 0;
	this.mOffY = 0;
};

DragResize.prototype.mouseDown = function(e) {
	// Suitable elements are selected for drag/resize on mousedown.
	// We also initialise the resize boxes, and drag parameters like mouse position etc.
	if (!document.getElementById || !this.enabled) return true;

	// Fake a mousemove for touch devices.
	if (e.touches && e.touches.length) this.mouseMove(e);

	var elm = e.target || e.srcElement,
		newElement = null,
		newHandle = null,
		hRE = new RegExp(this.myName + '-([trmbl]{2})', '');

	while (elm)
	{
		// Loop up the DOM looking for matching elements. Remember one if found.
		if (!newHandle && this.allowResizing && hRE.test(elm.className)) {
			newHandle = elm;
		}
		if (elm == this.node) {
			if (!newHandle) newHandle = elm;
			newElement = elm;
			break;
		}
		elm = elm.parentNode;
	}

	// If this isn't on the last dragged this.element, call deselect(),
	// which will hide its handles and clear this.element.
	if (this.element && (this.element != newElement) && this.allowBlur) this.deselect(true);

	// If we have a new matching this.element, call select().
	if (newElement && newElement === this.node && (!this.element || (newElement == this.element)))
	{
		// Stop mouse selections if we're dragging a this.handle.
		if (newHandle) cancelEvent(e);
		this.select(newElement, newHandle);
		this.handle = newHandle;
		if (this.handle && this.ondragstart) this.ondragstart(hRE.test(this.handle.className));
	}
};

DragResize.prototype.mouseMove = function(e) {
	// This continually offsets the dragged this.element by the difference between the
	// last recorded mouse position (this.mouseX/Y) and the current mouse position.
	if (!document.getElementById || !this.enabled) return true;
	// We always record the current mouse/touch position.
	var mt = (e.touches && e.touches.length) ? e.touches[0] : e;
	this.mouseX = mt.pageX || mt.clientX + document.documentElement.scrollLeft;
	this.mouseY = mt.pageY || mt.clientY + document.documentElement.scrollTop;
	// Record the relative mouse movement, in case we're dragging.
	// Add any previously stored & ignored offset to the calculations.
	var diffX = this.mouseX - this.lastMouseX + this.mOffX;
	var diffY = this.mouseY - this.lastMouseY + this.mOffY;
	this.mOffX = this.mOffY = 0;
	// Update last processed mouse positions.
	this.lastMouseX = this.mouseX;
	this.lastMouseY = this.mouseY;

	// That's all we do if we're not dragging anything.
	if (!this.handle || this.element !== this.node) return true;

	// If included in the script, run the resize this.handle drag routine.
	// Let it create an object representing the drag offsets.
	var isResize = false;
	if (this.resizeHandleDrag && this.resizeHandleDrag(diffX, diffY))
	{
		isResize = true;
	}
	else if (this.allowDragging)
	{
		// If the resize drag handler isn't set or returns false (to indicate the drag was
		// not on a resize this.handle), we must be dragging the whole this.element, so move that.
		// Bounds check left-right...
		var dX = diffX, dY = diffY;
		if (this.elmX + dX < this.minLeft) this.mOffX = (dX - (diffX = this.minLeft - this.elmX));
		else if (this.elmX + this.elmW + dX > this.maxLeft) this.mOffX = (dX - (diffX = this.maxLeft - this.elmX - this.elmW));
		// ...and up-down.
		if (this.elmY + dY < this.minTop) this.mOffY = (dY - (diffY = this.minTop - this.elmY));
		else if (this.elmY + this.elmH + dY > this.maxTop) this.mOffY = (dY - (diffY = this.maxTop - this.elmY - this.elmH));
		this.elmX += diffX;
		this.elmY += diffY;
	}

	// Assign new info back to the this.element, with minimum dimensions / grid align.
	this.element.style.left =   (Math.round(this.elmX / this.gridX) * this.gridX) + 'px';
	this.element.style.top =    (Math.round(this.elmY / this.gridY) * this.gridY) + 'px';
	if (isResize)
	{
		this.element.style.width =  (Math.round(this.elmW / this.gridX) * this.gridX) + 'px';
		this.element.style.height = (Math.round(this.elmH / this.gridY) * this.gridY) + 'px';
	}

	// Evil, dirty, hackish Opera select-as-you-drag fix.
	if (window.opera && document.documentElement)
	{
		var oDF = document.getElementById('op-drag-fix');
		if (!oDF)
		{
			var oDF = document.createElement('input');
			oDF.id = 'op-drag-fix';
			oDF.style.display = 'none';
			document.body.appendChild(oDF);
		}
		oDF.focus();
	}

	if (this.ondragmove) this.ondragmove(isResize);

	// Stop a normal drag event.
	cancelEvent(e);
};


DragResize.prototype.mouseUp = function(e) {
	// On mouseup, stop dragging, but don't reset handler visibility.
	if (!document.getElementById || !this.enabled) return;

	var hRE = new RegExp(this.myName + '-([trmbl]{2})', '');
	if (this.handle && this.element === this.node && this.ondragend) this.ondragend(hRE.test(this.handle.className));
	this.deselect(false);
};

/* Resize Code -- can be deleted if you're not using it. */

DragResize.prototype.resizeHandleSet = function(elm, show) {
	// Either creates, shows or hides the resize handles within an this.element.

	// If we're showing them, and no handles have been created, create new ones.
	if (!elm['_handle_' + this.handles[0]])
	{
		for (var h = 0; h < this.handles.length; h++)
		{
			// Create news divs, assign each a generic + specific class.
			var hDiv = document.createElement('div');
			hDiv.className = this.myName + ' ' +  this.myName + '-' + this.handles[h];
			elm['_handle_' + this.handles[h]] = elm.appendChild(hDiv);
		}
	}

	// We now have handles. Find them all and show/hide.
	for (var h = 0; h < this.handles.length; h++)
	{
		elm['_handle_' + this.handles[h]].style.visibility = show ? 'inherit' : 'hidden';
	}
};


DragResize.prototype.resizeHandleDrag = function(diffX, diffY) {
	// Passed the mouse movement amounts. This function checks to see whether the
	// drag is from a resize this.handle created above; if so, it changes the stored
	// elm* dimensions and this.mOffX/Y.

	var hClass = this.handle && this.handle.className &&
	this.handle.className.match(new RegExp(this.myName + '-([tmblr]{2})')) ? RegExp.$1 : '';

	// If the hClass is one of the resize handles, resize one or two dimensions.
	// Bounds checking is the hard bit -- basically for each edge, check that the
	// this.element doesn't go under minimum size, and doesn't go beyond its boundary.
	var dY = diffY, dX = diffX, processed = false;
	if (hClass.indexOf('t') >= 0)
	{
		if (this.elmH - dY < this.minHeight) this.mOffY = (dY - (diffY = this.elmH - this.minHeight));
		else if (this.elmY + dY < this.minTop) this.mOffY = (dY - (diffY = this.minTop - this.elmY));
		this.elmY += diffY;
		this.elmH -= diffY;
		processed = true;
	}
	if (hClass.indexOf('b') >= 0)
	{
		if (this.elmH + dY < this.minHeight) this.mOffY = (dY - (diffY = this.minHeight - this.elmH));
		else if (this.elmY + this.elmH + dY > this.maxTop) this.mOffY = (dY - (diffY = this.maxTop - this.elmY - this.elmH));
		this.elmH += diffY;
		processed = true;
	}
	if (hClass.indexOf('l') >= 0)
	{
		if (this.elmW - dX < this.minWidth) this.mOffX = (dX - (diffX = this.elmW - this.minWidth));
		else if (this.elmX + dX < this.minLeft) this.mOffX = (dX - (diffX = this.minLeft - this.elmX));
		this.elmX += diffX;
		this.elmW -= diffX;
		processed = true;
	}
	if (hClass.indexOf('r') >= 0)
	{
		if (this.elmW + dX < this.minWidth) this.mOffX = (dX - (diffX = this.minWidth - this.elmW));
		else if (this.elmX + this.elmW + dX > this.maxLeft) this.mOffX = (dX - (diffX = this.maxLeft - this.elmX - this.elmW));
		this.elmW += diffX;
		processed = true;
	}

	return processed;
};

export default DragResize;

