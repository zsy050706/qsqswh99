(function () {
    'use strict';

    var THREE = window.THREE;
    var OrbitControls = THREE.OrbitControls;

    var scene = null;
    var camera = null;
    var renderer = null;
    var labelLayer = null;
    var controls = null;
    var animationId = null;
    var hitMeshes = [];
    var verseEntries = [];
    var backgroundParticles = null;
    var pointerDown = null;
    var onVerseClick = null;
    var containerEl = null;
    var onControlsStart = null;

    var raycaster = new THREE.Raycaster();
    var mouse = new THREE.Vector2();

    function truncateText(text, maxLen) {
        if (text.length <= maxLen) return text;
        return text.slice(0, maxLen) + '…';
    }

    function computePositions3D(count) {
        var positions = [];
        var goldenAngle = Math.PI * (3 - Math.sqrt(5));
        var maxRadius = 1400;

        for (var i = 0; i < count; i++) {
            var t = (i + 0.5) / count;
            var radius = maxRadius * Math.cbrt(t);
            var theta = i * goldenAngle;
            var phi = Math.acos(1 - 2 * t);

            positions.push({
                x: radius * Math.sin(phi) * Math.cos(theta),
                y: radius * Math.sin(phi) * Math.sin(theta) * 0.55,
                z: radius * Math.cos(phi)
            });
        }

        return positions;
    }

    function createBackgroundParticles() {
        var count = 6000;
        var geometry = new THREE.BufferGeometry();
        var positions = new Float32Array(count * 3);
        var colors = new Float32Array(count * 3);
        var gold = new THREE.Color(0xd4af37);
        var white = new THREE.Color(0xffffff);

        for (var i = 0; i < count; i++) {
            var radius = 1800 + Math.random() * 1200;
            var theta = Math.random() * Math.PI * 2;
            var phi = Math.acos(2 * Math.random() - 1);

            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);

            var mix = Math.random();
            var color = gold.clone().lerp(white, mix * 0.7);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        var material = new THREE.PointsMaterial({
            size: 2.2,
            vertexColors: true,
            transparent: true,
            opacity: 0.75,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        return new THREE.Points(geometry, material);
    }

    function updateVerseLabels() {
        if (!labelLayer) return;

        var width = window.innerWidth;
        var height = window.innerHeight;
        var cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);

        verseEntries.forEach(function (entry) {
            var worldPos = new THREE.Vector3();
            entry.group.getWorldPosition(worldPos);

            var toPoint = worldPos.clone().sub(camera.position);
            if (cameraDirection.dot(toPoint) <= 0) {
                entry.labelEl.style.display = 'none';
                return;
            }

            var screenPos = worldPos.clone().project(camera);
            if (screenPos.z < -1 || screenPos.z > 1) {
                entry.labelEl.style.display = 'none';
                return;
            }

            var x = (screenPos.x * 0.5 + 0.5) * width;
            var y = (-screenPos.y * 0.5 + 0.5) * height;
            var dist = camera.position.distanceTo(worldPos);
            var opacity = THREE.MathUtils.clamp(1.4 - dist / 1600, 0.12, 0.9);
            var scale = THREE.MathUtils.clamp(700 / dist, 0.45, 1.15);

            entry.labelEl.style.display = '';
            entry.labelEl.style.left = x + 'px';
            entry.labelEl.style.top = y + 'px';
            entry.labelEl.style.setProperty('--verse-opacity', opacity.toFixed(3));
            entry.labelEl.style.setProperty('--verse-scale', scale.toFixed(3));
        });
    }

    function animate() {
        if (!renderer || !scene || !camera || !controls || !labelLayer) {
            animationId = null;
            return;
        }

        animationId = requestAnimationFrame(animate);

        if (backgroundParticles) {
            backgroundParticles.rotation.y += 0.00015;
            backgroundParticles.rotation.x += 0.00005;
        }

        controls.update();
        updateVerseLabels();
        renderer.render(scene, camera);
    }

    function onPointerDown(e) {
        pointerDown = { x: e.clientX, y: e.clientY, time: Date.now() };
    }

    function onPointerUp(e) {
        if (!pointerDown) return;

        var dx = e.clientX - pointerDown.x;
        var dy = e.clientY - pointerDown.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var elapsed = Date.now() - pointerDown.time;
        pointerDown = null;

        if (dist > 10 || elapsed > 400) return;

        var rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        var hits = raycaster.intersectObjects(hitMeshes, false);

        if (hits.length > 0 && onVerseClick) {
            onVerseClick(hits[0].object.userData.index);
        }
    }

    function onResize() {
        if (!camera || !renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function init(options) {
        destroy();

        containerEl = options.container;
        onVerseClick = options.onVerseClick;
        var starData = options.starData || [];

        containerEl.innerHTML = '';

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x020308);

        camera = new THREE.PerspectiveCamera(
            55,
            window.innerWidth / window.innerHeight,
            10,
            8000
        );
        camera.position.set(0, 120, 900);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);
        containerEl.appendChild(renderer.domElement);

        labelLayer = document.createElement('div');
        labelLayer.className = 'verse-label-layer';
        containerEl.appendChild(labelLayer);

        controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 0, 0);
        controls.enableDamping = true;
        controls.dampingFactor = 0.06;
        controls.minDistance = 280;
        controls.maxDistance = 1800;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.35;
        controls.enablePan = false;
        controls.minPolarAngle = Math.PI * 0.18;
        controls.maxPolarAngle = Math.PI * 0.82;

        scene.add(new THREE.AmbientLight(0x334466, 0.85));

        var pointLight = new THREE.PointLight(0xd4af37, 1.4, 6000);
        pointLight.position.set(0, 0, 0);
        scene.add(pointLight);

        backgroundParticles = createBackgroundParticles();
        scene.add(backgroundParticles);

        var positions = computePositions3D(starData.length);
        hitMeshes = [];
        verseEntries = [];

        starData.forEach(function (item, index) {
            var pos = positions[index];
            var group = new THREE.Group();
            group.position.set(pos.x, pos.y, pos.z);

            var hitMesh = new THREE.Mesh(
                new THREE.SphereGeometry(42, 10, 10),
                new THREE.MeshBasicMaterial({ visible: false })
            );
            hitMesh.userData.index = index;
            group.add(hitMesh);
            hitMeshes.push(hitMesh);

            var labelEl = document.createElement('div');
            labelEl.className = 'verse-node';
            labelEl.style.animationDelay = (Math.random() * 3) + 's';
            labelEl.innerHTML = '<span class="verse-text">' + truncateText(item.text, 22) + '</span>';
            labelLayer.appendChild(labelEl);

            (function (idx, el) {
                var down = null;
                el.addEventListener('pointerdown', function (e) {
                    down = { x: e.clientX, y: e.clientY };
                    e.stopPropagation();
                });
                el.addEventListener('pointerup', function (e) {
                    if (!down) return;
                    var dx = e.clientX - down.x;
                    var dy = e.clientY - down.y;
                    down = null;
                    if (Math.sqrt(dx * dx + dy * dy) < 12 && onVerseClick) {
                        e.stopPropagation();
                        onVerseClick(idx);
                    }
                });
            })(index, labelEl);

            scene.add(group);
            verseEntries.push({ group: group, labelEl: labelEl, hitMesh: hitMesh });
        });

        renderer.domElement.addEventListener('pointerdown', onPointerDown);
        renderer.domElement.addEventListener('pointerup', onPointerUp);
        window.addEventListener('resize', onResize);

        onControlsStart = function () {
            controls.autoRotate = false;
        };
        controls.addEventListener('start', onControlsStart);

        animate();
    }

    function releaseRenderer() {
        if (!renderer) return;

        var gl = renderer.getContext();
        var ext = gl && gl.getExtension('WEBGL_lose_context');
        renderer.dispose();
        if (ext) ext.loseContext();
    }

    function destroy() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }

        if (renderer) {
            renderer.domElement.removeEventListener('pointerdown', onPointerDown);
            renderer.domElement.removeEventListener('pointerup', onPointerUp);
        }

        window.removeEventListener('resize', onResize);

        if (controls && onControlsStart) {
            controls.removeEventListener('start', onControlsStart);
        }
        onControlsStart = null;

        if (labelLayer) {
            labelLayer.innerHTML = '';
            if (labelLayer.parentNode) {
                labelLayer.parentNode.removeChild(labelLayer);
            }
            labelLayer = null;
        }

        hitMeshes = [];
        verseEntries = [];

        if (scene) {
            scene.traverse(function (obj) {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(function (m) { m.dispose(); });
                    } else {
                        obj.material.dispose();
                    }
                }
            });
            scene = null;
        }

        if (renderer) {
            if (renderer.domElement.parentNode) {
                renderer.domElement.parentNode.removeChild(renderer.domElement);
            }
            releaseRenderer();
            renderer = null;
        }

        controls = null;
        camera = null;
        backgroundParticles = null;
        onVerseClick = null;
        containerEl = null;
    }

    window.GalaxyScene = { init: init, destroy: destroy };
})();
