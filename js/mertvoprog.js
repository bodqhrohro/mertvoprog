window.addEventListener('load', () => {
	const boneMenu = document.querySelector('.bone-menu');
	const boneContainer = document.querySelector('.bone-container');
	const boneArea = document.querySelector('.bone-area');
	const boneButtonRun = document.querySelector('.bone-button-run');
	const boneButtonClear = document.querySelector('.bone-button-clear');
	const boneButtonLoad = document.querySelector('.bone-button-load');
	const boneButtonSave = document.querySelector('.bone-button-save');

	const DRAG_RADIUS = 20;
	const ROTATE_REGEX = /transform(\([0-9-]+\)deg)/;
	const BONE_TYPE_REGEX = /img\/([a-z]+)\.svg/;
	const LANG = 'UA';

	const tr = {
		'UA': {
			boneLfemur: "простий з'єднувач (ненульова гілка)",
			boneRfemur: "простий з'єднувач (нульова гілка)",
			boneLbrachial: "додавач",
			boneRbrachial: "віднімач",
			boneLforearm: "початок",
			boneRforearm: "кінець",
			boneSkull: "пожирач",
			bonePelvis: "висирач",
			boneLpatella: "забувач",
			boneRpatella: "пам'ятач",
			boneLclavicle: "вичисляч",
			boneRclavicle: "вирядкувач",
			boneManubrium: "перетинач",
			boneLleg: "причіпляч",
			boneRleg: "чіпляч",

			error: "Помилка",
			errOrphanNode: "Вузол без з'єднувача",
			errLoopConnector: "З'єднувач-самоковтайко",
			errNoStart: "Нема початкового вузла",
			errManyStarts: "Зайвий початковий вузол",
			errManyOutputs: "Зайві виходи",
			errPelvisInputRequired: "Нема що висирати",
			errWrongManubriumConnection: "Заплутаний перетинач",

			msgConfirmClear: "Керму гаплик?",
		},
	};

	let dragX = undefined;
	let dragY = undefined;
	let center = undefined;
	let startDegree = undefined;
	let dragged = undefined;
	let rotated = undefined;

	// utils
	const fitAngle = (angle) => angle >= 360 || angle < 0
		? angle - Math.floor(angle / 360) * 360
		: angle;

	const updateDegree = (bone, degree) => {
		bone.style.transform = 'rotate(' + degree + 'deg)';
		bone.dataset.degree = degree;
	};

	const boneType = (bone) => BONE_TYPE_REGEX.exec(bone.children[0].getAttribute('src'))[1];

	const getBoneCenter = (bone) => ({
		x: bone.offsetLeft + bone.clientWidth / 2,
		y: bone.offsetTop + bone.clientHeight / 2,
	});

	const rotatePoint = (point, degree, center) => {
		const radians = degree * Math.PI / 180;
		const sin = Math.sin(radians);
		const cos = Math.cos(radians);
		const offsetX = point.x - center.x;
		const offsetY = point.y - center.y;
		return {
			x: center.x + offsetX * cos - offsetY * sin,
			y: center.y + offsetX * sin + offsetY * cos,
		};
	};

	const distanceXY = (point1, point2) => {
		const distX = point2.x - point1.x;
		const distY = point2.y - point1.y;
		return Math.sqrt(distX * distX + distY * distY);
	};

	const isString = s => typeof s === 'string' || s instanceof String;

	const isTrue = (value) => {
		if (Array.isArray(value)) {
			return value.length > 0;
		}
		else if (isString(value)) {
			return value !== '';
		}
		else if (isVoid(value)) {
			return false;
		}
		else {
			return !!value;
		}
	};

	const isVoid = value => value === undefined || value === null;

	const areCyclicOrderedFour = (a, b, c, d) => (
		(a < b && b < c && c < d) ||
		(b < c && c < d && d < a) ||
		(c < d && d < a && a < b) ||
		(d < a && a < b && b < c)
	);

	const stringToNumbers = (value) => [...value].map(v => v.charCodeAt(0));

	const numbersToString = (value) => value.map(v => String.fromCharCode(v)).join('');

	// commands
	const commandAdd = (value, diff) => {
		const addNumber = (value, diff) => {
			const isChar = isString(value);
			let number = isChar ? value.charCodeAt(0) : value;
			number += diff;
			return isChar ? String.fromCharCode(number) : number;
		};

		if (Array.isArray(value)) {
			return value.map(v => addNumber(v, diff));
		}
		else if (isString(value)) {
			return [...value].map(v => addNumber(v, diff)).join('');
		}
		else if (isVoid(value)) {
			return value;
		}
		else {
			return addNumber(value, diff);
		}

		return undefined;
	};
	const commandHead = (value) => {
		if (Array.isArray(value) || isString(value)) {
			return [value[0], value.slice(1)];
		} else {
			return [value, value];
		}
	};
	const commandTail = (value) => {
		if (Array.isArray(value) || isString(value)) {
			const lastPos = value.length-1;
			return [value[lastPos], value.slice(0, lastPos)];
		} else {
			return [value, value];
		}
	};
	const commandPrepend = (prevValue, nextValue) => {
		if (Array.isArray(nextValue)) {
			if (Array.isArray(prevValue)) {
				return prevValue.concat(nextValue);
			}
			else if (isString(prevValue)) {
				return stringToNumbers(prevValue).concat(nextValue);
			}
			else if (isVoid(prevValue)) {
				return nextValue;
			}
			else {
				return [prevValue].concat(nextValue);
			}
		}
		else if (isString(nextValue)) {
			if (Array.isArray(prevValue)) {
				return numbersToString(prevValue) + nextValue;
			}
			else if (isString(prevValue)) {
				return prevValue + nextValue;
			}
			else if (isVoid(prevValue)) {
				return nextValue;
			}
			else {
				return String.fromCharCode(prevValue) + nextValue;
			}
		}
		else if (isVoid(nextValue)) {
			if (Array.isArray(prevValue) || isString(prevValue) || isVoid(prevValue)) {
				return prevValue;
			}
			else {
				return [prevValue];
			}
		}
		else {
			if (Array.isArray(prevValue)) {
				return prevValue.concat([nextValue]);
			}
			else if (isString(prevValue)) {
				return stringToNumbers(prevValue).concat([nextValue]);
			}
			else if (isVoid(prevValue)) {
				return nextValue;
			}
			else {
				return [prevValue, nextValue];
			}
		}
	};
	const commandAppend = (prevValue, nextValue) => {
		if (Array.isArray(nextValue)) {
			if (Array.isArray(prevValue)) {
				return nextValue.concat(prevValue);
			}
			else if (isString(prevValue)) {
				return nextValue.concat(stringToNumbers(prevValue));
			}
			else if (isVoid(prevValue)) {
				return nextValue;
			}
			else {
				return nextValue.concat([prevValue]);
			}
		}
		else if (isString(nextValue)) {
			if (Array.isArray(prevValue)) {
				return nextValue + numbersToString(prevValue);
			}
			else if (isString(prevValue)) {
				return nextValue + prevValue;
			}
			else if (isVoid(prevValue)) {
				return nextValue;
			}
			else {
				return nextValue + String.fromCharCode(prevValue);
			}
		}
		else if (isVoid(nextValue)) {
			if (Array.isArray(prevValue) || isString(prevValue) || isVoid(prevValue)) {
				return prevValue;
			}
			else {
				return [prevValue];
			}
		}
		else {
			if (Array.isArray(prevValue)) {
				return [nextValue].concat(prevValue);
			}
			else if (isString(prevValue)) {
				return [nextValue].concat(stringToNumbers(prevValue));
			}
			else if (isVoid(prevValue)) {
				return nextValue;
			}
			else {
				return [nextValue, prevValue];
			}
		}
	};
	const commandToNumbers = (value) => isString(value) ? stringToNumbers(value) : value;
	const commandToString = (value) => {
		if (Array.isArray(value)) {
			return numbersToString(value);
		}
		else if (isString(value) || isVoid(value)) {
			return value;
		}
		else {
			return String.fromCharCode(value);
		}
	};

	// UI
	const newBone = (proto, x, y, degree, initialValue) => {
		const newImg = proto.cloneNode();
		newImg.classList.add('bone-object-img');
		const imgObject = document.createElement('div');
		imgObject.classList.add('bone-object');
		imgObject.style.left = x;
		imgObject.style.top = y;
		updateDegree(imgObject, degree);
		if (initialValue) {
			imgObject.dataset.initialValue = initialValue;
		}
		imgObject.appendChild(newImg);
		boneArea.appendChild(imgObject);
	};

	const showBoneMenu = (x, y) => {
		boneMenu.classList.add('bone-menu-visible');
		boneMenu.style.left = x + 'px';
		boneMenu.style.top = y + 'px';
	};

	const hideBoneMenu = () => {
		boneMenu.classList.remove('bone-menu-visible');
	};

	const boneError = (error, bone) => {
		if (bone) {
			bone.classList.add('bone-error');
			bone.scrollIntoView();
		}
		alert(tr[LANG]['error'] + ': ' + tr[LANG][error]);
	};

	const clearBoneErrors = () => {
		for (let bone of document.querySelectorAll('.bone-error')) {
			bone.classList.remove('bone-error');
		}
	};

	const clearBones = () => {
		[...boneArea.children].forEach((bone) => bone.remove());
	};

	// storage
	const serialize = () => JSON.stringify([...boneArea.children].map((bone) => ({
		'x': bone.style.left,
		'y': bone.style.top,
		'type': bone.children[0].getAttribute('src'),
		'degree': bone.dataset.degree || 0,
		'initialValue': bone.dataset.initialValue || null,
	})));

	const unserialize = (json) => {
		const oldBones = JSON.parse(json);

		const imgProtoHash = new Map();
		for (let img of boneMenu.querySelectorAll('img')) {
			imgProtoHash.set(img.getAttribute('src'), img);
		}

		for (let bone of oldBones) {
			const imgProto = imgProtoHash.get(bone.type);
			if (imgProto) {
				newBone(imgProto, bone.x, bone.y, bone.degree || 0, bone.initialValue || null);
			}
		}
	};

	const serializeToLocalStorage = () => {
		const json = serialize();
		window.localStorage.setItem('mertvoprog_bones', json);
	};

	const unserializeFromLocalStorage = () => {
		const oldBones = window.localStorage.getItem('mertvoprog_bones');
		if (oldBones) {
			unserialize(oldBones);
		}
	};

	// graph
	const getNearestNode = (point, nodes) => {
		let minDistance = Number.MAX_VALUE;
		let nearestNode = null;
		for (let node of nodes) {
			const distance = distanceXY(point, node.center);
			if (distance < minDistance) {
				nearestNode = node;
				minDistance = distance;
			}
		}
		return nearestNode;
	};

	const getConnectorVertices = (bone, type) => {
		// nw:se
		if (type === 'rfemur' || type === 'lforearm') {
			return {
				start: {
					x: bone.offsetLeft,
					y: bone.offsetTop,
				},
				end: {
					x: bone.offsetLeft + bone.clientWidth,
					y: bone.offsetTop + bone.clientHeight,
				},
			};
		}
		// ne:sw
		else if (type === 'lfemur' || type === 'rforearm') {
			return {
				start: {
					x: bone.offsetLeft + bone.clientWidth,
					y: bone.offsetTop,
				},
				end: {
					x: bone.offsetLeft,
					y: bone.offsetTop + bone.clientHeight,
				},
			};
		}
		// se:ne
		else if (type === 'lbrachial') {
			return {
				start: {
					x: bone.offsetLeft + bone.clientWidth,
					y: bone.offsetTop + bone.clientHeight,
				},
				end: {
					x: bone.offsetLeft + bone.clientWidth,
					y: bone.offsetTop,
				},
			};
		}
		// sw:nw
		else if (type === 'rbrachial') {
			return {
				start: {
					x: bone.offsetLeft,
					y: bone.offsetTop + bone.clientHeight,
				},
				end: {
					x: bone.offsetLeft,
					y: bone.offsetTop,
				},
			};
		}
		// ne:se
		else if (type === 'lleg') {
			return {
				start: {
					x: bone.offsetLeft + bone.clientWidth,
					y: bone.offsetTop,
				},
				end: {
					x: bone.offsetLeft + bone.clientWidth,
					y: bone.offsetTop + bone.clientHeight,
				},
			};
		}
		// nw:sw
		else if (type === 'rleg') {
			return {
				start: {
					x: bone.offsetLeft,
					y: bone.offsetTop,
				},
				end: {
					x: bone.offsetLeft,
					y: bone.offsetTop + bone.clientHeight,
				},
			};
		}
		// w:s
		else if (type === 'lclavicle' || type === 'rclavicle') {
			const yCenter = bone.offsetTop + bone.clientHeight / 2;
			return {
				start: {
					x: bone.offsetLeft,
					y: yCenter,
				},
				end: {
					x: bone.offsetLeft + bone.clientWidth,
					y: yCenter,
				},
			};
		}
	};

	const bonesToCircuit = () => {
		const bones = [...boneArea.children];
		const connectors = [];
		const nodes = [];

		// collect nodes and connectors
		bones.forEach(bone => {
			const type = boneType(bone);
			if (['skull', 'pelvis', 'lpatella', 'rpatella', 'manubrium'].includes(type)) {
				const node = {
					bone,
					type,
					center: getBoneCenter(bone),
					value: 'initialValue' in bone.dataset ? bone.dataset.initialValue : null,
				};
				nodes.push(node);
			} else {
				const vertices = getConnectorVertices(bone, type);
				const center = getBoneCenter(bone);
				const degree = +bone.dataset.degree;
				const connector = {
					bone,
					type,
					start: rotatePoint(vertices.start, degree, center),
					end: rotatePoint(vertices.end, degree, center),
				};
				connectors.push(connector);
			}
		});
		// connect nodes to edges
		connectors.forEach(connector => {
			connector.startNode = getNearestNode(connector.start, nodes);
			connector.endNode = getNearestNode(connector.end, nodes);
		});

		return [
			nodes,
			connectors,
		];
	};

	const validateCircuit = (nodes, connectors) => {
		// check for loops
		for (let connector of connectors) {
			if (connector.startNode === connector.endNode) {
				return {
					error: 'errLoopConnector',
					errorBone: connector.bone,
				};
			}
		}

		// validate node adjoints
		let startNode = null;
		for (let node of nodes) {
			let inputs = [];
			let outputs = [];
			for (let connector of connectors) {
				if (connector.endNode === node) {
					inputs.push(connector);
				}
				else if (connector.startNode === node) {
					outputs.push(connector);
				}
			}
			if (!inputs.length && !outputs.length) {
				return {
					error: 'errOrphanNode',
					errorBone: node.bone,
				};
			}
			// no multi-output nodes for now
			if (outputs.length > 1) {
				// maybe condition?
				if (outputs.length == 2 && (
					(outputs[0].type === 'lfemur' && outputs[1].type === 'rfemur') ||
					(outputs[0].type === 'rfemur' && outputs[1].type === 'lfemur')
				)) {
					if (outputs[0].type === 'lfemur') {
						node.trueConnector = outputs[0];
						node.falseConnector = outputs[1];
					} else {
						node.trueConnector = outputs[1];
						node.falseConnector = outputs[0];
					}
				// manubrium?
				} else if (node.type === 'manubrium' && inputs.length === 2 && outputs.length === 2) {
					const input0 = inputs[0];
					const input1 = inputs[1];
					const output0 = outputs[0];
					const output1 = outputs[1];

					const input0Angle = Math.atan2(
						(input0.start.x + input0.end.x) / 2 - node.center.x,
						(input0.start.y + input0.end.y) / 2 - node.center.y
					);
					const input1Angle = Math.atan2(
						(input1.start.x + input1.end.x) / 2 - node.center.x,
						(input1.start.y + input1.end.y) / 2 - node.center.y
					);
					const output0Angle = Math.atan2(
						(output0.start.x + output0.end.x) / 2 - node.center.x,
						(output0.start.y + output0.end.y) / 2 - node.center.y
					);
					const output1Angle = Math.atan2(
						(output1.start.x + output1.end.x) / 2 - node.center.x,
						(output1.start.y + output1.end.y) / 2 - node.center.y
					);

					// allowed orders
					if (
						areCyclicOrderedFour(input0Angle, input1Angle, output0Angle, output1Angle) ||
						areCyclicOrderedFour(output1Angle, output0Angle, input1Angle, input0Angle)
					) {
						node.input0 = input0;
						node.input1 = input1;
						node.output0 = output0;
						node.output1 = output1;
					}
					else if (
						areCyclicOrderedFour(input1Angle, input0Angle, output0Angle, output1Angle) ||
						areCyclicOrderedFour(output1Angle, output0Angle, input0Angle, input1Angle)
					) {
						node.input0 = input0;
						node.input1 = input1;
						node.output0 = output1;
						node.output1 = output0;
					}
					else {
						return {
							error: 'errWrongManubriumConnection',
							errorBone: node.bone,
						};
					}
				} else {
					return {
						error: 'errManyOutputs',
						errorBone: node.bone,
					};
				}
			} else if (outputs.length > 0) {
				node.nextConnector = outputs[0];
			} else {
				node.nextConnector = null;
			}
			if (!inputs.length) {
				if (node.type === 'pelvis') {
					return {
						error: 'errPelvisInputRequired',
						errorBone: node.bone,
					};
				}

				if (startNode) {
					return {
						error: 'errManyStarts',
						errorBone: node.bone,
					};
				} else {
					startNode = node;
				}
			}
		}
		if (!startNode) {
			return {
				error: 'errNoStart',
			};
		}

		return {
			startNode,
			nodes,
			connectors,
		};
	};

	const setNodeValue = (node, value, debug) => {
		node.value = value;
		if (debug) {
			node.bone.children[0].title = value;
		}
	};

	const executeCircuit = (circuit, debug) => {
		let currentBone = circuit.startNode;
		let lastConnector = null;
		for (;;) {
			// process node
			switch (currentBone.type) {
				case 'skull':
					setNodeValue(currentBone, prompt(), debug);
				break;
				case 'pelvis':
					alert(currentBone.value);
				break;
				case 'lpatella':
					setNodeValue(currentBone, undefined, debug);
				break;
				// noop: just store the value
				case 'rpatella':
				break;
			}

			const prevNode = currentBone;
			if (currentBone.nextConnector) {
				currentBone = currentBone.nextConnector;
			}
			// evaluate condition
			else if (currentBone.trueConnector && currentBone.falseConnector) {
				currentBone = isTrue(currentBone.value)
					? currentBone.trueConnector
					: currentBone.falseConnector;
			}
			// cross
			else if (currentBone.input0 && currentBone.input1 && currentBone.output0 && currentBone.output1) {
				currentBone = currentBone.input0 === lastConnector
					? currentBone.output0
					: currentBone.output1;
			}
			else {
				break;
			}

			// process next connector
			const nextNode = currentBone.endNode;
			switch (currentBone.type) {
				case 'lfemur':
				case 'rfemur':
					// preserve value of next node
					if (prevNode.type !== 'lpatella') {
						// noop
						setNodeValue(nextNode, prevNode.value, debug);
					}
				break;
				case 'lbrachial':
					setNodeValue(nextNode, commandAdd(prevNode.value, 1), debug);
				break;
				case 'rbrachial':
					setNodeValue(nextNode, commandAdd(prevNode.value, -1), debug);
				break;
				case 'lforearm':
					{
						const [next, prev] = commandHead(prevNode.value)
						setNodeValue(prevNode, prev, debug);
						setNodeValue(nextNode, next, debug);
					}
				break;
				case 'rforearm':
					{
						const [next, prev] = commandTail(prevNode.value)
						setNodeValue(prevNode, prev, debug);
						setNodeValue(nextNode, next, debug);
					}
				break;
				case 'lleg':
					setNodeValue(nextNode, commandPrepend(prevNode.value, nextNode.value), debug);
				break;
				case 'rleg':
					setNodeValue(nextNode, commandAppend(prevNode.value, nextNode.value), debug);
				break;
				case 'lclavicle':
					setNodeValue(nextNode, commandToNumbers(prevNode.value), debug);
				break;
				case 'rclavicle':
					setNodeValue(nextNode, commandToString(prevNode.value), debug);
				break;
			}
			lastConnector = currentBone;

			// pick next node
			currentBone = nextNode;
		}
	};

	const playCircuit = function(debug = false) {
		clearBoneErrors();

		[nodes, connectors] = bonesToCircuit();
		let circuit = validateCircuit(nodes, connectors);
		if (circuit.error) {
			boneError(circuit.error, circuit.errorBone);
			return;
		}
		executeCircuit(circuit, debug);
	};

	// handlers
	boneArea.addEventListener('contextmenu', (e) => {
		if (e.target.classList && e.target.classList.contains('bone-object-img')) {
			const bone = e.target.parentNode;
			bone.remove();
		} else {
			showBoneMenu(e.pageX, e.pageY);
		}
		e.preventDefault();
	});
	boneArea.addEventListener('click', () => {
		hideBoneMenu();
	});
	boneArea.addEventListener('auxclick', (e) => {
		if (
			e.target.classList &&
			e.target.classList.contains('bone-object-img') &&
			e.target.getAttribute('src') === 'img/rpatella.svg'
		) {
			const value = prompt();
			if (value) {
				e.target.parentNode.dataset.initialValue = value;
				e.target.title = value;
			}
		}
	});

	boneMenu.addEventListener('click', (e) => {
		if (e.target.tagName === 'IMG') {
			newBone(
				e.target,
				parseInt(boneMenu.style.left) + boneContainer.scrollLeft + 'px',
				parseInt(boneMenu.style.top) + boneContainer.scrollTop + 'px',
				0,
				null,
			);
		}
		hideBoneMenu();
	});

	boneButtonRun.addEventListener('click', () => {
		boneButtonRun.innerHTML = '►';

		setTimeout(() => {
			playCircuit();

			boneButtonRun.innerHTML = '';
		}, 0);
	});
	boneButtonRun.addEventListener('contextmenu', (e) => {
		e.preventDefault();
		boneButtonRun.innerHTML = '⏯';

		setTimeout(() => {
			playCircuit(true);

			boneButtonRun.innerHTML = '';
		}, 0);
	});
	boneButtonClear.addEventListener('click', () => {
		if (confirm(tr[LANG]['msgConfirmClear'])) {
			clearBones();
		}
	});
	boneButtonLoad.addEventListener('click', () => {
		const input = document.createElement('input');
		input.type = 'file';
		input.style.visibility = 'hidden';

		const clear = () => input.remove();

		document.body.appendChild(input);
		input.addEventListener('change', (e) => {
			if (e.target.files.length) {
				const reader = new FileReader();
				reader.onload = (e) => {
					clear();
					clearBones();
					unserialize(e.target.result);
				};
				reader.onerror = clear;
				reader.onabort = clear;
				reader.readAsText(e.target.files[0]);
			}
		});

		input.click();
	});
	boneButtonSave.addEventListener('click', () => {
		const json = serialize();

		const file = new Blob([json], { type: 'application/json', });

		const a = document.createElement('a');
		const url = URL.createObjectURL(file);

		a.style.visibility = 'hidden';
		a.href = url;
		a.download = 'project.mvprg';
		document.body.appendChild(a);
		a.click();

		setTimeout(() => {
			a.remove();
			window.URL.revokeObjectURL(url);
		}, 0);
	});

	boneArea.addEventListener('mousedown', (e) => {
		if (e.target.classList && e.target.classList.contains('bone-object-img')) {
			const bone = e.target.parentNode;
			center = getBoneCenter(bone);

			const relativePageX = e.pageX + boneContainer.scrollLeft;
			const relativePageY = e.pageY + boneContainer.scrollTop;

			const offsetX = relativePageX - center.x;
			const offsetY = relativePageY - center.y;

			dragX = relativePageX - bone.offsetLeft;
			dragY = relativePageY - bone.offsetTop;
			const radius = Math.sqrt(offsetX * offsetX + offsetY * offsetY);

			if (radius > DRAG_RADIUS) {
				const oldDegree = +bone.dataset.degree;
				const curDegree = Math.atan2(-offsetX, offsetY) / Math.PI * 180
				startDegree = fitAngle(curDegree - oldDegree);
				rotated = bone;
			} else {
				dragged = bone;
			}
			e.preventDefault();
		}
	});
	boneArea.addEventListener('mousemove', (e) => {
		const relativePageX = e.pageX + boneContainer.scrollLeft;
		const relativePageY = e.pageY + boneContainer.scrollTop;

		if (dragged !== undefined) {
			dragged.style.left = relativePageX - dragX + 'px';
			dragged.style.top = relativePageY - dragY + 'px';
			e.preventDefault();
		} else if (rotated !== undefined) {
			const oldDegree = rotated.dataset.oldDegree || 0;

			const offsetX = relativePageX - center.x;
			const offsetY = relativePageY - center.y;

			const curDegree = Math.atan2(-offsetX, offsetY) / Math.PI * 180;
			const degree = fitAngle(curDegree - startDegree);
			updateDegree(rotated, degree);
		}
	});
	boneArea.addEventListener('mouseup', (e) => {
		dragX = undefined;
		dragY = undefined;
		center = undefined;
		startDegree = undefined;
		dragged = undefined;
		rotated = undefined;
	});

	// init
	for (let bone of boneMenu.children) {
		const type = boneType(bone);
		bone.children[0].title = tr[LANG]['bone' + type.charAt(0).toUpperCase() + type.slice(1)];
	}
	unserializeFromLocalStorage();
	window.setInterval(serializeToLocalStorage, 5000);
});
