# 풍속의 밤 프로토타입

숲 콘셉트 주점을 위에서 내려다보는 3D 장면. three.js r160, 빌드는 esbuild.

## 로컬 실행
npm install
npm run build      # dist/index.html 한 파일로 묶는다
dist/index.html 을 브라우저로 연다

## 배포 (Vercel)
GitHub 저장소를 Vercel 에 연결하면 vercel.json 설정대로
npm install → npm run build → dist 폴더를 올린다.

## 친구들과 같이 놀기
- Supabase 무료 프로젝트를 만들고 Project URL 과 anon(public) 키를
  Vercel 환경 변수 SUPABASE_URL, SUPABASE_ANON_KEY 에 넣고 다시 배포한다
- 접속하면 주소 끝에 #방코드 가 붙는다. 이 주소(초대 링크)를 받은 사람만 같은 방에 들어온다
- 설정이 없으면 가짜 손님과 혼자 노는 데모로 빌드된다
- 키 없이 시험하려면 주소에 ?local 을 붙여 같은 브라우저의 탭 두 개로 열면 탭끼리 같이 논다

## 파일
- src/main.js      장면 조립, 손님 행동, 버튼, 누르기, 카메라, 수다방, 같이 놀기
- src/net.js       Supabase Realtime(또는 ?local 탭 간) 메시지 주고받기
- src/games.js     술게임(복불복, 업다운, 369) 진행
- src/looks.js     캐릭터 꾸미기 선택지
- src/titles.js    오늘의 기록과 칭호
- src/world.js     바닥, 잎 벽, 바, 테이블, 조명, 반딧불
- src/person.js    2등신 캐릭터와 동작
- src/dishes.js    안주와 술병
- src/sound.js     합성 소리
- src/particles.js 반딧불, 김, 반짝임
- src/path.js      테이블을 돌아가는 길 찾기
- src/merge.js     안 움직이는 물건 합치기
- template.html    화면 UI

주소에 ?debug 를 붙이면 window.__pungsok 로 상태를 볼 수 있다.
