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
        fov: Math.PI / 3
    };

    // 마우스 감도
    const mouseSensitivity = 0.002;

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
        
        // 종횡비 반영 없이 화면의 짧은 쪽 기준으로 스케일링하거나 높이 기준으로 통일
        const px = (rx / fz) * fovScale;
        const py = (ry / fz) * fovScale;

        // 5. 화면 중앙 기준 픽셀 좌표계로 변환
        return {
            x: width * 0.5 + px * height * 0.5,
            y: height * 0.5 - py * height * 0.5,
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

    function initPointerLock() {
        canvas.addEventListener('click', () => {
            if (document.pointerLockElement !== canvas) {
                canvas.requestPointerLock();
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

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        // 해상도 변경 시 필요한 추가 처리 로직
    }

    function update(deltaTime) {
        // 게임 상태 업데이트 로직 (사용자 입력 처리, 이동, 등)
    }

    function draw() {
        // 화면 지우기
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 그리기 로직 (테스트용 등)
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 테스트를 위해 투영된 좌표에 점 하나 그리기 (임시)
        const testPoint = project3DTo2D({ x: 0, y: 1.5, z: 5 }, canvas.width, canvas.height);
        if (testPoint) {
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(testPoint.x, testPoint.y, 15 * testPoint.scale, 0, Math.PI * 2);
            ctx.fill();
        }
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

        // 윈도우 리사이즈 이벤트 등록
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas(); // 초기 크기 설정

        // 마우스 시야 회전(Pointer Lock) 초기화
        initPointerLock();

        // 메인 게임 루프 시작
        requestAnimationFrame((timestamp) => {
            lastTime = timestamp;
            gameLoop(timestamp);
        });
    }

    // DOM 로드 완료 후 초기화 시작
    window.addEventListener('DOMContentLoaded', init);
})();