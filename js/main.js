// main.js - 엔트리 포인트
(function () {
    'use strict';

    let canvas, ctx;
    let lastTime = 0;

    // 카메라 (FPS 시점)
    const camera = {
        x: 0,
        y: 1.5,
        z: 0,
        pitch: 0,
        yaw: 0,
        roll: 0, // 틸트 효과를 위한 roll 추가
        fov: Math.PI / 3
    };

    // 마우스 감도
    const mouseSensitivity = 0.002;

    // 키보드 입력 상태
    const keys = { w: false, a: false, s: false, d: false };

    // 입력 버퍼 (리듬/조작 메커니즘)
    const inputBuffer = [];
    const maxBufferSize = 10;

    // 리듬 및 판정 시스템
    const bpm = 120; // 120 Beats Per Minute
    const beatInterval = 60000 / bpm; // ms per beat (500ms)
    let nextBeatTime = performance.now() + beatInterval;
    
    let combo = 0;
    let lastJudgment = '';
    let judgmentTimer = 0;
    
    let baseSpeed = 0.1;
    let currentSpeed = baseSpeed;

    // 시각적 효과 업데이트 함수 (색온도, 화면 가장자리 글로우)
    function updateVisualEffects() {
        const canvasEl = document.getElementById('gameCanvas');
        const vignette = document.getElementById('vignette');
        
        if (!canvasEl || !vignette) return;
        
        // 콤보가 올라갈수록 0.0에서 1.0으로 증가 (최대 20 콤보)
        const intensity = Math.min(combo / 20, 1.0);
        
        // 필터 효과 보간 (Cold -> Golden)
        // Cold: sepia(0.3) hue-rotate(180deg) saturate(1.2)
        // Golden: sepia(0.8) hue-rotate(30deg) saturate(2.0)
        const sepia = 0.3 + intensity * 0.5;
        const hueRotate = 180 - intensity * 150;
        const saturate = 1.2 + intensity * 0.8;
        
        canvasEl.style.filter = `sepia(${sepia}) hue-rotate(${hueRotate}deg) saturate(${saturate})`;
        
        // 화면 가장자리 글로우 (Cold Cyan -> Golden Orange)
        // Cold: rgb(0, 255, 255)
        // Golden: rgb(255, 215, 0)
        const glowR = Math.floor(0 + intensity * 255);
        const glowG = Math.floor(255 + intensity * (215 - 255));
        const glowB = Math.floor(255 - intensity * 255);
        const glowAlpha = 0.1 + intensity * 0.4;
        
        vignette.style.boxShadow = `inset 0 0 ${150 + intensity * 100}px rgba(${glowR}, ${glowG}, ${glowB}, ${glowAlpha})`;
    }

    // 플레이어 이동 로직 (관성)
    const velocity = { x: 0, z: 0 };
    const acceleration = 0.05;
    const friction = 0.85;

    // 트랙 데이터 (3레인, 온레일)
    const track = {
        lanes: [-2, 0, 2],
        segmentLength: 5,
        renderDistance: 100 // z축 렌더링 거리
    };

    // 장애물(수비수) 데이터 구조 및 관리
    const obstacles = [];
    const obstacleSpawnRate = 30; // z축 거리당 생성 빈도
    let nextObstacleZ = 50; // 첫 장애물 생성 z위치

    // 3D 공간의 (X, Y, Z) 좌표를 2D 화면 좌표로 변환하는 원근 투영(Perspective Projection) 함수
    function project3DTo2D(p, width, height) {
        // 1. 카메라 이동 적용
        let dx = p.x - camera.x;
        let dy = p.y - camera.y;
        let dz = p.z - camera.z;

        // 2. 카메라 Yaw(좌우 회전, Y축 기준) 적용
        let cosYaw = Math.cos(camera.yaw);
        let sinYaw = Math.sin(camera.yaw);
        let rx = dx * cosYaw - dz * sinYaw;
        let rz = dx * sinYaw + dz * cosYaw;

        // 3. 카메라 Pitch(상하 회전, X축 기준) 적용
        let cosPitch = Math.cos(camera.pitch);
        let sinPitch = Math.sin(camera.pitch);
        let ry = dy * cosPitch - rz * sinPitch;
        let fz = dy * sinPitch + rz * cosPitch;

        // 카메라 뒤에 있는 점은 렌더링 불가 (Near clipping)
        if (fz < 0.1) return null;

        // 4. 원근 투영
        const fovScale = 1 / Math.tan(camera.fov / 2);
        
        let px = (rx / fz) * fovScale;
        let py = (ry / fz) * fovScale;

        // 카메라 Roll (Z축 회전/틸트) 적용
        const cosRoll = Math.cos(camera.roll);
        const sinRoll = Math.sin(camera.roll);
        const rolledPx = px * cosRoll - py * sinRoll;
        const rolledPy = px * sinRoll + py * cosRoll;

        // 5. 화면 중앙 기준 픽셀 좌표계로 변환
        return {
            x: width * 0.5 + rolledPx * height * 0.5,
            y: height * 0.5 - rolledPy * height * 0.5,
            scale: fovScale / fz
        };
    }

    // Pointer Lock API를 활용한 마우스 시야 회전 (Mouse Look)
    function onMouseMove(event) {
        camera.yaw -= event.movementX * mouseSensitivity;
        camera.pitch -= event.movementY * mouseSensitivity;

        // 위아래 고개 꺾임 제한 (-80도 ~ 80도 정도)
        const maxPitch = Math.PI / 2.2;
        if (camera.pitch > maxPitch) camera.pitch = maxPitch;
        if (camera.pitch < -maxPitch) camera.pitch = -maxPitch;
    }

    function onMouseClick(event) {
        if (document.pointerLockElement !== canvas) return;
        
        // event.button: 0 (LMB), 2 (RMB)
        const buttonType = event.button === 0 ? 'LMB' : (event.button === 2 ? 'RMB' : 'OTHER');
        if (buttonType === 'OTHER') return;

        const timestamp = performance.now();
        inputBuffer.push({ type: buttonType, time: timestamp });

        if (inputBuffer.length > maxBufferSize) {
            inputBuffer.shift();
        }
        
        // 판정 로직
        const prevBeatTime = nextBeatTime - beatInterval;
        const diffNext = Math.abs(nextBeatTime - timestamp);
        const diffPrev = Math.abs(prevBeatTime - timestamp);
        const closestDiff = Math.min(diffNext, diffPrev);
        
        // 판정 기준 (ms)
        const PERFECT = 50;
        const GREAT = 100;
        const GOOD = 150;
        
        if (closestDiff <= PERFECT) {
            lastJudgment = 'PERFECT';
            combo++;
            currentSpeed += 0.05; // 속도 증가
        } else if (closestDiff <= GREAT) {
            lastJudgment = 'GREAT';
            combo++;
            currentSpeed += 0.02;
        } else if (closestDiff <= GOOD) {
            lastJudgment = 'GOOD';
            combo = 0; // 콤보 초기화
            currentSpeed = baseSpeed;
        } else {
            lastJudgment = 'MISS';
            combo = 0;
            currentSpeed = baseSpeed * 0.5; // 속도 감소 페널티
        }
        
        judgmentTimer = 1000; // 1초간 텍스트 표시
        
        // 속도 상한 및 하한
        const maxSpeed = baseSpeed * 3;
        const minSpeed = 0.05;
        if (currentSpeed > maxSpeed) currentSpeed = maxSpeed;
        if (currentSpeed < minSpeed) currentSpeed = minSpeed;

        updateVisualEffects(); // 콤보 변화에 따른 시각적 효과 갱신

        console.log(`Input: ${buttonType}, Diff: ${closestDiff.toFixed(2)}ms, Judgment: ${lastJudgment}, Combo: ${combo}`);
    }

    function initPointerLock() {
        canvas.addEventListener('mousedown', (e) => {
            if (document.pointerLockElement !== canvas) {
                canvas.requestPointerLock();
            } else {
                onMouseClick(e);
            }
        });

        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement === canvas) {
                document.addEventListener('mousemove', onMouseMove, false);
            } else {
                document.removeEventListener('mousemove', onMouseMove, false);
            }
        });
    }

    function initKeyboard() {
        window.addEventListener('keydown', (e) => {
            if(e.code === 'KeyW' || e.code === 'ArrowUp') keys.w = true;
            if(e.code === 'KeyS' || e.code === 'ArrowDown') keys.s = true;
            if(e.code === 'KeyA' || e.code === 'ArrowLeft') keys.a = true;
            if(e.code === 'KeyD' || e.code === 'ArrowRight') keys.d = true;
        });

        window.addEventListener('keyup', (e) => {
            if(e.code === 'KeyW' || e.code === 'ArrowUp') keys.w = false;
            if(e.code === 'KeyS' || e.code === 'ArrowDown') keys.s = false;
            if(e.code === 'KeyA' || e.code === 'ArrowLeft') keys.a = false;
            if(e.code === 'KeyD' || e.code === 'ArrowRight') keys.d = false;
        });
    }

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function update(deltaTime) {
        // 리듬 타이머 업데이트
        const now = performance.now();
        if (now > nextBeatTime) {
            nextBeatTime += beatInterval;
        }
        
        if (judgmentTimer > 0) {
            judgmentTimer -= deltaTime;
        }

        // 카메라의 시선 방향 (yaw) 기준 전진/후진, 좌우 이동 벡터 계산
        let forwardX = -Math.sin(camera.yaw);
        let forwardZ = Math.cos(camera.yaw);
        
        let rightX = Math.cos(camera.yaw);
        let rightZ = Math.sin(camera.yaw);

        let inputX = 0;
        let inputZ = 0;

        if (keys.w) inputZ += 1;
        if (keys.s) inputZ -= 1;
        if (keys.a) inputX -= 1;
        if (keys.d) inputX += 1;

        // 대각선 이동 시 속도 정규화
        const length = Math.sqrt(inputX * inputX + inputZ * inputZ);
        if (length > 0) {
            inputX /= length;
            inputZ /= length;
        }

        // 가속도 적용 (시선 방향 기반)
        const accelX = (forwardX * inputZ + rightX * inputX) * acceleration;
        const accelZ = (forwardZ * inputZ + rightZ * inputX) * acceleration;

        velocity.x += accelX;
        velocity.z += accelZ;

        // 마찰력 (관성)
        velocity.x *= friction;
        velocity.z *= friction;

        // 카메라 위치 업데이트
        camera.x += velocity.x;
        camera.z += velocity.z + (currentSpeed * (deltaTime / 16.66));

        // 온레일 트랙 범위 이탈 방지 (-3 ~ 3)
        if (camera.x < -3) { camera.x = -3; velocity.x = 0; }
        if (camera.x > 3) { camera.x = 3; velocity.x = 0; }

        // 카메라 틸트(Roll) 효과 적용: 이동 방향(velocity.x) 및 마우스 회전(yaw 변화량)에 비례
        const targetRoll = -velocity.x * 0.05; 
        // 부드러운 틸트 복귀
        camera.roll += (targetRoll - camera.roll) * 0.1;

        // 장애물 생성 (플레이어 앞쪽으로 일정 거리마다 생성)
        if (camera.z + track.renderDistance > nextObstacleZ) {
            const laneIndex = Math.floor(Math.random() * track.lanes.length);
            obstacles.push({
                x: track.lanes[laneIndex],
                y: 0,
                z: nextObstacleZ,
                width: 1.5,
                height: 2.5,
                color: '#ff0055', // 장애물(수비수) 임시 색상
                passed: false // 충돌 여부 추적
            });
            nextObstacleZ += obstacleSpawnRate + Math.random() * 20;
        }

        // 장애물 충돌 판정
        for (let i = 0; i < obstacles.length; i++) {
            const obs = obstacles[i];
            if (!obs.passed) {
                // 플레이어가 장애물(Z좌표)을 지나가는 순간의 앞뒤 판정 (1.0 기준)
                const zDiff = camera.z - obs.z;
                if (Math.abs(zDiff) < 1.0) {
                    // X 좌표 (레인) 겹침 판정
                    if (Math.abs(camera.x - obs.x) < 1.2) {
                        obs.passed = true;
                        obs.color = '#550000'; // 충돌 시 색상 어둡게 변경
                        
                        // 패널티 적용
                        combo = 0;
                        currentSpeed = baseSpeed * 0.3; // 속도 대폭 감소
                        lastJudgment = 'CRASH!';
                        judgmentTimer = 1000;
                        updateVisualEffects(); // 패널티 시 글로우 효과 등 초기화
                    }
                } else if (zDiff > 1.0) {
                    // 장애물을 무사히 통과함
                    obs.passed = true;
                }
            }
        }

        // 지나친 장애물 메모리 해제
        while(obstacles.length > 0 && obstacles[0].z < camera.z - 10) {
            obstacles.shift();
        }
    }

    function draw() {
        // 화면 지우기 (배경)
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 다가오는 트랙(레일/그리드) 렌더링
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        
        // 현재 카메라 위치 기준으로 트랙 세그먼트 시작점 계산
        const startZ = Math.floor(camera.z / track.segmentLength) * track.segmentLength;
        const endZ = startZ + track.renderDistance;

        // 1. 세로선 (레일/레인)
        for (let laneX of track.lanes) {
            ctx.beginPath();
            let hasStarted = false;
            for (let z = startZ - track.segmentLength; z <= endZ; z += track.segmentLength) {
                const p = project3DTo2D({ x: laneX, y: 0, z: z }, canvas.width, canvas.height);
                if (p) {
                    if (!hasStarted) {
                        ctx.moveTo(p.x, p.y);
                        hasStarted = true;
                    } else {
                        ctx.lineTo(p.x, p.y);
                    }
                }
            }
            if (hasStarted) ctx.stroke();
        }

        // 2. 가로선 (세그먼트 구분선)
        for (let z = startZ - track.segmentLength; z <= endZ; z += track.segmentLength) {
            const pLeft = project3DTo2D({ x: track.lanes[0], y: 0, z: z }, canvas.width, canvas.height);
            const pRight = project3DTo2D({ x: track.lanes[track.lanes.length - 1], y: 0, z: z }, canvas.width, canvas.height);
            
            if (pLeft && pRight) {
                ctx.beginPath();
                ctx.moveTo(pLeft.x, pLeft.y);
                ctx.lineTo(pRight.x, pRight.y);
                ctx.stroke();
            }
        }

        // 3. 장애물 렌더링 (Z축 기준 정렬 후 그리기 - 멀리 있는 것부터)
        // 화면에 보일 장애물만 필터링 후 복사하여 정렬
        const visibleObstacles = obstacles.filter(obs => obs.z >= camera.z && obs.z <= endZ);
        visibleObstacles.sort((a, b) => b.z - a.z); // 내림차순 (멀리 있는 것 먼저 렌더링)

        for (let obs of visibleObstacles) {
            const pBottom = project3DTo2D({ x: obs.x, y: obs.y, z: obs.z }, canvas.width, canvas.height);
            const pTop = project3DTo2D({ x: obs.x, y: obs.y + obs.height, z: obs.z }, canvas.width, canvas.height);
            
            if (pBottom && pTop) {
                // 너비는 원근감(scale)에 비례
                // 기본 해상도 스케일링을 위해 500 곱함 (조정 가능)
                const w = obs.width * 500 * pBottom.scale;
                const h = pBottom.y - pTop.y;
                
                ctx.fillStyle = obs.color;
                ctx.globalAlpha = 0.8;
                ctx.fillRect(pTop.x - w / 2, pTop.y, w, h);
                
                // 테두리
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.strokeRect(pTop.x - w / 2, pTop.y, w, h);
                ctx.globalAlpha = 1.0;
            }
        }

        // 4. UI / HUD 렌더링 (2D 오버레이)
        drawHUD();
    }

    function drawHUD() {
        ctx.save();
        
        // 콤보 표시
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`COMBO: ${combo}`, 20, 40);
        ctx.fillText(`SPEED: ${currentSpeed.toFixed(2)}`, 20, 70);

        // 판정 결과 표시 (가운데 상단, 페이드 아웃 효과)
        if (judgmentTimer > 0) {
            const alpha = Math.min(1, judgmentTimer / 500); // 서서히 사라짐
            ctx.globalAlpha = alpha;
            
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center';
            
            let color = '#fff';
            if (lastJudgment === 'PERFECT') color = '#00ffff';
            else if (lastJudgment === 'GREAT') color = '#00ff00';
            else if (lastJudgment === 'GOOD') color = '#ffff00';
            else if (lastJudgment === 'MISS' || lastJudgment === 'CRASH!') color = '#ff0000';
            
            ctx.fillStyle = color;
            ctx.fillText(lastJudgment, canvas.width / 2, canvas.height / 3);
            
            // 콤보 애니메이션 효과
            if (combo > 1) {
                ctx.font = 'bold 20px Arial';
                ctx.fillStyle = '#fff';
                ctx.fillText(`${combo} COMBO!`, canvas.width / 2, canvas.height / 3 + 40);
            }
        }
        
        ctx.restore();
    }

    function gameLoop(timestamp) {
        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;

        update(deltaTime);
        draw();

        requestAnimationFrame(gameLoop);
    }

    function init() {
        console.log('ZeroBaek 게임 초기화');
        canvas = document.getElementById('gameCanvas');
        ctx = canvas.getContext('2d');

        // 마우스 우클릭 컨텍스트 메뉴 방지 (RMB 인식용)
        window.addEventListener('contextmenu', e => e.preventDefault());

        // 이벤트 리스너 등록
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        initPointerLock();
        initKeyboard();

        // 메인 게임 루프 시작
        requestAnimationFrame((timestamp) => {
            lastTime = timestamp;
            gameLoop(timestamp);
        });
    }

    // DOM 로드 완료 후 초기화
    window.addEventListener('DOMContentLoaded', init);
})();