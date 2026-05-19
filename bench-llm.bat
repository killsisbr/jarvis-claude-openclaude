@echo off
setlocal enabledelayedexpansion

REM LLM Benchmark for NVIDIA NIM models
REM Usage: bench-llm.bat [iterations] [prompt]

set "ROOT=%~dp0"
set "ITERATIONS=%~1"
if not defined ITERATIONS set "ITERATIONS=5"
set "PROMPT=%~2"
if not defined PROMPT set "PROMPT=Write a 4-line poem about artificial intelligence. Only the poem, no explanations."

REM Load NVIDIA key
for /f "tokens=*" %%a in ('findstr /i "NVIDIA_API_KEY" "%ROOT%.env" 2^>nul') do set "%%a"

if not defined NVIDIA_API_KEY (
    echo [bench] NVIDIA_API_KEY not found in .env
    exit /b 1
)

REM Strip any hidden chars from key
set "NVIDIA_API_KEY=%NVIDIA_API_KEY: =%"

set "OUTFILE=%ROOT%bench-results.txt"
echo LLM Benchmark Report > "%OUTFILE%"
echo Date: %DATE% %TIME% >> "%OUTFILE%"
echo Iterations per model: %ITERATIONS% >> "%OUTFILE%"
echo Prompt: "%PROMPT%" >> "%OUTFILE%"
echo. >> "%OUTFILE%"
echo ======================================== >> "%OUTFILE%"
echo. >> "%OUTFILE%"

set "MODELS[1]=qwen/qwen3-coder-480b-a35b-instruct;Qwen Coder 480B"
set "MODELS[2]=qwen/qwen3.5-397b-a17b;Qwen 3.5 397B"
set "MODELS[3]=qwen/qwen3-next-80b-a3b-instruct;Qwen Next 80B"
set "MODELS[4]=deepseek-ai/deepseek-v4-flash;DeepSeek V4 Flash"
set "MODELS[5]=deepseek-ai/deepseek-v4-pro;DeepSeek V4 Pro"
set "MODELS[6]=minimaxai/minimax-m2.7;MiniMax M2.7"
set "MODELS[7]=mistralai/mistral-large-3-675b-instruct;Mistral Large 3 675B"
set "MODELS[8]=nvidia/nemotron-ultra-253b;Nemotron Ultra 253B"

set "TOTAL_MODELS=8"
set "TOTAL_TTFB=0"
set "TOTAL_LATENCY=0"
set "TOTAL_COUNT=0"

