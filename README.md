# LH Plan Lab

LH 공공임대주택 법규검토와 개략 건축규모 산정을 한 흐름으로 연결한 Next.js 애플리케이션입니다.

## 실행

Node.js 20.9 이상이 필요합니다.

- Windows: `start-windows.bat` 실행
- macOS/Linux: 터미널에서 `bash start-macos-linux.sh` 실행

또는 다음 명령을 직접 실행합니다.

```bash
NPM_CONFIG_CACHE=/tmp/jaehyun-npm npm ci --no-audit --no-fund
npm run dev
```

브라우저에서 `http://127.0.0.1:3000`을 엽니다.

## 검증

```bash
npm test
npm run typecheck
npm run build
```

## 구현 범위

- 사업·주소·대지·법규 계획값 입력 및 실시간 재계산
- 공동주택 46㎡/75%와 오피스텔 25㎡/45%의 4개 주차 대안
- 건폐율·용적률·높이·부대시설·주차를 반영한 독립 계산 엔진
- 법적 확정값, 사용자 입력값, 확인 필요값의 상태 분리
- 조건부 0.3대 특례 및 기계식주차 불가 시 안전한 대체 계산
- 프로젝트/버전 브라우저 저장, JSON·Excel용 CSV·인쇄/PDF 출력
- VWorld 주소 API 서버 연동 및 키 미설정 시 실패 안전 응답
- 문서 업로드 메타데이터 등록과 외부 분석 연동 필요 상태 표시

## 외부 연동

주소 자동조회에는 환경변수 `VWORLD_API_KEY`가 필요합니다. 키가 없어도 수동 입력과 모든 계산 기능은 동작합니다.

현 단계에서는 지자체 조례, 지구단위계획, LH 최신 공고 및 PDF 본문을 자동 확정 판정하지 않습니다. 원문을 확보하지 못한 항목은 화면에서 `자료 미확보` 또는 `검토 필요`로 유지합니다.
