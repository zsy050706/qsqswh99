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
    var autoRotateResumeTimer = null;
    var hiddenVerseIndexes = {};
    var hoveredIndex = null;
    var versePositions = [];

    var raycaster = new THREE.Raycaster();
    var mouse = new THREE.Vector2();

    function truncateText(text, maxLen) {
        if (text.length <= maxLen) return text;
        return text.slice(0, maxLen) + '…';
    }

    function getVerseColor(index) {
        var colors = [
            { main: '212, 175, 55', glow: '212, 175, 55' },
            { main: '255, 183, 197', glow: '255, 120, 170' },
            { main: '139, 217, 255', glow: '84, 180, 255' },
            { main: '190, 255, 198', glow: '110, 235, 150' },
            { main: '218, 190, 255', glow: '165, 120, 255' },
            { main: '255, 214, 153', glow: '255, 168, 88' },
            { main: '255, 246, 180', glow: '255, 226, 88' }
        ];
        return colors[index % colors.length];
    }

    function stopAutoRotate() {
        if (!controls) return;
        controls.autoRotate = false;
        if (autoRotateResumeTimer) {
            clearTimeout(autoRotateResumeTimer);
            autoRotateResumeTimer = null;
        }
    }

    function resumeAutoRotateAfterDelay() {
        if (!controls) return;
        stopAutoRotate();
        autoRotateResumeTimer = setTimeout(function () {
            if (controls) {
                controls.autoRotate = true;
            }
            autoRotateResumeTimer = null;
        }, 5000);
    }

    function hideVerse(index) {
        hiddenVerseIndexes[index] = true;
        if (hoveredIndex === index) {
            setHoveredIndex(null);
        }
        verseEntries.forEach(function (entry) {
            if (entry.index === index) {
                entry.hidden = true;
                entry.group.visible = false;
                entry.labelEl.classList.add('verse-node-hidden');
            }
        });
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

    function getNearestNeighborIndexes(index, count) {
        var origin = versePositions[index];
        if (!origin) return [];

        var neighbors = [];
        versePositions.forEach(function (pos, i) {
            if (i === index || hiddenVerseIndexes[i]) return;
            var dx = pos.x - origin.x;
            var dy = pos.y - origin.y;
            var dz = pos.z - origin.z;
            neighbors.push({ index: i, dist: dx * dx + dy * dy + dz * dz });
        });

        neighbors.sort(function (a, b) {
            return a.dist - b.dist;
        });

        return neighbors.slice(0, count).map(function (item) {
            return item.index;
        });
    }

    function createHoverEffect(verseColor) {
        var group = new THREE.Group();
        group.visible = false;

        var lineCount = 16;
        var lineLength = 175;
        var linePositions = new Float32Array(lineCount * 2 * 3);
        for (var i = 0; i < lineCount; i++) {
            var angle = (i / lineCount) * Math.PI * 2;
            var tilt = (i % 3 - 1) * 0.35;
            linePositions[i * 6] = 0;
            linePositions[i * 6 + 1] = 0;
            linePositions[i * 6 + 2] = 0;
            linePositions[i * 6 + 3] = Math.cos(angle) * lineLength;
            linePositions[i * 6 + 4] = tilt * lineLength;
            linePositions[i * 6 + 5] = Math.sin(angle) * lineLength * 0.72;
        }

        var lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
        var lineMat = new THREE.LineBasicMaterial({
            color: new THREE.Color('rgb(' + verseColor.main + ')'),
            transparent: true,
            opacity: 0.68,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        group.add(new THREE.LineSegments(lineGeo, lineMat));

        var sparkleCount = 32;
        var sparklePos = new Float32Array(sparkleCount * 3);
        for (var j = 0; j < sparkleCount; j++) {
            var radius = 55 + Math.random() * 140;
            var theta = Math.random() * Math.PI * 2;
            var phi = Math.acos(2 * Math.random() - 1);
            sparklePos[j * 3] = radius * Math.sin(phi) * Math.cos(theta);
            sparklePos[j * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            sparklePos[j * 3 + 2] = radius * Math.cos(phi);
        }

        var sparkleGeo = new THREE.BufferGeometry();
        sparkleGeo.setAttribute('position', new THREE.BufferAttribute(sparklePos, 3));
        var sparkleMat = new THREE.PointsMaterial({
            color: new THREE.Color('rgb(' + verseColor.glow + ')'),
            size: 6.5,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        group.add(new THREE.Points(sparkleGeo, sparkleMat));

        var neighborLineGeo = new THREE.BufferGeometry();
        var neighborLineMat = new THREE.LineBasicMaterial({
            color: new THREE.Color('rgb(' + verseColor.glow + ')'),
            transparent: true,
            opacity: 0.48,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        var neighborLines = new THREE.LineSegments(neighborLineGeo, neighborLineMat);
        group.add(neighborLines);

        group.userData = {
            lineMat: lineMat,
            sparkleMat: sparkleMat,
            neighborLineMat: neighborLineMat,
            neighborLines: neighborLines,
            phase: Math.random() * Math.PI * 2
        };

        return group;
    }

    function updateNeighborLines(entry, index) {
        var origin = versePositions[index];
        var neighborIndexes = getNearestNeighborIndexes(index, 3);
        var positions = new Float32Array(neighborIndexes.length * 2 * 3);

        neighborIndexes.forEach(function (neighborIndex, i) {
            var neighbor = versePositions[neighborIndex];
            positions[i * 6] = 0;
            positions[i * 6 + 1] = 0;
            positions[i * 6 + 2] = 0;
            positions[i * 6 + 3] = neighbor.x - origin.x;
            positions[i * 6 + 4] = neighbor.y - origin.y;
            positions[i * 6 + 5] = neighbor.z - origin.z;
        });

        entry.hoverEffectGroup.userData.neighborLines.geometry.setAttribute(
            'position',
            new THREE.BufferAttribute(positions, 3)
        );
        entry.hoverEffectGroup.userData.neighborLines.geometry.attributes.position.needsUpdate = true;
    }

    function setHoveredIndex(index) {
        if (hoveredIndex === index) return;

        if (hoveredIndex !== null) {
            verseEntries.forEach(function (entry) {
                if (entry.index !== hoveredIndex || entry.hidden) return;
                entry.hoverEffectGroup.visible = false;
                entry.labelEl.classList.remove('verse-node-hovered');
            });
        }

        hoveredIndex = index;

        if (hoveredIndex === null) {
            if (renderer) renderer.domElement.style.cursor = 'grab';
            return;
        }

        verseEntries.forEach(function (entry) {
            if (entry.index !== hoveredIndex || entry.hidden) return;
            updateNeighborLines(entry, hoveredIndex);
            entry.hoverEffectGroup.visible = true;
            entry.labelEl.classList.add('verse-node-hovered');
        });

        if (renderer) renderer.domElement.style.cursor = 'pointer';
    }

    function pickVerseAt(clientX, clientY) {
        if (!renderer || !camera) return null;

        var rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        var hits = raycaster.intersectObjects(hitMeshes, false);

        if (hits.length === 0) return null;

        var hitIndex = hits[0].object.userData.index;
        return hiddenVerseIndexes[hitIndex] ? null : hitIndex;
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
            if (entry.hidden) {
                entry.labelEl.style.display = 'none';
                return;
            }

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
            var isHovered = entry.index === hoveredIndex;

            if (isHovered) {
                opacity = Math.min(1, opacity * 1.35);
                scale = Math.min(1.35, scale * 1.12);
            }

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

        var time = Date.now() * 0.004;
        verseEntries.forEach(function (entry) {
            if (!entry.hoverEffectGroup.visible) return;

            var effect = entry.hoverEffectGroup.userData;
            var pulse = 0.5 + 0.5 * Math.sin(time + effect.phase);
            effect.sparkleMat.opacity = 0.45 + pulse * 0.55;
            effect.lineMat.opacity = 0.35 + pulse * 0.5;
            effect.neighborLineMat.opacity = 0.25 + pulse * 0.7;
            entry.hoverEffectGroup.rotation.y += 0.01;
        });

        updateVerseLabels();
        renderer.render(scene, camera);
    }

    function onPointerMove(e) {
        setHoveredIndex(pickVerseAt(e.clientX, e.clientY));
    }

    function onPointerLeave() {
        setHoveredIndex(null);
    }

    function onPointerDown(e) {
        stopAutoRotate();
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
            var hitIndex = hits[0].object.userData.index;
            if (!hiddenVerseIndexes[hitIndex]) {
                onVerseClick(hitIndex);
            }
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
        hiddenVerseIndexes = {};
        (options.hiddenIndexes || []).forEach(function (index) {
            hiddenVerseIndexes[index] = true;
        });

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
        versePositions = positions;
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

            var verseColor = getVerseColor(index);
            var hoverEffectGroup = createHoverEffect(verseColor);
            group.add(hoverEffectGroup);

            var labelEl = document.createElement('div');
            var isHidden = !!hiddenVerseIndexes[index];
            labelEl.className = isHidden ? 'verse-node verse-node-hidden' : 'verse-node';
            labelEl.style.animationDelay = (Math.random() * 3) + 's';
            labelEl.style.setProperty('--verse-color', verseColor.main);
            labelEl.style.setProperty('--verse-glow-color', verseColor.glow);
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
                    if (Math.sqrt(dx * dx + dy * dy) < 12 && onVerseClick && !hiddenVerseIndexes[idx]) {
                        e.stopPropagation();
                        onVerseClick(idx);
                    }
                });
                el.addEventListener('mouseenter', function () {
                    setHoveredIndex(idx);
                });
                el.addEventListener('mouseleave', function () {
                    if (hoveredIndex === idx) {
                        setHoveredIndex(null);
                    }
                });
            })(index, labelEl);

            group.visible = !isHidden;
            scene.add(group);
            verseEntries.push({
                index: index,
                group: group,
                labelEl: labelEl,
                hitMesh: hitMesh,
                hoverEffectGroup: hoverEffectGroup,
                hidden: isHidden
            });
        });

        renderer.domElement.addEventListener('pointerdown', onPointerDown);
        renderer.domElement.addEventListener('pointerup', onPointerUp);
        renderer.domElement.addEventListener('pointermove', onPointerMove);
        renderer.domElement.addEventListener('pointerleave', onPointerLeave);
        window.addEventListener('resize', onResize);

        onControlsStart = function () {
            stopAutoRotate();
        };
        controls.addEventListener('start', onControlsStart);
        controls.addEventListener('end', resumeAutoRotateAfterDelay);

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
            renderer.domElement.removeEventListener('pointermove', onPointerMove);
            renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
        }

        window.removeEventListener('resize', onResize);

        if (autoRotateResumeTimer) {
            clearTimeout(autoRotateResumeTimer);
            autoRotateResumeTimer = null;
        }

        if (controls && onControlsStart) {
            controls.removeEventListener('start', onControlsStart);
            controls.removeEventListener('end', resumeAutoRotateAfterDelay);
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
        versePositions = [];
        hoveredIndex = null;

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

    window.GalaxyScene = { init: init, destroy: destroy, hideVerse: hideVerse };
})();