for /l %%m in (1,1,%TOTAL_MODELS%) do (
    for /f "tokens=1,* delims=;" %%a in ("!MODELS[%%m]!") do (
        set "MODEL_ID=%%a"
        set "MODEL_NAME=%%b"
    )

    echo Testing !MODEL_NAME! ^(!MODEL_ID!^)...
    set "SUM_TTFB=0"
    set "SUM_LAT=0"
    set "ERR=0"

    for /l %%i in (1,1,%ITERATIONS%) do (
        set "START=!TIME!"

        REM Create temp JSON body
        >"%TEMP%\bench-payload.json" echo {"model":"!MODEL_ID!","messages":[{"role":"user","content":"%PROMPT%"}],"max_tokens":100,"stream":true}

        set "TTFB="
        set "LAT="
        set "CHUNK_TIME="

        REM Stream and parse SSE for timing
        set "BODY="
        set "FIRST_CHUNK="
        set "T1="
        set "T2="

        for /f "usebackq delims=" %%r in (`curl -s -N --max-time 120 -X POST "https://integrate.api.nvidia.com/v1/chat/completions" -H "Authorization: Bearer %NVIDIA_API_KEY%" -H "Content-Type: application/json" -d @"%TEMP%\bench-payload.json" 2^>nul`) do (
            set "LINE=%%r"
            if "!LINE:~0,6!"=="data: " (
                set "CONTENT=!LINE:~6!"
                if "!CONTENT!"=="[DONE]" goto :done_%%m_%%i
                if not defined T1 (
                    set "T1=!TIME!"
                    for /f "tokens=1-4 delims=:.," %%a in ("!T1!") do (
                        set /a "T1_MS=(((%%a*60)+%%b)*60+%%c)*1000+%%d"
                    )
                )
                set "BODY=!CONTENT!"
            )
        )
        :done_%%m_%%i

        set "T2=!TIME!"
        for /f "tokens=1-4 delims=:.," %%a in ("!T2!") do (
            set /a "T2_MS=(((%%a*60)+%%b)*60+%%c)*1000+%%d"
        )

        if defined T1 (
            set /a "TTFB_MS=T1_MS"
            set /a "LAT_MS=T2_MS"
            REM Handle wraparound (unlikely but safe)
            if !TTFB_MS! lss 0 set /a "TTFB_MS+=86400000"
            if !LAT_MS! lss 0 set /a "LAT_MS+=86400000"

            set /a "TTFB=!TTFB_MS!"
            set /a "LATENCY=!LAT_MS!-!TTFB_MS!"
            if !LATENCY! lss 0 set /a "LATENCY+=86400000"

            set /a "SUM_TTFB+=!TTFB!"
            set /a "SUM_LAT+=!LATENCY!"

            echo  [%%i] TTFB=!TTFB!ms Total=!LATENCY!ms
        ) else (
            set /a "ERR+=1"
            echo  [%%i] FAILED (no response)
        )
    )

    REM Calculate averages
    set /a "VALID=%ITERATIONS%-!ERR!"
    if !VALID! gtr 0 (
        set /a "AVG_TTFB=!SUM_TTFB!/!VALID!"
        set /a "AVG_LAT=!SUM_LAT!/!VALID!"
        set /a "TOTAL_TTFB+=!AVG_TTFB!"
        set /a "TOTAL_LATENCY+=!AVG_LAT!"
        set /a "TOTAL_COUNT+=1"
    )

    echo !MODEL_NAME! (T4=TTFB/Avg=%VALID% ok, !ERR! err) >> "%OUTFILE%"
    if !VALID! gtr 0 (
        echo   TTFB  avg: !AVG_TTFB!ms >> "%OUTFILE%"
        echo   Total avg: !AVG_LAT!ms >> "%OUTFILE%"
        set "SCORE_RANK[%%m]=!AVG_LAT!"
        set "SCORE_NAME[%%m]=!MODEL_NAME!"
    ) else (
        echo   ALL FAILED >> "%OUTFILE%"
        set "SCORE_RANK[%%m]=99999"
        set "SCORE_NAME[%%m]=!MODEL_NAME! (FAIL)"
    )
    echo. >> "%OUTFILE%"

    echo Done
    echo.
)

REM Ranking
echo. >> "%OUTFILE%"
echo ======================================== >> "%OUTFILE%"
echo RANKING BY SPEED >> "%OUTFILE%"
echo ======================================== >> "%OUTFILE%"

for /l %%i in (1,1,%TOTAL_MODELS%) do set "RANKED=%%i"
REM Bubble sort by latency
for /l %%i in (1,1,%TOTAL_MODELS%) do (
    for /l %%j in (1,1,%TOTAL_MODELS%) do (
        set /a "NEXT=%%j+1"
        if !NEXT! leq %TOTAL_MODELS% (
            for /f %%a in ("!NEXT!") do (
                if !SCORE_RANK[%%j]! gtr !SCORE_RANK[%%a]! (
                    set "TMP=!SCORE_RANK[%%j]!"
                    set "SCORE_RANK[%%j]=!SCORE_RANK[%%a]!"
                    set "SCORE_RANK[%%a]=!TMP!"
                    set "TMP=!SCORE_NAME[%%j]!"
                    set "SCORE_NAME[%%j]=!SCORE_NAME[%%a]!"
                    set "SCORE_NAME[%%a]=!TMP!"
                )
            )
        )
    )
)

set "POS=1"
for /l %%i in (1,1,%TOTAL_MODELS%) do (
    if not "!SCORE_RANK[%%i]!"=="99999" (
        echo !POS!. !SCORE_NAME[%%i]! - !SCORE_RANK[%%i]!ms >> "%OUTFILE%"
        set /a "POS+=1"
    )
)
for /l %%i in (1,1,%TOTAL_MODELS%) do (
    if "!SCORE_RANK[%%i]!"=="99999" (
        echo !POS!. !SCORE_NAME[%%i]! >> "%OUTFILE%"
        set /a "POS+=1"
    )
)

echo. >> "%OUTFILE%"
echo Results saved to %OUTFILE%
type "%OUTFILE%"
