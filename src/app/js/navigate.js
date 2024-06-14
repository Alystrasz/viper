const events = require("./events");
const popups = require("./popups");
const settings = require("./settings");

let navigate = {};

// sets `#selection` to the correct position, size and border radius,
// according to what is currently the `.active-selection`, if none is
// found, it'll instead be hidden
navigate.selection = () => {
	// shorthands
	let selection_el = document.getElementById("selection");
	let active_el = document.querySelector(".active-selection");

	// make sure there's an `active_el`, and hide the `selection_el` if
	// that isn't the case
	if (! active_el) {
		selection_el.style.opacity = "0.0";
		return;
	}


	// this adds space between the `selection_el` and ``
	let padding = 8;


	// attempt to get the border radius of `active_el`
	let radius = getComputedStyle(active_el).borderRadius;

	// if there's no radius set, we default to the default of
	// `selection_el` through using `null`
	if (! radius || radius == "0px") {
		radius = null;
	}

	// set visibility and radius
	selection_el.style.opacity = "1.0";
	selection_el.style.borderRadius = radius;

	// get bounds for position and size calculations of `selection_el`
	let active_bounds = active_el.getBoundingClientRect();

	// set top and left side coordinate subtracting the padding
	selection_el.style.top = active_bounds.top - padding + "px";
	selection_el.style.left = active_bounds.left - padding + "px";

	// set width of `selection_el` with the padding
	selection_el.style.width =
		active_bounds.width + (padding * 2) + "px";

	// set height of `selection_el` with the padding
	selection_el.style.height =
		active_bounds.height + (padding * 2) + "px";
}

// these events cause the `#selection` element to reposition itself
window.addEventListener("resize", () => {navigate.selection()}, true);
window.addEventListener("scroll", () => {navigate.selection()}, true);

// listen for click events, and hide the `#selection` element, when
// emitting a mouse event we will want to hide, as it then isn't needed
window.addEventListener("click", (e) => {
	// make sure its a trusted click event, and therefore actually a
	// mouse, and not anything else
	if (! e.isTrusted) {
		return;
	}

	// get the `.active-selection`
	let active_el = document.querySelector(".active-selection");

	// if there's an `active_el` then we unselect it, and update the
	// `#selection` element, hiding it
	if (active_el) {
		active_el.classList.remove("active-selection");
		navigate.selection();
	}
})

// returns a list of valid elements that should be possible to navigate
// to/select with the `#selection` element
//
// setting `div` makes it limit itself to elements inside that, without
// it, it'll use `document.body` or the active popup, if one is found
navigate.get_els = (div) => {
	let els = [];

	// is `div` not set, and is there a popup shown
	if (! div && document.body.querySelector(".popup.shown")) {
		// the spread operator is to convert from a `NodeList` to an
		// `Array`, and then we need to reverse this to get the ones
		// that are layered on top first.
		let popups_list = [...popups.list()].reverse();

		// run through the list of popups
		for (let i = 0; i < popups_list.length; i++) {
			// if this popup is shown, we make it the current `div`
			if (popups_list[i].classList.contains("shown")) {
				div = popups_list[i];
				break;
			}
		}

		// get buttons inside `#winbtns`
		els = [...document.body.querySelectorAll("#winbtns [onclick]")];
	} if (! div) { // default
		div = document.body;
	}

	// this gets the list of all the elements we should be able to
	// select inside `div`, on top of anything that's already in `els`
	els = [...els, ...div.querySelectorAll([
		"a",
		"input",
		"button",
		"select",
		"textarea",
		"[onclick]"
	])]

	// this'll contain a filtered list of `els`
	let new_els = [];

	// filter out elements we don't care about
	filter: for (let i = 0; i < els.length; i++) {
		// elements that match on `els.closest()` with any of these will
		// be stripped away, as we dont want them
		let ignore_closest = [
			"#overlay",
			".no-navigate",
			"button.visual",
			".popup:not(.shown)"
		]

		// check if `els[i].closest()` matches on any of the elements
		// inside of `ignore_closest`
		for (let ii = 0; ii < ignore_closest.length; ii++) {
			if (els[i].closest(ignore_closest[ii])) {
				// it matches
				continue filter;
			}
		}

		// make sure `els[i]` is visible on screen
		let visible = els[i].checkVisibility({
			checkOpacity: true,
			visibilityProperty: true,
			checkVisibilityCSS: true,
			contentVisibilityAuto: true
		})

		// filter out if not visible
		if (! visible) {continue}

		// add to filtered list
		new_els.push(els[i])
	}

	// return the filtered list of elements
	return new_els;
}

