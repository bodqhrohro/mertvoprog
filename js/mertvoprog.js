window.addEventListener('load', () => {
	const boneMenu = document.querySelector('.bone-menu');
	const boneContainer = document.querySelector('.bone-container');
	const boneArea = document.querySelector('.bone-area');
	const boneButtonRun = document.querySelector('.bone-button-run');

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

			error: "Помилка",
			errOrphanNode: "Вузол без з'єднувача",
			errLoopConnector: "З'єднувач-самоковтайко",
			errNoStart: "Нема початкового вузла",
			errManyStarts: "Зайвий початковий вузол",
			errManyOutputs: "Зайві виходи",
			errPelvisInputRequired: "Нема що висирати",
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

	// UI
	const newBone = (proto, x, y, degree) => {
		const newImg = proto.cloneNode();
		newImg.classList.add('bone-object-img');
		const imgObject = document.createElement('div');
		imgObject.classList.add('bone-object');
		imgObject.style.left = x;
		imgObject.style.top = y;
		updateDegree(imgObject, degree);
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

	// storage
	const serialize = () => {
		const bones = [...boneArea.children].map((bone) => {
			return {
				'x': bone.style.left,
				'y': bone.style.top,
				'type': bone.children[0].getAttribute('src'),
				'degree': bone.dataset.degree || 0,
			};
		});
		window.localStorage.setItem('mertvoprog_bones', JSON.stringify(bones));
	};

	const unserialize = () => {
		let oldBones = window.localStorage.getItem('mertvoprog_bones');
		if (oldBones) {
			oldBones = JSON.parse(oldBones);

			const imgProtoHash = new Map();
			for (let img of boneMenu.querySelectorAll('img')) {
				imgProtoHash.set(img.getAttribute('src'), img);
			}

			for (let bone of oldBones) {
				const imgProto = imgProtoHash.get(bone.type);
				if (imgProto) {
					newBone(imgProto, bone.x, bone.y, bone.degree || 0);
				}
			}
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
	};

	const bonesToCircuit = () => {
		const bones = [...boneArea.children];
		const connectors = [];
		const nodes = [];

		// collect nodes and connectors
		bones.forEach(bone => {
			const type = boneType(bone);
			if (type === 'skull' || type == 'pelvis') {
				const node = {
					bone: bone,
					center: getBoneCenter(bone),
				};
				nodes.push(node);
			} else {
				const vertices = getConnectorVertices(bone, type);
				const center = getBoneCenter(bone);
				const degree = +bone.dataset.degree;
				const connector = {
					bone: bone,
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
			const type = boneType(node.bone);
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
				return {
					error: 'errManyOutputs',
					errorBone: node.bone,
				};
			}
			if (!inputs.length) {
				if (type === 'pelvis') {
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
		};
	};

	// handlers
	boneArea.addEventListener('contextmenu', (e) => {
		if (e.target.classList && e.target.classList.contains('bone-object-img')) {
			const bone = e.target.parentNode;
			bone.remove();
		} else {
			showBoneMenu(e.x, e.y);
		}
		e.preventDefault();
	});
	boneArea.addEventListener('click', () => {
		hideBoneMenu();
	});

	boneMenu.addEventListener('click', (e) => {
		if (e.target.tagName === 'IMG') {
			newBone(
				e.target,
				parseInt(boneMenu.style.left) + boneContainer.scrollLeft + 'px',
				parseInt(boneMenu.style.top) + boneContainer.scrollTop + 'px',
				0
			);
		}
		hideBoneMenu();
	});

	boneButtonRun.addEventListener('click', () => {
		clearBoneErrors();
		[nodes, connectors] = bonesToCircuit();
		let circuit = validateCircuit(nodes, connectors);
		if (circuit.error) {
			boneError(circuit.error, circuit.errorBone);
			return;
		}
	});

	boneArea.addEventListener('mousedown', (e) => {
		if (e.target.classList && e.target.classList.contains('bone-object-img')) {
			const bone = e.target.parentNode;
			center = getBoneCenter(bone);

			const offsetX = e.pageX - boneArea.offsetLeft - center.x;
			const offsetY = e.pageY - boneArea.offsetTop - center.y;

			dragX = e.pageX - bone.offsetLeft;
			dragY = e.pageY - bone.offsetTop;
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
		if (dragged !== undefined) {
			dragged.style.left = e.pageX - boneArea.offsetLeft - dragX + 'px';
			dragged.style.top = e.pageY - boneArea.offsetTop - dragY + 'px';
			e.preventDefault();
		} else if (rotated !== undefined) {
			const oldDegree = rotated.dataset.oldDegree || 0;

			const offsetX = e.pageX - boneArea.offsetLeft - center.x;
			const offsetY = e.pageY - boneArea.offsetTop - center.y;

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
	unserialize();
	window.setInterval(serialize, 5000);
});
