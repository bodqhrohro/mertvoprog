window.addEventListener('load', () => {
	const boneMenu = document.querySelector('.bone-menu');
	const boneArea = document.querySelector('.bone-area');

	const DRAG_RADIUS = 20;
	const ROTATE_REGEX = /transform(\([0-9-]+\)deg)/;

	let dragX = undefined;
	let dragY = undefined;
	let centerX = undefined;
	let centerY = undefined;
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
	}

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
			newBone(e.target, boneMenu.style.left, boneMenu.style.top, 0);
		}
		hideBoneMenu();
	});

	boneArea.addEventListener('mousedown', (e) => {
		if (e.target.classList && e.target.classList.contains('bone-object-img')) {
			const bone = e.target.parentNode;
			centerX = bone.offsetLeft + bone.clientWidth / 2;
			centerY = bone.offsetTop + bone.clientHeight / 2;

			const offsetX = e.pageX - boneArea.offsetLeft - centerX;
			const offsetY = e.pageY - boneArea.offsetTop - centerY;

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

			const offsetX = e.pageX - boneArea.offsetLeft - centerX;
			const offsetY = e.pageY - boneArea.offsetTop - centerY;

			const curDegree = Math.atan2(-offsetX, offsetY) / Math.PI * 180;
			const degree = fitAngle(curDegree - startDegree);
			updateDegree(rotated, degree);
		}
	});
	boneArea.addEventListener('mouseup', (e) => {
		dragX = undefined;
		dragY = undefined;
		centerX = undefined;
		centerY = undefined;
		startDegree = undefined;
		dragged = undefined;
		rotated = undefined;
	});

	// init
	unserialize();
	window.setInterval(serialize, 5000);
});
