(function () {
    'use strict';

    var starData = window.STAR_DATA || [];

    var landingPage = document.getElementById('landingPage');
    var messageContainer = document.getElementById('messageContainer');
    var threeContainer = document.getElementById('threeContainer');
    var startButton = document.getElementById('startButton');
    var backButton = document.getElementById('backButton');
    var audioBtn = document.getElementById('audioBtn');
    var clickSound = document.getElementById('clickSound');
    var bgm = document.getElementById('bgm');
    var landingStars = document.getElementById('landingStars');
    var modalOverlay = document.getElementById('modalOverlay');
    var closeModal = document.getElementById('closeModal');
    var modalMedia = document.getElementById('modalMedia');
    var modalTitle = document.getElementById('modalTitle');
    var modalText = document.getElementById('modalText');
    var modalAudio = document.getElementById('modalAudio');
    var hintText = document.getElementById('hintText');
    var depthIndicator = document.getElementById('depthIndicator');

    var isAudioPlaying = true;
    var hasAudio = !!(clickSound && bgm);

    function createLandingStars(container, count) {
        if (!container) return;
        var fragment = document.createDocumentFragment();
        for (var i = 0; i < count; i++) {
            var star = document.createElement('div');
            star.className = 'bg-star';
            var size = Math.random() * 2.5 + 1;
            star.style.width = size + 'px';
            star.style.height = size + 'px';
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 100 + '%';
            star.style.animationDuration = (2 + Math.random() * 3) + 's';
            star.style.animationDelay = Math.random() * 3 + 's';
            fragment.appendChild(star);
        }
        container.appendChild(fragment);
    }

    function openModal(index) {
        var data = starData[index];
        if (!data) return;

        var mediaHtml = '';
        if (data.video) {
            mediaHtml = '<video controls playsinline><source src="' + data.video + '"></video>';
        } else if (data.photo) {
            mediaHtml = '<img src="' + data.photo + '" alt="记忆影像">';
        } else {
            mediaHtml = '<div class="modal-media-placeholder">影像待启</div>';
        }

        modalMedia.innerHTML = mediaHtml;
        modalTitle.textContent = '星语 · ' + (index + 1);
        modalText.textContent = data.text;

        if (data.audio) {
            modalAudio.innerHTML = '<audio controls><source src="' + data.audio + '" type="audio/mpeg"></audio>';
        } else {
            modalAudio.innerHTML = '<div class="modal-audio-placeholder">语音待启</div>';
        }

        modalOverlay.classList.add('show');
    }

    function closeModalFunc() {
        modalOverlay.classList.remove('show');
        var video = modalMedia.querySelector('video');
        var audio = modalAudio.querySelector('audio');
        if (video) video.pause();
        if (audio) audio.pause();
    }

    function toggleAudio() {
        if (!hasAudio) return;
        isAudioPlaying = !isAudioPlaying;
        if (isAudioPlaying) {
            audioBtn.textContent = '🔊';
            bgm.volume = 0.4;
            if (messageContainer.classList.contains('show')) {
                bgm.play().catch(function () {});
            }
        } else {
            audioBtn.textContent = '🔇';
            bgm.pause();
            clickSound.pause();
        }
    }

    function showGalaxyLoading() {
        threeContainer.innerHTML = '<div class="galaxy-loading">星河正在苏醒…</div>';
    }

    function showGalaxyError(message) {
        threeContainer.innerHTML =
            '<div class="galaxy-error">' +
            '<p>' + message + '</p>' +
            '<p class="galaxy-error-hint">请检查网络连接后刷新页面重试</p>' +
            '</div>';
    }

    function initGalaxyScene() {
        showGalaxyLoading();

        if (typeof THREE === 'undefined') {
            showGalaxyError('3D 引擎加载失败，请联网后刷新页面');
            return;
        }
        if (!window.GalaxyScene) {
            showGalaxyError('页面脚本不完整，请确认 js 文件夹未被删除');
            return;
        }

        try {
            window.GalaxyScene.init({
                container: threeContainer,
                starData: starData,
                onVerseClick: openModal
            });
        } catch (err) {
            console.error(err);
            showGalaxyError('3D 场景启动失败，请刷新页面重试');
        }
    }

    function enterGalaxy() {
        landingPage.classList.add('fade-out');
        setTimeout(function () {
            messageContainer.classList.add('show');
            backButton.classList.add('show');
            hintText.classList.add('show');
            depthIndicator.classList.add('show');
            requestAnimationFrame(function () {
                initGalaxyScene();
            });
        }, 800);
    }

    if (startButton) {
        startButton.addEventListener('click', function () {
            if (hasAudio && isAudioPlaying) {
                clickSound.play().catch(function () {});
                bgm.volume = 0.4;
                bgm.play().catch(function () {});
            }
            enterGalaxy();
        });
    }

    if (backButton) {
        backButton.addEventListener('click', function () {
            if (window.GalaxyScene) {
                window.GalaxyScene.destroy();
            }
            threeContainer.innerHTML = '';
            messageContainer.classList.remove('show');
            backButton.classList.remove('show');
            hintText.classList.remove('show');
            depthIndicator.classList.remove('show');
            landingPage.classList.remove('fade-out');
            if (hasAudio) {
                bgm.pause();
                bgm.currentTime = 0;
            }
            closeModalFunc();
        });
    }

    if (closeModal) closeModal.addEventListener('click', closeModalFunc);
    if (modalOverlay) {
        modalOverlay.addEventListener('click', function (e) {
            if (e.target === modalOverlay) closeModalFunc();
        });
    }
    if (audioBtn) {
        if (!hasAudio) {
            audioBtn.style.display = 'none';
        } else {
            audioBtn.addEventListener('click', toggleAudio);
        }
    }

    window.openVerseModal = openModal;
    createLandingStars(landingStars, 80);
})();