// attempts to select the currently default selection, if inside a popup
// we'll look for a `.default-selection`, if it doesn't exist we'll
// simply use the first selectable element in it
//
// if not inside a popup we'll just use the currently selected tab in
// the `.gamesContainer` sidebar
navigate.default_selection = () => {
	// the spread operator is to convert from a `NodeList` to an
	// `Array`, and then we need to reverse this to get the ones
	// that are layered on top first.
	let popups_list = [...popups.list()].reverse();

	let active_popup;

	// run through the list of popups
	for (let i = 0; i < popups_list.length; i++) {
		// if this popup is shown, set set `active_popup` to it
		if (popups_list[i].classList.contains("shown")) {
			active_popup = popups_list[i];
			break;
		}
	}

	// is there no active popup?
	if (! active_popup) {
		// select the currently selected page in `.gamesContainer`
		document.querySelector(
			".gamesContainer :not(.inactive)"
		).classList.add("active-selection");

		// update the `#selection` element
		navigate.selection();

		return;
	}

	// get the default element inside the active popup
	let popup_default = active_popup.querySelector("default-selection");

	// did we not find a default selection element?
	if (! popup_default) {
		// select the first selectable element in the popup
		navigate.get_els(active_popup)[0].classList.add(
			"active-selection"
		)

		// update the `#selection` element
		navigate.selection();

		return;
	}

	// select the default selection
	popup_default.classList.add("active-selection");

	// update the `#selection` element
	navigate.selection();
}

// this navigates `#selection` in the direction of `direction`
// this can be: up, down, left and right
navigate.move = (direction) => {
	// get the `.active-selection` if there is one
	let active = document.querySelector(".active-selection");

	// if there is no active selection, then attempt to select the
	// default selection
	if (! active) {
		navigate.default_selection()

		active = document.querySelector(".active-selection");

		// if there is somehow still no active selection we stop here
		if (! active) {
			return;
		}
	}

	// attempt to get the element in the `direction` requested
	let move_to_el = navigate.get_relative_el(active, direction);

	// if no element is found, do nothing
	if (! move_to_el) {return}

	// switch `.active-selection` from `active` to `move_to_el`
	active.classList.remove("active-selection");
	move_to_el.classList.add("active-selection");

	// update the `#selection` element
	navigate.selection();

	// make sure the selecting classes are removed, and thereby the
	// scale/pressed effect with it
	document.getElementById("selection").classList.remove(
		"keyboard-selecting",
		"controller-selecting"
	)

	// stop here if `move_to_el` is a child to `document.body`
	if (move_to_el.parentElement == document.body) {
		return;
	}

	// this element will be scrolled in view later
	let scroll_el = move_to_el;

	// these elements cant be scrolled
	let no_scroll_parents = [
		".el .text",
		".gamesContainer"
	]

	// run through unscrollable parent elements
	for (let i = 0; i < no_scroll_parents.length; i++) {
		// check if `move_to_el.closest()` matches on anything in
		// `no_scroll_parents`
		let no_scroll_parent = move_to_el.closest(
			no_scroll_parents[i]
		)

		if (! no_scroll_parent) {
			// it does not match
			continue;
		}

		// it matches, so we make the new `scroll_el` the parent
		scroll_el = no_scroll_parent;
	}

	// refuse to scroll to begin with, if any of these are a parent
	let ignore_parents = [
		".contentMenu",
		".gamesContainer",
	]

	// check if `ignore_parents` match on `move_to_el`, and if so, stop
	for (let i = 0; i < ignore_parents.length; i++) {
		if (move_to_el.closest(ignore_parents[i])) {
			return;
		}
	}

	// scroll `scroll_el` smoothly into view, centered
	scroll_el.scrollIntoView({
		block: "center",
		inline: "center",
		behavior: "smooth",
	})
}

// selects the currently selected element, by clicking or focusing it
navigate.select = () => {
	// get the current selection
	let active = document.querySelector(".active-selection");

	// make sure there is a selection
	if (! active) {return}

	// slight delay to prevent some timing issues
	setTimeout(() => {
		// if `active` is a switch, use `settings.popup.switch()` on it,
		// to be able to toggle it
		if (active.closest(".switch")) {
			settings.popup.switch(active.closest(".switch"));
			return;
		}

		// click and focus `active`
		active.click();
		active.focus();
	}, 150)
}

