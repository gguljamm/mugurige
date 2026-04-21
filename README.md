# Mugurige MVP

React + Firebase 기반의 그림 파티게임 플랫폼 MVP입니다. 현재 릴레이 모드 중심으로 구성되어 있고, Firebase 설정이 없을 때도 로컬 프리뷰 모드로 UI와 게임 흐름을 확인할 수 있습니다.

## 포함된 기능

- 한국어 우선 랜딩 + 모드 선택 화면
- 릴레이 모드 중심의 방 생성 / 초대 코드 입장 흐름
- 실시간 채팅 UI
- 텔레스트레이션 스타일 라운드 진행
- AI 참가자 추가 및 크레딧 차감 UX
- Firebase Auth / Firestore / Storage / Cloud Functions 스캐폴드
- Firestore / Storage 보안 규칙 초안

## 시작 방법

```bash
npm install
npm run dev
```

Firebase를 붙이려면 `.env.example`를 참고해서 `.env`를 채운 뒤 사용하면 됩니다.
