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
                    麗澤大学のキャンパスは、豊かな緑に囲まれ落ち着いた環境と、<br>
                    学生の挑戦を支える充実した施設設備がたくさんあります。<br>
                    自然にあふれるキャンパス内を全国で、どこでも体験できます！
                </p>
            `,
            
            // 各コンテンツ（部屋など）のデータ
            // image1.jpg が textData[0]、image2.jpg が textData[1]... に対応します
            textData: [
                { name: "「さつき」校舎", desc: "工学部の校舎。" },
                { name: "「かえで」校舎", desc: "経済学部、経営学部の校舎。" },
                { name: "「あすなろ」校舎", desc: "国際学部、外国語学部の校舎。" },
                { name: "研究棟", desc: "最先端の研究設備を備えた研究棟。" },
                { name: "図書館", desc: "豊富な本と快適な学習環境を提供する図書館。" },
                { name: "「ひいらぎ」食堂", desc: "学生の憩いの場である食堂。" },
            ]
        };

        // ★スライダー画像の最大枚数（imageフォルダの main1.jpg, main2.jpg ... を読み込みます）
        const MAX_HERO_IMAGES = 5;
        
        // ★リスト画像の最大枚数（imageフォルダの image1.jpg, image2.jpg ... を読み込みます）
        const MAX_ROOM_IMAGES = 18;

        /* ===============動作ロジック）================== */

        document.addEventListener('DOMContentLoaded', async () => {
            document.getElementById('brand').textContent = config.name;
            document.getElementById('hero-title').textContent = config.hero.title;
            document.getElementById('hero-sub').textContent = config.hero.sub;
            document.getElementById('concept-text').innerHTML = config.concept;

            // 1. ヒーロースライダー画像の動的生成
            const heroContainer = document.getElementById('hero-slider');
            let heroImageCount = 0;
            for (let i = 1; i <= MAX_HERO_IMAGES; i++) {
                const exists = await checkAndRenderHeroImage(i, heroContainer);
                if (exists) heroImageCount++;
            }
            if (heroImageCount > 0) {
                heroContainer.querySelector('.slide').classList.add('active');
            }

            // 2. 部屋画像の動的生成（高速化：並列処理に変更）
            const roomContainer = document.getElementById('rooms');
            const roomPromises = [];
            for (let i = 1; i <= MAX_ROOM_IMAGES; i++) {
                roomPromises.push(checkAndGetRoomHtml(i));
            }
            // 全画像の判定を並行して行い、完了を待つ
            const roomResults = await Promise.all(roomPromises);
            
            // 結果を順番に描画
            roomResults.forEach(html => {
                if(html) roomContainer.insertAdjacentHTML('beforeend', html);
            });

            // 無限スライダーの初期化
            initInfiniteSlider();

            // スライダーロジック
            const slides = document.querySelectorAll('.slide');
            if(slides.length > 1) {
                let current = 0;
                setInterval(() => {
                    slides[current].classList.remove('active');
                    current = (current + 1) % slides.length;
                    slides[current].classList.add('active');
                }, 3000);
            }

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

        // 画像存在チェック
        function imageExists(src) {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(true);
                img.onerror = () => resolve(false);
                img.src = src;
            });
        }

        // ヒーロー画像のレンダリング（既存維持）
        async function checkAndRenderHeroImage(index, container) {
            const imgPath = `image/main${index}.jpg`;
            const exists = await imageExists(imgPath);
            if (exists) {
                const div = document.createElement('div');
                div.className = 'slide';
                div.style.backgroundImage = `url('${imgPath}')`;
                container.insertBefore(div, container.querySelector('.hero-txt'));
                return true;
            }
            return false;
        }

        // 部屋画像のHTML生成（HTML文字列を返すように変更）
        async function checkAndGetRoomHtml(index) {
            const imgPath = `image/model${index}.png`;
            const exists = await imageExists(imgPath);
            
            if (exists) {
                const dataIndex = index - 1;
                const name = config.textData[dataIndex] ? config.textData[dataIndex].name : `Model ${index}`;
                const desc = config.textData[dataIndex] ? config.textData[dataIndex].desc : `Campus view ${index}`;
                const safeName = name.replace(/'/g, "\\'");
                const safeDesc = desc.replace(/'/g, "\\'").replace(/\n/g, "");

                return `
                    <div class="room-item fade-in">
                        <div class="r-img-wrap">
                            <img src="${imgPath}" class="r-img" onclick="openModal('${safeName}', '${safeDesc}', '${imgPath}')" style="cursor:pointer;">
                        </div>
                        <div class="r-info">
                            <h2 class="r-name">${name}</h2>
                            <a href="javascript:void(0)" class="btn" onclick="openModal('${safeName}', '${safeDesc}', '${imgPath}')">VIEW</a>
                        </div>
                    </div>
                `;
            }
            return null;
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
        document.getElementById('modal').addEventListener('click', function(e) {
            if (e.target === this) closeModal();
        });

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
            let velocity = baseSpeed; // 現在の速度
            let isDragging = false;
            let lastPageX = 0;
            let lastScrollPos = 0;
            
            // 1セット分の幅を計算（アイテム幅 + マージン）
            // ※CSSで width: 300px, margin-right: 2rem (32px) としている前提
            const itemWidth = 300 + 32; 
            const totalWidth = itemWidth * items.length;

            // 初期位置を真ん中のセットの先頭に設定
            slider.scrollLeft = totalWidth;
            lastScrollPos = totalWidth;

            function step() {
                if (isDragging) {
                    // ドラッグ中は、移動量（速度）を計算して保持しておく
                    // ※mousemoveでscrollLeftが変わるので、その差分を速度とする
                    const currentPos = slider.scrollLeft;
                    velocity = currentPos - lastScrollPos;
                    
                    // ループによる急激な変化を無視するための補正
                    // （ドラッグ中にループ境界をまたいだ場合、velocityが異常値になるのを防ぐ）
                    if (Math.abs(velocity) > totalWidth / 2) {
                        velocity = 0; // 境界またぎのフレームは速度計算をスキップ
                    }
                } else {
                    // ドラッグしていない時は、速度を加算して移動
                    slider.scrollLeft += velocity;
                    
                    // 摩擦処理：徐々に基本速度(baseSpeed)に戻す
                    // 慣性スクロールが終わると自動スクロールに戻る動き
                    velocity += (baseSpeed - velocity) * 0.05;
                }
                
                // ループ処理：スクロール位置が範囲外に出たら巻き戻す
                // [Set1] [Set2] [Set3] のうち、Set2の範囲内に留める
                if (slider.scrollLeft >= totalWidth * 2) {
                    slider.scrollLeft -= totalWidth;
                } else if (slider.scrollLeft <= 0) {
                    slider.scrollLeft += totalWidth;
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
            });
            
            slider.addEventListener('mouseleave', () => {
                isDragging = false;
                slider.classList.remove('active');
            });
            
            slider.addEventListener('mouseup', () => {
                isDragging = false;
                slider.classList.remove('active');
            });
            
            slider.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                e.preventDefault();
                
                // マウスの移動量（delta）分だけスクロールさせる
                const delta = e.pageX - lastPageX;
                lastPageX = e.pageX;
                
                // ドラッグ方向とスクロール方向は逆（左にドラッグすると右にスクロール）
                slider.scrollLeft -= delta; 
            });

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