// selects the closest and hopefully most correct element to select next
// to `relative_el` in the direction of `direction`
//
// the direction can be: up, down, left and right
navigate.get_relative_el = (relative_el, direction) => {
	// get selectable elements
	let els = navigate.get_els();

	// get bounds of `relative_el`
	let bounds = relative_el.getBoundingClientRect();

	// get the centered coordinates of `relative_el`
	let relative = {
		x: bounds.left + (bounds.width / 2),
		y: bounds.top + (bounds.height / 2)
	}

	// update the coordinates on the element itself
	relative_el.coords = relative;

	// attempt to return the element in the correct direction
	// if `x` or `y` is a number that's greater or less than 0 then
	// we'll go in the direction of the coordinate that is as such
	//
	// meaning `get_el(1, 0)` will go to the right
	let get_el = (x = 0, y = 0) => {
		// `coord` is the coordinate that we're trying to get an element
		// on, and `rev_coord` is just the opposite coord
		let coord, rev_coord;

		// set `coord` and `rev_coord` according to `x` and `y`
		if (x > 0 || x < 0) {
			coord = "x";
			rev_coord = "y";
		} else if (y > 0 || y < 0) {
			coord = "y";
			rev_coord = "x";
		} else { // something unexpected was given
			return false;
		}

		// this is the distance between each point which we check for
		// selectable elements, increasing this improves performance,
		// but lowers accuracy, and likewise in reverse
		let jump_distance = 5;

		// this is the coordinates to check in the direct coord check
		let check = {
			x: relative.x,
			y: relative.y
		}

		// this will contain the element that directly next to
		// `relative_el` from checking every point from `relative_el`
		// into `direction`
		let direct_el;

		// this is the amount of pixels inbetween `relative_el` and
		// `direct_el`, this means it doesn't have the distance from the
		// center of `direct_el` or anything included, just the raw
		// distance between them, this number could vary in accuracy
		// depending on how big or small `jump_distance` is
		let direct_distance = 0;

		// attempt to find an element from a straight line from
		// `relative_el`, by checking whether there's an element at each
		// point in the `direction` specified
		while (! direct_el) {
			// add `jump_distance` to the coordinates we're checking
			check.x += x * jump_distance;
			check.y += y * jump_distance;

			// get the elements at the coordinates we're checking
			let els_at = document.elementsFromPoint(check.x, check.y);

			// run through all the elements we found
			for (let i = 0; i < els_at.length; i++) {
				// make sure `els_at[i]` isn't `relative_el` and that
				// its a selectable element
				if (els_at[i] == relative_el
					|| ! els.includes(els_at[i])) {

					// not selectable or is `relative_el`
					continue;
				}

				// set `direct_el`
				direct_el = els_at[i];

				// get the bounds of `direct_el`
				let direct_bounds = direct_el.getBoundingClientRect();

				// get the centered coordinates for `direct_el`
				let direct_coords = {
					x: direct_bounds.left + (direct_bounds.width / 2),
					y: direct_bounds.top + (direct_bounds.height / 2)
				}

				// update the coordinates on the element itself
				direct_el.coords = direct_coords;

				// get the difference between `relative_el` and
				// `direct_el`'s coordinates, effectively their distance
				let diff_x = direct_coords.x - relative.x;
				let diff_y = direct_coords.y - relative.y;

				// make sure this element is marked as the element that
				// was found directly
				direct_el.is_direct_el = true;

				// update the distance on the element itself
				direct_el.distance = Math.sqrt(
					diff_x*diff_x + diff_y*diff_y
				)

				// set the distance on the coord we're checking on the
				// element itself
				direct_el.coord_distance = direct_distance;

				break; // we found the `direct_el` we can stop now
			}

			// if `els_at` has `relative_el` then we reset
			// `direct_distance`
			if (els_at.includes(relative_el)) {
				direct_distance = 0;
			} else {
				// add `jump_distance` to `direct_distance`, because
				// we're no longer on the `relative_el` nor the
				// `direct_el`
				direct_distance += jump_distance;
			}

			// are we beyond the edges of the window
			if (check.x < 0 || check.y < 0 ||
				check.x > innerWidth || check.y > innerHeight) {

				// did we find no elements?
				if (! els_at.length) {
					break; // stop searching
				}
			}
		}

		// this contains elements in the respective directions
		let positions = {
			up: [], down: [],
			left: [], right: []
		}

		// gets the nearest elements from the selectable elements
		for (let i = 0; i < els.length; i++) {
			// get bounds
			let el_bounds = els[i].getBoundingClientRect();

			// get centered coordinates
			let el_coords = {
				x: el_bounds.left + (el_bounds.width / 2),
				y: el_bounds.top + (el_bounds.height / 2)
			}

			// get the difference between `el_coords` and `direct_el`'s
			// coordinates, effectively their distance
			let diff_x = el_coords.x - relative.x;
			let diff_y = el_coords.y - relative.y;

			// is this element not an element that was previously a
			// `direct_el`?
			if (! els[i].is_direct_el) {
				// update centerd coordinates on the element itself
				els[i].coords = el_coords;

				// set the distance on the element itself
				els[i].distance = Math.sqrt(
					diff_x*diff_x + diff_y*diff_y
				)

				// get and set the distance on the coord we're checking
				// on the element itself
				els[i].coord_distance = Math.abs(
					relative[coord] - el_coords[coord]
				)
			} else {
				els[i].is_direct_el = false;
				continue;
			}

			// put `els[i]` in the correct place in `positions`
			if (el_coords.x < relative.x) {
				positions.left.push(els[i]);
			} if (el_coords.x > relative.x) {
				positions.right.push(els[i]);
			} if (el_coords.y < relative.y) {
				positions.up.push(els[i]);
			} if (el_coords.y > relative.y) {
				positions.down.push(els[i]);
			}
		}

		// this will contain the element closest to `relative_el` in the
		// correct direction, but not necessarily at the same
		// coordinates
		let closest_el;

		// set `closest_el` to the elements closest element in the
		// respective position using `direction`
		for (let i = 0; i < positions[direction].length; i++) {
			// get the element
			let el = positions[direction][i];

			// is this the first check, or is it closer than the
			// previous `closest_el`, then update `closest_el`
			if (! closest_el || closest_el.distance > el.distance) {
				closest_el = el;
			}
		}

		// was there found a `closest_el` and `direct_el`
		if (closest_el && direct_el) {
			// simply return `direct_el` if its the same as `closest_el`
			if (closest_el == direct_el) {
				return direct_el;
			}

			// if the parent element of `closest_el` and `direct_el` is
			// the same, then we prefer the `direct_el`
			//
			// unless the parent is `document.body`
			if (closest_el.parentElement == direct_el.parentElement &&
				direct_el.parentElement !== document.body) {
				return direct_el;
			}

			// get the difference between `relative_el` and `direct_el`
			// on the coordinate of `direction`
			let same_coord_diff = Math.abs(
				direct_el.coords[rev_coord] -
				relative_el.coords[rev_coord]
			)

			// if the difference is less than 3 then we just return the
			// `direct_el` as its only a couple pixels off being on the
			// same coordinate as `relative_el`
			if (same_coord_diff < 3) {
				return direct_el;
			}

			// get the difference is distance on `direct_el` and
			// `closest_el`
			let difference = Math.abs(
				direct_el.distance - closest_el.distance
			)

			// is the distance les than 50?
			if (difference < 50) {
				// get the difference between `direct_el` and
				// `relative_el`
				let direct_diff = Math.abs(
					direct_el.coords[rev_coord] -
					relative_el.coords[rev_coord]
				)

				// get the difference between `closest_el` and
				// `relative_el`
				let closest_diff = Math.abs(
					closest_el.coords[rev_coord] -
					relative_el.coords[rev_coord]
				)

				// if the `direct_el` is closer to `relative_el`, return
				// that, otherwise return `closet_el`
				if (direct_diff < closest_diff) {
					return direct_el;
				} else if (closest_diff < direct_diff) {
					return closest_el;
				}
			}

			// is `direct_el` closer than `closest_el` in either
			// `.coord_distance` or `.distance`
			//
			// if not just return `closest_el`
			if (direct_el.coord_distance <= closest_el.coord_distance ||
				direct_el.distance <= closest_el.distance) {

				// if `direct_el` is closer in `.coord_distance` then
				// return `direct_el`
				if (direct_el.coord_distance <=
					closest_el.coord_distance) {

					return direct_el;
				}

				// if the difference in `.distance` is less than 50,
				// then return `direct_el`
				if (difference < 50) {
					return direct_el;
				}

				// if the `.distance` is overall closer on `direct_el`
				// than `closest_el` then we return `direct_el`,
				// otherwise we return `closest_el`
				if (direct_el.distance < closest_el.distance) {
					return direct_el;
				} else {
					return closest_el;
				}
			} else { // `direct_el` is unarguably too far away
				return closest_el;
			}
		} else if (! direct_el && ! closest_el) {
			// do nothing if no element at all was found
			return false;
		}

		// return whichever element we did find
		return direct_el || closest_el;
	}

	// translate `direction` into `get_el()` args
	switch(direction) {
		case "up": return get_el(0, -1);
		case "down": return get_el(0, 1);
		case "left": return get_el(-1, 0);
		case "right": return get_el(1, 0);
	}
}

// attempt to reselect the default selection when a popup is either
// closed or opened
events.on("popup-changed", () => {
	// get the active selection
	let active_el = document.querySelector(".active-selection");

	// make sure there is a selection
	if (! active_el) {
		return;
	}

	// remove the currently active selection
	active_el.classList.remove("active-selection");

	// update the `#selection` element
	navigate.selection();

	// wait a moment to allow the popup to open or close completely
	setTimeout(() => {
		// select the default selection
		navigate.default_selection();
	}, 300)
})

module.exports = navigate;
