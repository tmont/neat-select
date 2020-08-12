(function(window) {
	const document = window.document;
	const defaultValueText = 'Select a value';
	const clsPrefix = 'neat-select';
	const neatAttrName = 'data-neat-select';
	const defaultMultiInputWidth = 200;
	const neatMap = {};

	let id = 0;

	const getContainerAncestor = (node) => {
		while (node) {
			if (node.className && node.classList.contains(clsPrefix)) {
				return node;
			}

			node = node.parentNode;
		}

		return null;
	};

	const regexEscape = s => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

	const el = (name, attrs) => {
		if (typeof(name) === 'object') {
			attrs = name;
			name = 'div';
		}
		const [ nodeName ] = name.split('.', 1);
		const node = document.createElement(nodeName);
		node.className = name.substring(nodeName.length + 1).replace(/\./g, ' ');
		Object.keys(attrs || {}).forEach((key) => {
			if (key === 'style') {
				Object.keys(attrs.style).forEach((prop) => {
					node.style.setProperty(prop, attrs.style[prop]);
				});
			} else {
				node.setAttribute(key, attrs[key]);
			}
		});
		return node;
	};

	const toArray = x => [].slice.call(x);

	const neatSelect = (options = {}) => {
		if (typeof(options) === 'string' || typeof(options) === 'number') {
			return neatMap[options];
		}

		if (!options || !options.selectElement) {
			throw new Error('neat-select: options.selectElement is required');
		}

		const selectElement = options.selectElement;
		const enableSearch = typeof(options.search) === 'boolean' ? options.search : true;
		const onOptionAdded = typeof(options.onOptionAdded) === 'function' ? options.onOptionAdded : null;

		const existingId = selectElement.getAttribute(neatAttrName);
		if (existingId && neatMap[existingId]) {
			return neatMap[existingId];
		}

		id++;

		const isMultiple = selectElement.hasAttribute('multiple');
		const inputPlaceholder = options.inputPlaceholder || (isMultiple  ? 'Choose some values' : 'Filter values');
		const style = window.getComputedStyle(selectElement);
		const originalSelectDisplay = style.getPropertyValue('display');

		let activeItem;
		let dropdownShowing = false;
		let destroyNeatSelect;
		let hideDropdown;
		let showAndFilterDropdown;
		let addOption;

		const selectedValues = [];

		const getInheritedStyles = (styles) => {
			return styles.reduce((obj, prop) => {
				obj[prop] = style.getPropertyValue(prop);
				return obj;
			}, {});
		};

		const enableNeatSelect = () => {
			const container = el(`div.${clsPrefix}`, {
				[neatAttrName]: id,
				style: {
					position: 'relative',
					...getInheritedStyles([
						'display',
						'margin-top',
						'margin-left',
						'margin-right',
						'margin-bottom',
						'font-family',
						'font-size',
						'color'
					])
				}
			});

			const find = cls => container.querySelector(`.${clsPrefix}-${cls}`);
			const findAll = cls => container.querySelectorAll(`.${clsPrefix}-${cls}`);

			const updateDimensions = () => {
				const width = style.getPropertyValue('width');
				// TODO hardcoding this percent sign is pretty stupid
				if (parseInt(width) && width.indexOf('%') === -1) {
					container.style.minWidth = Math.max(150, parseInt(style.getPropertyValue('width'))) + 'px';
				} else {
					container.style.minWidth = width;
				}
				dropdownContainer.style.width = container.offsetWidth + 'px';
			};

			const toggleDropdown = () => {
				if (dropdownContainer.style.display === 'block') {
					hideDropdown();
				} else {
					showAndFilterDropdown();
				}
			};

			showAndFilterDropdown = (filterValue = '') => {
				noMatchesItem.style.display = 'none';
				noMatchesItem.textContent = '';
				container.classList.add('neat-select-open');
				if (!isMultiple) {
					find('caret').textContent = '▲';
				}
				dropdownContainer.style.display = 'block';
				if (!dropdownShowing) {
					turnOnKeyboardEvents();
				}
				dropdownShowing = true;
				updateDimensions();

				const items = findAll(`dropdown-item`);
				const regex = new RegExp(`.*${regexEscape(filterValue)}.*`, 'i');

				let numMatches = 0;
				let hasExactMatch = false;
				items.forEach((element) => {
					const value = element.textContent;
					hasExactMatch = hasExactMatch || value === filterValue;
					if (regex.test(value)) {
						element.style.display = 'block';
						numMatches++;
					} else {
						element.style.display = 'none';
					}
				});

				updateAddOptionButton(filterValue, hasExactMatch);

				if (!numMatches) {
					noMatchesItem.style.display = 'block';
					noMatchesItem.textContent = `Nothing matches ${filterValue}`;
				}
			};

			const updateAddOptionButton = (filterValue, hasExactMatch) => {
				const newOptionButton = find('new-option-button');
				if (newOptionButton) {
					newOptionButton.disabled = filterValue ? hasExactMatch : true;
				}
			};

			hideDropdown = () => {
				container.classList.remove('neat-select-open');
				itemContainer.scrollTop = 0;
				dropdownContainer.style.display = 'none';
				dropdownShowing = false;
				if (!isMultiple) {
					find(`caret`).textContent = '▼';
					if (enableSearch) {
						find(`search-input`).value = '';
					}
				}
				activeItem = null;
				turnOffKeyboardEvents();
				unsetActiveItem();
			};

			addOption = (value, label, selected, disabled) => {
				createNewOption(value, label, selected, disabled);
			};

			const setActiveItem = (node, navigationDir) => {
				const className = `${clsPrefix}-active`;
				findAll(`dropdown-item`).forEach((item) => {
					item.classList.remove(className);
				});
				if (node) {
					node.classList.add(className);
					activeItem = node;

					const diff = node.offsetTop - itemContainer.scrollTop;
					if (diff < 0 || diff >= itemContainer.offsetHeight) {
						const alignToTop = navigationDir < 0;
						node.scrollIntoView(alignToTop);
					}
				} else {
					activeItem = null;
				}
			};

			const unsetActiveItem = () => {
				if (activeItem) {
					activeItem.classList.remove(`${clsPrefix}-active`);
					activeItem = null;
				}
			};

			const navigate = (dir) => {
				const visibleItems = toArray(findAll(`dropdown-item`))
					.filter(node => node.style.display !== 'none' && !node.classList.contains(`${clsPrefix}-disabled`));

				if (!activeItem) {
					if (dir > 0) {
						setActiveItem(visibleItems[0], dir);
					} else {
						setActiveItem(visibleItems[visibleItems.length - 1], dir);
					}
					return;
				}

				const activeIndex = visibleItems.findIndex(node => node === activeItem);
				const newIndex = dir > 0 ?
					activeIndex + 1 :
					activeIndex - 1;

				const realIndex = (newIndex + visibleItems.length) % visibleItems.length;
				if (!visibleItems[realIndex]) {
					activeItem = null;
					return;
				}

				setActiveItem(visibleItems[realIndex], dir);
			};

			const addSelectedValue = (dropdownItem, optionNode) => {
				optionNode.selected = true;
				if (!isMultiple) {
					selectedValues[0] = optionNode.value;
					find(`value`).textContent = optionNode.textContent;
				} else {
					selectedValues.push(optionNode.value);
					dropdownItem.classList.add(`${clsPrefix}-disabled`);
					const valueInput = find('multiple-input');
					valueInput.focus();
					const newItem = el(`div.${clsPrefix}-multiple-item`, {
						'data-value': optionNode.value
					});
					const del = el(`div.${clsPrefix}-item-delete`);
					del.addEventListener('click', () => {
						removeSelectedValue(dropdownItem, optionNode, newItem);
					});
					del.textContent = '×';
					newItem.appendChild(document.createTextNode(optionNode.textContent));
					newItem.appendChild(del);
					container.insertBefore(newItem, valueInput);

					if (selectedValues.length) {
						valueInput.removeAttribute('placeholder');
					} else {
						valueInput.setAttribute('placeholder', inputPlaceholder);
					}
				}

				unsetActiveItem();
			};

			const removeSelectedValue = (dropdownItem, optionNode, multiItem) => {
				if (!isMultiple) {
					return;
				}

				if (!dropdownItem) {
					return;
				}

				dropdownItem.classList.remove(`${clsPrefix}-disabled`);
				const optionValue = dropdownItem.getAttribute('data-value');
				if (!optionNode) {
					optionNode = toArray(selectElement.querySelectorAll(`option`))
						.find(option => option.value === optionValue);
				}
				if (optionNode) {
					optionNode.selected = false;
				}

				const index = selectedValues.findIndex(value => value === optionValue);
				if (index !== -1) {
					selectedValues.splice(index, 1);
				}

				if (!multiItem) {
					multiItem = toArray(findAll(`multiple-item`))
						.find(item => item.getAttribute('data-value') === optionValue);
				}
				if (multiItem) {
					multiItem.parentNode.removeChild(multiItem);
				}

				const valueInput = find('multiple-input');
				if (selectedValues.length) {
					valueInput.removeAttribute('placeholder');
				} else {
					valueInput.setAttribute('placeholder', inputPlaceholder);
				}

				updateMultiInputWidth();
			};

			const toggleItem = (dropdownItem) => {
				const selectedValue = dropdownItem.getAttribute('data-value');
				const optionNodes = selectElement.querySelectorAll('option');
				for (const optionNode of optionNodes) {
					if (optionNode.value === selectedValue) {
						if (!optionNode.selected) {
							addSelectedValue(dropdownItem, optionNode);
						} else {
							removeSelectedValue(dropdownItem, optionNode);
						}
					} else if (!isMultiple) {
						optionNode.selected = false;
					}
				}

				if (!isMultiple) {
					hideDropdown();
				}

				unsetActiveItem();
			};

			const updateMultiInputWidth = () => {
				if (!isMultiple) {
					return;
				}

				const valueInput = find('multiple-input');
				const inputValue = valueInput.value;
				showAndFilterDropdown(inputValue);
				if (!inputValue && !selectedValues.length) {
					// placeholder shows
					valueInput.style.width = defaultMultiInputWidth + 'px';
				} else {
					const width = Math.min(container.offsetWidth, 25 + (inputValue.length * 7));
					valueInput.style.width = width + 'px';
				}
			};

			const keyDownListener = (e) => {
				if (!getContainerAncestor(e.target)) {
					return;
				}

				switch (e.key) {
					case 'ArrowUp':
					case 'Up':
						navigate(-1);
						break;
					case 'ArrowDown':
					case 'Down':
					case 'Tab':
						navigate(1);
						break;
					case 'Enter':
						if (activeItem) {
							toggleItem(activeItem);
						}
						break;
					case 'Escape':
					case 'Esc':
						hideDropdown();
						break;
					case 'Backspace':
						if (isMultiple && e.target.classList.contains(`${clsPrefix}-multiple-input`) && !e.target.value) {
							const items = findAll(`multiple-item`);
							const lastItem = items[items.length - 1];
							if (lastItem) {
								const optionValue = lastItem.getAttribute('data-value');
								const dropdownItem = toArray(findAll('dropdown-item'))
									.find(item => item.getAttribute('data-value') === optionValue);

								removeSelectedValue(dropdownItem);
							}
							break;
						}
						return;
					default:
						return;
				}

				e.preventDefault();
			};

			const turnOnKeyboardEvents = () => {
				document.addEventListener('keydown', keyDownListener);
			};

			const turnOffKeyboardEvents = () => {
				document.removeEventListener('keydown', keyDownListener);
			};

			const dropdownContainer = el(`div.${clsPrefix}-dropdown`);
			const itemContainer = el(`div.${clsPrefix}-dropdown-item-container`);
			const noMatchesItem = el(`div.${clsPrefix}-dropdown-no-matches`);

			if (!isMultiple) {
				let searchInput;
				if (enableSearch) {
					searchInput = el(`input.${clsPrefix}-search-input`, {
						type: 'text',
						placeholder: inputPlaceholder
					});
					searchInput.addEventListener('input', () => {
						showAndFilterDropdown(searchInput.value);
					});

					const searchContainer = el(`div.${clsPrefix}-search-container`);
					searchContainer.appendChild(searchInput);
					dropdownContainer.appendChild(searchContainer);

					if (onOptionAdded) {
						searchInput.classList.add('addable-option');
						const newOptionButton = el(`button.${clsPrefix}-new-option-button`, {
							autocomplete: 'off',
						});
						newOptionButton.innerHTML = `<div class="lds-ring"><div></div><div></div><div></div><div></div></div>`;
						const btnLabel = el(`span`);
						btnLabel.textContent = 'Add';
						newOptionButton.appendChild(btnLabel);
						newOptionButton.disabled = true;
						newOptionButton.addEventListener('click', () => {
							newOptionButton.classList.add(`${clsPrefix}-loading`);
							onOptionAdded(searchInput.value)
								.then((value, label) => {
									addOption(value, label, true);
								})
								.catch(() => {})
								.finally(() => {
									newOptionButton.classList.remove(`${clsPrefix}-loading`);
								});
						});
						searchContainer.appendChild(newOptionButton);
					}
				}

				container.classList.add(`${clsPrefix}-single`);
				const valueContainer = el(`div.${clsPrefix}-value-container`, {
					style: {
						...getInheritedStyles([
							'padding-left',
							'padding-right',
							'padding-top',
							'padding-bottom',
							'font-size',
							'color',
						])
					}
				});

				valueContainer.addEventListener('click', () => {
					const shouldFocus = !dropdownShowing;
					toggleDropdown();
					if (shouldFocus && searchInput) {
						searchInput.focus();
					}
				});
				const caret = el(`span.${clsPrefix}-caret`);
				caret.textContent = '▼';
				const selectedValueElement = el(`span.${clsPrefix}-value`);
				valueContainer.appendChild(caret);
				valueContainer.appendChild(selectedValueElement);
				selectedValueElement.textContent = defaultValueText;

				container.appendChild(valueContainer);
			} else {
				container.classList.add(`${clsPrefix}-multiple`);
				const valueInput = el(`input.${clsPrefix}-multiple-input`, {
					type: 'text',
					placeholder: 'Choose some values',
					style: {
						width: `${defaultMultiInputWidth}px`
					}
				});
				valueInput.addEventListener('input', () => {
					const inputValue = valueInput.value;
					showAndFilterDropdown(inputValue);
					updateMultiInputWidth();
				});
				valueInput.addEventListener('focus', () => showAndFilterDropdown(valueInput.value));
				container.addEventListener('click', (e) => {
					if (e.target === container) {
						valueInput.focus();
					}
				});

				container.appendChild(valueInput);
			}

			dropdownContainer.appendChild(noMatchesItem);
			dropdownContainer.appendChild(itemContainer);
			container.appendChild(dropdownContainer);

			const createNewOption = (value, label, selected, disabled) => {
				const optionNode = el('option', {
					value,
				});

				if (selected) {
					optionNode.selected = true;
				}
				if (disabled) {
					optionNode.disabled = true;
				}

				optionNode.appendChild(document.createTextNode(label || value));
				selectElement.appendChild(optionNode);
				createItemFromOption(optionNode);

				updateAddOptionButton(value, true);
			};

			const createItemFromOption = (optionNode) => {
				const item = el(`div.${clsPrefix}-dropdown-item`, {
					'data-value': optionNode.value
				});
				if (optionNode.disabled) {
					item.classList.add(`${clsPrefix}-disabled`);
				}
				item.textContent = optionNode.textContent;
				item.addEventListener('click', () => toggleItem(item));
				item.addEventListener('mouseenter', () => setActiveItem(item));
				itemContainer.appendChild(item);

				if (optionNode.selected) {
					addSelectedValue(item, optionNode);
				}
			};

			selectElement.querySelectorAll('option').forEach((option) => {
				createItemFromOption(option);
			});

			selectElement.style.display = 'none';
			selectElement.setAttribute(neatAttrName, id);
			selectElement.parentNode.insertBefore(container, selectElement);

			updateDimensions();

			destroyNeatSelect = () => {
				turnOffKeyboardEvents();
				selectElement.removeAttribute(neatAttrName);
				container.parentNode.removeChild(container);
				selectElement.style.display = originalSelectDisplay;
				while (selectedValues.length) {
					selectedValues.pop();
				}
			};
		};

		const api = {
			getValues() {
				return selectedValues.concat([]);
			},
			update() {
				destroyNeatSelect && destroyNeatSelect();
				enableNeatSelect();
			},
			destroy() {
				destroyNeatSelect && destroyNeatSelect();
			},
			open() {
				showAndFilterDropdown && showAndFilterDropdown();
			},
			close() {
				hideDropdown && hideDropdown();
			},
			addOption(value, text, selected, disabled) {
				addOption && addOption(value, text, selected, disabled);
			}
		};
		neatMap[id] = api;

		enableNeatSelect();

		return api;
	};

	window.neatSelect = neatSelect;

	document.addEventListener('click', (e) => {
		// is a dropdown showing? if not, short-circuit so that we don't have to
		// traverse the ancestry every time
		const openContainers = document.querySelectorAll(`.${clsPrefix}-open`);
		if (!openContainers.length) {
			return;
		}

		const container = getContainerAncestor(e.target);
		for (const openContainer of openContainers) {
			if (openContainer !== container) {
				neatSelect(openContainer.getAttribute(neatAttrName)).close();
			}
		}
	});
}(window));
