// main.js - 엔트리 포인트
(function () {
    'use strict';

    function init() {
        console.log('ZeroBaek 게임 초기화');
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');

        // 리사이즈 핸들러 등은 이후 구현
    }

    // DOM 로드 완료 후 초기화
    window.addEventListener('DOMContentLoaded', init);
})();
