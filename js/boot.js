(function () {
    'use strict';

    var starData = window.STAR_DATA || [];

    var STAGES = [
        { id: 'meet', name: '相遇', start: 0, end: 19 },
        { id: 'know', name: '相识', start: 20, end: 39 },
        { id: 'deep', name: '相知', start: 40, end: 59 },
        { id: 'love', name: '相恋', start: 60, end: 79 },
        { id: 'forever', name: '相守', start: 80, end: 99 }
    ];

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
    var modalContent = modalOverlay ? modalOverlay.querySelector('.modal-content') : null;
    var modalKicker = document.getElementById('modalKicker');
    var modalStamp = document.getElementById('modalStamp');
    var modalMedia = document.getElementById('modalMedia');
    var modalTitle = document.getElementById('modalTitle');
    var modalText = document.getElementById('modalText');
    var modalAudio = document.getElementById('modalAudio');
    var hintText = document.getElementById('hintText');
    var stageNav = document.getElementById('stageNav');
    var stageTabs = document.getElementById('stageTabs');
    var stageProgress = document.getElementById('stageProgress');
    var collectionPanel = document.getElementById('collectionPanel');
    var collectionBackdrop = document.getElementById('collectionBackdrop');
    var collectionClose = document.getElementById('collectionClose');
    var collectionPanelTitle = document.getElementById('collectionPanelTitle');
    var collectionPanelSubtitle = document.getElementById('collectionPanelSubtitle');
    var collectionGrid = document.getElementById('collectionGrid');

    var isAudioPlaying = true;
    var hasAudio = !!(clickSound && bgm);
    var activeVerseIndex = null;
    var modalReviewMode = false;
    var activeStageId = null;
    var isNavigatingToFinale = false;
    var viewedVerseKey = 'qsqswh99-viewed-verses';
    var progressApiUrl = '/api/progress';
    var viewedVerseIndexes = [];
    var progressLoadPromise = null;
    var progressApiAvailable = true;

    var CARD_THEMES = [
        { id: 'moon-letter', name: '月光信笺', kicker: 'MOONLIGHT LETTER', stamp: '夜色已寄达', accent: '#8db7e8', soft: '#dcecff', ink: '#24364d' },
        { id: 'snow-postcard', name: '雪夜明信片', kicker: 'SNOWFALL POSTCARD', stamp: '落雪留白', accent: '#9ec8da', soft: '#edf8ff', ink: '#2b4250' },
        { id: 'rain-window', name: '雨窗日记', kicker: 'RAINY WINDOW NOTE', stamp: '雨声慢递', accent: '#5fa6a0', soft: '#dff3ef', ink: '#263d44' },
        { id: 'cat-bow', name: '猫猫便签', kicker: 'SOFT CAT MEMO', stamp: '偷偷想你', accent: '#f05c8e', soft: '#ffe1ee', ink: '#673248' },
        { id: 'strawberry-cream', name: '草莓食谱卡', kicker: 'SWEET RECIPE CARD', stamp: '甜度合格', accent: '#e4465f', soft: '#fff0d8', ink: '#653234' },
        { id: 'cherry-polaroid', name: '樱桃拍立得', kicker: 'POLAROID MEMORY', stamp: '此刻成像', accent: '#d83b4c', soft: '#e9f7ff', ink: '#403647' },
        { id: 'candy-ticket', name: '糖果票根', kicker: 'ONE-WAY TICKET', stamp: '通往喜欢', accent: '#2fb7aa', soft: '#fff3b8', ink: '#3d4550' },
        { id: 'garden-note', name: '花园观察页', kicker: 'GARDEN FIELD NOTE', stamp: '今日花开', accent: '#6ea85c', soft: '#fff0c8', ink: '#354b32' }
    ];

    function getStageById(stageId) {
        for (var i = 0; i < STAGES.length; i++) {
            if (STAGES[i].id === stageId) return STAGES[i];
        }
        return null;
    }

    function getStageForIndex(index) {
        return STAGES[Math.floor(index / 20)] || STAGES[0];
    }

    function findCardTheme(themeId) {
        for (var i = 0; i < CARD_THEMES.length; i++) {
            if (CARD_THEMES[i].id === themeId) return CARD_THEMES[i];
        }
        return null;
    }

    function getCardTheme(index, data) {
        var requestedTheme = data && (data.theme || data.cardTheme);
        return findCardTheme(requestedTheme) || CARD_THEMES[index % CARD_THEMES.length];
    }

    function applyModalTheme(index, data) {
        var theme = getCardTheme(index, data);
        if (!modalContent) return theme;

        modalContent.className = 'modal-content modal-theme-' + theme.id;
        modalContent.dataset.theme = theme.id;
        modalContent.style.setProperty('--card-accent', theme.accent);
        modalContent.style.setProperty('--card-accent-soft', theme.soft);
        modalContent.style.setProperty('--card-ink', theme.ink);
        modalContent.style.setProperty('--card-decor-shift', (((index * 19) % 34) - 17) + 'px');
        modalContent.style.setProperty('--card-tilt', ((((index * 7) % 9) - 4) * 0.35) + 'deg');
        if (modalKicker) modalKicker.textContent = theme.kicker;
        if (modalStamp) modalStamp.textContent = theme.stamp;

        return theme;
    }

    function sanitizeViewedVerseIndexes(indexes) {
        if (!Array.isArray(indexes)) return [];

        var total = starData.length || 100;
        var seen = {};
        var sanitized = [];

        indexes.forEach(function (index) {
            var parsed = Number(index);
            if (Number.isInteger(parsed) && parsed >= 0 && parsed < total && !seen[parsed]) {
                seen[parsed] = true;
                sanitized.push(parsed);
            }
        });

        return sanitized.sort(function (a, b) {
            return a - b;
        });
    }

    function getLocalViewedVerseIndexes() {
        try {
            var saved = localStorage.getItem(viewedVerseKey);
            var parsed = saved ? JSON.parse(saved) : [];
            return sanitizeViewedVerseIndexes(parsed);
        } catch (err) {
            return [];
        }
    }

    function cacheViewedVerseIndexes(indexes) {
        try {
            localStorage.setItem(viewedVerseKey, JSON.stringify(indexes));
        } catch (err) {}
    }

    function getViewedVerseIndexes() {
        return viewedVerseIndexes.slice();
    }

    function refreshProgressViews() {
        updateStageNav();
        if (activeStageId) {
            renderCollectionPanel(activeStageId);
        }
    }

    function applyViewedVerseIndexes(indexes) {
        viewedVerseIndexes = sanitizeViewedVerseIndexes(indexes);
        cacheViewedVerseIndexes(viewedVerseIndexes);
        refreshProgressViews();
        return viewedVerseIndexes;
    }

    function syncViewedVerseIndexes(indexes) {
        if (!progressApiAvailable || typeof fetch !== 'function' || window.location.protocol === 'file:') {
            return Promise.resolve(indexes);
        }

        return fetch(progressApiUrl + '/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ viewed: indexes })
        })
            .then(function (response) {
                if (!response.ok) throw new Error('Progress sync failed');
                return response.json();
            })
            .then(function (data) {
                if (data && data.viewed) {
                    return applyViewedVerseIndexes(data.viewed);
                }
                return viewedVerseIndexes;
            })
            .catch(function (err) {
                progressApiAvailable = false;
                console.warn('Progress sync failed. Local backup is still available.', err);
                return viewedVerseIndexes;
            });
    }

    function loadViewedVerseIndexes() {
        if (progressLoadPromise) return progressLoadPromise;

        var localViewed = getLocalViewedVerseIndexes();
        applyViewedVerseIndexes(localViewed);

        if (typeof fetch !== 'function' || window.location.protocol === 'file:') {
            progressApiAvailable = false;
            progressLoadPromise = Promise.resolve(viewedVerseIndexes);
            return progressLoadPromise;
        }

        progressLoadPromise = fetch(progressApiUrl, { cache: 'no-store' })
            .then(function (response) {
                if (!response.ok) throw new Error('Progress API unavailable');
                return response.json();
            })
            .then(function (data) {
                var serverViewed = sanitizeViewedVerseIndexes(data && data.viewed);
                var mergedViewed = sanitizeViewedVerseIndexes(serverViewed.concat(localViewed));

                applyViewedVerseIndexes(mergedViewed);
                if (mergedViewed.length > serverViewed.length) {
                    syncViewedVerseIndexes(mergedViewed);
                }

                return viewedVerseIndexes;
            })
            .catch(function (err) {
                progressApiAvailable = false;
                console.warn('Progress API unavailable. Using local backup.', err);
                applyViewedVerseIndexes(localViewed);
                return viewedVerseIndexes;
            });

        return progressLoadPromise;
    }

    function persistViewedVerse(index) {
        if (!progressApiAvailable || typeof fetch !== 'function' || window.location.protocol === 'file:') {
            return;
        }

        fetch(progressApiUrl + '/viewed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index: index })
        })
            .then(function (response) {
                if (!response.ok) throw new Error('Progress save failed');
                return response.json();
            })
            .then(function (data) {
                if (data && data.viewed) {
                    applyViewedVerseIndexes(data.viewed);
                }
            })
            .catch(function (err) {
                progressApiAvailable = false;
                console.warn('Progress save failed. Local backup is still available.', err);
            });
    }

    function getViewedInStage(stage) {
        return getViewedVerseIndexes()
            .filter(function (index) {
                return index >= stage.start && index <= stage.end;
            })
            .sort(function (a, b) {
                return a - b;
            });
    }

    function truncateText(text, maxLen) {
        if (!text) return '';
        if (text.length <= maxLen) return text;
        return text.slice(0, maxLen) + '…';
    }

    function saveViewedVerse(index) {
        var viewed = getViewedVerseIndexes();
        if (viewed.indexOf(index) === -1) {
            viewed.push(index);
        }

        applyViewedVerseIndexes(viewed);
        persistViewedVerse(index);
        checkAllComplete();
    }

    function updateStageNav() {
        if (!stageProgress || !stageTabs) return;

        var viewed = getViewedVerseIndexes();
        var total = starData.length || 100;
        stageProgress.textContent = viewed.length + ' / ' + total;

        STAGES.forEach(function (stage) {
            var countEl = document.getElementById('stageCount-' + stage.id);
            var tabEl = stageTabs.querySelector('[data-stage-id="' + stage.id + '"]');
            var count = getViewedInStage(stage).length;
            var stageTotal = stage.end - stage.start + 1;

            if (countEl) {
                countEl.textContent = count + '/' + stageTotal;
            }
            if (tabEl) {
                tabEl.classList.toggle('has-items', count > 0);
                tabEl.classList.toggle('complete', count >= stageTotal);
                tabEl.classList.toggle('active', activeStageId === stage.id);
            }
        });
    }

    function initStageNav() {
        if (!stageTabs) return;

        stageTabs.innerHTML = '';
        STAGES.forEach(function (stage) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'stage-tab';
            btn.dataset.stageId = stage.id;
            btn.innerHTML =
                '<span class="stage-tab-name">' + stage.name + '</span>' +
                '<span class="stage-tab-count" id="stageCount-' + stage.id + '">0/20</span>';
            btn.addEventListener('click', function () {
                if (activeStageId === stage.id && collectionPanel.classList.contains('show')) {
                    closeCollectionPanel();
                } else {
                    openCollectionPanel(stage.id);
                }
            });
            stageTabs.appendChild(btn);
        });

        updateStageNav();
    }

    function renderCollectionPanel(stageId) {
        var stage = getStageById(stageId);
        if (!stage || !collectionGrid) return;

        var viewedInStage = getViewedInStage(stage);
        var stageTotal = stage.end - stage.start + 1;

        collectionPanelTitle.textContent = stage.name;
        collectionPanelSubtitle.textContent = '已收集 ' + viewedInStage.length + ' / ' + stageTotal + ' 颗星';
        collectionGrid.innerHTML = '';

        if (viewedInStage.length === 0) {
            collectionGrid.innerHTML =
                '<div class="collection-empty">' +
                '这片星域还没有被点亮<br>去星河里寻找属于「' + stage.name + '」的星星吧' +
                '</div>';
            return;
        }

        viewedInStage.forEach(function (index) {
            var data = starData[index];
            if (!data) return;
            var theme = getCardTheme(index, data);

            var card = document.createElement('button');
            card.type = 'button';
            card.className = 'collection-card collection-card-themed collection-theme-' + theme.id;
            card.style.setProperty('--collection-accent', theme.accent);
            card.style.setProperty('--collection-soft', theme.soft);
            card.innerHTML =
                '<div class="collection-card-star">★</div>' +
                '<div class="collection-card-body">' +
                '<div class="collection-card-label">星语 · ' + (index + 1) + '</div>' +
                '<div class="collection-card-text">' + truncateText(data.text, 48) + '</div>' +
                '</div>';

            card.addEventListener('click', function () {
                openModal(index, true);
            });
            collectionGrid.appendChild(card);
        });
    }

    function openCollectionPanel(stageId) {
        if (!collectionPanel || !collectionBackdrop) return;

        activeStageId = stageId;
        renderCollectionPanel(stageId);
        collectionPanel.classList.add('show');
        collectionPanel.setAttribute('aria-hidden', 'false');
        collectionBackdrop.classList.add('show');
        updateStageNav();
    }

    function closeCollectionPanel() {
        if (!collectionPanel || !collectionBackdrop) return;

        activeStageId = null;
        collectionPanel.classList.remove('show');
        collectionPanel.setAttribute('aria-hidden', 'true');
        collectionBackdrop.classList.remove('show');
        updateStageNav();
    }

    function checkAllComplete() {
        if (isNavigatingToFinale) return;

        var viewed = getViewedVerseIndexes();
        var total = starData.length;
        if (total > 0 && viewed.length >= total) {
            navigateToFinale();
        }
    }

    function navigateToFinale() {
        if (isNavigatingToFinale) return;
        isNavigatingToFinale = true;

        closeCollectionPanel();
        if (modalOverlay) {
            modalOverlay.classList.remove('show');
        }

        if (hintText) {
            hintText.textContent = '百星齐聚，星河为你开启终章…';
            hintText.classList.add('show');
        }

        if (messageContainer) {
            messageContainer.classList.add('finale-transition');
        }

        setTimeout(function () {
            window.location.href = 'finale.html';
        }, 2200);
    }

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

    function openModal(index, reviewMode) {
        var data = starData[index];
        if (!data) return;

        activeVerseIndex = index;
        modalReviewMode = !!reviewMode;
        var theme = applyModalTheme(index, data);

        var mediaHtml = '';
        if (data.video) {
            mediaHtml = '<video controls playsinline><source src="' + data.video + '"></video>';
        } else if (data.photo) {
            mediaHtml = '<img src="' + data.photo + '" alt="记忆影像">';
        } else {
            mediaHtml =
                '<div class="modal-media-placeholder">' +
                '<span class="modal-placeholder-mark"></span>' +
                '<span>影像待启</span>' +
                '</div>';
        }

        modalMedia.innerHTML = mediaHtml;
        modalTitle.textContent = (theme ? theme.name : '星语') + ' · ' + (index + 1);
        modalText.textContent = data.text;

        if (data.audio) {
            modalAudio.innerHTML = '<audio playsinline><source src="' + data.audio + '"></audio>';
            var verseAudio = modalAudio.querySelector('audio');
            if (verseAudio) {
                verseAudio.currentTime = 0;
                verseAudio.play().catch(function () {});
            }
        } else {
            modalAudio.innerHTML = '<div class="modal-audio-placeholder">语音待启</div>';
        }

        modalOverlay.classList.add('show');
    }

    function closeModalFunc() {
        modalOverlay.classList.remove('show');

        if (!modalReviewMode && activeVerseIndex !== null && window.GalaxyScene && typeof window.GalaxyScene.hideVerse === 'function') {
            window.GalaxyScene.hideVerse(activeVerseIndex);
            saveViewedVerse(activeVerseIndex);
        }

        activeVerseIndex = null;
        modalReviewMode = false;

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
                hiddenIndexes: getViewedVerseIndexes(),
                onVerseClick: function (index) {
                    openModal(index, false);
                }
            });
        } catch (err) {
            console.error(err);
            showGalaxyError('3D 场景启动失败，请刷新页面重试');
        }
    }

    function enterGalaxy() {
        loadViewedVerseIndexes().then(function () {
            var viewed = getViewedVerseIndexes();
            if (starData.length > 0 && viewed.length >= starData.length) {
                navigateToFinale();
                return;
            }

            landingPage.classList.add('fade-out');
            setTimeout(function () {
                messageContainer.classList.add('show');
                backButton.classList.add('show');
                hintText.classList.add('show');
                if (stageNav) stageNav.classList.add('show');
                requestAnimationFrame(function () {
                    initGalaxyScene();
                });
            }, 800);
        });
    }

    viewedVerseIndexes = getLocalViewedVerseIndexes();
    initStageNav();
    loadViewedVerseIndexes();

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
            closeCollectionPanel();
            if (window.GalaxyScene) {
                window.GalaxyScene.destroy();
            }
            threeContainer.innerHTML = '';
            messageContainer.classList.remove('show', 'finale-transition');
            backButton.classList.remove('show');
            hintText.classList.remove('show');
            if (stageNav) stageNav.classList.remove('show');
            landingPage.classList.remove('fade-out');
            if (hasAudio) {
                bgm.pause();
                bgm.currentTime = 0;
            }
            closeModalFunc();
            if (hintText) {
                hintText.textContent = '漫游星河 · 每一句低语都藏着一个故事';
            }
        });
    }

    if (closeModal) closeModal.addEventListener('click', closeModalFunc);
    if (modalOverlay) {
        modalOverlay.addEventListener('click', function (e) {
            if (e.target === modalOverlay) closeModalFunc();
        });
    }
    if (collectionClose) collectionClose.addEventListener('click', closeCollectionPanel);
    if (collectionBackdrop) {
        collectionBackdrop.addEventListener('click', closeCollectionPanel);
    }
    if (audioBtn) {
        if (!hasAudio) {
            audioBtn.style.display = 'none';
        } else {
            audioBtn.addEventListener('click', toggleAudio);
        }
    }

    window.openVerseModal = function (index) {
        openModal(index, false);
    };
    createLandingStars(landingStars, 80);
})();
