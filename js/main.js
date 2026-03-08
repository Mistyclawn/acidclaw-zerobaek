// main.js - 엔트리 포인트
(function () {
    'use strict';

    let canvas, ctx;
    let lastTime = 0;

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

        // 메인 게임 루프 시작
        requestAnimationFrame((timestamp) => {
            lastTime = timestamp;
            gameLoop(timestamp);
        });
    }

    // DOM 로드 완료 후 초기화 시작
    window.addEventListener('DOMContentLoaded', init);
})();
