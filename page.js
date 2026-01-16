        const config = {
            // サイト左上のロゴ名
            name: "麗澤大学",
            
            // トップのヒーローエリアの文字
            hero: { title: "CAMPUS TOUR", sub: "REITAKU UNIVERSITY" },
            
            // 導入のコンセプト文章（<br>で改行できます）
            concept: `
                <h2 style="font-family: 'Cinzel', serif; font-size: 2.5rem; margin: 0 0 1rem 0; letter-spacing: 0.1em;">Reitaku Campus</h2>
                <h3 style="font-size: 1.1rem; margin: 0 0 2rem 0; font-weight: normal; color: #555;">360°でキャンパスツアーをしてみよう！</h3>
                <p style="font-size: 1rem; line-height: 2.2; margin: 0; color: #555;">
                    このサイトはパノラマ機能（360°ビュー）や地図を活用して、麗澤大学のキャンパス内を体験できるように制作したものです。<br>
                    麗澤大学のキャンパスは、豊かな緑に囲まれ落ち着いた環境と、<br>
                    学生の挑戦を支える充実した施設設備が特徴です。
                </p>
            `,
            
            // 各コンテンツ（部屋など）のデータ
            // image1.jpg が textData[0]、image2.jpg が textData[1]... に対応します
            textData: [
                { name: "「さつき」校舎", desc: "工学部の校舎。", pano: "Map/images/part2/satsuki_out.jpg" },
                { name: "「かえで」校舎", desc: "経済学部、経営学部の校舎。", pano: "Map/images/part2/kaede_front.jpg" },
                { name: "「あすなろ」校舎", desc: "国際学部、外国語学部の校舎。", pano: "Map/images/part2/asunaro1.jpg" },
                { name: "麗澤大学院", desc: "最先端の研究設備を備えた施設。", pano: "Map/images/part2/puraza.jpg" },
                { name: "図書館", desc: "豊富な本と快適な学習環境を提供する図書館。", pano: "Map/images/part2/tosyokann_soto.jpg" },
                { name: "「ひいらぎ」食堂", desc: "学生の憩いの場である食堂。", pano: "Map/images/part2/hiiragi_1.jpg" },
            ]
        };

        // ★スライダー画像の最大枚数（imageフォルダの main1.jpg, main2.jpg ... を読み込みます）
        // Ensure the Graduate School VIEW button points to an existing panorama file.
        // (Some builds only contain `kennkyuutou_mae.jpg` under `Map/images/part2/thumbs/`)
        try {
            const item = (config && config.textData && config.textData[3]) ? config.textData[3] : null;
            if (item && typeof item.pano === 'string' && item.pano.includes('Map/images/part2/kennkyuutou_mae.jpg')) {
                item.pano = 'Map/images/part2/thumbs/kennkyuutou_mae.jpg';
            }
        } catch (_) {}

        const MAX_HERO_IMAGES = 5;
        
        // ★リスト画像の最大枚数（imageフォルダの image1.jpg, image2.jpg ... を読み込みます）
        const MAX_ROOM_IMAGES = 18;

        /* ===============動作ロジック）================== */

        document.addEventListener('DOMContentLoaded', () => {
            document.getElementById('brand').textContent = config.name;
            document.getElementById('hero-title').textContent = config.hero.title;
            document.getElementById('hero-sub').textContent = config.hero.sub;
            document.getElementById('concept-text').innerHTML = config.concept;

            // 1. ヒーロースライダー：最初の1枚は即表示、残りはアイドル時に追加（体感速度優先）
            const heroContainer = document.getElementById('hero-slider');
            bootstrapHeroSlider(heroContainer);

            // 2. 部屋画像：存在チェックのための事前ロードをやめ、lazy-load + onerrorで欠損を除去
            const roomContainer = document.getElementById('rooms');
            renderRoomItems(roomContainer);

            // 無限スライダーの初期化
            initInfiniteSlider();

            // Listen for map iframe "exit" button requests (close overlay + scroll back to section).
            window.addEventListener('message', (event) => {
                const data = event.data;

                // Handle open request from embedded map
                if (data && data.type === 'reitaku:openMapOverlay') {
                    if (data.pano) {
                        openPanorama(data.pano);
                    }
                    return;
                }

                const shouldClose = data === 'closeMapOverlay' || (data && data.type === 'reitaku:closeMapOverlay');
                if (!shouldClose) return;

                const overlay = document.getElementById('map-overlay');
                const iframe = document.getElementById('map-frame');
                if (overlay) {
                    overlay.style.opacity = '0';
                    overlay.style.pointerEvents = 'none';
                }
                if (iframe) {
                    setTimeout(() => { iframe.src = ''; }, 550);
                }

                const targetSectionId = (data && data.targetSectionId) ? data.targetSectionId : 'rooms';
                const section = document.getElementById(targetSectionId);
                if (section && typeof section.scrollIntoView === 'function') {
                    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });

            // スライダーロジック（スライド追加にも追従）
            startHeroAutoSlide(heroContainer);

            // Scroll Animation Observer
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(e => {
                    if(e.isIntersecting) e.target.classList.add('active');
                });
            }, { threshold: 0.1 });
            document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

            // パララックス開始
            initParallax();
        });

        // 画像存在チェック（hero追加用。roomはlazy + onerrorで処理）
        function imageExists(src) {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(true);
                img.onerror = () => resolve(false);
                img.decoding = 'async';
                img.src = src;
            });
        }

        function bootstrapHeroSlider(container) {
            if (!container) return;
            // まずmain1を表示（存在しない場合もレイアウトは維持される）
            const firstPath = 'image/main1.jpg';
            const first = document.createElement('div');
            first.className = 'slide active';
            first.style.backgroundImage = `url('${firstPath}')`;
            container.insertBefore(first, container.querySelector('.hero-txt'));

            // 残りはアイドル時間に追加（存在チェックしてから）
            const schedule = (cb) => {
                if (typeof window.requestIdleCallback === 'function') {
                    window.requestIdleCallback(cb, { timeout: 1200 });
                } else {
                    setTimeout(cb, 0);
                }
            };

            schedule(async () => {
                const heroTxt = container.querySelector('.hero-txt');
                const checks = [];
                for (let i = 2; i <= MAX_HERO_IMAGES; i++) {
                    const imgPath = `image/main${i}.jpg`;
                    checks.push((async () => {
                        const exists = await imageExists(imgPath);
                        return exists ? imgPath : null;
                    })());
                }
                const paths = await Promise.all(checks);
                paths.filter(Boolean).forEach((imgPath) => {
                    const div = document.createElement('div');
                    div.className = 'slide';
                    div.style.backgroundImage = `url('${imgPath}')`;
                    container.insertBefore(div, heroTxt);
                });
            });
        }

        function startHeroAutoSlide(heroContainer) {
            if (!heroContainer) return;
            let current = 0;
            setInterval(() => {
                const slides = heroContainer.querySelectorAll('.slide');
                if (!slides || slides.length <= 1) return;
                if (current >= slides.length) current = 0;
                slides[current].classList.remove('active');
                current = (current + 1) % slides.length;
                slides[current].classList.add('active');
            }, 3000);
        }

        function renderRoomItems(roomContainer) {
            if (!roomContainer) return;
            const frag = document.createDocumentFragment();

            const configuredCount = Array.isArray(config.textData) ? config.textData.length : 0;
            const roomCount = configuredCount > 0 ? Math.min(MAX_ROOM_IMAGES, configuredCount) : MAX_ROOM_IMAGES;

            for (let index = 1; index <= roomCount; index++) {
                const imgPath = `image/model${index}.png`;
                const dataIndex = index - 1;
                const name = config.textData[dataIndex] ? config.textData[dataIndex].name : `Model ${index}`;
                const desc = config.textData[dataIndex] ? config.textData[dataIndex].desc : `Campus view ${index}`;
                const pano = config.textData[dataIndex] ? config.textData[dataIndex].pano : '';

                const safeName = name.replace(/'/g, "\\'");
                const safeDesc = desc.replace(/'/g, "\\'").replace(/\n/g, "");
                const safePano = pano ? pano.replace(/'/g, "\\'") : '';
                const clickAction = safePano ? `openPanorama('${safePano}')` : `openModal('${safeName}', '${safeDesc}', '${imgPath}')`;

                const wrapper = document.createElement('div');
                wrapper.className = 'room-item fade-in';
                wrapper.innerHTML = `
                    <div class="r-img-wrap">
                        <img src="${imgPath}" class="r-img" onclick="${clickAction}" style="cursor:pointer;" draggable="false" loading="lazy" decoding="async" onerror="this.closest('.room-item')?.remove();">
                    </div>
                    <div class="r-info">
                        <h2 class="r-name">${name}</h2>
                        <a href="javascript:void(0)" class="btn view-btn" data-tooltip="360°ビューで見る" onclick="${clickAction}">VIEW</a>
                    </div>
                `;
                frag.appendChild(wrapper);
            }

            roomContainer.appendChild(frag);
        }

        // モーダル操作関数
        function openModal(title, desc, imgSrc) {
            document.getElementById('modal-title').textContent = title;
            document.getElementById('modal-desc').innerHTML = desc;
            document.getElementById('modal-img').src = imgSrc;
            document.getElementById('modal').classList.add('active');
        }
        function closeModal() {
            document.getElementById('modal').classList.remove('active');
        }

        // パノラマビューワー操作関数（Iframe版）
        function openPanorama(panoPath) {
            const overlay = document.getElementById('map-overlay');
            const iframe = document.getElementById('map-frame');
            
            // パスからファイル名を抽出 (例: "Map/images/part2/satsuki_out.jpg" -> "satsuki_out.jpg")
            const normalized = String(panoPath || '').trim().replace(/\\/g, '/');
            const mapRelative = normalized.startsWith('Map/') ? normalized.slice(4) : normalized;
            
            // iframeのsrcを設定してマップを開く（panoパラメータ付き）
            iframe.src = `Map/index.html?pano=${encodeURIComponent(mapRelative)}`;
            
            overlay.style.opacity = '1';
            overlay.style.pointerEvents = 'auto';
        }

        // パララックスエフェクト関数
        function initParallax() {
            const targets = document.getElementsByClassName('parallax-target');
            window.addEventListener('scroll', () => {
                const windowHeight = window.innerHeight;
                for (let i = 0; i < targets.length; i++) {
                    const rect = targets[i].parentElement.getBoundingClientRect();
                    if (rect.top < windowHeight && rect.bottom > 0) {
                        const speed = 0.15;
                        const offset = (windowHeight / 2 - (rect.top + rect.height / 2)) * speed;
                        targets[i].style.transform = `translateY(${offset}px) scale(1.1)`;
                    }
                }
            });
        }

        // 無限スライダー＆ドラッグスクロール機能
        function initInfiniteSlider() {
            const slider = document.getElementById('rooms');
            const items = Array.from(slider.children);
            if(items.length === 0) return;

            // コンテンツを複製して無限ループ用のバッファを作る
            // 3セット用意する（[Set1][Set2][Set3]）
            items.forEach(item => {
                const clone = item.cloneNode(true);
                slider.appendChild(clone);
            });
            items.forEach(item => {
                const clone = item.cloneNode(true);
                slider.appendChild(clone);
            });

            // 変数設定
            const baseSpeed = 1; // 自動スクロールの基本速度
            let isAutoScrolling = false; // デフォルトはOFF
            let velocity = 0; // 現在の速度（開始時は0）
            let isDragging = false;
            let lastPageX = 0;
            let lastScrollPos = 0;
            let lastTime = 0;
            let dragMoved = false;
            let dragStartX = 0;
            const isPointerCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

            // トグルボタンの設定
            const toggleBtn = document.getElementById('slider-toggle');
            function updateBtnState() {
                if(!toggleBtn) return;
                toggleBtn.textContent = isAutoScrolling ? "AUTO PLAY: ON" : "AUTO PLAY: OFF";
                if(isAutoScrolling) {
                    toggleBtn.classList.add('active');
                } else {
                    toggleBtn.classList.remove('active');
                }
            }
            if (toggleBtn) {
                updateBtnState();
                toggleBtn.addEventListener('click', () => {
                    isAutoScrolling = !isAutoScrolling;
                    updateBtnState();
                });
            }

            // 矢印ボタンの設定
            const arrowLeft = document.getElementById('arrow-left');
            const arrowRight = document.getElementById('arrow-right');
            
            // 矢印クリック時は、isDraggingをtrueにしたときと同様に一時的に加速させるなどの処理か、
            // scrollPosを直接ずらすのが簡単。
            // ただしスムーズに動かすためvelocityに干渉する
            if (arrowLeft) {
                arrowLeft.addEventListener('click', () => {
                    // 左へスクロール＝velocityを正に
                    velocity = 20; 
                });
            }
            if (arrowRight) {
                arrowRight.addEventListener('click', () => {
                    // 右へスクロール＝velocityを負に
                    velocity = -20;
                });
            }
            
            // 1セット分の幅を計算（アイテム幅 + マージン）
            // ※CSSで width: 300px, margin-right: 2rem (32px) としている前提
            const itemWidth = 300 + 32; 
            const totalWidth = itemWidth * items.length;

            // 初期位置を真ん中のセットの先頭に設定
            slider.scrollLeft = totalWidth;
            let scrollPos = totalWidth; // ★追加: 浮動小数点で位置を管理
            lastScrollPos = totalWidth;

            function step(timestamp) {
                if (!lastTime) lastTime = timestamp;
                const deltaTime = timestamp - lastTime;
                lastTime = timestamp;

                // 60FPSを基準としたタイムスケール (16.67ms = 1)
                // deltaTimeが大きすぎる場合（タブ切り替え復帰時など）は補正
                const timeScale = (deltaTime > 50) ? 1 : (deltaTime / 16.67);

                if (isDragging) {
                    // ドラッグ中は、移動量（速度）を計算して保持しておく
                    // ※mousemoveでscrollLeftが変わるので、その差分を速度とする
                    const currentPos = slider.scrollLeft;
                    scrollPos = currentPos; // ★同期
                    
                    // timeScaleで割ることで、フレームレートに依存しない速度(px/frame@60fps)に変換
                    if (timeScale > 0.1) {
                        velocity = (currentPos - lastScrollPos) / timeScale;
                    }
                    
                    // ループによる急激な変化を無視するための補正
                    // （ドラッグ中にループ境界をまたいだ場合、velocityが異常値になるのを防ぐ）
                    if (Math.abs(velocity) > totalWidth / 2) {
                        velocity = 0; // 境界またぎのフレームは速度計算をスキップ
                    }
                } else {
                    // ドラッグしていない時は、速度を加算して移動
                    // timeScaleを掛けて、実時間に基づいた移動量にする
                    scrollPos += velocity * timeScale;
                    slider.scrollLeft = scrollPos;
                    
                    // 摩擦処理：徐々に基本速度(baseSpeed)または0(停止)に戻す
                    // 慣性スクロールが終わると設定された状態(自動/停止)に戻る
                    const targetSpeed = isAutoScrolling ? baseSpeed : 0;
                    velocity += (targetSpeed - velocity) * 0.05 * timeScale;
                }
                
                // ループ処理：スクロール位置が範囲外に出たら巻き戻す
                // [Set1] [Set2] [Set3] のうち、Set2の範囲内に留める
                if (scrollPos >= totalWidth * 2) {
                    scrollPos -= totalWidth;
                    slider.scrollLeft = scrollPos;
                } else if (scrollPos <= 0) {
                    scrollPos += totalWidth;
                    slider.scrollLeft = scrollPos;
                }

                // 次のフレームのために位置を保存
                lastScrollPos = slider.scrollLeft;

                requestAnimationFrame(step);
            }
            requestAnimationFrame(step);

            // ドラッグ操作イベント
            slider.addEventListener('mousedown', (e) => {
                isDragging = true;
                slider.classList.add('active');
                lastPageX = e.pageX;
                velocity = 0; // 掴んだ瞬間は速度リセット
                dragMoved = false;
                dragStartX = e.pageX;
            });
            
            slider.addEventListener('mouseleave', () => {
                isDragging = false;
                slider.classList.remove('active');
                if (!isPointerCoarse) {
                    dragMoved = false;
                }
            });
            
            slider.addEventListener('mouseup', () => {
                isDragging = false;
                slider.classList.remove('active');
                if (!isPointerCoarse) {
                    dragMoved = false;
                }
            });
            
            slider.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                e.preventDefault();
                
                // マウスの移動量（delta）分だけスクロールさせる
                const delta = e.pageX - lastPageX;
                lastPageX = e.pageX;

                if (!isPointerCoarse && Math.abs(e.pageX - dragStartX) > 5) {
                    dragMoved = true;
                }
                
                // ドラッグ方向とスクロール方向は逆（左にドラッグすると右にスクロール）
                slider.scrollLeft -= delta; 
            });

            // PCのみ: ドラッグ後のクリックを無効化（画像・VIEWリンクの誤発火防止）
            slider.addEventListener('click', (e) => {
                if (isPointerCoarse) return;
                if (!dragMoved) return;
                e.preventDefault();
                e.stopImmediatePropagation();
                dragMoved = false;
            }, true);

            // タッチ操作イベント（スマホ対応）
            slider.addEventListener('touchstart', (e) => {
                isDragging = true;
                slider.classList.add('active');
                lastPageX = e.touches[0].pageX;
                velocity = 0;
            }, { passive: false });

            slider.addEventListener('touchend', () => {
                isDragging = false;
                slider.classList.remove('active');
            });

            slider.addEventListener('touchmove', (e) => {
                if (!isDragging) return;
                // スマホでのスワイプ操作と競合しないように preventDefault する
                // ※縦スクロールもブロックされるため、操作感によっては調整が必要
                e.preventDefault();
                
                const x = e.touches[0].pageX;
                const delta = x - lastPageX;
                lastPageX = x;
                
                slider.scrollLeft -= delta;
            }, { passive: false });
        }
